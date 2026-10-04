import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, stop } from "esbuild";
import { HunkReviewController } from "../build/dsdd/hunk-review-controller.mjs";
import { clearDsddConversation } from "./dsdd-pi-session.mjs";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";
import { runPortableCommand } from "./pi-worker-runtime.mjs";
import { ensureVerificationTools } from "./run-webmcp-startup-uat.mjs";
import { createVerificationSyntheticProfile, authenticateVerificationSyntheticProfile } from "./full-verification-auth.mjs";
import { createBrowserVerificationSession } from "../lib/verification/browser-verification-broker.mjs";

assert.equal(process.platform, "win32", "This product proof requires native Windows.");
const root = path.resolve(".artifacts/settings-command-2717");
await mkdir(root, { recursive: true });
const temporary = await mkdtemp(path.join(root, "runtime-"));
const home = path.join(temporary, "home");
const base = "http://127.0.0.1:4173";
let server, browser, review, controller;
const output = [];
let error, page, report;
let commandClearVerified = false;
async function waitFor(check, label, timeout = 180_000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    if (server && server.exitCode !== null) throw new Error(`Server exited before ${label}.`);
    try { if (await check()) return; } catch (caught) { last = caught; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${label}. ${last?.message || ""}`);
}
try {
  const managed = await ensureManagedPiInstalled({ root: path.join(temporary, "managed-pi") });
  assert.equal(managed.version, "1.0.1");
  const { SessionManager } = await import(pathToFileURL(path.join(managed.root, "node_modules/@earendil-works/pi-coding-agent/dist/index.js")).href);
  const audit = SessionManager.create(process.cwd(), path.join(temporary, "clear-session"));
  const humanId = audit.appendMessage({ role: "user", content: "Synthetic old narration", timestamp: Date.now() });
  audit.appendMessage({ role: "assistant", content: "Synthetic old interpretation", timestamp: Date.now() });
  audit.appendCustomEntry("plotpickle-dsdd-github-issue-publication", { intentVersion: 1, publication: { number: 123 } });
  const rawBefore = structuredClone(audit.getEntries());
  clearDsddConversation(audit);
  assert.deepEqual(audit.getEntries().slice(0, rawBefore.length), rawBefore, "Clearing preserves immutable Pi provenance");
  assert.equal(audit.buildSessionProjection().messages.length, 0);
  const reopened = SessionManager.open(audit.getSessionFile(), path.join(temporary, "clear-session"), process.cwd());
  assert.equal(reopened.buildSessionProjection().messages.length, 0, "Cleared context survives reopening");
  assert.ok(reopened.getEntries().some(entry => entry.id === humanId));
  assert.ok(reopened.getEntries().some(entry => entry.customType === "plotpickle-dsdd-github-issue-publication"));
  const compiled = path.join(temporary, "project.mjs");
  await build({ stdin: { contents: 'export { normalizeLibraryProject } from "./core/storage/library-project.ts";', loader: "ts", resolveDir: process.cwd() }, bundle: true, platform: "node", format: "esm", outfile: compiled, logLevel: "silent" });
  stop();
  const { normalizeLibraryProject } = await import(pathToFileURL(compiled).href);
  server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", "4173", "--strictPort"], { env: { ...process.env, PLOTPICKLE_HOME: home, PLOTPICKLE_AUTH_STATE_PATH: path.join(home, "auth/state.json"), PLOTPICKLE_STARTUP_TESTING_MODE: "normal", PLOTPICKLE_ACCESS_MODE: "desktop-loopback", PLOTPICKLE_SERVER_NETWORK_ENABLED: "false" }, stdio: ["ignore", "pipe", "pipe"] });
  server.on("error", caught => { error = caught; });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", chunk => { output.push(String(chunk)); if (output.length > 1000) output.shift(); });
  await waitFor(async () => { if (error) throw error; return (await fetch(`${base}/api/auth/profile`, { signal: AbortSignal.timeout(1000) })).ok; }, "normal host readiness");
  const profile = await createVerificationSyntheticProfile({ baseUrl: base, home });
  const session = await authenticateVerificationSyntheticProfile({ baseUrl: base, ...profile });
  const headers = { Cookie: session.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE, Origin: base, "X-PlotPickle-CSRF": session.environment.PLOTPICKLE_VERIFICATION_AUTH_CSRF, "Content-Type": "application/json" };
  const api = async (pathname, body) => { const response = await fetch(base + pathname, { method: body ? "POST" : "GET", headers, ...(body ? { body: JSON.stringify(body) } : {}) }); const result = await response.json(); assert.ok(response.ok, `${pathname}: ${response.status} ${result.message || ""}`); return result; };
  const project = normalizeLibraryProject({ id: "synthetic-command-2717", title: "Synthetic Command Continuity" });
  await api("/api/auth/profile-private", { action: "save-project", project, activate: true });
  const original = await api("/api/auth/profile-private");
  assert.equal(original.project.id, project.id);
  const firstSession = (await api("/api/dsdd/command")).session;
  assert.equal(firstSession.conversation.length, 0);
  await api("/api/dsdd/command", { action: "append-human", text: "mindmap and worldmap have two identical titles and back selections at the header" });
  await api("/api/dsdd/command", { action: "append-interpretation", text: "Mind Map and World Map show duplicate headings and return controls. Keep one heading and one return control per surface." });
  assert.equal((await fetch(base + "/api/dsdd/review", { method: "POST", headers: { ...headers, "X-PlotPickle-CSRF": "" }, body: JSON.stringify({ action: "start", target: { kind: "working-tree" } }) })).status, 401);
  const toolRoot = path.join(temporary, "browser-tools");
  await ensureVerificationTools(toolRoot);
  browser = await createBrowserVerificationSession({ toolRoot, allowedOrigins: [base], runId: `command-2717-${Date.now()}` });
  const context = await browser.browser.newContext({ storageState: session.storageStatePath, viewport: { width: 1440, height: 1080 } });
  page = await context.newPage();
  const inference = [];
  page.on("request", request => { if (/\/api\/(?:dsdd\/command|local-ai\/chat|agents)/u.test(new URL(request.url()).pathname) && request.method() === "POST") inference.push(request.url()); });
  await page.goto(base + "/skin-v1", { waitUntil: "domcontentloaded" });
  await page.locator("[data-dashboard-menu-item='library']").click({ timeout: 60_000 });
  await page.locator("[data-library-load-story='synthetic-command-2717']").getByRole("button", { name: /^Resume saved story/u }).click();
  await page.getByRole("button", { name: "Open Saved Story", exact: true }).click();
  await page.locator("[data-dashboard-menu-item='settings']").click({ timeout: 60_000 });
  assert.equal(await page.locator("[data-dashboard-menu-item='command']").count(), 0);
  await page.locator("[data-settings-secondary-item='command']").click();
  const command = page.locator("[data-settings-command='true']");
  await command.waitFor();
  await page.locator("[data-skin-v1-active-surface='command'] [data-skin-v1-region-role='global-header']").getByText("Command", { exact: true }).waitFor();
  await command.getByRole("heading", { name: "Requests", exact: true }).waitFor({ timeout: 60_000 });
  await page.screenshot({ path: path.join(root, "command.png"), fullPage: true });
  await command.getByRole("button", { name: "Local engines", exact: true }).focus();
  await page.keyboard.press("Escape");
  await page.locator("[data-settings-secondary-item='command']").click();
  await page.locator("[data-settings-command='true']").getByRole("button", { name: "Local engines", exact: true }).click();
  await page.locator("section[aria-label='Local Story Mode setup']").waitFor({ timeout: 30_000 });
  await page.locator("[data-skin-v1-return-contract='single-owner']").click();
  await page.locator("[data-settings-secondary-item='command']").click();
  await page.locator("[data-skin-v1-return-contract='single-owner']").click();
  await page.locator("[data-settings-secondary-item='command']").waitFor();
  assert.equal(inference.length, 0, "Opening Command and engine settings must not infer or submit a request.");
  assert.equal((await api("/api/dsdd/command")).session.sessionId, firstSession.sessionId, "Command discovery preserves the protected session identity.");
  const after = await api("/api/auth/profile-private");
  assert.equal(after.activeProjectId, original.activeProjectId);
  assert.deepEqual(after.project, original.project, "Settings navigation must retain saved canonical project identity and content.");

  const visibleCommand = page.locator("[data-settings-command='true']");
  await page.locator("[data-settings-secondary-item='command']").click();
  await visibleCommand.getByText("Mind Map and World Map show duplicate headings and return controls. Keep one heading and one return control per surface.", { exact: true }).first().waitFor();
  const narration = visibleCommand.locator("textarea");
  await narration.fill("Synthetic unsent narration");
  await visibleCommand.getByRole("button", { name: "Clear console", exact: true }).click();
  await visibleCommand.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.equal((await api("/api/dsdd/command")).session.conversation.length, 2, "Cancel preserves history");
  await visibleCommand.getByRole("button", { name: "Clear console", exact: true }).click();
  await page.route("**/api/dsdd/command", async route => {
    if (route.request().method() === "POST" && route.request().postDataJSON()?.action === "clear-conversation") {
      // Exercise an unsuccessful application result without generating an intentional
      // HTTP 5xx blocker in the continuous browser-health observer.
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, message: "Synthetic clear unavailable" }) });
    } else await route.continue();
  });
  await visibleCommand.getByRole("button", { name: "Confirm clear", exact: true }).click();
  await visibleCommand.locator("[role=alert]").filter({ hasText: "Synthetic clear unavailable" }).waitFor();
  assert.equal((await api("/api/dsdd/command")).session.conversation.length, 2, "Failed clear preserves history");
  assert.equal(await narration.inputValue(), "Synthetic unsent narration");
  await page.unroute("**/api/dsdd/command");
  await visibleCommand.getByRole("button", { name: "Confirm clear", exact: true }).click();
  await waitFor(async () => (await api("/api/dsdd/command")).session.conversation.length === 0, "confirmed console clear");
  assert.equal(await narration.inputValue(), "Synthetic unsent narration");
  await waitFor(() => visibleCommand.getByRole("button", { name: "Clear console", exact: true }).isDisabled(), "cleared console control");
  assert.deepEqual((await api("/api/auth/profile-private")).project, original.project);
  await page.screenshot({ path: path.join(root, "command-cleared.png"), fullPage: true });
  commandClearVerified = true;
  await visibleCommand.locator("[data-command-review-state='ready']").waitFor({ timeout: 30_000 });

  // Native Hunk runs in an isolated changed checkout so this proof never creates
  // a source diff in the application repository or grants mutation authority.
  const checkout = path.join(temporary, "review-checkout");
  await mkdir(checkout);
  execFileSync("git", ["init", checkout], { stdio: "ignore" });
  await writeFile(path.join(checkout, "review.txt"), "Before review\n");
  execFileSync("git", ["-C", checkout, "add", "review.txt"]);
  execFileSync("git", ["-C", checkout, "-c", "user.name=Synthetic proof", "-c", "user.email=proof@example.invalid", "commit", "-m", "Synthetic review fixture"], { stdio: "ignore" });
  await writeFile(path.join(checkout, "review.txt"), "After review\n");
  controller = new HunkReviewController({ repositoryRoot: checkout });
  assert.equal((await controller.capabilities()).state, "ready");
  review = await controller.start("synthetic-owner", { kind: "working-tree" }, [{ filePath: "review.txt", newLine: 1, summary: "Synthetic advisory annotation 2717" }]);
  assert.equal(review.agentNotes, 1);
  const hunk = await controller.command();
  await waitFor(async () => {
    const result = await runPortableCommand(hunk, ["session", "comment", "list", "--repo", checkout, "--type", "agent", "--json"], { timeout: 5000 });
    const notes = JSON.parse(result.stdout).comments;
    return Array.isArray(notes) && notes.some(note => note.source === "agent" && note.filePath === "review.txt"
      && note.newRange?.[0] === 1 && note.newRange?.[1] === 1 && note.body === "Synthetic advisory annotation 2717");
  }, "native inline agent annotation", 30_000);
  await assert.rejects(controller.cancel("other-profile", review.id));
  assert.equal((await controller.current("synthetic-owner")).state, "running");
  assert.equal((await controller.cancel("synthetic-owner", review.id)).state, "cancelled");
  assert.equal(execFileSync("git", ["-C", checkout, "diff"], { encoding: "utf8" }).includes("+After review"), true);
  report = { issue: 2717, status: "PASS", head: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || "local", platform: process.platform, settingsCommand: "PASS", commandClear: "PASS", piClearProjection: "PASS", normalStartupInference: 0, csrfDenial: "PASS", projectContinuity: "PASS", managedPiLockedInstall: managed.version, nativeHunk: "PASS", inlineAgentAnnotation: "PASS", ownedCancellation: "PASS", gpuAcceleration: "UNPROVEN" };

} catch (caught) {
  const hunkDiscovery = await new HunkReviewController().command()
    .then(() => "ready", error => String(error.message).slice(0, 1500));
  await writeFile(path.join(root, "failure.json"), JSON.stringify({ status: "FAIL", message: caught.message, commandClear: commandClearVerified ? "PASS" : "UNPROVEN", hunkDiscovery }, null, 2));
  if (page) await page.screenshot({ path: path.join(root, "failure.png"), fullPage: true }).catch(() => {});
  throw caught;
} finally {
  if (controller && review) await controller.cancel("synthetic-owner", review.id).catch(() => {});
  if (browser) await browser.close();
  if (server?.pid) {
    const owned = server;
    server = null;
    if (owned.exitCode === null) {
      try { execFileSync("taskkill.exe", ["/PID", String(owned.pid), "/T", "/F"], { stdio: "ignore" }); }
      catch (caught) { output.push(`Owned host cleanup race: ${caught.message}\n`); }
    }
    await waitFor(async () => { try { await fetch(base + "/api/auth/profile", { signal: AbortSignal.timeout(1000) }); return false; } catch { return true; } }, "owned host stop", 20_000);
    await waitFor(() => owned.exitCode !== null || owned.signalCode !== null, "owned process exit", 5000);
  }
  await writeFile(path.join(root, "host.log"), output.join("").slice(-128_000));
}

if (report) {
  await writeFile(path.join(root, "proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
}
