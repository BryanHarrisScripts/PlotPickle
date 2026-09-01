import assert from "node:assert/strict";
import test from "node:test";

import {
  createMaintainerTaskHandoff,
  evaluateMaintainerTaskBudget,
} from "../build/autonomous-guest/maintainer/task/handoff.mjs";

const HEAD = "a".repeat(40);
const OTHER = "b".repeat(40);

const harnessAuthority = Object.freeze({
  authorityClass: "plotpickle-maintainer-harness-approver",
  serverOwned: true,
  approverId: "maintainer-harness",
  humanProfileId: "",
});

function architecture(overrides = {}) {
  return {
    schemaVersion: 1,
    snapshotId: "maintainer-architecture-1234567890abcdef1234567890abcdef",
    exactCommitSha: HEAD,
    state: "verified",
    sourceMutationAllowed: false,
    operationalAuthorityGranted: false,
    ...overrides,
  };
}

function handoff(overrides = {}) {
  return createMaintainerTaskHandoff({
    harnessAuthority,
    taskId: "maintainer-task-1592",
    requestedOutcome: "Determine one exact-head persistence defect and return evidence-backed repair guidance.",
    exactStartingCommitSha: HEAD,
    architectureSnapshot: architecture(),
    permittedSkills: [{ skillId: "ben-code-quality", version: "1.2.0" }],
    allowedFiles: ["build/autonomous-guest", "tests"],
    allowedRoutes: ["story-workbench"],
    allowedTools: ["repository-reader", "test-runner"],
    allowedProviderIds: ["plotpickle-local"],
    providerPolicyRef: "policy:local-maintainer",
    credentialAccessRefs: ["credential:local-model"],
    budgets: {
      maximumAttempts: 2,
      maximumWallClockMs: 600_000,
      maximumActions: 32,
      maximumRequests: 12,
      maximumTokens: 80_000,
      maximumCloudCostUsd: 0,
      maximumChangedFiles: 4,
      maximumDiffLines: 300,
      maximumChildAgents: 0,
    },
    childAgentDelegationAllowed: false,
    exclusions: ["exclude:unrelated-refactors", "exclude:new-dependencies"],
    requiredEvidence: ["test:focused-reproduction", "ci:exact-head"],
    resultFormatRef: "format:maintainer-proposal-v1",
    stopConditions: ["stop:outcome-met", "stop:budget-exceeded", "stop:exact-head-changed"],
    ...overrides,
  });
}

test("#1592 final acceptance handoff is exact-head, harness-owned and non-self-authorizing", () => {
  const task = handoff();
  assert.equal(task.contract, "plotpickle-maintainer-bounded-task-handoff");
  assert.equal(task.exactStartingCommitSha, HEAD);
  assert.equal(task.architectureState, "verified");
  assert.equal(task.harness.serverOwned, true);
  assert.equal(task.budgets.maximumAttempts, 2);
  assert.equal(task.budgets.maximumWallClockMs, 600_000);
  assert.equal(task.budgets.maximumChangedFiles, 4);
  assert.equal(task.budgets.maximumDiffLines, 300);
  assert.deepEqual(task.allowedTools, ["repository-reader", "test-runner"]);
  assert.deepEqual(task.allowedProviderIds, ["plotpickle-local"]);
  assert.deepEqual(task.credentialAccessRefs, ["credential:local-model"]);
  assert.deepEqual(task.permittedSkills.map((item) => item.key), ["ben-code-quality@1.2.0"]);
  assert.equal(task.sourceEditingAuthorityGranted, false);
  assert.equal(task.separateCodingAuthorityRequiredForMutation, true);
  assert.equal(task.durableAdmissionAuthorityGranted, false);
  assert.equal(task.approvalAuthorityGranted, false);
  assert.equal(task.mergeAuthorityGranted, false);
  assert.equal(task.operationalAuthorityGranted, false);
  assert.equal(task.aiSelfCertified, false);
});

