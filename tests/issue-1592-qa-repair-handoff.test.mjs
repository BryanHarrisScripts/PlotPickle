import assert from "node:assert/strict";
import test from "node:test";

import {
  createMaintainerBoundedRepairRequest,
  createMaintainerDefectLearningInput,
  createMaintainerQaAnalysisPackage,
} from "../build/autonomous-guest/maintainer/qa-repair-handoff.mjs";

const FAILING_SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);

const authority = Object.freeze({
  active: true,
  authorityClass: "delegated-guest-autonomous-operator",
  delegated: true,
  humanProfileId: "",
  workspaceId: "guest-auto-1234567890abcdef12345678",
  autonomousRunId: "qa-run-1592",
  operatorId: "maintainer-learner",
  accessMode: "desktop-loopback",
});

function observation(overrides = {}) {
  return {
    commitSha: FAILING_SHA,
    buildId: "build-1592-failing",
    testerRole: "persistence-recovery",
    routeId: "story-workbench",
    assertionRef: "assertion:restart-retains-state",
    expectedRef: "expected:state-retained",
    actualRef: "actual:state-missing",
    errorClass: "persistence-regression",
    reproductionRefs: ["repro:open-save-restart"],
    evidenceRefs: ["artifact:qa/restart-failure"],
    ...overrides,
  };
}

function defect(overrides = {}) {
  return {
    fingerprint: "qa-defect-1234567890abcdef1234567890abcdef",
    severity: "major",
    testerRole: "persistence-recovery",
    routeId: "story-workbench",
    assertionRef: "assertion:restart-retains-state",
    expectedRef: "expected:state-retained",
    actualRef: "actual:state-missing",
    errorClass: "persistence-regression",
    observations: [observation(), observation({ buildId: "build-1592-rerun" })],
    reproductionRefs: ["repro:open-save-restart"],
    evidenceRefs: ["artifact:qa/restart-failure"],
    reproducible: true,
    ...overrides,
  };
}

function architecture(overrides = {}) {
  return {
    schemaVersion: 1,
    snapshotId: "maintainer-architecture-1234567890abcdef1234567890abcdef",
    exactCommitSha: FAILING_SHA,
    state: "verified",
    domains: [
      {
        domain: "developer",
        ownershipPaths: ["build/autonomous-guest", "tests"],
        changedPathInvalidationInputs: [
          "config/repository-architecture-target.json",
          "scripts/repository-architecture-inventory.mjs",
          "build/autonomous-guest",
          "tests",
        ],
      },
    ],
    sourceMutationAllowed: false,
    operationalAuthorityGranted: false,
    ...overrides,
  };
}

function observedLearning(input, overrides = {}) {
  return {
    schemaVersion: 1,
    ...input,
    dedupeKey: "maintainer-learning-1234567890abcdef1234567890abcdef",
    state: "observed",
    proposedBy: {
      authorityClass: authority.authorityClass,
      autonomousRunId: authority.autonomousRunId,
      workspaceId: authority.workspaceId,
      operatorId: authority.operatorId,
      humanProfileId: "",
    },
    sourceMutationAllowed: false,
    selfApprovalAllowed: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
    ...overrides,
  };
}

function approval(learning, overrides = {}) {
  return {
    schemaVersion: 1,
    decisionId: "maintainer-approval-1234567890abcdef1234567890abcdef",
    harnessApprovalRef: "harness-approval:maintainer-approval-1234567890abcdef1234567890abcdef",
    action: "durable-knowledge-admission",
    state: "approved",
    exactCommitSha: FAILING_SHA,
    learningProposalId: learning.proposalId,
    learningDedupeKey: learning.dedupeKey,
    domain: "developer",
    kind: "defect-lesson",
    approvedBy: {
      authorityClass: "plotpickle-maintainer-harness-approver",
      serverOwned: true,
      approverId: "maintainer-harness",
      humanProfileId: "",
    },
    durableAdmissionEligible: true,
    durablyAdmitted: false,
    sourceMutationAllowed: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
    ...overrides,
  };
}

test("#1592 Slice F converts exact-head reproduced QA evidence into bounded canonical learning input", () => {
  const analysis = createMaintainerQaAnalysisPackage({
    defect: defect(),
    exactCommitSha: FAILING_SHA,
    architectureSnapshot: architecture(),
    domain: "developer",
  });
  assert.equal(analysis.state, "reproduced");
  assert.equal(analysis.exactHeadObservationCount, 2);
  assert.equal(analysis.maximumAnalysisAttempts, 1);
  assert.equal(analysis.testerRepairAuthorityGranted, false);
  assert.equal(analysis.testerApprovalAuthorityGranted, false);
  assert.equal(analysis.sourceMutationAllowed, false);
  assert.equal(analysis.repairAuthorityGranted, false);
  assert.equal(analysis.operationalAuthorityGranted, false);
  assert.equal(analysis.aiSelfCertified, false);

  const learningInput = createMaintainerDefectLearningInput({
    analysis,
    proposalId: "maintainer-defect-lesson-1592",
    createdAt: "2026-09-01T13:30:00.000Z",
  });
  assert.equal(learningInput.kind, "defect-lesson");
  assert.equal(learningInput.exactCommitSha, FAILING_SHA);
  assert.ok(learningInput.evidence.some((item) => item.kind === "defect" && item.ref === analysis.defectFingerprint));
  assert.ok(learningInput.evidence.length <= 64);
  assert.ok(learningInput.freshnessPaths.length <= 32);
  assert.ok(learningInput.applicabilityRefs.length <= 64);
  assert.equal("state" in learningInput, false);
  assert.equal("sourceMutationAllowed" in learningInput, false);
  assert.equal("selfApprovalAllowed" in learningInput, false);
  assert.equal("operationalAuthorityGranted" in learningInput, false);
  assert.equal("aiSelfCertified" in learningInput, false);
});

