import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FULL_VERIFICATION_GRAPH } from "../scripts/full-verification-graph.mjs";
import {
  executeBoundedCommand,
  FULL_VERIFICATION_HEARTBEAT_MS,
  FULL_VERIFICATION_STAGE_TIMEOUT_MS,
  PI_PREFLIGHT_TIMEOUT_MS,
  PI_STACK_TIMEOUT_MS,
  verificationProgressSnapshot,
  verificationTimeoutForNode,
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

test("every authoritative Full Verification stage has a bounded host timeout", () => {
  const authoritative = FULL_VERIFICATION_GRAPH.filter((node) => node.authoritative);
  assert.equal(authoritative.length, 9);
  for (const node of authoritative) {
    const timeout = verificationTimeoutForNode(node);
    assert.equal(timeout, FULL_VERIFICATION_STAGE_TIMEOUT_MS[node.id], `${node.id} should use its declared timeout`);
    assert.ok(timeout > 0, `${node.id} should never run without a host timeout`);
  }
  assert.equal(FULL_VERIFICATION_STAGE_TIMEOUT_MS["ensure-pi-model"], PI_STACK_TIMEOUT_MS);
  assert.equal(FULL_VERIFICATION_STAGE_TIMEOUT_MS["pi-preflight"], PI_PREFLIGHT_TIMEOUT_MS);
  assert.ok(PI_STACK_TIMEOUT_MS >= 30 * 60_000);
  assert.ok(PI_PREFLIGHT_TIMEOUT_MS >= 10 * 60_000);
  assert.ok(FULL_VERIFICATION_STAGE_TIMEOUT_MS["exhaustive-uat"] >= 60 * 60_000);
});

test("a deliberately hung verification child is stopped and reported instead of hanging the runner", async () => {
  const started = Date.now();
  const result = await executeBoundedCommand({
    id: "deliberate-hang",
    name: "Deliberately hung verification child",
    tool: "node",
    args: ["-e", "setInterval(() => {}, 1000)"],
  }, 150);

  assert.equal(result.status, "FAIL");
  assert.equal(result.exitCode, 124);
  assert.match(result.detail, /host timeout/i);
  assert.ok(Date.now() - started < 8_000, "timeout cleanup should itself remain bounded");
});

test("Pi verification remains host-bounded while the worker self-provisions instead of being treated as optional", async () => {
  const [runner, processControls, piRuntime, ensurePi, verifyPi] = await Promise.all([
    read("scripts/full-verification-progress-runner.mjs"),
    read("scripts/full-verification-process.mjs"),
    read("scripts/pi-worker-runtime.mjs"),
    read("scripts/ensure-pi-repair-stack.mjs"),
    read("scripts/verify-pi-repair-worker.mjs"),
  ]);
  assert.doesNotMatch(runner, /OPTIONAL REPAIR CAPABILITY UNAVAILABLE|executableAvailable\("pi"\)/);
  assert.match(processControls, /ensure-pi-repair-stack\.mjs/);
  assert.match(processControls, /verify-pi-repair-worker\.mjs/);
  assert.match(piRuntime, /npm.*install.*-g.*--ignore-scripts.*@earendil-works\/pi-coding-agent/s);
  assert.match(piRuntime, /npm.*prefix.*-g/s);
  assert.match(ensurePi, /ensure-local-repair-model\.mjs/);
  assert.match(verifyPi, /runPiSmoke/);

  assert.match(processControls, /taskkill\.exe/);
  assert.match(processControls, /return new Promise/);
  assert.match(processControls, /waitForProcessClose/);
  assert.match(processControls, /shell: false/);
  assert.doesNotMatch(processControls, /shell:\s*true/);
  assert.match(runner, /terminateVerificationProcessTree\(child\)/);
  assert.match(runner, /shell: false/);
  assert.doesNotMatch(runner, /shell:\s*true/);
});

test("Full Verification PowerShell entrypoint uses the launcher guard and watchdog while preserving progress-runner graph authority", async () => {
  const [powerShell, launcher, supervisor, progressRunner] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/invoke-full-verification-supervisor.ps1"),
    read("scripts/full-verification-supervisor.mjs"),
    read("scripts/full-verification-progress-runner.mjs"),
  ]);

  assert.match(powerShell, /invoke-full-verification-supervisor\.ps1/);
  assert.match(powerShell, /HandshakeTimeoutSeconds\s+12/);
  assert.match(launcher, /full-verification-supervisor\.mjs/);
  assert.match(launcher, /watchdog did not acknowledge startup within/);
  assert.match(launcher, /taskkill\.exe/);
  assert.match(supervisor, /full-verification-progress-runner\.mjs/);
  assert.match(supervisor, /FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS\s*=\s*45_000/);
  assert.match(progressRunner, /runVerificationGraph/);
  assert.match(powerShell, /The nine deterministic stages remain the sole PASS\/FAIL authority/);
  assert.match(powerShell, /GraphResultPath/);
  assert.doesNotMatch(powerShell, /&\s+node\s+"\.\\scripts\\full-verification-progress-runner\.mjs"/);
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
