#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { inspectEngineeringCheckout } from "./engineering-team/run-local.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const UAT_SCRIPT = path.join(REPO, "scripts", "run-uat-autopilot.mjs");
const HASH = /^[a-f0-9]{64}$/;
const SHA = /^[a-f0-9]{40}$/;
const TASK = /^[a-z0-9][a-z0-9._:/-]{1,119}$/i;
const MAX_REPORT = 512_000;
const MAX_DURATION_MS = 20 * 60_000;
const POLL_MS = 400;
const hash = (value) => createHash("sha256").update(value).digest("hex");

function privateAppRoot() {
  if (process.env.LOCALAPPDATA) return path.resolve(process.env.LOCALAPPDATA, "PlotPickle");
  if (process.platform === "win32") return path.resolve(os.homedir(), "AppData", "Local", "PlotPickle");
  return path.resolve(os.homedir(), ".local", "share", "PlotPickle");
}
function controlDir(appRoot) {
  if (!path.isAbsolute(appRoot)) throw new Error("Windows UAT control requires an absolute private app root.");
  return path.join(appRoot, "engineering-team", "windows-uat-control");
}
export function parseWindowsUatCommand(args) {
  if (!Array.isArray(args)) throw new Error("Windows UAT command requires explicit arguments.");
  const modes = ["--start", "--status", "--stop", "--worker", "--doctor"].filter((flag) => args.includes(flag));
  if (modes.length !== 1) throw new Error("Windows UAT requires exactly one explicit start/status/stop operation.");
  const values = {};
  const keys = new Set(["--head", "--base", "--task", "--attempt", "--scope"]);
  for (let i = 0; i < args.length; i++) {
    if (modes.includes(args[i])) continue;
    if (!keys.has(args[i]) || values[args[i]] !== undefined || !args[i+1] || args[i+1].startsWith("--"))
      throw new Error("Windows UAT command has unknown, duplicate or missing options.");
    values[args[i]] = args[++i];
  }
  const mode = modes[0].slice(2);
  if (args.filter((item) => item === modes[0]).length !== 1) throw new Error("Windows UAT duplicate operation.");
  if (mode === "doctor") {
    if (Object.keys(values).length) throw new Error("Windows UAT doctor takes no additional arguments.");
    return Object.freeze({ mode });
  }
  if (mode === "start") {
    if (values["--scope"] !== undefined || !SHA.test(values["--head"] || "")
      || !SHA.test(values["--base"] || "") || values["--head"] === values["--base"]
      || !TASK.test(values["--task"] || "")) throw new Error("Windows UAT start requires exact base/head and bounded task.");
    const attempt = Number(values["--attempt"] ?? 1);
    if (!Number.isInteger(attempt) || attempt < 1 || attempt > 9) throw new Error("Windows UAT attempt must be 1-9.");
    return Object.freeze({ mode, head: values["--head"].toLowerCase(), base: values["--base"].toLowerCase(),
      task: values["--task"], attempt });
  }
  if (Object.keys(values).length !== 1 || !HASH.test(values["--scope"] || "")) {
    throw new Error("Windows UAT status/stop/worker requires only a 64-hex private scope.");
  }
  return Object.freeze({ mode, scope: values["--scope"] });
}

async function safeJson(file) {
  let stat;
  try { stat = await lstat(file); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_REPORT) {
    throw new Error("Windows UAT private evidence is not a bounded ordinary file.");
  }
  return JSON.parse(await readFile(file, "utf8"));
}
async function privateScope(root, scope) {
  if (!HASH.test(scope)) throw new Error("Windows UAT requires a verified scope.");
  const folder = path.join(controlDir(root), scope);
  const stat = await lstat(folder);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Windows UAT directory must be a private ordinary directory.");
  return folder;
}
async function atomicJson(file, value) {
  const temporary = file + "." + process.pid + ".tmp";
  await writeFile(temporary, JSON.stringify(value) + "\n", { flag: "wx", mode: 0o600 });
  await rename(temporary, file);
}
export function windowsUatScope({ head, base, task, attempt }) {
  if (!SHA.test(head) || !SHA.test(base) || !TASK.test(task) || !Number.isInteger(attempt)
    || attempt < 1 || attempt > 9) throw new Error("Windows UAT cannot scope an invalid task.");
  return hash(JSON.stringify({ schemaVersion: 1, head, base, task, attempt, mode: "contracts-only" }));
}