test("#1592 Slice F emits only a bounded #1451 repair request after canonical observed learning", () => {
  const analysis = createMaintainerQaAnalysisPackage({
    defect: defect(),
    exactCommitSha: FAILING_SHA,
    architectureSnapshot: architecture(),
    domain: "developer",
  });
  const learning = observedLearning(createMaintainerDefectLearningInput({
    analysis,
    proposalId: "maintainer-defect-lesson-repair-1592",
    createdAt: "2026-09-01T13:31:00.000Z",
  }));
  const request = createMaintainerBoundedRepairRequest({
    analysis,
    learningProposal: learning,
    harnessDecision: approval(learning),
    targetPaths: ["build/autonomous-guest/qa/fix-verification.ts"],
    deterministicGateRefs: ["test:issue-1571-fix-verification", "ci:exact-head"],
    maximumAttempts: 2,
  });

  assert.equal(request.repairContract, "issue-1451-bounded-repair-request");
  assert.equal(request.maximumAttempts, 2);
  assert.equal(request.requiresSameDeterministicRerun, true);
  assert.equal(request.requiresExactHeadCi, true);
  assert.equal(request.requiresSeparateCodingAuthority, true);
  assert.equal(request.testerRepairAuthorityGranted, false);
  assert.equal(request.testerApprovalAuthorityGranted, false);
  assert.equal(request.learnerApprovalAuthorityGranted, false);
  assert.equal(request.repairAuthorityGranted, false);
  assert.equal(request.sourceMutationAllowed, false);
  assert.equal(request.mergeAuthorityGranted, false);
  assert.equal(request.operationalAuthorityGranted, false);
  assert.equal(request.deterministicSuccessClaimed, false);
  assert.equal(request.aiSelfCertified, false);
});

test("#1592 Slice F fails closed for flaky, stale, cross-boundary or self-authorizing repair evidence", () => {
  assert.throws(
    () => createMaintainerQaAnalysisPackage({
      defect: defect({ reproducible: false, severity: "flaky", observations: [observation()] }),
      exactCommitSha: FAILING_SHA,
      architectureSnapshot: architecture(),
      domain: "developer",
    }),
    /reproduced non-flaky/,
  );
  assert.throws(
    () => createMaintainerQaAnalysisPackage({
      defect: defect(),
      exactCommitSha: OTHER_SHA,
      architectureSnapshot: architecture({ exactCommitSha: OTHER_SHA }),
      domain: "developer",
    }),
    /two matching reproductions on the exact failing commit/,
  );

  const analysis = createMaintainerQaAnalysisPackage({
    defect: defect(),
    exactCommitSha: FAILING_SHA,
    architectureSnapshot: architecture(),
    domain: "developer",
  });
  const learning = observedLearning(createMaintainerDefectLearningInput({
    analysis,
    proposalId: "maintainer-defect-lesson-failclosed-1592",
    createdAt: "2026-09-01T13:32:00.000Z",
  }));

  assert.throws(
    () => createMaintainerBoundedRepairRequest({
      analysis,
      learningProposal: learning,
      harnessDecision: approval(learning),
      targetPaths: ["modules/wyrmwood/rival-director.ts"],
      deterministicGateRefs: ["ci:exact-head"],
    }),
    /escapes the verified ownership boundary/,
  );
  assert.throws(
    () => createMaintainerBoundedRepairRequest({
      analysis,
      learningProposal: observedLearning(learning, { sourceMutationAllowed: true }),
      harnessDecision: approval(learning),
      targetPaths: ["build/autonomous-guest/qa/fix-verification.ts"],
      deterministicGateRefs: ["ci:exact-head"],
    }),
    /reject self-authorizing or operational learning proposals/,
  );
  assert.throws(
    () => createMaintainerBoundedRepairRequest({
      analysis,
      learningProposal: learning,
      harnessDecision: approval(learning, { sourceMutationAllowed: true }),
      targetPaths: ["build/autonomous-guest/qa/fix-verification.ts"],
      deterministicGateRefs: ["ci:exact-head"],
    }),
    /without operational authority/,
  );
  assert.throws(
    () => createMaintainerBoundedRepairRequest({
      analysis,
      learningProposal: learning,
      harnessDecision: approval(learning),
      targetPaths: ["build/autonomous-guest/qa/fix-verification.ts"],
      deterministicGateRefs: ["ci:exact-head"],
      maximumAttempts: 4,
    }),
    /between one and three/,
  );
});
