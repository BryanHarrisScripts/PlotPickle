import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { measureStoryWorkflowContract } from "../scripts/performance/measure-story-workflow-contract.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1411 benchmark runner preserves authoritative Windows and no-fake-budget boundaries", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  assert.match(source, /process\.platform !== "win32"/);
  assert.match(source, /authoritative benchmark must run on Windows/);
  assert.match(source, /Hard thresholds are intentionally absent until repeated real-machine baseline samples establish variance/);
  assert.match(source, /deterministic workflow planning and targeted re-evaluation evidence/);
});

test("#1411 benchmark identifies canonical modes and core workspace routes", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const mode of [
    "warm-persistent-runtime",
    "fresh-optimizer",
    "fresh-runtime",
    "story-workflow-local",
    "buzz-enabled-story-council",
  ]) assert.ok(source.includes(mode), `Missing benchmark mode: ${mode}`);

  for (const route of ["/library", "/learn", "/plan", "/build", "/story-decisions", "/story-workbench"]) {
    assert.ok(source.includes(route), `Missing benchmark route: ${route}`);
  }
});

test("#1411 evidence records reproducibility identity and process memory reliability", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const field of [
    "plotpickleVersion",
    "commit",
    "afterglowFixture",
    "ppfStartingRevision",
    "curriculumIdentity",
    "buzzMode",
    "optionalIntegrations",
    "process-only",
  ]) assert.ok(source.includes(field), `Missing evidence field: ${field}`);
});

test("#1411 deterministic Afterglow workflow comparison proves targeted re-evaluation stays bounded", () => {
  const evidence = measureStoryWorkflowContract();
  assert.equal(evidence.status, "captured-deterministic-contract");
  assert.equal(evidence.workload, "afterglow-v9-bounded-story-workflow");
  assert.equal(evidence.paidCloudRequired, false);
  assert.ok(evidence.fullAudit.workItemCount > evidence.targetedReevaluation.workItemCount);
  assert.ok(evidence.fullAudit.specialistCount >= evidence.targetedReevaluation.specialistCount);
  assert.ok(evidence.fullAudit.contextBytes > evidence.targetedReevaluation.contextBytes);
  assert.equal(evidence.targetedReevaluation.preservedUnaffected, true);
  assert.equal(evidence.comparison.targetedIsBounded, true);
  assert.ok(evidence.comparison.workItemRatio > 0 && evidence.comparison.workItemRatio < 1);
});

test("#1411 workflow benchmark stays explicit about what deterministic planning does not measure", async () => {
  const source = await read("scripts/performance/measure-story-workflow-contract.mjs");
  assert.match(source, /Live model latency, retries and network transport remain separate real-machine measurements/);
  assert.match(source, /affectedStoryWorkItemIds/);
  assert.match(source, /requeueAffectedStoryWorkItems/);
  assert.match(source, /ppf:foundations:ren-motivation/);
  assert.match(source, /visual:ren-isobel-beach/);
});
