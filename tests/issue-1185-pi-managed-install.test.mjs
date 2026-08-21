import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ensureManagedPiInstalled,
  managedPiCommand,
  managedPiRoot,
  PLOTPICKLE_MANAGED_PI_PACKAGE,
  PLOTPICKLE_MANAGED_PI_VERSION,
  probeManagedPi,
} from "../scripts/pi-managed-install.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1185 managed Windows Pi lives under LOCALAPPDATA rather than the locked global npm wrapper", () => {
  const env = {
    LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local",
    APPDATA: "C:\\Users\\Test Writer\\AppData\\Roaming",
  };
  const root = managedPiRoot({ platform: "win32", env });
  const command = managedPiCommand({ platform: "win32", env, root });
  assert.equal(root, "C:\\Users\\Test Writer\\AppData\\Local\\PlotPickle\\developer-agent\\pi-cli");
  assert.equal(command, `${root}\\pi.cmd`);
  assert.equal(command.toLowerCase().includes("appdata\\roaming\\npm"), false);
});

test("#1185 managed installer uses the active Windows npm.cmd and a private prefix without --force or PATH mutation", async () => {
  const env = { LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local" };
  const root = managedPiRoot({ platform: "win32", env });
  const command = managedPiCommand({ platform: "win32", env, root });
  const nodeExecutable = "C:\\Program Files\\nodejs\\node.exe";
  const npmCommand = "C:\\Program Files\\nodejs\\npm.cmd";
  const existing = new Set([npmCommand.toLowerCase()]);
  const calls = [];
  const runPortableCommand = async (cmd, args) => {
    calls.push([cmd, ...args]);
    if (args[0] === "install") {
      existing.add(command.toLowerCase());
      return { stdout: "installed", stderr: "" };
    }
    return { stdout: PLOTPICKLE_MANAGED_PI_VERSION, stderr: "" };
  };
  const result = await ensureManagedPiInstalled({
    platform: "win32",
    env,
    root,
    nodeExecutable,
    nodeVersion: "22.19.0",
    existsSync: (candidate) => existing.has(String(candidate).toLowerCase()),
    commandOnPath: () => { throw new Error("PATH lookup must not be required when npm.cmd is beside node.exe"); },
    runPortableCommand,
  });
  assert.equal(result.ready, true);
  assert.equal(result.command, command);
  assert.equal(result.version, "0.84.2");
  assert.equal(result.installed, true);
  const install = calls.find((entry) => entry[1] === "install");
  assert.ok(install);
  assert.equal(install[0], npmCommand);
  assert.deepEqual(install.slice(1, 6), ["install", "-g", "--prefix", root, "--ignore-scripts"]);
  assert.equal(install.at(-1), PLOTPICKLE_MANAGED_PI_PACKAGE);
  assert.equal(install.includes("--force"), false);
});

test("#1185 existing managed Pi validates without reinstalling only when it matches the exact managed version", async () => {
  const env = { LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local" };
  const command = managedPiCommand({ platform: "win32", env });
  let calls = 0;
  const result = await probeManagedPi({
    platform: "win32",
    env,
    existsSync: (candidate) => candidate === command,
    runPortableCommand: async () => { calls += 1; return { stdout: "pi 0.84.2", stderr: "" }; },
  });
  assert.equal(result.ready, true);
  assert.equal(result.command, command);
  assert.equal(result.version, "0.84.2");
  assert.equal(result.expectedVersion, "0.84.2");
  assert.equal(calls, 1);
});

test("#1185 stale managed Pi is upgraded to the pinned 0.84.2 package rather than accepted", async () => {
  const env = { LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local" };
  const root = managedPiRoot({ platform: "win32", env });
  const command = managedPiCommand({ platform: "win32", env, root });
  const npmCommand = "C:\\Program Files\\nodejs\\npm.cmd";
  let installed = false;
  const calls = [];
  const result = await ensureManagedPiInstalled({
    platform: "win32",
    env,
    root,
    nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    nodeVersion: "22.19.0",
    npmCommand,
    existsSync: (candidate) => candidate === command || candidate === npmCommand,
    runPortableCommand: async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (args[0] === "install") {
        installed = true;
        return { stdout: "installed", stderr: "" };
      }
      return { stdout: installed ? "0.84.2" : "0.83.0", stderr: "" };
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.version, "0.84.2");
  assert.equal(result.installed, true);
  assert.ok(calls.some((entry) => entry.at(-1) === PLOTPICKLE_MANAGED_PI_PACKAGE));
});

test("#1185 wrong managed Pi version fails closed when installation is disabled", async () => {
  const env = { LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local" };
  const command = managedPiCommand({ platform: "win32", env });
  await assert.rejects(() => ensureManagedPiInstalled({
    platform: "win32",
    env,
    nodeVersion: "22.19.0",
    allowInstall: false,
    existsSync: (candidate) => candidate === command,
    runPortableCommand: async () => ({ stdout: "0.83.0", stderr: "" }),
  }), /Expected 0\.84\.2; found 0\.83\.0/u);
});

test("#1185 startup health provisions managed Pi when worker preflight says unavailable and exports the absolute command", async () => {
  const plugin = await read("build/uat-discovery-plugin.ts");
  assert.match(plugin, /ensure-pi-cli\.mjs/);
  assert.match(plugin, /repair\.workerAvailable === false/);
  assert.match(plugin, /process\.env\.PLOTPICKLE_PI_COMMAND = parsed\.command/);
  assert.match(plugin, /repair = await developerRepairPreflight\(\)/);
  assert.match(plugin, /global npm wrapper is not required/);
});

test("#1185 repair-stack bootstrap uses managed Pi and never recommends killing every Node process", async () => {
  const managed = await read("scripts/pi-managed-install.mjs");
  const ensure = await read("scripts/ensure-pi-repair-stack.mjs");
  const runtime = await read("scripts/pi-worker-runtime.mjs");
  const combined = `${managed}\n${ensure}\n${runtime}`;
  assert.match(ensure, /ensureManagedPiInstalled/);
  assert.match(managed, /PLOTPICKLE_MANAGED_PI_VERSION = "0\.84\.2"/u);
  assert.match(managed, /resolveActiveNpmCommand/);
  assert.match(managed, /"-g",\s*\n\s*"--prefix", root/);
  assert.match(runtime, /windowsBatchArguments/);
  assert.match(runtime, /\["\/d", "\/c", \.\.\.values\]/);
  assert.match(runtime, /windowsBatchWrapper\(command\)/);
  assert.doesNotMatch(runtime, /values\.join\(" "\)/);
  assert.doesNotMatch(combined, /--force/);
  assert.doesNotMatch(combined, /SetEnvironmentVariable/);
  assert.doesNotMatch(combined, /taskkill[^\n]*node\.exe/i);
  assert.doesNotMatch(combined, /Run as Administrator/i);
});

test("#1185 Full Verification stage 5, stage 6, and nested Pi quality review stay on the managed executable", async () => {
  const graph = await read("scripts/full-verification-graph.mjs");
  const processBoundary = await read("scripts/full-verification-process.mjs");
  const ensure = await read("scripts/ensure-pi-repair-stack.mjs");
  const preflight = await read("scripts/verify-pi-repair-worker.mjs");
  const review = await read("scripts/run-pi-code-quality-review.mjs");

  assert.match(graph, /id: "ensure-pi-model"/u);
  assert.match(graph, /id: "pi-preflight"/u);
  assert.match(processBoundary, /scripts\/ensure-pi-repair-stack\.mjs/u);
  assert.match(processBoundary, /scripts\/verify-pi-repair-worker\.mjs/u);
  for (const source of [ensure, preflight, review]) {
    assert.match(source, /ensureManagedPiInstalled/u);
    assert.doesNotMatch(source, /\bensurePiInstalled\b/u);
  }
  assert.match(preflight, /PLOTPICKLE_PI_COMMAND = pi\.command/u);
  assert.match(preflight, /env: \{ PLOTPICKLE_PI_COMMAND: pi\.command \}/u);
  assert.match(review, /command: pi\.command/u);
});
