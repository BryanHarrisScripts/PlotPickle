#!/usr/bin/env node
/**
 * #3110: explicit local opt-in, revocable Windows supervisor for bounded
 * paired-control polling and queue OBSERVATION. This is not an agent-coding
 * dispatcher, a remote shell, an automatic PR/merge policy, or a Windows
 * descendant-termination guarantee.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { inspectQueue } from "../../queue/unattended-queue.mjs";
import { pollWindowsGitHubControlOnce, readWindowsGitHubPairing } from "../paired-github-control.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const THIS = fileURLToPath(import.meta.url);
const exec = promisify(execFile);
const CONSENT = "ENABLE_INDEPENDENT_WINDOWS_SUPERVISOR";
const SHA = /^[a-f0-9]{40}$/;
const INTERVAL_MS = 60_000;
const MAX_RECORD_BYTES = 16_384;
const hash = value => createHash("sha256").update(value).digest("hex");

async function safeRead(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_RECORD_BYTES) return null;
    return JSON.parse(await readFile(file, "utf8"));
  } catch { return null; }
}
async function exactHead() {
  const { stdout } = await exec("git", ["rev-parse", "HEAD"],
    { cwd: REPO, windowsHide: true, timeout: 10_000, maxBuffer: 4096 });
  return stdout.trim().toLowerCase();
}
function dirs(appRoot) {
  return {
    dir: path.join(appRoot, "engineering-team", "supervisor"),
    enabled: path.join(appRoot, "engineering-team", "supervisor", "enabled.json"),
    stop: path.join(appRoot, "engineering-team", "supervisor", "stop-request.json"),
    pause: path.join(appRoot, "engineering-team", "supervisor", "pause-request.json"),
    lock: path.join(appRoot, "engineering-team", "supervisor", "running.lock"),
    heartbeat: path.join(appRoot, "engineering-team", "supervisor", "heartbeat.json"),
  };
}
function appRootDefault() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "PlotPickle");
}
export function validateSupervisorConsent(value, platform = process.platform) {
  return platform === "win32" && value === CONSENT;
}
export async function enableSupervisor({ appRoot = appRootDefault(), consent, platform = process.platform,
  head = exactHead, paired = readWindowsGitHubPairing, now = Date.now } = {}) {
  if (!validateSupervisorConsent(consent, platform)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  const info = await paired({ appRoot });
  if (info.enabled !== true) throw Error("PAIRED_HOST_REQUIRED");
  const sha = await head();
  if (!SHA.test(sha)) throw Error("INVALID_CHECKOUT_HEAD");
  const p = dirs(appRoot);
  await mkdir(p.dir, { recursive: true, mode: 0o700 });
  if (await safeRead(p.enabled)) throw Error("SUPERVISOR_ALREADY_ENABLED");
  const record = Object.freeze({ schemaVersion: 1, kind: "independent-windows-supervisor",
    sourceHead: sha, hostId: info.hostId, authorizedActor: info.authorizedActor,
    enabledAt: now(), remoteControlScope: "paired-start-status-stop-only",
    modelDispatchAllowed: false, sourceMutationAllowed: false, autonomousMergeAllowed: false });
  await writeFile(p.enabled, JSON.stringify(record) + "\n", { flag: "wx", mode: 0o600 });
  return Object.freeze({ state: "ENABLED_NOT_RUNNING", exactSha: sha,
    sourceMutationAllowed: false, autonomousMergeAllowed: false });
}

/** Check current on-device revision without changing source or invoking an agent. */
async function cleanMigrationCheckout(fromHead) {
  const opts = { cwd: REPO, windowsHide: true, timeout: 10_000, maxBuffer: 4096 };
  const command = async args => String((await exec("git", args, opts)).stdout || "").trim();
  const [sourceHead, branch, changed, origin] = await Promise.all([
    command(["rev-parse", "HEAD"]), command(["branch", "--show-current"]),
    command(["status", "--porcelain", "--untracked-files=no"]),
    command(["remote", "get-url", "origin"]),
  ]);
  if (!SHA.test(sourceHead) || branch !== "main" || changed) return null;
  if (!/^(?:https:\/\/github\.com\/BryanHarrisScripts\/PlotPickle(?:\.git)?|git@github\.com:BryanHarrisScripts\/PlotPickle(?:\.git)?)$/u.test(origin)) return null;
  try { await command(["merge-base", "--is-ancestor", fromHead, sourceHead]); }
  catch { return null; }
  return Object.freeze({ sourceHead, trackedClean: true, branch: "main",
    originVerified: true, ancestorVerified: true });
}

