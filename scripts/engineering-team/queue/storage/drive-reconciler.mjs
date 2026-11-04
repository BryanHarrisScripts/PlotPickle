/**
 * #3241 PlotPickle Drive Reconciler — startup observation, not a cleanup grant.
 * The only persisted object is ONE replaced aggregate status snapshot.
 * No PPF, media, Git checkout, runtime, lock, cache or evidence is removed.
 */
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, mkdir, opendir, realpath, rename, statfs, writeFile, unlink } from "node:fs/promises";

const exec = promisify(execFile);
const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const MAX_ITEMS = 512;
const PER_ROOT_MS = 1250;
const SNAPSHOT = "last-reconciliation.json";
const samePath = (a, b) => process.platform === "win32"
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);

async function checkedExistingDirectory(directory) {
  let current = path.resolve(directory);
  for (;;) {
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw Error("REDIRECTED_OR_NON_DIRECTORY");
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!samePath(await realpath(directory), directory)) throw Error("REDIRECTED_OR_NON_DIRECTORY");
}

export function parseRegisteredWorktrees(porcelain) {
  if (typeof porcelain !== "string") return [];
  return porcelain.split(/\r?\n/u).filter(line => line.startsWith("worktree "))
    .map(line => path.resolve(line.slice(9).trim())).filter(Boolean);
}

async function git(args) {
  const result = await exec("git", ["-C", REPO, ...args], {
    timeout: 1500, maxBuffer: 1024 * 1024, windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
  });
  return result.stdout.trim();
}

async function readGitState() {
  try {
    const [head, branch, worktrees, objects] = await Promise.all([
      git(["rev-parse", "HEAD"]),
      git(["branch", "--show-current"]),
      git(["worktree", "list", "--porcelain"]),
      git(["count-objects", "-v"]),
    ]);
    const lines = new Map(objects.split(/\r?\n/u).map(line => {
      const split = line.indexOf(": ");
      return split < 0 ? [line, ""] : [line.slice(0, split), line.slice(split + 2)];
    }));
    const sizePackKiB = Number(lines.get("size-pack"));
    const sizeLooseKiB = Number(lines.get("size"));
    const packValid = Number.isFinite(sizePackKiB) && sizePackKiB >= 0;
    const looseValid = Number.isFinite(sizeLooseKiB) && sizeLooseKiB >= 0;
    const registeredWorktrees = parseRegisteredWorktrees(worktrees);
    return {
      state: "OBSERVED",
      mainCheckout: branch === "main",
      headPresent: /^[a-f0-9]{40}$/u.test(head),
      sourceHead: /^[a-f0-9]{40}$/u.test(head) ? head : null,
      registeredWorktreeCount: registeredWorktrees.length,
      registeredWorktrees,
      gitPackBytes: packValid ? String(Math.round(sizePackKiB * 1024)) : null,
      gitLooseObjectBytes: looseValid ? String(Math.round(sizeLooseKiB * 1024)) : null,
      gitObjectStoreBytes: packValid && looseValid
        ? String(Math.round((sizePackKiB + sizeLooseKiB) * 1024)) : null,
      packSizeScope: "Git object packs and loose objects only; excludes worktree checkouts, staged runtime copies and physical sharing",
    };
  } catch {
    return { state: "UNVERIFIED", mainCheckout: false, headPresent: false,
      sourceHead: null, registeredWorktreeCount: null, registeredWorktrees: [], gitPackBytes: null,
      gitLooseObjectBytes: null, gitObjectStoreBytes: null };
  }
}

async function immediate(directory) {
  try {
    await checkedExistingDirectory(directory);
  } catch (error) {
    return { state: error?.code === "ENOENT" ? "MISSING" : "UNVERIFIED",
      observedEntries: 0, directories: 0, skippedLinks: 0, registered: null,
      unregisteredOrUnknown: null, bytes: null };
  }
  let entries = 0, directories = 0, skippedLinks = 0, truncated = false;
  const names = [];
  const deadline = Date.now() + PER_ROOT_MS;
  try {
    const handle = await opendir(directory);
    for await (const item of handle) {
      if (entries >= MAX_ITEMS || Date.now() > deadline) { truncated = true; break; }
      entries += 1;
      const full = path.join(directory, item.name);
      const info = await lstat(full);
      if (info.isSymbolicLink()) { skippedLinks += 1; continue; }
      if (!info.isDirectory() || !item.isDirectory()) continue;
      directories += 1;
      names.push(path.resolve(full));
    }
  } catch {
    return { state: "UNVERIFIED", observedEntries: entries, directories,
      skippedLinks, registered: null, unregisteredOrUnknown: null, bytes: null };
  }
  return { state: truncated ? "PARTIAL" : "COMPLETE", observedEntries: entries,
    directories, skippedLinks, names, bytes: null };
}

/**
 * Separate opt-in review of at most eight actually observed, registered stage
 * checkouts. Git cleanliness is NOT a retirement permit: independent PR, task,
 * process and immutable-receipt references are deliberately unverified here.
 */
