import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #371 retries failed screen identity validation with isolated captures", async () => {
  const workflow = await source(".github/workflows/visual.yml");

  for (const contract of [
    "timeout-minutes: 40",
    'PLOTPICKLE_VISUAL_BATCH_SIZE: "6"',
    'PLOTPICKLE_VISUAL_BATCH_RETRY_COUNT: "1"',
    'PLOTPICKLE_VISUAL_BATCH_RETRY_SETTLE_MS: "8000"',
    'PLOTPICKLE_VISUAL_RETRY_BATCH_SIZE: "1"',
    '$PSNativeCommandUseErrorActionPreference = $false',
    "$initialValidation = $LASTEXITCODE",
    "Initial visual identity validation failed. Recapturing each requested screen in its own browser/server batch.",
    '$env:PLOTPICKLE_VISUAL_BATCH_SIZE = $env:PLOTPICKLE_VISUAL_RETRY_BATCH_SIZE',
  ]) assert.ok(workflow.includes(contract), `Missing isolated visual recovery contract: ${contract}`);

  assert.ok((workflow.match(/node scripts\/visual-audit-supervisor\.mjs/g) ?? []).length >= 2, "The workflow must recapture after an identity failure");
  assert.ok((workflow.match(/node scripts\/visual-audit-validate\.mjs/g) ?? []).length >= 3, "The workflow must validate the initial, recovered and final evidence sets");
});

test("issue #371 retries only a crashed browser batch before abandoning captured evidence", async () => {
  const supervisor = await source("scripts/visual-audit-supervisor.mjs");

  for (const contract of [
    "PLOTPICKLE_VISUAL_BATCH_RETRY_COUNT",
    "PLOTPICKLE_VISUAL_BATCH_RETRY_SETTLE_MS",
    "Retrying ${batchName}",
    "await rm(batchDirectory, { recursive: true, force: true })",
    "Batch manifest was not produced after ${batchRetryCount + 1} attempt(s)",
  ]) assert.ok(supervisor.includes(contract), `Missing crashed-batch recovery contract: ${contract}`);

  assert.ok(supervisor.includes("for (let attempt = 0; attempt <= batchRetryCount; attempt += 1)"), "The supervisor must use a bounded retry loop");
  assert.ok(supervisor.includes("if (batchManifest && (code === 0 || attempt === batchRetryCount)) break"), "The supervisor must retry partial evidence after a failed runner and stop after successful or final evidence");
  assert.ok(supervisor.includes("if (batchManifest) manifestError = `Capture runner exited with code ${code}.`;"), "The supervisor must retain the failed-runner reason when partial evidence is written");
});
