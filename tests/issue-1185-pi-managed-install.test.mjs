import assert from "node:assert/strict";
import { readFile, mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import {
  ensureManagedPiInstalled,
  managedPiCommand,
  managedPiRoot,
  PLOTPICKLE_MANAGED_PI_PACKAGE,
  PLOTPICKLE_MANAGED_PI_VERSION,
  probeManagedPi,
} from "../scripts/pi-managed-install.mjs";

async function reviewedRead(file, encoding) {
  if (file instanceof URL) return readFile(file, encoding);
  if (String(file).replaceAll("\\", "/").endsWith("undici/package.json")) {
    const lock = JSON.parse(await readFile(new URL("../.pi/managed/package-lock.json", import.meta.url), "utf8"));
    return JSON.stringify({ name: "undici", version: lock.packages["node_modules/undici"].version });
  }
  return readFile(new URL(String(file).endsWith("package-lock.json") ? "../.pi/managed/package-lock.json" : "../.pi/managed/package.json", import.meta.url), encoding);
}

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#3289 same-version dependency repair validates actual installed files and then reuses the current graph", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-3289-"));
  const command = managedPiCommand({ root });
  const manifest = await read(".pi/managed/package.json");
  const lock = await read(".pi/managed/package-lock.json");
  const expectedUndici = JSON.parse(lock).packages["node_modules/undici"].version;
  let installs = 0;
  const options = { root, nodeVersion: "26.12.0", npmCommand: "npm",
    resolveCliEntry: async () => "synthetic-safe-dist-cli.js",
    existsSync: (file) => file === command,
    runPortableCommand: async (_cmd, args) => {
      if (args[0] === "ci") {
        installs += 1;
        await writeFile(path.join(root, "node_modules/undici/package.json"), JSON.stringify({ name: "undici", version: expectedUndici }));
      }
      return { stdout: "1.3.0", stderr: "" };
    } };
  try {
    await mkdir(path.join(root, "node_modules/undici"), { recursive: true });
    await writeFile(path.join(root, "package.json"), manifest);
    await writeFile(path.join(root, "package-lock.json"), lock);
    await writeFile(path.join(root, "node_modules/undici/package.json"), JSON.stringify({ name: "undici", version: "8.10.2" }));
    assert.equal((await probeManagedPi(options)).state, "dependency-mismatch");
    await assert.rejects(ensureManagedPiInstalled({ ...options, allowInstall: false }), /automatic installation is disabled.*reviewed repository lock/u);
    assert.equal(installs, 0);
    assert.equal((await ensureManagedPiInstalled(options)).installed, true);
    assert.equal(installs, 1);
    assert.equal((await ensureManagedPiInstalled(options)).installed, false);
    assert.equal(installs, 1);
    await writeFile(path.join(root, "package-lock.json"), "{}");
    assert.equal((await probeManagedPi(options)).state, "dependency-mismatch");
    await writeFile(path.join(root, "package-lock.json"), lock);
    await rm(path.join(root, "node_modules/undici/package.json"));
    assert.equal((await probeManagedPi(options)).ready, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#3289 a successful installer exit cannot conceal stale installed dependencies", async () => {
  await assert.rejects(ensureManagedPiInstalled({
    root: "synthetic-pi-3289", nodeVersion: "26.12.0", npmCommand: "npm",
    resolveCliEntry: async () => "synthetic-safe-dist-cli.js",
    existsSync: () => true, mkdir: async () => {}, writeFile: async () => {},
    readFile: async (file, encoding) => String(file).replaceAll("\\", "/").endsWith("undici/package.json")
      ? JSON.stringify({ name: "undici", version: "8.10.2" }) : reviewedRead(file, encoding),
    runPortableCommand: async () => ({ stdout: "1.3.0", stderr: "" }),
  }), /private executable failed validation/u);
});

test("#1185 managed Windows Pi lives under LOCALAPPDATA rather than the locked global npm wrapper", () => {
  const env = {
    LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local",
    APPDATA: "C:\\Users\\Test Writer\\AppData\\Roaming",
  };
  const root = managedPiRoot({ platform: "win32", env });
  const command = managedPiCommand({ platform: "win32", env, root });
  assert.equal(root, "C:\\Users\\Test Writer\\AppData\\Local\\PlotPickle\\developer-agent\\pi-cli");
  assert.equal(command, `${root}\\node_modules\\.bin\\pi.cmd`);
  assert.equal(command.toLowerCase().includes("appdata\\roaming\\npm"), false);
});

test("#1551 developer-agent metadata stays aligned with the authoritative managed Pi 1.3.0 pin", async () => {
  const stack = JSON.parse(await read("config/developer-agent-stack.json"));
  const pi = stack.requiredAgents.find((agent) => agent.id === "pi");
  assert.equal(stack.piRuntime.managedVersion, PLOTPICKLE_MANAGED_PI_VERSION);
  assert.equal(pi?.installCommand, "node scripts/ensure-pi-cli.mjs");
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
    if (args[0] === "ci") {
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
    resolveCliEntry: async () => "synthetic-safe-dist-cli.js",
    existsSync: (candidate) => existing.has(String(candidate).toLowerCase()),
    commandOnPath: () => { throw new Error("PATH lookup must not be required when npm.cmd is beside node.exe"); },
    runPortableCommand,
    readFile: reviewedRead,
    mkdir: async () => {},
    writeFile: async () => {},
  });
  assert.equal(result.ready, true);
  assert.equal(result.command, command);
  assert.equal(result.version, "1.3.0");
  assert.equal(result.installed, true);
  const install = calls.find((entry) => entry[1] === "ci");
  assert.ok(install);
  assert.equal(install[0], npmCommand);
  assert.deepEqual(install.slice(1), ["ci", "--prefix", root, "--ignore-scripts", "--no-audit", "--no-fund"]);
  assert.equal(install.includes("-g"), false);
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
    readFile: reviewedRead,
    resolveCliEntry: async () => "synthetic-safe-dist-cli.js",
    runPortableCommand: async () => { calls += 1; return { stdout: "pi 1.3.0", stderr: "" }; },
  });
  assert.equal(result.ready, true);
  assert.equal(result.command, command);
  assert.equal(result.version, "1.3.0");
  assert.equal(result.expectedVersion, "1.3.0");
  assert.equal(calls, 1);
});

