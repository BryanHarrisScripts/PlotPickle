import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { decideLifecycleAuthority } from "../core/lifecycle/lifecycle-authority.mjs";
import { createAutonomousReferenceLifecycleProof } from "../lib/verification/autonomous-reference-lifecycle.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function proofInput(overrides = {}) {
  return {
    runId: "afterglow-reference-v1",
    operatorId: "plotpickle-autonomous-reference",
    projectId: "afterglow-working-copy",
    baseRevision: "11",
    resultingRevision: "12",
    decisionId: "decision-afterglow-1",
    taskId: "task-library-1",
    workbenchEvidenceRef: "story-workbench-receipt:decision-afterglow-1@12",
    beforeRouteEvidenceRef: "autonomous-route-pass:before:afterglow-working-copy@12",
    afterRouteEvidenceRef: "autonomous-route-pass:after:afterglow-working-copy@12",
    packageRef: "autonomous-reference-package:afterglow-working-copy@12",
    continuationRef: "guest-task:task-library-1",
    restartVerified: true,
    taskCompleted: true,
    decisionApplied: true,
    contractsPassed: true,
    idempotentContinuation: true,
    ...overrides,
  };
}

test("#1649 projects the real autonomous reference shape through all seven canonical lifecycle stages", () => {
  const proof = createAutonomousReferenceLifecycleProof(proofInput());
  assert.deepEqual(proof.stageSequence, [
    "enter-understand",
    "learn-prepare",
    "plan-decide",
    "create-execute",
    "validate-repair",
    "approve-persist",
    "package-present-continue",
  ]);
  assert.equal(proof.transitions.length, 6);
  assert.ok(proof.transitions.every((transition) => transition.allowed === true));
  assert.equal(proof.validation.decision.action, "advance");
  assert.equal(proof.persistence.allowed, true);
  assert.equal(proof.persistence.code, "delegated-workbench-approved-canonical-state");
  assert.equal(proof.persistence.autonomousPolicyApproved, true);
  assert.equal(proof.persistence.humanApproved, false);
  assert.equal(proof.persistence.operationalAuthorityGranted, false);
  assert.equal(proof.continuation.allowed, true);
  assert.equal(proof.restart.verified, true);
  assert.equal(proof.restart.idempotentContinuation, true);
});

test("#1649 retains zero-Human delegated authority while preserving the existing Story Decision and Workbench owners", () => {
  const proof = createAutonomousReferenceLifecycleProof(proofInput());
  assert.equal(proof.authority.actorKind, "guest");
  assert.equal(proof.authority.authorityClass, "delegated-guest-autonomous-operator");
  assert.equal(proof.authority.delegated, true);
  assert.equal(proof.authority.humanProfileId, "");
  assert.equal(proof.authority.humanApproved, false);
  const finalEnvelope = proof.stages.at(-1).envelope;
  assert.ok(finalEnvelope.contractRefs.includes("story-decision-authority:core/story-workflow/story-decisions/autonomous-authority.mjs"));
  assert.ok(finalEnvelope.contractRefs.includes("story-decision-operator:core/story-workflow/story-decisions/autonomous-operator.mjs"));
  assert.ok(finalEnvelope.contractRefs.includes("story-workbench:modules/story-workflow/workbench/workflow.ts"));
});

test("#1649 does not accept a forged delegated Workbench persistence projection", () => {
  const proof = createAutonomousReferenceLifecycleProof(proofInput());
  const approveEnvelope = proof.stages.find((item) => item.stage === "approve-persist").envelope;
  const baseline = {
    kind: "delegated-story-workbench",
    authorityClass: "delegated-autonomous-operator",
    delegated: true,
    serverPolicyApproved: true,
    workbenchValidated: true,
    humanProfileId: "",
    autonomousRunId: proof.runId,
    operatorId: "plotpickle-autonomous-reference",
    projectId: proof.projectId,
    approvalRef: approveEnvelope.persistence.approvalRef,
    evidenceRef: "story-workbench-receipt:decision-afterglow-1@12",
    resultingRevision: "12",
  };

  for (const approval of [
    { ...baseline, serverPolicyApproved: false },
    { ...baseline, workbenchValidated: false },
    { ...baseline, autonomousRunId: "other-run" },
    { ...baseline, operatorId: "other-operator" },
    { ...baseline, humanProfileId: "profile-human" },
    { ...baseline, evidenceRef: "evidence:not-in-run" },
  ]) {
    const denied = decideLifecycleAuthority({ envelope: approveEnvelope, action: "persist", approval });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "canonical-persistence-approval-required");
  }
});

test("#1649 uses the existing convergence/restart contract to prove bounded failure and truthful stop behavior", () => {
  const proof = createAutonomousReferenceLifecycleProof(proofInput());
  assert.equal(proof.boundedFailureStopProof.contractRef, "tests/issue-1553-autonomous-convergence-restart.test.mjs");
  assert.equal(proof.boundedFailureStopProof.contractSuitePassed, true);
  assert.deepEqual(proof.boundedFailureStopProof.provenStopCodes, ["reevaluation-fanout", "convergence-limit", "resume-state-mismatch"]);
  assert.equal(proof.boundedFailureStopProof.unboundedLoopPermitted, false);
});

test("#1649 refuses to claim lifecycle completion when restart task apply contracts or continuation proof are missing", () => {
  for (const overrides of [
    { restartVerified: false },
    { taskCompleted: false },
    { decisionApplied: false },
    { contractsPassed: false },
    { idempotentContinuation: false },
  ]) {
    assert.throws(() => createAutonomousReferenceLifecycleProof(proofInput(overrides)), /requires/);
  }
});

test("#1649 extends the existing one-command reference controller instead of adding a demo-only orchestration path", async () => {
  const [referenceRunner, routeRunner, convergenceContract] = await Promise.all([
    read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs"),
    read("scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs"),
    read("tests/issue-1553-autonomous-convergence-restart.test.mjs"),
  ]);

  assert.match(referenceRunner, /createAutonomousReferenceLifecycleProof/);
  assert.match(referenceRunner, /run-autonomous-story-routes\.mjs/);
  assert.match(referenceRunner, /afterglow-v9/);
  assert.match(referenceRunner, /decisionPersistedAfterRestart/);
  assert.match(referenceRunner, /completedFromOperatedRoute/);
  assert.match(referenceRunner, /baseRevision: String\(beforeDecision\?\.action\?\.receipt\?\.baseRevision/);
  assert.match(referenceRunner, /schemaVersion: 6/);
  assert.match(routeRunner, /operateAutonomousStoryDecision/);
  assert.match(routeRunner, /respond-autonomous/);
  assert.match(routeRunner, /Apply change/);
  assert.match(routeRunner, /receipt: \{ baseRevision: String\(action\.receipt\?\.baseRevision/);
  assert.match(convergenceContract, /convergence-limit/);
  assert.match(convergenceContract, /reevaluation-fanout/);
  assert.match(convergenceContract, /resume-state-mismatch/);

  assert.doesNotMatch(referenceRunner, /resultingRevision[^\n]*[-+]\s*1|parseInt\([^\n]*resultingRevision|Number\([^\n]*resultingRevision/);
  assert.doesNotMatch(referenceRunner, /saveFoundationProjectAtRevision|applyStoryWorkbenchReview|respondAutonomousStoryDecisionThroughGateway/);
});
