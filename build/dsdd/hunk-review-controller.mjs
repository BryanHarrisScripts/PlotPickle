import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runPortableCommand } from "../../scripts/pi-worker-runtime.mjs";

const REPOSITORY = "BryanHarrisScripts/PlotPickle";
const bridge = fileURLToPath(new URL("../../scripts/pi/hunk-review-terminal.ps1", import.meta.url));

export function hunkAgentContext(notes) {
  if (notes === undefined) return null;
  if (!Array.isArray(notes) || notes.length > 30) throw new Error("Review notes exceed the supported bound.");
  const files = new Map();
  for (const note of notes) {
    if (!note || typeof note !== "object" || Object.keys(note).some(key => !["filePath", "newLine", "summary"].includes(key))) throw new Error("Invalid review note.");
    if (typeof note.filePath !== "string" || note.filePath.length > 300 || !/^[A-Za-z0-9_. /-]+$/u.test(note.filePath)
      || note.filePath.split("/").some(part => !part || part === "." || part === "..") || path.posix.isAbsolute(note.filePath)) throw new Error("Choose a relative reviewed file.");
    if (!Number.isSafeInteger(note.newLine) || note.newLine < 1 || note.newLine > 1_000_000 || typeof note.summary !== "string" || !note.summary.trim() || note.summary.length > 2000) throw new Error("Invalid review note anchor or summary.");
    const file = files.get(note.filePath) || { path: note.filePath, annotations: [] };
    file.annotations.push({ newRange: [note.newLine, note.newLine], summary: note.summary, source: "agent", author: "PlotPickle agent" });
    files.set(note.filePath, file);
  }
  return { version: 1, summary: "Advisory review notes; no permission to apply or merge changes.", files: [...files.values()] };
}

export function hunkReviewArguments(target) {
  if (!target || typeof target !== "object" || Array.isArray(target)) throw new Error("Choose a valid review target.");
  if (Object.keys(target).some(key => !["kind", "number"].includes(key))) throw new Error("Review target contains unsupported fields.");
  if (target.kind === "working-tree" && target.number === undefined) return ["--no-extensions", "diff"];
  if (target.kind === "pull-request" && Number.isSafeInteger(target.number) && target.number > 0 && target.number <= 2_147_483_647) {
    return ["--no-extensions", "gh", "pr", String(target.number), "--repo", REPOSITORY];
  }
  throw new Error("Choose the current changes or a positive PlotPickle pull request number.");
}

export class HunkReviewController {
  #reviews = new Map();
  #starting = new Set();
  constructor({ repositoryRoot = process.cwd(), platform = process.platform, run = runPortableCommand } = {}) {
    this.root = path.resolve(repositoryRoot); this.platform = platform; this.run = run;
  }
  async command() {
    const result = await this.run(this.platform === "win32" ? "where.exe" : "which", ["hunk"], { timeout: 5000 });
    const command = result.stdout.split(/\r?\n/u).map(line => line.trim()).find(candidate =>
      path[this.platform === "win32" ? "win32" : "posix"].isAbsolute(candidate)
      && (this.platform !== "win32" || /\.(?:exe|com|cmd|bat)$/iu.test(candidate)));
    if (!command) throw new Error("Hunk is not installed. Install Hunk with npm or mise, then retry.");
    const version = await this.run(command, ["--version"], { timeout: 5000 });
    if (!/\b0\.23\.\d+\b/u.test(version.stdout)) throw new Error("This adapter requires reviewed Hunk 0.23.x.");
    return command;
  }
  async capabilities() {
    if (this.platform !== "win32") return { state: "unavailable", message: "Native Hunk review requires the Windows local application. No browser review adapter is configured." };
    try { await this.command(); return { state: "ready", message: "Native Hunk review is available; inline agent annotations stay advisory." }; }
    catch { return { state: "unavailable", message: "Hunk is unavailable or incompatible. Install Hunk 0.23.x, then retry. No tool is installed automatically." }; }
  }
  async start(profileId, target, notes) {
    if (!profileId) throw new Error("Unlock a profile before reviewing changes.");
    const args = hunkReviewArguments(target);
    const agentContext = hunkAgentContext(notes);
    if (this.platform !== "win32") throw new Error("Native Hunk review requires Windows.");
    const existing = [...this.#reviews.values()].find(review => review.owner === profileId && review.state === "running");
    if (existing || this.#starting.has(profileId)) throw new Error("Close or cancel the current review before opening another.");
    this.#starting.add(profileId);
    let notesDirectory;
    try {
    const command = await this.command();
    let notesPath;
    if (agentContext?.files.length) {
      notesDirectory = await mkdtemp(path.join(tmpdir(), "plotpickle-review-"));
      notesPath = path.join(notesDirectory, "agent-context.json");
      await writeFile(notesPath, JSON.stringify(agentContext), { mode: 0o600 });
    }
    const result = await this.run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", bridge,
      "-Action", "Start", "-HunkCommand", command, "-RepositoryRoot", this.root,
      ...(target.kind === "pull-request" ? ["-PullRequest", String(target.number)] : []),
      ...(notesPath ? ["-AgentContext", notesPath] : [])], { timeout: 15_000 });
    const process = JSON.parse(result.stdout);
    if (!Number.isSafeInteger(process.pid) || process.pid <= 0 || !/^\d+$/u.test(process.startTicks)) throw new Error("Hunk launch returned invalid process ownership evidence.");
    const review = { id: randomUUID(), owner: profileId, pid: process.pid, startTicks: process.startTicks, state: "running", target: structuredClone(target), args, notesDirectory, agentNotes: agentContext?.files.reduce((total, file) => total + file.annotations.length, 0) || 0 };
    for (const [id, previous] of this.#reviews) if (previous.owner === profileId && previous.state !== "running") this.#reviews.delete(id);
    this.#reviews.set(review.id, review);
    notesDirectory = undefined; // The owned review now retains its sidecar.
    return this.view(review);
    } finally { this.#starting.delete(profileId); if (notesDirectory) await rm(notesDirectory, { recursive: true, force: true }); }
  }
  async current(profileId) {
    const review = [...this.#reviews.values()].find(item => item.owner === profileId && item.state === "running");
    if (!review) return null;
    const result = await this.run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", bridge,
      "-Action", "Status", "-OwnedPid", String(review.pid), "-OwnedStartTicks", review.startTicks], { timeout: 5000 });
    const status = JSON.parse(result.stdout);
    if (typeof status.running !== "boolean") throw new Error("Invalid review process status.");
    if (!status.running) { review.state = "closed"; if (review.notesDirectory) await rm(review.notesDirectory, { recursive: true, force: true }); }
    return this.view(review);
  }
  async cancel(profileId, id) {
    const review = this.#reviews.get(id);
    if (!review || review.owner !== profileId) throw new Error("Review not found for this profile.");
    if (review.state !== "running") return this.view(review);
    await this.run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", bridge,
      "-Action", "Stop", "-OwnedPid", String(review.pid), "-OwnedStartTicks", review.startTicks], { timeout: 15_000 });
    review.state = "cancelled";
    if (review.notesDirectory) await rm(review.notesDirectory, { recursive: true, force: true });
    return this.view(review);
  }
  view(review) { return { id: review.id, state: review.state, target: review.target, agentNotes: review.agentNotes, adapter: "windows-native-terminal", repositoryMutation: false, mergeAuthority: false }; }
}