test("#1551 stale managed Pi is upgraded to the pinned 1.3.0 package rather than accepted", async () => {
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
    resolveCliEntry: async () => "synthetic-safe-dist-cli.js",
    existsSync: (candidate) => candidate === command || candidate === npmCommand,
    mkdir: async () => {},
    writeFile: async () => {},
    readFile: reviewedRead,
    runPortableCommand: async (cmd, args) => {
      calls.push([cmd, ...args]);
      if (args[0] === "ci") {
        installed = true;
        return { stdout: "installed", stderr: "" };
      }
      return { stdout: installed ? "1.3.0" : "0.83.0", stderr: "" };
    },
  });
  assert.equal(result.ready, true);
  assert.equal(result.version, "1.3.0");
  assert.equal(result.installed, true);
  assert.ok(calls.some((entry) => entry[1] === "ci"));
});

test("#1185 wrong managed Pi version fails closed when installation is disabled", async () => {
  const env = { LOCALAPPDATA: "C:\\Users\\Test Writer\\AppData\\Local" };
  const command = managedPiCommand({ platform: "win32", env });
  await assert.rejects(() => ensureManagedPiInstalled({
    platform: "win32",
    env,
    nodeVersion: "22.19.0",
    allowInstall: false,
    resolveCliEntry: async () => "synthetic-safe-dist-cli.js",
    existsSync: (candidate) => candidate === command,
    readFile: reviewedRead,
    runPortableCommand: async () => ({ stdout: "0.83.0", stderr: "" }),
  }), /Expected 1\.3\.0; found 0\.83\.0/u);
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
  const batch = await read("scripts/windows-batch-command.mjs");
  const combined = `${managed}\n${ensure}\n${runtime}`;
  assert.match(ensure, /ensureManagedPiInstalled/);
  assert.match(managed, /PLOTPICKLE_MANAGED_PI_VERSION = "1\.3\.0"/u);
  assert.match(managed, /resolveActiveNpmCommand/);
  assert.match(managed, /"ci",\s*\n\s*"--prefix", root/);
  assert.match(runtime, /windowsBatchInvocation/);
  assert.match(runtime, /windowsBatchWrapper\(command\)/);
  assert.doesNotMatch(runtime, /process\.env\.ComSpec/);
  assert.match(batch, /PLOTPICKLE_BATCH_COMMAND/);
  assert.match(batch, /Object\.freeze\(\["\/d", "\/c", "call", "%PLOTPICKLE_BATCH_COMMAND%"/);
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
  assert.match(review, /runManagedPiReadOnly/u);
  assert.doesNotMatch(review, /command: pi\.command/u);
});

test("#3291 managed readiness probes unbundled Pi through Node, never the embedded-Undici npm shim", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-safe-probe-"));
  const command = managedPiCommand({ root });
  const packageRoot = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  const bundled = path.join(packageRoot, "dist", "bundle", "cli.js");
  const safeCli = path.join(packageRoot, "dist", "cli.js");
  const launches = [];
  try {
    await mkdir(path.dirname(command), { recursive: true });
    await mkdir(path.dirname(bundled), { recursive: true });
    await writeFile(command, "throw new Error('npm wrapper must not run')\n");
    await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({
      name: "@earendil-works/pi-coding-agent", version: "1.3.0",
      bin: { pi: "dist/bundle/cli.js" },
    }));
    await writeFile(bundled, "throw new Error('embedded Undici must not run')\n");
    await writeFile(safeCli, "// published unbundled Pi entry\n");
    const result = await probeManagedPi({
      root,
      existsSync: candidate => candidate === command,
      readFile: reviewedRead,
      runPortableCommand: async (executable, args) => {
        launches.push([executable, ...args]);
        return { stdout: "1.3.0", stderr: "" };
      },
    });
    assert.equal(result.ready, true);
    assert.deepEqual(launches, [[process.execPath, safeCli, "--version"]]);
    assert.notEqual(launches[0][0], command);
    assert.notEqual(launches[0][1], bundled);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#3291 managed readiness fails closed when unbundled Pi is missing even if bundled wrapper exists", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-pi-no-safe-cli-"));
  const command = managedPiCommand({ root });
  const packageRoot = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  let launches = 0;
  try {
    await mkdir(path.dirname(command), { recursive: true });
    await mkdir(path.join(packageRoot, "dist", "bundle"), { recursive: true });
    await writeFile(command, "unsafe wrapper\n");
    await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({
      name: "@earendil-works/pi-coding-agent", version: "1.3.0",
      bin: { pi: "dist/bundle/cli.js" },
    }));
    await writeFile(path.join(packageRoot, "dist", "bundle", "cli.js"), "unsafe bundle\n");
    const result = await probeManagedPi({
      root, existsSync: candidate => candidate === command,
      runPortableCommand: async () => { launches++; return { stdout: "1.3.0", stderr: "" }; },
    });
    assert.equal(result.ready, false);
    assert.equal(result.state, "invalid-managed-install");
    assert.equal(launches, 0, "Neither the published shim nor the bundled fallback may run");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