export async function reviewStageCheckouts({ roots, observations, registeredWorktrees, offset = 0 } = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw Error("DRIVE_REVIEW_OFFSET_INVALID");
  const registered = new Set((registeredWorktrees ?? []).map(name =>
    process.platform === "win32" ? name.toLowerCase() : name));
  const eligibleRoots = new Set(["candidateStages", "issueWorktrees"]);
  const choices = roots.flatMap(([id, directory], i) => eligibleRoots.has(id)
    ? (observations[i]?.names ?? []).map(name => ({ id, directory, name })) : []);
  const sampled = choices.slice(offset, offset + 8);
  const decisions = [];
  for (const candidate of sampled) {
    const label = path.basename(candidate.name);
    const key = process.platform === "win32" ? candidate.name.toLowerCase() : candidate.name;
    const registeredHere = registered.has(key);
    let head = null, worktreeClean = null, observation = "NOT_CHECKED";
    if (registeredHere) {
      try {
        await checkedExistingDirectory(candidate.name);
        const [rawHead, rawStatus] = await Promise.all([
          exec("git", ["-C", candidate.name, "rev-parse", "HEAD"], {
            timeout: 4000, maxBuffer: 16384, windowsHide: true,
            env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
          }),
          exec("git", ["-C", candidate.name, "status", "--porcelain=v1", "--untracked-files=all"], {
            timeout: 4000, maxBuffer: 1024 * 1024, windowsHide: true,
            env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" },
          }),
        ]);
        await checkedExistingDirectory(candidate.name);
        head = /^[a-f0-9]{40}$/iu.test(rawHead.stdout.trim()) ? rawHead.stdout.trim() : null;
        worktreeClean = rawStatus.stdout.trim() === "";
        observation = head ? "GIT_OBSERVED" : "GIT_HEAD_UNVERIFIED";
      } catch {
        observation = "GIT_INSPECTION_UNVERIFIED";
      }
    }
    decisions.push({
      bucket: candidate.id, localDirectoryName: label, registeredHere,
      head, worktreeClean, observation,
      decision: "BLOCKED_REFERENCES_UNVERIFIED",
      proofStillNeeded: ["PR_STATE", "TASK_AND_PROCESS_OWNERSHIP",
        "STAGING_LEASES", "IMMUTABLE_RECEIPTS", "G_DRIVE_NTFS_AND_INTEGRITY"],
      archived: false, cleanupAuthorized: false,
    });
  }
  return {
    state: choices.length > offset + sampled.length ? "PARTIAL" : "OBSERVED_BOUND",
    totalObserved: choices.length, reviewed: decisions.length, offset,
    limitedByRootInventory: observations.some(x => x?.state === "PARTIAL"),
    decisions, archiveAuthorized: false, removedBytes: "0",
  };
}

async function checkedCapacity(directory) {
  try {
    await checkedExistingDirectory(directory);
    const result = await statfs(directory, { bigint: true });
    return { state: "OBSERVED", freeBytes: String(result.bavail * result.bsize),
      totalBytes: String(result.blocks * result.bsize),
      isReservation: false };
  } catch {
    return { state: "UNVERIFIED", freeBytes: null, totalBytes: null, isReservation: false };
  }
}

