import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS,
  FULL_VERIFICATION_RUNNER_OVERALL_TIMEOUT_MS,
  superviseProcess,
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

test("PowerShell routes the graph through the independent supervisor and keeps BLOCKED fallback", async () => {
  const [powerShell, supervisor] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/full-verification-supervisor.mjs"),
  ]);

  assert.match(powerShell, /full-verification-supervisor\.mjs/);
  assert.doesNotMatch(powerShell, /& node "\.\\scripts\\full-verification-progress-runner\.mjs"/);
  assert.match(powerShell, /Verification graph result was unavailable/);
  assert.match(powerShell, /Write-StructuredVerificationRecord/);
  assert.match(supervisor, /full-verification-progress-runner\.mjs/);
  assert.match(supervisor, /taskkill\.exe/);
  assert.match(supervisor, /shell: false/);
  assert.doesNotMatch(supervisor, /shell:\s*true/);
});
