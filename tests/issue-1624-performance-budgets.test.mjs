import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluatePerformanceBudgets } from "../scripts/performance/ratified/evaluate-performance-budgets.mjs";

const contract = JSON.parse(await readFile(new URL("../scripts/performance/ratified/performance-budgets.json", import.meta.url), "utf8"));

function sample(mode, overrides = {}) {
  const budget = contract.modes[mode];
  const startup = Object.fromEntries(Object.entries(budget.startup).map(([field, threshold]) => [field, threshold.warningMax * 0.8]));
  const repeatedAccess = Object.entries(budget.repeatedUsefulInteractiveMs).map(([label, threshold]) => ({
    label,
    ready: true,
    usefulInteractiveMs: threshold.warningMax * 0.8,
    firstContentfulPaintMs: 100,
    interactiveControlCount: 10,
  }));
  const workflow = mode === "story-workflow-local" ? {
    status: "captured-deterministic-contract",
    paidCloudRequired: false,
    workload: "afterglow-v9-story-workflow",
    baseRevision: "9",
    changedRefs: ["block-01"],
    providerRoute: "deterministic-local-contract",
    fullAudit: { elapsedMs: 20, workItemCount: 4, specialistCount: 3, contextBytes: 2000 },
    targetedReevaluation: { elapsedMs: 2, workItemCount: 2, specialistCount: 2, contextBytes: 1000, preservedUnaffected: true },
    comparison: { workItemRatio: 0.5, specialistRatio: 0.6667, contextByteRatio: 0.5, targetedIsBounded: true },
  } : null;
  return {
    benchmarkIssue: 1411,
    authoritative: true,
    mode,
    environment: {
      platform: "win32",
      arch: "x64",
      node: "v24.19.0",
      plotpickleVersion: "1.0.0",
      commit: "exact-head",
      afterglowFixture: "afterglow-v9",
      ppfStartingRevision: "9",
      curriculumIdentity: "afterglow-v9-current-catalog",
      buzzMode: "disabled",
      optionalIntegrations: [],
    },
    measurements: {
      startup,
      navigation: [],
      memory: { rssAfterBytes: 64 * 1024 * 1024 },
      browser: {
        firstAccess: repeatedAccess,
        repeatedAccess,
        idle: {
          windowMs: 5000,
          sameOriginRequestCount: 0,
          apiRequestCount: 0,
          externalRequestCount: 0,
          domMutationCount: 0,
          rendererTaskDurationMs: 1,
        },
      },
      processIdle: {
        reliability: "windows-cim-launcher-owned-process-tree",
        observedWindowMs: 5000,
        cpuTimeDeltaMs: 0,
        workingSetAfterBytes: 1200 * 1024 * 1024,
        workingSetDeltaBytes: 0,
        activeProcessCount: 0,
        processCountAfter: 5,
        appearedProcessCount: 0,
        disappearedProcessCount: 0,
        explicitAgentOrModelProcessCount: 0,
      },
    },
    workflow,
    result: {
      harnessHealthy: true,
      startupHealthy: mode !== "story-workflow-local",
      workflowBounded: mode === "story-workflow-local",
    },
    ...overrides,
  };
}

function triplicate(mode, mutate = (entry) => entry) {
  return [0, 1, 2].map((index) => mutate(sample(mode), index));
}

test("#1624 pins the ratified budget to the exact repeated #1623 evidence", () => {
  assert.equal(contract.benchmarkIssue, 1411);
  assert.equal(contract.evidence.sourcePullRequest, 1623);
  assert.equal(contract.evidence.sourceHeadSha, "a7741f473fe8e20e8e643b4922f3dee9d4eda772");
  assert.equal(contract.identity.minimumHealthySamplesPerMode, 3);
  assert.deepEqual(contract.scopes.startup, ["fresh-runtime", "fresh-optimizer", "warm-persistent-runtime"]);
  assert.deepEqual(contract.scopes["story-workflow-local"], ["story-workflow-local"]);
  assert.match(contract.derivation.timingHard, /4 standard deviations/);
});

test("#1624 ratified startup budgets pass repeated matching evidence and hard-zero idle invariants", () => {
  const evidence = contract.scopes.startup.flatMap((mode) => triplicate(mode));
  const report = evaluatePerformanceBudgets({ contract, evidence, scope: "startup" });
  assert.equal(report.status, "pass");
  assert.equal(report.failures.length, 0);
  assert.equal(report.analysisReadyForBudgetRatification, true);
  assert.ok(report.checks.some((entry) => entry.metric === "browser.idle.apiRequestCount.max" && entry.observed === 0));
  assert.ok(report.checks.some((entry) => entry.metric === "processIdle.explicitAgentOrModelProcessCount.max" && entry.observed === 0));
});

test("#1624 noisy timing can warn without failing, while a hard regression blocks", () => {
  const mode = "warm-persistent-runtime";
  const warningEvidence = triplicate(mode, (entry) => {
    entry.measurements.startup.viteReadyMs = 17000;
    return entry;
  });
  const warningReport = evaluatePerformanceBudgets({
    contract: { ...contract, scopes: { ...contract.scopes, startup: [mode] } },
    evidence: warningEvidence,
    scope: "startup",
  });
  assert.equal(warningReport.status, "warn");
  assert.equal(warningReport.failures.length, 0);
  assert.ok(warningReport.warnings.some((message) => message.includes("startup.viteReadyMs.max")));

  const failingEvidence = triplicate(mode, (entry) => {
    entry.measurements.startup.viteReadyMs = 19000;
    return entry;
  });
  const failingReport = evaluatePerformanceBudgets({
    contract: { ...contract, scopes: { ...contract.scopes, startup: [mode] } },
    evidence: failingEvidence,
    scope: "startup",
  });
  assert.equal(failingReport.status, "fail");
  assert.ok(failingReport.failures.some((message) => message.includes("exceeds hard maximum")));
});

test("#1624 workflow gate requires bounded re-evaluation, preserved unaffected work and exact workload identity", () => {
  const passing = evaluatePerformanceBudgets({ contract, evidence: triplicate("story-workflow-local"), scope: "story-workflow-local" });
  assert.equal(passing.status, "pass");

  const badIdentity = triplicate("story-workflow-local", (entry, index) => {
    if (index === 2) entry.environment.curriculumIdentity = "wrong-catalog";
    return entry;
  });
  const identityReport = evaluatePerformanceBudgets({ contract, evidence: badIdentity, scope: "story-workflow-local" });
  assert.equal(identityReport.status, "fail");
  assert.ok(identityReport.failures.some((message) => message.includes("curriculumIdentity")));

  const unbounded = triplicate("story-workflow-local", (entry, index) => {
    if (index === 1) entry.workflow.comparison.targetedIsBounded = false;
    return entry;
  });
  const unboundedReport = evaluatePerformanceBudgets({ contract, evidence: unbounded, scope: "story-workflow-local" });
  assert.equal(unboundedReport.status, "fail");
  assert.ok(unboundedReport.failures.some((message) => message.includes("bounded targeted re-evaluation")));
});