test("#1592 final acceptance budget evaluator permits only exact-head in-scope bounded work", () => {
  const result = evaluateMaintainerTaskBudget(handoff(), {
    currentCommitSha: HEAD,
    attempts: 1,
    elapsedMs: 45_000,
    actions: 8,
    requests: 3,
    tokens: 10_000,
    cloudCostUsd: 0,
    changedFiles: 0,
    diffLines: 0,
    childAgents: 0,
    toolIds: ["repository-reader", "test-runner"],
    skillVersionKeys: ["ben-code-quality@1.2.0"],
    providerIds: ["plotpickle-local"],
    credentialRefs: ["credential:local-model"],
    touchedFiles: ["build/autonomous-guest/maintainer/task/handoff.mjs", "tests/issue-1592-task-handoff-budget-guard.test.mjs"],
    routeIds: ["story-workbench"],
  });

  assert.equal(result.state, "within-budget");
  assert.equal(result.stopRequired, false);
  assert.deepEqual(result.violations, []);
  assert.equal(result.learnerMayWaiveViolation, false);
  assert.equal(result.learnerMayExpandScope, false);
  assert.equal(result.learnerMayRaiseBudget, false);
  assert.equal(result.deterministicGateRequiredForSuccess, true);
  assert.equal(result.operationalAuthorityGranted, false);
});

test("#1592 final acceptance deterministically stops loops, drift and unauthorized repair", () => {
  const result = evaluateMaintainerTaskBudget(handoff(), {
    currentCommitSha: OTHER,
    attempts: 3,
    elapsedMs: 700_000,
    actions: 40,
    requests: 13,
    tokens: 81_000,
    cloudCostUsd: 1,
    changedFiles: 5,
    diffLines: 301,
    childAgents: 1,
    toolIds: ["repository-writer"],
    skillVersionKeys: ["unapproved-skill@9.9.9"],
    providerIds: ["unapproved-cloud"],
    credentialRefs: ["credential:unapproved"],
    touchedFiles: ["modules/wyrmwood/rival-director.ts"],
    routeIds: ["community-great-hall"],
    separateCodingAuthorityActive: false,
  });

  assert.equal(result.state, "stopped");
  assert.equal(result.stopRequired, true);
  for (const expected of [
    "exact-head-changed",
    "attempt-budget-exceeded",
    "wall-clock-budget-exceeded",
    "action-budget-exceeded",
    "request-budget-exceeded",
    "token-budget-exceeded",
    "cloud-cost-budget-exceeded",
    "changed-file-budget-exceeded",
    "diff-budget-exceeded",
    "child-agent-budget-exceeded",
    "source-editing-authority-missing",
    "child-agent-delegation-missing",
    "tool-scope-exceeded",
    "skill-scope-exceeded",
    "provider-scope-exceeded",
    "credential-scope-exceeded",
    "file-scope-exceeded",
    "route-scope-exceeded",
  ]) assert.ok(result.violations.includes(expected), expected);
});

test("#1592 final acceptance rejects stale snapshots, silent delegation and unbounded budgets", () => {
  assert.throws(
    () => handoff({ architectureSnapshot: architecture({ state: "stale" }) }),
    /verified non-operational exact-head architecture snapshot/,
  );
  assert.throws(
    () => handoff({
      budgets: {
        maximumAttempts: 4,
        maximumWallClockMs: 600_000,
        maximumActions: 32,
        maximumRequests: 12,
        maximumTokens: 80_000,
        maximumCloudCostUsd: 0,
        maximumChangedFiles: 4,
        maximumDiffLines: 300,
        maximumChildAgents: 0,
      },
    }),
    /attempt budget must be between 1 and 3/,
  );
  assert.throws(
    () => handoff({
      budgets: {
        maximumAttempts: 2,
        maximumWallClockMs: 600_000,
        maximumActions: 32,
        maximumRequests: 12,
        maximumTokens: 80_000,
        maximumCloudCostUsd: 0,
        maximumChangedFiles: 4,
        maximumDiffLines: 300,
        maximumChildAgents: 1,
      },
    }),
    /cannot budget child agents without explicit harness delegation/,
  );
});
