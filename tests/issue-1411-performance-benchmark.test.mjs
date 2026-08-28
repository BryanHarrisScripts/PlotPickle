import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { analyzeBaselines, summarize } from "../scripts/performance/analyze-real-machine-baselines.mjs";
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
  for (const mode of ["warm-persistent-runtime", "fresh-optimizer", "fresh-runtime", "story-workflow-local", "buzz-enabled-story-council"]) assert.ok(source.includes(mode));
  for (const route of ["/library", "/learn", "/plan", "/build", "/story-decisions", "/story-workbench"]) assert.ok(source.includes(route));
});

test("#1411 evidence records reproducibility identity and process memory reliability", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const field of ["plotpickleVersion", "commit", "afterglowFixture", "ppfStartingRevision", "curriculumIdentity", "buzzMode", "optionalIntegrations", "process-only"]) assert.ok(source.includes(field));
});

test("#1411 deterministic Afterglow workflow comparison proves targeted re-evaluation stays bounded", () => {
  const evidence = measureStoryWorkflowContract();
  assert.equal(evidence.status, "captured-deterministic-contract");
  assert.equal(evidence.paidCloudRequired, false);
  assert.ok(evidence.fullAudit.workItemCount > evidence.targetedReevaluation.workItemCount);
  assert.equal(evidence.targetedReevaluation.preservedUnaffected, true);
  assert.equal(evidence.comparison.targetedIsBounded, true);
});

test("#1411 workflow benchmark stays explicit about deterministic planning limits", async () => {
  const source = await read("scripts/performance/measure-story-workflow-contract.mjs");
  assert.match(source, /Live model latency, retries and network transport remain separate real-machine measurements/);
  assert.match(source, /affectedStoryWorkItemIds/);
  assert.match(source, /requeueAffectedStoryWorkItems/);
});

test("#1411 baseline analyzer requires repeated authoritative Windows samples before ratification", () => {
  const sample = (elapsedMs) => ({
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "warm-persistent-runtime",
    environment: { platform: "win32", plotpickleVersion: "1.0.0", afterglowFixture: "afterglow-v9", curriculumIdentity: "curriculum-a", ppfStartingRevision: "9" },
    measurements: { navigation: [{ label: "dashboard", ok: true, elapsedMs }], memory: { rssAfterBytes: 1000 + elapsedMs } },
  });
  const two = analyzeBaselines([sample(100), sample(120)]);
  assert.equal(two.readyForBudgetRatification, false);
  const three = analyzeBaselines([sample(100), sample(120), sample(110)]);
  assert.equal(three.readyForBudgetRatification, true);
  assert.equal(three.identityStable, true);
  assert.equal(three.navigation.dashboard.samples, 3);
});

test("#1411 baseline analyzer rejects mixed workload identity and ignores non-authoritative evidence", () => {
  const base = { benchmarkIssue: 1411, authoritative: true, mode: "warm-persistent-runtime", environment: { platform: "win32", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9" }, measurements: { navigation: [], memory: {} } };
  const mixed = analyzeBaselines([base, base, { ...base, environment: { ...base.environment, curriculumIdentity: "b" } }, { ...base, authoritative: false }]);
  assert.equal(mixed.authoritativeSampleCount, 3);
  assert.equal(mixed.identityStable, false);
  assert.equal(mixed.readyForBudgetRatification, false);
  assert.deepEqual(summarize([10, 20, 30]), { samples: 3, min: 10, max: 30, mean: 20, standardDeviation: 8.16 });
});