/**
 * #3142: Human-authorized, one-way exact-head migration AFTER a controlled
 * local fast-forward. Does not unlock local STOP/PAUSE, start a worker, alter
 * advisory queue/reservations or allow any source execution.
 */
export async function migrateSupervisorHead({
  appRoot = appRootDefault(), consent, platform = process.platform, fromHead,
  checkout = cleanMigrationCheckout, paired = readWindowsGitHubPairing,
  now = Date.now,
} = {}) {
  if (!validateSupervisorConsent(consent, platform)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  if (!SHA.test(fromHead || "")) throw Error("MIGRATION_OLD_HEAD_REQUIRED");
  const p = dirs(appRoot);
  // Presence checks intentionally reject malformed locks, stop or pause markers.
  // An uncertain owner cannot be migrated merely because parsing failed.
  if (await existsOrdinaryFile(p.lock)) throw Error("SUPERVISOR_LOCKED_OR_STALE");
  if (await existsOrdinaryFile(p.stop)) throw Error("LOCAL_STOP_REQUIRES_OPERATOR_REENABLE");
  if (await existsOrdinaryFile(p.pause)) throw Error("PAUSE_REQUEST_REQUIRES_OPERATOR_REVIEW");
  if (!await existsOrdinaryFile(p.enabled)) throw Error("SUPERVISOR_NOT_ENABLED");
  const enabled = await safeRead(p.enabled);
  if (!enabled || enabled.schemaVersion !== 1 ||
    enabled.kind !== "independent-windows-supervisor" ||
    enabled.sourceHead !== fromHead || enabled.modelDispatchAllowed !== false ||
    enabled.sourceMutationAllowed !== false || enabled.autonomousMergeAllowed !== false)
    throw Error("SUPERVISOR_AUTHORITY_UNVERIFIABLE");
  const info = await paired({ appRoot });
  if (!info?.enabled || info.hostId !== enabled.hostId ||
    info.authorizedActor !== enabled.authorizedActor)
    throw Error("PAIRING_CHANGED_OR_DISABLED");
  const previousHeartbeat = await safeRead(p.heartbeat);
  if (!previousHeartbeat && await existsOrdinaryFile(p.heartbeat))
    throw Error("SUPERVISOR_HEARTBEAT_UNVERIFIABLE");
  const instant = now();
  if (previousHeartbeat?.sourceHead === fromHead &&
    Number.isSafeInteger(previousHeartbeat.at) &&
    previousHeartbeat.at > instant - INTERVAL_MS * 3 &&
    previousHeartbeat.at <= instant + 5000 &&
    ["RUNNING", "PAUSED", "BLOCKED"].includes(previousHeartbeat.state))
    throw Error("SUPERVISOR_MAY_STILL_BE_RUNNING");

  const verified = await checkout(fromHead);
  if (!verified || !SHA.test(verified.sourceHead || "") ||
    verified.sourceHead === fromHead || verified.trackedClean !== true ||
    verified.branch !== "main" || verified.originVerified !== true ||
    verified.ancestorVerified !== true) throw Error("CLEAN_FAST_FORWARD_MAIN_REQUIRED");
  // Recheck local identity before atomic replacement, not just before git checks.
  if (await existsOrdinaryFile(p.lock) || await existsOrdinaryFile(p.stop) ||
    await existsOrdinaryFile(p.pause)) throw Error("SUPERVISOR_CONTROL_CHANGED");
  const current = await safeRead(p.enabled);
  if (JSON.stringify(current) !== JSON.stringify(enabled))
    throw Error("SUPERVISOR_AUTHORITY_CHANGED");
  const archive = path.join(p.dir, "migration-" + fromHead + "-to-" + verified.sourceHead + ".json");
  const previous = Object.freeze({ schemaVersion: 1, kind: "supervisor-revision-migration",
    fromHead, toHead: verified.sourceHead, migratedAt: instant,
    hostId: enabled.hostId, authorizedActor: enabled.authorizedActor,
    priorEnabledAt: enabled.enabledAt, permissionChanged: false,
    workerStarted: false, replayAuthorized: false,
    autonomousMergeAllowed: false });
  // Write-once audit entry: a failed/uncertain migration is never silently
  // retried over the same previous evidence.
  await writeFile(archive, JSON.stringify(previous) + "\n", { flag: "wx", mode: 0o600 });
  const next = { ...enabled, sourceHead: verified.sourceHead,
    lastMigrationFrom: fromHead, migratedAt: instant };
  const temporary = path.join(p.dir, "enabled-migration-" + process.pid + "-" + instant + ".tmp");
  try {
    await writeFile(temporary, JSON.stringify(next) + "\n", { flag: "wx", mode: 0o600 });
    await rename(temporary, p.enabled);
  } finally { await rm(temporary, { force: true }).catch(() => {}); }
  return Object.freeze({ state: "HEAD_MIGRATED_NOT_RUNNING", fromHead,
    exactSha: verified.sourceHead, workerProcessVerified: false,
    issueReplayed: false, sourceModified: false, automaticMergeEnabled: false });
}

export async function reenableSupervisor({ appRoot = appRootDefault(), consent, platform = process.platform,
  head = exactHead, paired = readWindowsGitHubPairing } = {}) {
  if (!validateSupervisorConsent(consent, platform)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  const p = dirs(appRoot);
  const enabled = await safeRead(p.enabled);
  if (!enabled || !SHA.test(enabled.sourceHead)) throw Error("SUPERVISOR_NOT_ENABLED");
  if (await safeRead(p.lock)) throw Error("SUPERVISOR_LOCKED_OR_STALE");
  if ((await head()) !== enabled.sourceHead) throw Error("STALE_SOURCE_HEAD");
  const info = await paired({ appRoot });
  if (!info.enabled || info.hostId !== enabled.hostId
    || info.authorizedActor !== enabled.authorizedActor) throw Error("PAIRING_CHANGED_OR_DISABLED");
  await rm(p.stop, { force: true });
  // A local STOP revokes the old pause state; the explicit reenable is still
  // required and never silently revives an already stopped or stale process.
  await rm(p.pause, { force: true });
  return Object.freeze({ state: "ENABLED_NOT_RUNNING", exactSha: enabled.sourceHead });
}
export async function disableSupervisor({ appRoot = appRootDefault(), now = Date.now } = {}) {
  const p = dirs(appRoot);
  if (!await safeRead(p.enabled)) return Object.freeze({ state: "OFF", reason: "NOT_ENABLED" });
  try {
    await writeFile(p.stop, JSON.stringify({ stopRequestedAt: now(), localOperator: true }) + "\n",
      { flag: "wx", mode: 0o600 });
  } catch (error) { if (error?.code !== "EEXIST") throw error; }
  return Object.freeze({ state: "STOP_REQUESTED", reason: "LOCAL_KILL_SWITCH" });
}
/**
 * PAUSE is a durable local request, not proof that an in-flight remote poll
 * was cancelled. The supervisor acknowledges it on its next bounded cycle.
 * No arbitrary process/PID control or editable issue grant is involved.
 */
export async function pauseSupervisor({ appRoot = appRootDefault(), consent,
  platform = process.platform, head = exactHead, paired = readWindowsGitHubPairing,
  now = Date.now } = {}) {
  if (!validateSupervisorConsent(consent, platform)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  const p = dirs(appRoot);
  const enabled = await safeRead(p.enabled);
  if (!enabled || !SHA.test(enabled.sourceHead)) throw Error("SUPERVISOR_NOT_ENABLED");
  if (await safeRead(p.stop)) throw Error("LOCAL_STOP_REQUIRES_OPERATOR_REENABLE");
  if ((await head()) !== enabled.sourceHead) throw Error("STALE_SOURCE_HEAD");
  const info = await paired({ appRoot });
  if (!info.enabled || info.hostId !== enabled.hostId ||
    info.authorizedActor !== enabled.authorizedActor) throw Error("PAIRING_CHANGED_OR_DISABLED");
  const previous = await safeRead(p.pause);
  if (previous) {
    if (previous.schemaVersion !== 1 || previous.sourceHead !== enabled.sourceHead ||
      previous.hostId !== enabled.hostId || !Number.isSafeInteger(previous.requestedAt))
      throw Error("PAUSE_REQUEST_UNVERIFIABLE");
    return Object.freeze({ state: "PAUSE_REQUESTED", exactSha: enabled.sourceHead,
      alreadyRequested: true, pauseAcknowledged: false, inFlightCancellationProven: false });
  }
  await writeFile(p.pause, JSON.stringify({ schemaVersion: 1, sourceHead: enabled.sourceHead,
    hostId: enabled.hostId, requestedAt: now(), localOperator: true }) + "\n",
    { flag: "wx", mode: 0o600 });
  return Object.freeze({ state: "PAUSE_REQUESTED", exactSha: enabled.sourceHead,
    alreadyRequested: false, pauseAcknowledged: false, inFlightCancellationProven: false });
}

/** RESUME removes only this exact owner's verified pause request, never STOP. */
export async function resumeSupervisor({ appRoot = appRootDefault(), consent,
  platform = process.platform, head = exactHead, paired = readWindowsGitHubPairing } = {}) {
  if (!validateSupervisorConsent(consent, platform)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  const p = dirs(appRoot);
  const enabled = await safeRead(p.enabled);
  if (!enabled || !SHA.test(enabled.sourceHead)) throw Error("SUPERVISOR_NOT_ENABLED");
  if (await safeRead(p.stop)) throw Error("LOCAL_STOP_REQUIRES_OPERATOR_REENABLE");
  if ((await head()) !== enabled.sourceHead) throw Error("STALE_SOURCE_HEAD");
  const info = await paired({ appRoot });
  if (!info.enabled || info.hostId !== enabled.hostId ||
    info.authorizedActor !== enabled.authorizedActor) throw Error("PAIRING_CHANGED_OR_DISABLED");
  const pause = await safeRead(p.pause);
  if (!pause) {
    if (await existsOrdinaryFile(p.pause)) throw Error("PAUSE_REQUEST_UNVERIFIABLE");
    return Object.freeze({ state: "RESUME_REQUESTED", alreadyResumed: true,
      exactSha: enabled.sourceHead, workerRunningProven: false });
  }
  if (pause.schemaVersion !== 1 || pause.sourceHead !== enabled.sourceHead ||
    pause.hostId !== enabled.hostId || !Number.isSafeInteger(pause.requestedAt))
    throw Error("PAUSE_REQUEST_UNVERIFIABLE");
  await rm(p.pause);
  return Object.freeze({ state: "RESUME_REQUESTED", alreadyResumed: false,
    exactSha: enabled.sourceHead, workerRunningProven: false });
}
async function existsOrdinaryFile(file) {
  try { await lstat(file); return true; }
  catch (error) { if (error?.code === "ENOENT") return false; throw error; }
}

export async function supervisorStatus({ appRoot = appRootDefault(), now = Date.now } = {}) {
  const p = dirs(appRoot);
  const enabled = await safeRead(p.enabled);
  if (!enabled) return Object.freeze({ state: "OFF", reason: "NOT_ENABLED" });
  if (await safeRead(p.stop)) return Object.freeze({ state: "STOP_REQUESTED", reason: "LOCAL_KILL_SWITCH" });
  const pause = await safeRead(p.pause);
  if (!pause && await existsOrdinaryFile(p.pause))
    return Object.freeze({ state: "BLOCKED", exactSha: enabled.sourceHead, reason: "PAUSE_REQUEST_UNVERIFIABLE" });
  if (pause && (pause.schemaVersion !== 1 || pause.sourceHead !== enabled.sourceHead ||
    pause.hostId !== enabled.hostId || !Number.isSafeInteger(pause.requestedAt)))
    return Object.freeze({ state: "BLOCKED", exactSha: enabled.sourceHead, reason: "PAUSE_REQUEST_UNVERIFIABLE" });
  const hb = await safeRead(p.heartbeat);
  if (!hb || hb.sourceHead !== enabled.sourceHead || hb.hostId !== enabled.hostId
    || !Number.isSafeInteger(hb.at) || hb.at > now() + 5_000 || now() - hb.at > INTERVAL_MS * 3)
    return Object.freeze({ state: pause ? "PAUSE_REQUESTED" : "OFFLINE",
      pauseAcknowledged: false, inFlightCancellationProven: false, exactSha: enabled.sourceHead,
      reason: "NO_FRESH_OWNED_HEARTBEAT" });
  const acknowledgedPause = pause && hb.state === "PAUSED"
    && hb.pauseRequestAt === pause.requestedAt && hb.at >= pause.requestedAt;
  const observedState = pause ? (acknowledgedPause ? "PAUSED" : "PAUSE_REQUESTED")
    : hb.state === "PAUSED" ? "RESUME_REQUESTED"
      : ["RUNNING", "BLOCKED"].includes(hb.state) ? hb.state : "OFFLINE";
  return Object.freeze({ state: observedState,
    pauseAcknowledged: Boolean(acknowledgedPause), inFlightCancellationProven: false,
    exactSha: enabled.sourceHead, checkedAt: hb.at, reason: hb.reason || null,
    queueEligible: Number.isSafeInteger(hb.queueEligible) ? hb.queueEligible : null,
    remoteProcessed: Number.isSafeInteger(hb.remoteProcessed) ? hb.remoteProcessed : null,
    autonomousPrLifecycleProven: false });
}
export async function supervisorCycle({
  appRoot = appRootDefault(), platform = process.platform, head = exactHead,
  paired = readWindowsGitHubPairing, queue = inspectQueue,
  poll = pollWindowsGitHubControlOnce, now = Date.now,
} = {}) {
  if (platform !== "win32") return Object.freeze({ state: "BLOCKED", reason: "WINDOWS_REQUIRED" });
  const p = dirs(appRoot);
  const enabled = await safeRead(p.enabled);
  if (!enabled || enabled.kind !== "independent-windows-supervisor" || !SHA.test(enabled.sourceHead))
    return Object.freeze({ state: "OFF", reason: "NOT_ENABLED" });
  if (await safeRead(p.stop)) return Object.freeze({ state: "STOPPED", reason: "LOCAL_KILL_SWITCH" });
  if ((await head()) !== enabled.sourceHead)
    return Object.freeze({ state: "BLOCKED", reason: "STALE_SOURCE_HEAD" });
  const info = await paired({ appRoot });
  if (!info.enabled || info.hostId !== enabled.hostId || info.authorizedActor !== enabled.authorizedActor)
    return Object.freeze({ state: "BLOCKED", reason: "PAIRING_CHANGED_OR_DISABLED" });
  // Queue remains observational until independently authorized implementation
  // and verifier/PR pathways exist. A JSON grant is not sufficient authority.
  const pause = await safeRead(p.pause);
  if (pause || await existsOrdinaryFile(p.pause)) {
    if (!pause || pause.schemaVersion !== 1 || pause.sourceHead !== enabled.sourceHead ||
      pause.hostId !== enabled.hostId || !Number.isSafeInteger(pause.requestedAt))
      return Object.freeze({ state: "BLOCKED", reason: "PAUSE_REQUEST_UNVERIFIABLE" });
    const snapshot = Object.freeze({ schemaVersion: 1, sourceHead: enabled.sourceHead,
      hostId: enabled.hostId, at: now(), state: "PAUSED", reason: "LOCAL_OPERATOR_PAUSED",
      pauseRequestAt: pause.requestedAt, queueEligible: null, remoteProcessed: 0,
      agentExecutionProven: false, autonomousPrLifecycleProven: false });
    await writeFile(p.heartbeat, JSON.stringify(snapshot) + "\n", { mode: 0o600 });
    return snapshot;
  }
  const q = await queue();
  // A pause arriving during inspection must block any *new* remote poll.
  if (await existsOrdinaryFile(p.pause)) {
    return Object.freeze({ state: "PAUSE_REQUESTED", reason: "NEXT_CYCLE_ACK_PENDING",
      remoteProcessed: 0, agentExecutionProven: false, autonomousPrLifecycleProven: false });
  }
  let remoteProcessed = 0, reason = null;
  try {
    const result = await poll({ appRoot });
    if (!["POLL_COMPLETE", "OFF"].includes(result.state)) throw Error("REMOTE_CONTROL_UNAVAILABLE");
    if (result.state === "OFF") throw Error("PAIRING_OFF");
    remoteProcessed = result.processed || 0;
  } catch {
    reason = "GITHUB_TRANSPORT_OFFLINE";
  }
  const snapshot = Object.freeze({ schemaVersion: 1, sourceHead: enabled.sourceHead,
    hostId: enabled.hostId, at: now(), state: reason ? "BLOCKED" : "RUNNING",
    reason, queueEligible: q.eligible || 0, remoteProcessed,
    agentExecutionProven: false, autonomousPrLifecycleProven: false });
  // Private heartbeat is status, not independent verification.
  await writeFile(p.heartbeat, JSON.stringify(snapshot) + "\n", { mode: 0o600 });
  return snapshot;
}
export async function serveSupervisor({ appRoot = appRootDefault(), consent, platform = process.platform,
  now = Date.now, cycle = supervisorCycle, delay = ms => new Promise(resolve => setTimeout(resolve, ms)),
  maxCycles = Infinity } = {}) {
  if (!validateSupervisorConsent(consent, platform)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  const p = dirs(appRoot);
  if (!await safeRead(p.enabled)) throw Error("SUPERVISOR_NOT_ENABLED");
  if (await safeRead(p.stop)) throw Error("LOCAL_STOP_REQUIRES_OPERATOR_REENABLE");
  const handle = await open(p.lock, "wx", 0o600).catch(error => {
    if (error?.code === "EEXIST") throw Error("SUPERVISOR_LOCKED_OR_STALE");
    throw error;
  });
  const owner = hash(String(process.pid) + ":" + String(now())).slice(0, 32);
  try {
    await handle.writeFile(JSON.stringify({ owner, pid: process.pid, startedAt: now() }) + "\n");
    await handle.close();
    let count = 0;
    for (; count < maxCycles; count++) {
      if (await safeRead(p.stop)) break;
      const result = await cycle({ appRoot });
      if (result.state === "OFF" || result.state === "STOPPED"
        || result.reason === "PAIRING_CHANGED_OR_DISABLED" || result.reason === "STALE_SOURCE_HEAD"
        || result.reason === "PAUSE_REQUEST_UNVERIFIABLE")
        break;
      if (count + 1 < maxCycles) await delay(INTERVAL_MS);
    }
    return Object.freeze({ state: "STOPPED", completedCycles: count });
  } finally {
    const enabled = await safeRead(p.enabled);
    if (enabled?.sourceHead) {
      await writeFile(p.heartbeat, JSON.stringify({ schemaVersion: 1,
        sourceHead: enabled.sourceHead, hostId: enabled.hostId, at: now(),
        state: "STOPPED", reason: "SUPERVISOR_EXITED", queueEligible: 0,
        remoteProcessed: 0, agentExecutionProven: false,
        autonomousPrLifecycleProven: false }) + "\n", { mode: 0o600 }).catch(() => {});
    }
    await handle.close().catch(() => {});
    // Only the currently active local owner can remove its lock.
    const saved = await safeRead(p.lock);
    if (saved?.owner === owner) await rm(p.lock, { force: true });
  }
}
function parseCli(argv) {
  const modes = ["--enable", "--reenable", "--serve", "--status", "--disable", "--pause", "--resume", "--migrate"].filter(x => argv.includes(x));
  if (modes.length !== 1) throw Error("SUPERVISOR_ONE_MODE_REQUIRED");
  const consentIndex = argv.indexOf("--consent");
  const allowed = ["--enable", "--reenable", "--serve", "--pause", "--resume"].includes(modes[0]);
  if (modes[0] === "--migrate") {
    if (argv.length !== 5 || argv[1] !== "--from" ||
      !SHA.test(argv[2] || "") || argv[3] !== "--consent" || argv[4] !== CONSENT)
      throw Error("MIGRATION_REQUIRES_EXPLICIT_OLD_HEAD_AND_LOCAL_CONSENT");
    return { mode: "--migrate", fromHead: argv[2] };
  }
  if (allowed && (argv.length !== 3 || consentIndex !== 1
    || argv[2] !== CONSENT)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  if (!allowed && argv.length !== 1) throw Error("UNSUPPORTED_SUPERVISOR_ARGS");
  return { mode: modes[0], fromHead: null };
}
async function main() {
  const command = parseCli(process.argv.slice(2));
  const mode = command.mode;
  const result = mode === "--enable" ? await enableSupervisor({ consent: CONSENT })
    : mode === "--reenable" ? await reenableSupervisor({ consent: CONSENT })
    : mode === "--serve" ? await serveSupervisor({ consent: CONSENT })
    : mode === "--pause" ? await pauseSupervisor({ consent: CONSENT })
    : mode === "--resume" ? await resumeSupervisor({ consent: CONSENT })
    : mode === "--migrate" ? await migrateSupervisorHead({ consent: CONSENT, fromHead: command.fromHead })
    : mode === "--disable" ? await disableSupervisor() : await supervisorStatus();
  process.stdout.write(JSON.stringify(result) + "\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === THIS)
  main().catch(() => { process.stderr.write("SUPERVISOR_BLOCKED\n"); process.exitCode = 1; });
