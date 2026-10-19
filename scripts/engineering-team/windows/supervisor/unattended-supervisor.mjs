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
import { mkdir, lstat, open, readFile, rm, writeFile } from "node:fs/promises";
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
export async function supervisorStatus({ appRoot = appRootDefault(), now = Date.now } = {}) {
  const p = dirs(appRoot);
  const enabled = await safeRead(p.enabled);
  if (!enabled) return Object.freeze({ state: "OFF", reason: "NOT_ENABLED" });
  if (await safeRead(p.stop)) return Object.freeze({ state: "STOP_REQUESTED", reason: "LOCAL_KILL_SWITCH" });
  const hb = await safeRead(p.heartbeat);
  if (!hb || hb.sourceHead !== enabled.sourceHead || hb.hostId !== enabled.hostId
    || !Number.isSafeInteger(hb.at) || hb.at > now() + 5_000 || now() - hb.at > INTERVAL_MS * 3)
    return Object.freeze({ state: "OFFLINE", exactSha: enabled.sourceHead,
      reason: "NO_FRESH_OWNED_HEARTBEAT" });
  return Object.freeze({ state: ["RUNNING", "BLOCKED"].includes(hb.state) ? hb.state : "OFFLINE",
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
  const q = await queue();
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
        || result.reason === "PAIRING_CHANGED_OR_DISABLED" || result.reason === "STALE_SOURCE_HEAD")
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
  const modes = ["--enable", "--reenable", "--serve", "--status", "--disable"].filter(x => argv.includes(x));
  if (modes.length !== 1) throw Error("SUPERVISOR_ONE_MODE_REQUIRED");
  const consentIndex = argv.indexOf("--consent");
  const allowed = ["--enable", "--reenable", "--serve"].includes(modes[0]);
  if (allowed && (argv.length !== 3 || consentIndex !== 1
    || argv[2] !== CONSENT)) throw Error("LOCAL_WINDOWS_CONSENT_REQUIRED");
  if (!allowed && argv.length !== 1) throw Error("UNSUPPORTED_SUPERVISOR_ARGS");
  return modes[0];
}
async function main() {
  const mode = parseCli(process.argv.slice(2));
  const result = mode === "--enable" ? await enableSupervisor({ consent: CONSENT })
    : mode === "--reenable" ? await reenableSupervisor({ consent: CONSENT })
    : mode === "--serve" ? await serveSupervisor({ consent: CONSENT })
    : mode === "--disable" ? await disableSupervisor() : await supervisorStatus();
  process.stdout.write(JSON.stringify(result) + "\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === THIS)
  main().catch(() => { process.stderr.write("SUPERVISOR_BLOCKED\n"); process.exitCode = 1; });
