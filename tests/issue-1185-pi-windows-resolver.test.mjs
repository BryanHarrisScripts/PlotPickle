import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolvePiExecutable } from "../scripts/pi-worker-runtime.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function windowsFixture(overrides = {}) {
  const appData = "C:\\Users\\Test Writer\\AppData\\Roaming";
  const npmPrefix = `${appData}\\npm`;
  const pi = `${npmPrefix}\\pi.cmd`;
  const existing = new Set([pi.toLowerCase()]);
  return {
    platform: "win32",
    env: { APPDATA: appData },
    nodeExecutable: "C:\\Program Files\\nodejs\\node.exe",
    commandOnPath: (name) => name === "npm" ? "C:\\Program Files\\nodejs\\npm.cmd" : "",
    npmGlobalPrefix: () => npmPrefix,
    existsSync: (candidate) => existing.has(String(candidate).toLowerCase()),
    versionProbe: async () => ({ ok: true, version: "0.73.1" }),
    ...overrides,
  };
}

test("#1185 recovers Pi from npm global prefix when the inherited Windows PATH is stale", async () => {
  const result = await resolvePiExecutable(windowsFixture());
  assert.equal(result.ready, true);
  assert.equal(result.executable, "C:\\Users\\Test Writer\\AppData\\Roaming\\npm\\pi.cmd");
  assert.equal(result.version, "0.73.1");
  assert.equal(result.discoveryMethod, "npm-global-prefix");
  assert.equal(result.remediationCode, "stale-path-recovered");
  assert.equal(result.nodeExecutable, "C:\\Program Files\\nodejs\\node.exe");
  assert.equal(result.npmExecutable, "C:\\Program Files\\nodejs\\npm.cmd");
  assert.equal(result.npmPrefix, "C:\\Users\\Test Writer\\AppData\\Roaming\\npm");
});

test("#1185 supports APPDATA npm fallback after active npm provenance is established", async () => {
  const appDataPi = "C:\\Users\\Test Writer\\AppData\\Roaming\\npm\\pi.cmd";
  const result = await resolvePiExecutable(windowsFixture({
    npmGlobalPrefix: () => "D:\\Different npm prefix",
    existsSync: (candidate) => String(candidate).toLowerCase() === appDataPi.toLowerCase(),
  }));
  assert.equal(result.ready, true);
  assert.equal(result.executable, appDataPi);
  assert.equal(result.discoveryMethod, "appdata-npm-fallback");
  assert.equal(result.remediationCode, "stale-path-recovered");
});

test("#1185 explicit Pi executable wins, validates, and paths containing spaces stay intact", async () => {
  const explicit = "C:\\Tools With Spaces\\Pi\\pi.cmd";
  const result = await resolvePiExecutable(windowsFixture({
    explicitCommand: explicit,
    existsSync: (candidate) => candidate === explicit,
    versionProbe: async (candidate) => ({ ok: candidate === explicit, version: "0.73.1" }),
  }));
  assert.equal(result.ready, true);
  assert.equal(result.executable, explicit);
  assert.equal(result.discoveryMethod, "explicit");
  assert.equal(result.remediationCode, "ready");
});

test("#1185 invalid explicit configuration fails closed instead of silently selecting another Pi", async () => {
  const result = await resolvePiExecutable(windowsFixture({
    explicitCommand: "C:\\Missing\\pi.cmd",
  }));
  assert.equal(result.ready, false);
  assert.equal(result.remediationCode, "explicit-missing");
  assert.match(result.message, /configured Pi executable/i);
});

test("#1185 distinguishes an invalid npm wrapper from a genuinely absent Pi install", async () => {
  const invalid = await resolvePiExecutable(windowsFixture({
    versionProbe: async () => ({ ok: false, status: 1, stderr: "wrapper target missing" }),
  }));
  assert.equal(invalid.ready, false);
  assert.equal(invalid.remediationCode, "invalid-wrapper");
  assert.match(invalid.message, /failed validation/i);
  assert.match(invalid.message, /locking the npm wrapper/i);

  const absent = await resolvePiExecutable(windowsFixture({
    existsSync: () => false,
  }));
  assert.equal(absent.ready, false);
  assert.equal(absent.remediationCode, "not-installed");
  assert.match(absent.message, /npm install -g @earendil-works\/pi-coding-agent/i);
});

test("#1185 inherited PATH remains the cheap first choice on non-Windows platforms", async () => {
  const result = await resolvePiExecutable({
    platform: "linux",
    env: {},
    commandOnPath: (name) => name === "pi" ? "/usr/local/bin/pi" : name === "npm" ? "/usr/local/bin/npm" : "",
    npmGlobalPrefix: () => "/usr/local",
    existsSync: (candidate) => candidate === "/usr/local/bin/pi",
    versionProbe: async () => ({ ok: true, version: "0.73.1" }),
  });
  assert.equal(result.ready, true);
  assert.equal(result.executable, "/usr/local/bin/pi");
  assert.equal(result.discoveryMethod, "path");
  assert.equal(result.remediationCode, "ready");
});

test("#1185 Developer Repair Worker preflight and launch consume one resolved absolute Pi executable", async () => {
  const runner = await read("scripts/run-uat-repair-agent.mjs");
  assert.match(runner, /import \{ resolvePiExecutable, runPortableCommand \} from "\.\/pi-worker-runtime\.mjs"/u);
  assert.match(runner, /piResolution = await resolvePiExecutable\(\)/u);
  assert.match(runner, /runPortableCommand\(resolution\.executable, \[/u);
  assert.doesNotMatch(runner, /runCli\(resolution\.executable, \[/u);
  assert.doesNotMatch(runner, /runCli\("pi", \[/u);
  for (const field of ["workerExecutable", "workerVersion", "workerDiscoveryMethod", "workerRemediationCode", "workerNodeExecutable", "workerNpmExecutable", "workerNpmPrefix"]) {
    assert.ok(runner.includes(field), `missing Pi provenance field ${field}`);
  }
});

test("#1185 resolver records diagnostics without silently rewriting Windows PATH or forcing npm repair", async () => {
  const runtime = await read("scripts/pi-worker-runtime.mjs");
  const runner = await read("scripts/run-uat-repair-agent.mjs");
  const combined = `${runtime}\n${runner}`;
  assert.match(runtime, /discoveryMethod/u);
  assert.match(runtime, /nodeExecutable/u);
  assert.match(runtime, /npmExecutable/u);
  assert.match(runtime, /npmPrefix/u);
  assert.doesNotMatch(combined, /SetEnvironmentVariable/u);
  assert.doesNotMatch(combined, /\.zshrc/u);
  assert.doesNotMatch(combined, /\bsource\s+~\//u);
  assert.doesNotMatch(runtime, /npm[^\n]*install[^\n]*--force/u);
});