async function recordStatus(directory, report) {
  try {
    await checkedExistingDirectory(directory);
    const drive = path.join(directory, "drive");
    try { await mkdir(drive); } catch (error) { if (error?.code !== "EEXIST") throw error; }
    await checkedExistingDirectory(drive);
    const destination = path.join(drive, SNAPSHOT);
    // Never overwrite a redirected or non-regular output.
    try {
      const info = await lstat(destination);
      if (!info.isFile() || info.isSymbolicLink()) throw Error("SNAPSHOT_UNVERIFIED");
    } catch (error) { if (error?.code !== "ENOENT") throw error; }
    const pending = path.join(drive, ".pending-" + process.pid + "-" + Date.now().toString(36));
    await writeFile(pending, JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    try { await rename(pending, destination); }
    catch (error) { await unlink(pending).catch(() => {}); throw error; }
    return "WRITTEN";
  } catch {
    return "NOT_WRITTEN";
  }
}

export async function reconcile({ appHome, repo = REPO, persist = false, reviewOffset = null } = {}) {
  if (typeof appHome !== "string" || !path.isAbsolute(appHome)) throw Error("DRIVE_ROOT_UNVERIFIED");
  if (!samePath(repo, REPO)) throw Error("DRIVE_REPOSITORY_UNVERIFIED");
  const queue = path.join(appHome, "engineering-team", "autonomous-queue");
  const roots = [
    ["candidateStages", path.join(queue, "chat-candidate-stages")],
    ["issueWorktrees", path.join(queue, "worktrees")],
    ["storyUat", path.join(queue, "mcp-story-uat")],
    ["runtimes", path.join(appHome, "runtimes")],
    ["factoryNpmCache", path.join(queue, "npm-cache")],
    ["packageCache", path.join(appHome, "npm-cache")],
    ["verificationArtifacts", path.join(REPO, ".artifacts")],
  ];
  // G: is the owner-approved *archive* volume. It is not a second live
  // Factory or a permitted destination until NTFS, references, capacity,
  // copy integrity and a rollback plan have been independently checked.
  const archiveRoot = process.platform === "win32" ? "G:\\" : null;
  const [gitState, capacity, gDrive, ...seen] = await Promise.all([
    readGitState(), checkedCapacity(appHome),
    archiveRoot ? checkedCapacity(archiveRoot) : Promise.resolve({
      state: "NOT_WINDOWS", freeBytes: null, totalBytes: null, isReservation: false,
    }),
    ...roots.map(row => immediate(row[1])),
  ]);
  const registered = new Set(gitState.registeredWorktrees.map(name => process.platform === "win32" ? name.toLowerCase() : name));
  const buckets = Object.fromEntries(roots.map(([name], index) => {
    const { names = [], ...data } = seen[index];
    const worktreeClass = name === "candidateStages" || name === "issueWorktrees";
    const matching = names.filter(p => registered.has(process.platform === "win32" ? p.toLowerCase() : p)).length;
    return [name, { ...data, registered: worktreeClass && gitState.state === "OBSERVED" ? matching : null,
      unregisteredOrUnknown: worktreeClass && gitState.state === "OBSERVED" ? names.length - matching : null,
      cleanupAuthorized: false }];
  }));
  const stageReview = reviewOffset === null ? null : await reviewStageCheckouts({
    roots, observations: seen, registeredWorktrees: gitState.registeredWorktrees,
    offset: reviewOffset,
  });
  const report = {
    schemaVersion: 1, component: "PlotPickle Drive Reconciler",
    observedAt: new Date().toISOString(),
    state: Object.values(buckets).every(b => b.state === "COMPLETE") && gitState.state === "OBSERVED"
      ? "OBSERVED_METADATA_ONLY" : "PARTIAL_OR_UNVERIFIED",
    capacity, git: { ...gitState, registeredWorktrees: undefined },
    archiveTarget: {
      volume: "G:", baseFolder: "PlotPickle-Archive", role: "ARCHIVE_ONLY",
      capacity: gDrive, fileSystemVerified: false, targetWritableVerified: false,
      referenceAndProcessAttested: false, restoreVerified: false,
      archiveAuthorized: false, movedBytes: "0",
    },
    buckets, ...(stageReview ? { stageReview } : {}),
    cleanupAuthorized: false, automaticDeletionImplemented: false,
    archiveToGAuthorized: false, protected: [
      "PPF", "Library", "creative-media", "manual-backups", "locked-artifacts",
      "Git-worktrees", "runtime-active-and-fallback", "receipts", "unclassified-data",
    ],
    notes: "Startup reads fixed roots and replaces one aggregate status snapshot. G: archive is a planned destination, not a completed copy or a storage grant. No recursive sizes, physical reclamation, G: modification, process/reference attestation or cleanup action. Git object size excludes checkout copies; missing references block retirement.",
  };
  const snapshotState = persist ? await recordStatus(appHome, report) : "NOT_REQUESTED";
  return { ...report, snapshotState };
}

async function main() {
  const reviewRequested = process.argv[2] === "--review";
  if (reviewRequested
    ? process.argv.length !== 4 || !/^(0|[1-9][0-9]{0,5})$/u.test(process.argv[3])
    : process.argv.length !== 3 || !["--startup", "--report"].includes(process.argv[2]))
    throw Error("DRIVE_MODE_UNSUPPORTED");
  const appHome = process.env.PLOTPICKLE_HOME && path.isAbsolute(process.env.PLOTPICKLE_HOME)
    ? path.resolve(process.env.PLOTPICKLE_HOME)
    : process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "PlotPickle")
      : path.join(os.homedir(), ".plotpickle");
  const result = await reconcile({
    appHome, persist: process.argv[2] === "--startup",
    reviewOffset: reviewRequested ? Number(process.argv[3]) : null,
  });
  if (reviewRequested) {
    process.stdout.write("PLOTPICKLE_DRIVE_REVIEW " + JSON.stringify({
      sourceHead: result.git.sourceHead, state: result.state,
      archiveTarget: result.archiveTarget, stageReview: result.stageReview,
    }) + "\\n".replace("\\n", "\n"));
    return;
  }
  process.stdout.write("PLOTPICKLE_DRIVE " + JSON.stringify({
    state: result.state, freeBytes: result.capacity.freeBytes,
    registeredWorktrees: result.git.registeredWorktreeCount,
    candidateStages: result.buckets.candidateStages.directories,
    issueWorktrees: result.buckets.issueWorktrees.directories,
    runtimes: result.buckets.runtimes.directories,
    snapshotState: result.snapshotState, cleanupAuthorized: false,
  }) + "\n");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    const code = ["DRIVE_MODE_UNSUPPORTED", "DRIVE_ROOT_UNVERIFIED", "DRIVE_REPOSITORY_UNVERIFIED"]
      .includes(error?.message) ? error.message : "DRIVE_RECONCILIATION_UNVERIFIED";
    process.stderr.write(code + "\n");
    process.exitCode = 1;
  });
}