/** Non-installing dev toolchain probe. No provider dispatch, UAT or reservation. */
export function checkWindowsUatToolchain({ repoRoot = REPO, loadTypeScript } = {}) {
  if (!path.isAbsolute(repoRoot)) throw new Error("Windows UAT toolchain requires an absolute repository root.");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  } catch {
    return Object.freeze({ ready: false, code: "PACKAGE_MANIFEST_UNAVAILABLE" });
  }
  const pinned = /^npm:@typescript\/typescript6@(\d+\.\d+\.\d+)$/.exec(
    String(manifest.devDependencies?.typescript || ""),
  );
  if (!pinned) return Object.freeze({ ready: false, code: "TYPESCRIPT_PIN_UNVERIFIED" });
  const expectedVersion = pinned[1];
  let ts;
  try {
    ts = loadTypeScript ? loadTypeScript() : createRequire(path.join(repoRoot, "package.json"))("typescript");
  } catch (error) {
    const missing = error?.code === "MODULE_NOT_FOUND" || error?.code === "ERR_MODULE_NOT_FOUND";
    return Object.freeze({ ready: false, code: missing ? "TYPESCRIPT_NOT_INSTALLED" : "TYPESCRIPT_UNUSABLE",
      expectedVersion });
  }
  if (!ts || typeof ts.transpileModule !== "function") {
    return Object.freeze({ ready: false, code: "TYPESCRIPT_UNUSABLE", expectedVersion });
  }
  if (ts.version !== expectedVersion) {
    return Object.freeze({ ready: false, code: "TYPESCRIPT_VERSION_MISMATCH",
      expectedVersion, observedVersion: typeof ts.version === "string" ? ts.version.slice(0, 40) : "unknown" });
  }
  return Object.freeze({ ready: true, code: "READY", expectedVersion, observedVersion: ts.version,
    source: "locally-installed-dev-toolchain", inferenceStarted: false, installationPerformed: false });
}

/** This local-only launcher never accepts GitHub comments or remote instructions. */
export async function startWindowsUat(config, {
  appRoot = privateAppRoot(), repoRoot = REPO, inspect = () => inspectEngineeringCheckout({repoRoot,base:config.base}),
  launch = (args, opts) => spawn(process.execPath, args, opts),
  preflight = () => checkWindowsUatToolchain({ repoRoot }),
} = {}) {
  if (config.mode !== "start") throw new Error("Explicit local start operation required.");
  const checkout = await inspect();
  if (checkout.head !== config.head) throw new Error("Windows UAT checkout differs from exact authorized head.");
  // Fail before allocating an irreversible attempt or starting a child.
  const readiness = await preflight();
  if (readiness?.ready !== true) {
    throw new Error("Windows UAT toolchain blocked: " + String(readiness?.code || "TOOLCHAIN_UNKNOWN")
      + "; use --doctor before authorizing an attempt.");
  }
  const scope = windowsUatScope(config);
  const root = controlDir(appRoot);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const folder = path.join(root, scope);
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await privateScope(appRoot, scope);
  // No retries or duplicate starts. An attempt may have reached the provider
  // or child process before crashing; the reservation is never removed.
  await writeFile(path.join(folder, "reservation.json"), JSON.stringify({
    schemaVersion: 1, scope, head: config.head, base: config.base, task: config.task,
    attempt: config.attempt, mode: "contracts-only", replayAuthorized: false,
    remoteDispatchAuthorized: false, modelDispatchAuthorized: false, mergeEligible: false,
  }) + "\n", { flag: "wx", mode: 0o600 });
  try {
    const child = launch([fileURLToPath(import.meta.url), "--worker", "--scope", scope], {
      cwd: repoRoot, env: process.env, stdio: "ignore", detached: true, windowsHide: true,
    });
    if (!Number.isInteger(child.pid) || child.pid < 1) throw new Error("Windows UAT worker launch not confirmed.");
    child.unref?.();
  } catch {
    await atomicJson(path.join(folder, "launch-failure.json"), {
      state: "blocked", code: "LOCAL_WORKER_LAUNCH_FAILED", mergeEligible: false,
    });
    throw new Error("Windows UAT worker launch blocked; reserved attempt must not replay.");
  }
  return Object.freeze({ scope, status: "dispatched-unconfirmed",
    remoteDispatchAuthorized: false, mergeEligible: false });
}

