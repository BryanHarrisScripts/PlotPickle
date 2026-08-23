import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS,
  FULL_VERIFICATION_RUNNER_OVERALL_TIMEOUT_MS,
  canonicalEntrypointPath,
  isDirectExecution,
  superviseProcess,
  writeStartupHandshake,
} from "../scripts/full-verification-supervisor.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function sink() {
  let value = "";
  return {
    write(chunk) { value += String(chunk || ""); },
    text() { return value; },
  };
}

test("Full Verification outer watchdog has an independent liveness and overall bound", () => {
  assert.equal(FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS, 45_000);
  assert.equal(FULL_VERIFICATION_RUNNER_OVERALL_TIMEOUT_MS, 4 * 60 * 60_000);
  assert.ok(FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS > 10_000, "watchdog must allow several normal 10-second heartbeats");
});

test("outer watchdog stops a deliberately silent runner instead of hanging forever", async () => {
  const stdout = sink();
  const stderr = sink();
  const started = Date.now();
  const result = await superviseProcess({
    command: process.execPath,
    args: ["-e", "setInterval(() => {}, 1000)"],
    livenessTimeoutMs: 150,
    overallTimeoutMs: 5_000,
    pollMs: 25,
    stdout,
    stderr,
  });

  assert.equal(result.exitCode, 125);
  assert.equal(result.reason, "liveness-timeout");
  assert.match(result.detail, /liveness timeout/i);
  assert.match(stderr.text(), /WATCHDOG liveness timeout/i);
  assert.ok(Date.now() - started < 8_000, "watchdog cleanup must itself remain bounded");
});

test("outer watchdog preserves normal runner output and exit code", async () => {
  const stdout = sink();
  const stderr = sink();
  const result = await superviseProcess({
    command: process.execPath,
    args: ["-e", "console.log('heartbeat-ok')"],
    livenessTimeoutMs: 1_000,
    overallTimeoutMs: 5_000,
    pollMs: 25,
    stdout,
    stderr,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.reason, "runner-exit");
  assert.match(stdout.text(), /heartbeat-ok/);
  assert.equal(stderr.text(), "");
});

test("supervisor startup writes a filesystem handshake for the PowerShell launcher", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-verification-handshake-"));
  const handshake = path.join(directory, "watchdog.ready");
  try {
    writeStartupHandshake(handshake);
    const payload = JSON.parse(await readFile(handshake, "utf8"));
    assert.equal(payload.pid, process.pid);
    assert.match(payload.startedAt, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Windows direct-entry comparison is case-insensitive and canonicalized", () => {
  const upper = canonicalEntrypointPath("C:\\Users\\Bryan\\PlotPickle\\scripts\\full-verification-supervisor.mjs", "win32");
  const lower = canonicalEntrypointPath("c:\\users\\bryan\\plotpickle\\SCRIPTS\\FULL-VERIFICATION-SUPERVISOR.MJS", "win32");
  assert.equal(upper, lower);
  assert.equal(
    isDirectExecution(
      "C:\\Users\\Bryan\\PlotPickle\\scripts\\full-verification-supervisor.mjs",
      "c:\\users\\bryan\\plotpickle\\SCRIPTS\\FULL-VERIFICATION-SUPERVISOR.MJS",
      "win32",
    ),
    true,
  );
});

test("PowerShell adds a launcher-level watchdog startup bound and keeps BLOCKED fallback", async () => {
  const [powerShell, launcher, supervisor] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/invoke-full-verification-supervisor.ps1"),
    read("scripts/full-verification-supervisor.mjs"),
  ]);

  assert.match(powerShell, /invoke-full-verification-supervisor\.ps1/);
  assert.match(powerShell, /HandshakeTimeoutSeconds 12/);
  assert.doesNotMatch(powerShell, /& node "\.\\scripts\\full-verification-progress-runner\.mjs"/);
  assert.match(powerShell, /Verification graph result was unavailable/);
  assert.match(powerShell, /Write-StructuredVerificationRecord/);

  assert.match(launcher, /Full Verification launcher \.{8} START/);
  assert.match(launcher, /waiting up to \$HandshakeTimeoutSeconds s for watchdog acknowledgement/);
  assert.match(launcher, /Start-Process/);
  assert.match(launcher, /RedirectStandardOutput/);
  assert.match(launcher, /RedirectStandardError/);
  assert.match(launcher, /Stop-ProcessTreeBounded/);
  assert.match(launcher, /taskkill\.exe/);
  assert.match(launcher, /Test-Path -LiteralPath \$HandshakePath/);
  assert.match(launcher, /return \$ExitCode/);

  assert.match(supervisor, /--handshake-file/);
  assert.match(supervisor, /writeStartupHandshake/);
  assert.match(supervisor, /full-verification-progress-runner\.mjs/);
  assert.match(supervisor, /taskkill\.exe/);
  assert.match(supervisor, /shell: false/);
  assert.doesNotMatch(supervisor, /shell:\s*true/);
});
