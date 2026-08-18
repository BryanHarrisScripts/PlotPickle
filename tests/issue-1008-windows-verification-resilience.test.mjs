import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  FULL_VERIFICATION_HEARTBEAT_MS,
  PI_PREFLIGHT_TIMEOUT_MS,
  verificationProgressSnapshot,
} from "../scripts/full-verification-progress-runner.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Full Verification shows a heartbeat, progress bar, elapsed time, active work and conservative ETA", () => {
  const estimating = verificationProgressSnapshot({
    completed: 0,
    total: 9,
    startedAt: 0,
    now: 10_000,
    active: ["6 of 9 - Pi repair preflight"],
  });
  assert.match(estimating.line, /PROGRESS \[[#-]{20}\] 0\/9 0%/);
  assert.match(estimating.line, /elapsed 0:10/);
  assert.match(estimating.line, /ETA estimating/);
  assert.match(estimating.line, /Pi repair preflight/);

  const estimated = verificationProgressSnapshot({
    completed: 3,
    total: 9,
    startedAt: 0,
    now: 60_000,
    active: ["8 of 9 - Exhaustive code-aware UI and UX UAT"],
  });
  assert.equal(estimated.percent, 33);
  assert.match(estimated.eta, /^~/);
  assert.match(estimated.line, /3\/9 33%/);
  assert.equal(FULL_VERIFICATION_HEARTBEAT_MS, 10_000);
});

test("Pi preflight is host-bounded and missing Pi is detected without an unsafe shell probe", async () => {
  const runner = await read("scripts/full-verification-progress-runner.mjs");
  assert.equal(PI_PREFLIGHT_TIMEOUT_MS, 30_000);
  assert.match(runner, /process\.platform === "win32" \? "where\.exe" : "which"/);
  assert.match(runner, /node\.id === "pi-preflight"/);
  assert.match(runner, /Pi is not installed or not available on PATH/);
  assert.match(runner, /taskkill\.exe/);
  assert.match(runner, /shell: false/);
  assert.doesNotMatch(runner, /shell:\s*true/);
});

test("Full Verification PowerShell entrypoint uses the progress runner while preserving graph result authority", async () => {
  const powerShell = await read("scripts/run-plotpickle-full-check.ps1");
  assert.match(powerShell, /full-verification-progress-runner\.mjs/);
  assert.match(powerShell, /The nine deterministic stages remain the sole PASS\/FAIL authority/);
  assert.match(powerShell, /GraphResultPath/);
});

test("ComfyUI registry collection conversion is safe for Windows PowerShell 5.1", async () => {
  const starter = await read("scripts/start-comfyui-background.ps1");
  assert.match(starter, /return \$result\.ToArray\(\)/);
  assert.doesNotMatch(starter, /return @\(\$result\)/);
  assert.match(starter, /ComfyUI startup is restricted to a local HTTP address/);
  assert.doesNotMatch(starter, /api\.openai\.com|api\.minimax|anthropic|openrouter/i);
});

test("Sage strict anti-echo rejects restatement without rejecting a concise fresh paraphrase", async () => {
  const adapter = await read("build/startup-agent-diagnostics-runtime-v5.ts");
  assert.match(adapter, /answerText === questionText/);
  assert.match(adapter, /answerText\.includes\(questionText\)/);
  assert.match(adapter, /longestContiguousMatch/);
  assert.match(adapter, /nearVerbatim/);
  assert.doesNotMatch(adapter, /answerWords\.length < 6/);
});
