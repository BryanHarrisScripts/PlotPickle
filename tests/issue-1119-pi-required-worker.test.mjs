import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { FULL_VERIFICATION_GRAPH } from "../scripts/full-verification-graph.mjs";
import { verificationCommandFor } from "../scripts/full-verification-process.mjs";
import {
  FULL_VERIFICATION_STAGE_TIMEOUT_MS,
  PI_PREFLIGHT_TIMEOUT_MS,
  PI_STACK_TIMEOUT_MS,
} from "../scripts/full-verification-progress-runner.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1119 self-provisions the reviewed official Pi CLI and resolves npm global shims without PATH refresh", async () => {
  const runtime = await read("scripts/pi-worker-runtime.mjs");
  assert.match(runtime, /@earendil-works\/pi-coding-agent/);
  assert.match(runtime, /npm.*install.*-g.*--ignore-scripts/s);
  assert.match(runtime, /npm.*prefix.*-g/s);
  assert.match(runtime, /pi\.cmd/);
  assert.match(runtime, /PLOTPICKLE_PI_AUTO_INSTALL/);
  assert.match(runtime, /PLOTPICKLE_PI_COMMAND/);
  assert.match(runtime, /Node\.js.*22\.19\.0 or newer/);
  assert.doesNotMatch(runtime, /api\.openai\.com|anthropic\.com|openrouter\.ai/i);
});

test("#1119 Full Verification stages 5 and 6 route through the Pi stack and real local-model smoke", async () => {
  const stage5 = FULL_VERIFICATION_GRAPH.find((node) => node.id === "ensure-pi-model");
  const stage6 = FULL_VERIFICATION_GRAPH.find((node) => node.id === "pi-preflight");
  assert.ok(stage5?.authoritative);
  assert.ok(stage6?.authoritative);
  assert.deepEqual(verificationCommandFor(stage5, { nodeExecPath: "node-test" }), {
    command: "node-test",
    args: ["scripts/ensure-pi-repair-stack.mjs"],
  });
  assert.deepEqual(verificationCommandFor(stage6, { nodeExecPath: "node-test" }), {
    command: "node-test",
    args: ["scripts/verify-pi-repair-worker.mjs"],
  });

  const ensure = await read("scripts/ensure-pi-repair-stack.mjs");
  const verify = await read("scripts/verify-pi-repair-worker.mjs");
  assert.match(ensure, /ensurePiInstalled/);
  assert.match(ensure, /ensure-local-repair-model\.mjs/);
  assert.match(ensure, /resolveGitBash/);
  assert.match(verify, /runPiSmoke/);
  assert.match(verify, /headless local-model smoke/);
});

test("#1119 removes the optional missing-Pi escape hatch and gives self-provisioning realistic bounded time", async () => {
  const runner = await read("scripts/full-verification-progress-runner.mjs");
  assert.doesNotMatch(runner, /OPTIONAL REPAIR CAPABILITY UNAVAILABLE/);
  assert.doesNotMatch(runner, /Pi is not installed or not available on PATH/);
  assert.doesNotMatch(runner, /executableAvailable\("pi"\)/);
  assert.equal(FULL_VERIFICATION_STAGE_TIMEOUT_MS["ensure-pi-model"], PI_STACK_TIMEOUT_MS);
  assert.equal(FULL_VERIFICATION_STAGE_TIMEOUT_MS["pi-preflight"], PI_PREFLIGHT_TIMEOUT_MS);
  assert.ok(PI_STACK_TIMEOUT_MS >= 30 * 60_000);
  assert.ok(PI_PREFLIGHT_TIMEOUT_MS >= 10 * 60_000);
});

test("#1119 isolates Pi provider configuration to loopback and proves the local model before repair", async () => {
  const runtime = await read("scripts/pi-worker-runtime.mjs");
  assert.match(runtime, /PI_CODING_AGENT_DIR/);
  assert.match(runtime, /PI_OFFLINE/);
  assert.match(runtime, /PI_TELEMETRY/);
  assert.match(runtime, /plotpickle-local/);
  assert.match(runtime, /openai-completions/);
  assert.match(runtime, /127\.0\.0\.1/);
  assert.match(runtime, /localhost/);
  assert.match(runtime, /refusing provider endpoint/);
  assert.match(runtime, /PLOTPICKLE_PI_READY/);
  assert.match(runtime, /--no-tools/);
});

test("#1119 Pi slop review is read-only and advisory while BEN and deterministic gates retain authority", async () => {
  const review = await read("scripts/run-pi-code-quality-review.mjs");
  const verify = await read("scripts/verify-pi-repair-worker.mjs");
  assert.match(review, /run-ben-code-quality\.mjs/);
  assert.match(review, /ben-code-quality\/SKILL\.md/);
  assert.match(review, /AI-generated code smell/);
  assert.match(review, /authoritative:\s*false/);
  assert.match(review, /writesAllowed:\s*false/);
  assert.match(review, /\["read", "grep", "find", "ls"\]/);
  assert.match(review, /BEN\/slop-scan, tests, build, UAT, Full Verification, and repository merge gates remain authoritative/);
  assert.doesNotMatch(review, /--tools"?,?\s*"(?:bash|write|edit)/);
  assert.match(verify, /Pi code-quality review.*WARN/s, "advisory review failure must be reported without failing Pi readiness");
});