export async function statusWindowsUat(scope, { appRoot = privateAppRoot(), now = Date.now } = {}) {
  const folder = await privateScope(appRoot, scope);
  const [reservation, terminal, launchFailure, heartbeat, stop] = await Promise.all([
    safeJson(path.join(folder,"reservation.json")),
    safeJson(path.join(folder,"terminal.json")),
    safeJson(path.join(folder,"launch-failure.json")),
    safeJson(path.join(folder,"heartbeat.json")),
    safeJson(path.join(folder,"stop-request.json")),
  ]);
  if (!reservation || reservation.scope !== scope || !SHA.test(reservation.head || "")) {
    throw new Error("Windows UAT reservation mismatch.");
  }
  const terminalStatus = new Set(["observed-pass", "observed-fail", "cancelled-child-exited",
    "blocked", "stale"]).has(terminal?.state) && terminal?.scope === scope
    && terminal?.head === reservation.head ? terminal.state : null;
  const fresh = heartbeat?.scope === scope && Number.isFinite(heartbeat?.at)
    && heartbeat.at <= now() + 2_000 && now() - heartbeat.at <= 5_000;
  const state = terminalStatus || (launchFailure ? "blocked"
    : stop ? "stop-requested" : fresh ? "running-heartbeat" : "unconfirmed");
  return Object.freeze({
    schemaVersion: 1, scope, exactSha: reservation.head, task: reservation.task,
    state, cancellationAcknowledged: state === "cancelled-child-exited",
    childExitObserved: terminalStatus !== null && terminal?.childExitObserved === true,
    evidenceSha256: terminalStatus ? terminal.evidenceSha256 || null : null,
    browserUatProven: false, independentVerification: false, mergeEligible: false,
    remoteControlConnected: false, modelDispatchAllowed: false,
  });
}
export async function requestStopWindowsUat(scope, { appRoot = privateAppRoot(), now = Date.now } = {}) {
  const current = await statusWindowsUat(scope, { appRoot, now });
  if (["observed-pass","observed-fail","cancelled-child-exited","blocked","stale"].includes(current.state)) return current;
  const folder = await privateScope(appRoot, scope);
  try {
    await writeFile(path.join(folder,"stop-request.json"), JSON.stringify({
      schemaVersion: 1, scope, requestedAt: now(), reason: "local-operator",
    }) + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) { if (error?.code !== "EEXIST") throw error; }
  return statusWindowsUat(scope, { appRoot, now });
}

/** Worker owns the only UAT child it can cancel; status alone never kills a PID. */
export async function driveWindowsUat(scope, {
  appRoot = privateAppRoot(), repoRoot = REPO, now = Date.now,
  inspect, launch, preflight = () => checkWindowsUatToolchain({ repoRoot }),
  maxDurationMs = MAX_DURATION_MS, pollMs = POLL_MS,
} = {}) {
  const folder = await privateScope(appRoot, scope);
  const reservation = await safeJson(path.join(folder,"reservation.json"));
  if (!reservation || reservation.scope !== scope || reservation.mode !== "contracts-only"
    || !SHA.test(reservation.head || "") || !SHA.test(reservation.base || "")
    || !TASK.test(reservation.task || "")) throw new Error("Windows UAT worker reservation invalid.");
  // Write-once barrier; an interrupted dispatch is UNKNOWN, never re-executed.
  await writeFile(path.join(folder,"worker-started.json"), JSON.stringify({ scope, state: "started-uncertain-on-crash" })+"\n",
    { flag:"wx", mode: 0o600 });
  let child = null, exitCode = null, exitObserved = false, exitError = null;
  const startAt = now();
  async function finish(state, code, evidenceSha256 = null) {
    await atomicJson(path.join(folder,"terminal.json"), {
      schemaVersion: 1, scope, head: reservation.head, state, code,
      childExitObserved: exitObserved, evidenceSha256, completedAt: now(),
      independentVerification: false, mergeEligible: false,
    });
    return statusWindowsUat(scope, { appRoot, now });
  }
  try {
    const checked = await (inspect || (() => inspectEngineeringCheckout({ repoRoot, base:reservation.base })))();
    if (checked.head !== reservation.head) return finish("stale","STALE_CHECKOUT");
    if (await safeJson(path.join(folder,"stop-request.json"))) return finish("cancelled-child-exited","CANCELLED_BEFORE_CHILD");
    const readiness = await preflight();
    if (readiness?.ready !== true) return finish("blocked", readiness?.code || "TOOLCHAIN_UNKNOWN");
    const artifactRoot = path.join(folder,"focused-uat");
    await mkdir(artifactRoot,{recursive:true,mode:0o700});
    const spawnChild = launch || ((args,opts) => spawn(process.execPath,args,opts));
    child = spawnChild([UAT_SCRIPT,"--contracts-only","--artifact-root",artifactRoot], {
      cwd: repoRoot, env: process.env, stdio: "ignore", windowsHide: true, shell: false,
    });
    if (!Number.isInteger(child.pid) || child.pid < 1) return finish("blocked","CHILD_START_UNCONFIRMED");
    child.once("error", (error) => { exitError = error?.code === "ENOENT" ? "CHILD_MISSING" : "CHILD_EXECUTION_ERROR"; });
    child.once("exit",(code) => { exitObserved = true; exitCode = Number.isInteger(code) ? code : -1; });
    while (!exitObserved && !exitError) {
      await atomicJson(path.join(folder,"heartbeat.json"), { schemaVersion:1, scope, at: now(), state: "running" });
      if (await safeJson(path.join(folder,"stop-request.json"))) {
        child.kill("SIGTERM");
        // Do not claim descendant Windows process-tree termination here.
        break;
      }
      if (now() - startAt > maxDurationMs) {
        child.kill("SIGTERM");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve,pollMs));
    }
    if (child && !exitObserved && !exitError) {
      // Node confirms direct-child exit only; Windows grandchildren remain unproven.
      for(let wait=0;wait<20&&!exitObserved&&!exitError;wait++)
        await new Promise((resolve)=>setTimeout(resolve,pollMs));
    }
    if (!exitObserved) return finish("blocked", exitError || "CHILD_EXIT_UNCONFIRMED");
    if (await safeJson(path.join(folder,"stop-request.json"))) return finish("cancelled-child-exited","OPERATOR_STOP");
    if (now() - startAt > maxDurationMs) return finish("blocked","TIME_BUDGET_EXCEEDED");
    const after = await (inspect || (() => inspectEngineeringCheckout({repoRoot,base:reservation.base})))();
    if (after.head !== reservation.head) return finish("stale","STALE_CHECKOUT_AFTER_UAT");
    const report = await safeJson(path.join(artifactRoot,"autopilot-report.json"));
    if (!report || report.mode !== "contracts-only" || !["PASS","FAIL"].includes(report.overall)
      || !Number.isInteger(report.contracts?.code)
      || (report.overall === "PASS") !== (exitCode === 0)
      || (report.contracts.code === 0) !== (exitCode === 0)
      || !(Date.parse(report.generatedAt || "") >= startAt - 2_000)
      || Date.parse(report.generatedAt || "") > now() + 2_000)
      return finish("blocked","INVALID_OR_STALE_UAT_REPORT");
    const digest = hash(JSON.stringify(report));
    return finish(exitCode === 0 ? "observed-pass" : "observed-fail", "CONTRACTS_ONLY", digest);
  } catch {
    return finish("blocked","LOCAL_WORKER_EXECUTION_FAILED");
  }
}

async function main() {
  const config = parseWindowsUatCommand(process.argv.slice(2));
  const result = config.mode === "start" ? await startWindowsUat(config)
    : config.mode === "doctor" ? checkWindowsUatToolchain()
    : config.mode === "status" ? await statusWindowsUat(config.scope)
    : config.mode === "stop" ? await requestStopWindowsUat(config.scope)
    : await driveWindowsUat(config.scope);
  process.stdout.write(JSON.stringify(result,null,2)+"\n");
  if (config.mode === "doctor" && !result.ready) process.exitCode = 2;
  if (config.mode === "worker" && !["observed-pass","observed-fail","cancelled-child-exited"].includes(result.state))
    process.exitCode = 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("Windows UAT control blocked: "+String(error?.message||"Unknown failure").slice(0,180)+"\n");
    process.exitCode = 1;
  });
}
