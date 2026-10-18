#!/usr/bin/env node
/**
 * #3115: one-time, Windows-only *fixture* proving bounded process-tree stop.
 * This is NOT a general PID command, remote dispatcher, production UAT kill
 * routine, browser runner or model route. It never receives a PID from CLI.
 */
import { spawn, execFile } from "node:child_process";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const THIS = fileURLToPath(import.meta.url);
const exec = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/;
const POLL_MS = 80;
const READY_TIMEOUT_MS = 8_000;
const EXIT_TIMEOUT_MS = 6_000;
const FIXTURE_LIFETIME_MS = 35_000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const digest = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

function privateRoot() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "PlotPickle", "engineering-team", "windows-stop-proof");
}
function folderFor(id) {
  if (!UUID.test(id)) throw new Error("Invalid stop-proof identifier.");
  return path.join(privateRoot(), id);
}
async function boundedJson(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2048) return null;
    return JSON.parse(await readFile(file, "utf8"));
  } catch { return null; }
}
async function poll(predicate, timeout) {
  const limit = Date.now() + timeout;
  do {
    const answer = await predicate();
    if (answer) return answer;
    await sleep(POLL_MS);
  } while (Date.now() < limit);
  return null;
}
function pidAlive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code === "EPERM"; }
}
export function parseStopProofArgs(argv) {
  if (argv.length === 3 && argv[0] === "--prove" && argv[1] === "--head" && SHA.test(argv[2])) {
    return Object.freeze({ mode: "prove", head: argv[2].toLowerCase() });
  }
  if (argv.length === 3 && argv[0] === "--fixture-parent" && UUID.test(argv[1]) && TOKEN.test(argv[2]))
    return Object.freeze({ mode: "parent", id: argv[1], token: argv[2] });
  if (argv.length === 4 && argv[0] === "--fixture-leaf" && UUID.test(argv[1]) && TOKEN.test(argv[2])
    && ["descendant", "sentinel"].includes(argv[3]))
    return Object.freeze({ mode: "leaf", id: argv[1], token: argv[2], role: argv[3] });
  throw new Error("Expected --prove --head <exact-40-hex>; no external PID/kill operation is supported.");
}
export function assessWindowsStopFixture(f) {
  const checks = Object.freeze({
    nativeWindows: f.platform === "win32",
    sourceHeadMatched: f.sourceHeadMatched === true,
    privateReservation: f.privateReservation === true,
    parentStarted: f.parentStarted === true,
    descendantStarted: f.descendantStarted === true,
    sentinelStarted: f.sentinelStarted === true,
    parentAliveBeforeStop: f.parentAliveBeforeStop === true,
    descendantAliveBeforeStop: f.descendantAliveBeforeStop === true,
    sentinelAliveBeforeStop: f.sentinelAliveBeforeStop === true,
    ownedStopSucceeded: f.ownedStopSucceeded === true,
    parentExitObserved: f.parentExitObserved === true,
    descendantGoneAfterStop: f.descendantGoneAfterStop === true,
    unrelatedSentinelSurvived: f.unrelatedSentinelSurvived === true,
    repeatStopWasNoop: f.repeatStopWasNoop === true,
  });
  const verified = Object.values(checks).every(Boolean);
  return Object.freeze({
    schemaVersion: 1, kind: "owned-windows-process-tree-fixture",
    result: verified ? "verified-fixture" : "blocked", checks,
    processTreeTerminationProvenForFixture: verified,
    productionUatTreeTerminationProven: false, browserUatProven: false,
    independentVerification: false, remoteControlConnected: false,
    modelDispatchAllowed: false, mergeEligible: false,
  });
}
async function childFixture(config) {
  const folder = folderFor(config.id);
  const reservation = await boundedJson(path.join(folder, "reservation.json"));
  if (reservation?.id !== config.id || reservation?.token !== config.token || reservation?.kind !== "stop-fixture")
    throw new Error("Fixture reservation did not authorize this worker.");
  if (config.mode === "parent") {
    const child = spawn(process.execPath,
      [THIS, "--fixture-leaf", config.id, config.token, "descendant"],
      { cwd: REPO, stdio: "ignore", shell: false, windowsHide: true });
    if (!Number.isSafeInteger(child.pid) || child.pid < 1) throw new Error("Fixture descendant not launched.");
    await writeFile(path.join(folder, "parent-ready.json"), JSON.stringify({
      id: config.id, token: config.token, parentPid: process.pid, descendantPid: child.pid,
    }), { flag: "wx", mode: 0o600 });
  } else {
    await writeFile(path.join(folder, config.role + "-ready.json"),
      JSON.stringify({ id: config.id, token: config.token, role: config.role, pid: process.pid }),
      { flag: "wx", mode: 0o600 });
  }
  await sleep(FIXTURE_LIFETIME_MS);
}
function trackedFixture(args) {
  const child = spawn(process.execPath, [THIS, ...args], {
    cwd: REPO, stdio: "ignore", shell: false, windowsHide: true,
  });
  const state = { exited: false, errored: false };
  child.once("exit", () => { state.exited = true; });
  child.once("error", () => { state.errored = true; });
  return { child, state };
}
async function taskkillTree(pid) {
  try {
    await exec("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true, shell: false, timeout: 5_000, maxBuffer: 16_384,
    });
    return true;
  } catch { return false; }
}
export async function stopOwnedFixture(handle, killTree = taskkillTree) {
  // Only an in-memory live ChildProcess created by this exact operation.
  // No externally supplied PID, saved arbitrary PID or process-name matching.
  if (!handle || !Number.isSafeInteger(handle.child?.pid) || !handle.state
    || handle.state.exited || handle.state.errored) {
    return Object.freeze({ attempted: false, stopped: false, reason: "NOT_ACTIVE" });
  }
  const stopped = await killTree(handle.child.pid);
  return Object.freeze({ attempted: true, stopped: stopped === true,
    reason: stopped === true ? "TREE_KILL_ACCEPTED" : "TREE_KILL_FAILED" });
}
async function currentHead() {
  const { stdout } = await exec("git", ["rev-parse", "HEAD"], {
    cwd: REPO, windowsHide: true, timeout: 5_000, maxBuffer: 4096,
  });
  return stdout.trim();
}
async function prove(head) {
  if (process.platform !== "win32") throw new Error("Native Windows-only fixture; no simulated PASS.");
  if ((await currentHead()).toLowerCase() !== head) throw new Error("Exact checkout SHA mismatch.");
  const id = randomUUID(), token = randomBytes(32).toString("hex");
  const folder = folderFor(id);
  await mkdir(folder, { recursive: false, mode: 0o700 });
  const reservedAt = Date.now();
  await writeFile(path.join(folder, "reservation.json"), JSON.stringify({
    kind: "stop-fixture", id, token, head, attempt: 1, replayAuthorized: false,
    modelDispatchAllowed: false, remoteDispatchAuthorized: false,
  }), { flag: "wx", mode: 0o600 });
  let parent, sentinel;
  const facts = { platform: process.platform, sourceHeadMatched: true, privateReservation: true };
  try {
    sentinel = trackedFixture(["--fixture-leaf", id, token, "sentinel"]);
    parent = trackedFixture(["--fixture-parent", id, token]);
    facts.sentinelStarted = Number.isSafeInteger(sentinel.child.pid);
    facts.parentStarted = Number.isSafeInteger(parent.child.pid);
    const ready = await poll(async () => {
      const p = await boundedJson(path.join(folder, "parent-ready.json"));
      const d = await boundedJson(path.join(folder, "descendant-ready.json"));
      const s = await boundedJson(path.join(folder, "sentinel-ready.json"));
      if (p?.id !== id || p?.token !== token || p?.parentPid !== parent.child.pid
        || d?.id !== id || d?.token !== token || d?.role !== "descendant"
        || d?.pid !== p.descendantPid || s?.id !== id || s?.token !== token
        || s?.role !== "sentinel" || s?.pid !== sentinel.child.pid) return null;
      return { parent: p.parentPid, descendant: d.pid, sentinel: s.pid };
    }, READY_TIMEOUT_MS);
    facts.descendantStarted = ready !== null;
    if (ready) {
      facts.parentAliveBeforeStop = pidAlive(ready.parent);
      facts.descendantAliveBeforeStop = pidAlive(ready.descendant);
      facts.sentinelAliveBeforeStop = pidAlive(ready.sentinel);
      const stopped = await stopOwnedFixture(parent);
      facts.ownedStopSucceeded = stopped.stopped;
      facts.parentExitObserved = Boolean(await poll(() => parent.state.exited, EXIT_TIMEOUT_MS));
      facts.descendantGoneAfterStop = Boolean(await poll(() => !pidAlive(ready.descendant), EXIT_TIMEOUT_MS));
      facts.unrelatedSentinelSurvived = pidAlive(ready.sentinel);
      // Even if taskkill succeeded, DO NOT claim a complete tree from the exit
      // code alone. The descendant must be independently absent.
      const again = await stopOwnedFixture(parent);
      facts.repeatStopWasNoop = !again.attempted && again.reason === "NOT_ACTIVE";
    }
  } finally {
    // Fixture-only cleanup: direct handles, not a saved/CLI-supplied PID.
    if (parent && !parent.state.exited && Number.isSafeInteger(parent.child.pid)) {
      await stopOwnedFixture(parent);
    }
    if (sentinel && !sentinel.state.exited) {
      sentinel.child.kill("SIGTERM");
      await poll(() => sentinel.state.exited, EXIT_TIMEOUT_MS);
    }
  }
  const result = assessWindowsStopFixture(facts);
  const evidence = {
    ...result, head, proofId: id, evidenceSha256: digest({
      head, id, facts: result.checks, completedAt: Date.now(), reservedAt,
    }), createdAt: reservedAt, completedAt: Date.now(),
  };
  // Omit token, PIDs, paths and process command lines from output or report.
  await writeFile(path.join(folder, "result.json"), JSON.stringify(evidence, null, 2)+"\n",
    { flag: "wx", mode: 0o600 });
  return evidence;
}
async function main() {
  const args = parseStopProofArgs(process.argv.slice(2));
  if (args.mode === "prove") {
    const result = await prove(args.head);
    process.stdout.write(JSON.stringify(result, null, 2)+"\n");
    if (result.result !== "verified-fixture") process.exitCode = 2;
  } else await childFixture(args);
}
if (process.argv[1] && path.resolve(process.argv[1]) === THIS) {
  main().catch((error) => {
    process.stderr.write("Windows stop proof blocked: "+String(error?.message||"unknown").slice(0,170)+"\n");
    process.exitCode = 1;
  });
}
