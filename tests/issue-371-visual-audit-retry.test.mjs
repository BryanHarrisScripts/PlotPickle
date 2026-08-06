import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #371 retries failed screen identity validation with isolated captures", async () => {
  const workflow = await source(".github/workflows/visual-audit-capture.yml");

  for (const contract of [
    "timeout-minutes: 40",
    'PLOTPICKLE_VISUAL_BATCH_SIZE: "6"',
    'PLOTPICKLE_VISUAL_RETRY_BATCH_SIZE: "1"',
    '$PSNativeCommandUseErrorActionPreference = $false',
    "$initialValidation = $LASTEXITCODE",
    "Initial visual identity validation failed. Recapturing each requested screen in its own browser/server batch.",
    '$env:PLOTPICKLE_VISUAL_BATCH_SIZE = $env:PLOTPICKLE_VISUAL_RETRY_BATCH_SIZE',
  ]) assert.ok(workflow.includes(contract), `Missing isolated visual recovery contract: ${contract}`);

  assert.ok((workflow.match(/node scripts\/visual-audit-supervisor\.mjs/g) ?? []).length >= 2, "The workflow must recapture after an identity failure");
  assert.ok((workflow.match(/node scripts\/visual-audit-validate\.mjs/g) ?? []).length >= 3, "The workflow must validate the initial, recovered and final evidence sets");
});
