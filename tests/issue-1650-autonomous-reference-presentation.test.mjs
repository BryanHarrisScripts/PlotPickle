import assert from "node:assert/strict";
import test from "node:test";

import { presentLifecycleProof } from "../core/lifecycle/lifecycle-presentation.mjs";
import { createAutonomousReferenceLifecycleProof } from "../lib/verification/autonomous-reference-lifecycle.mjs";

function proofInput() {
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
  };
}

test("#1650 the real #1649 packaged proof restores plain-language lifecycle status without a second state owner", () => {
  const proof = createAutonomousReferenceLifecycleProof(proofInput());
  const presentation = presentLifecycleProof(proof);

  assert.equal(presentation.history.length, 7);
  assert.deepEqual(presentation.history.map((item) => item.stage), proof.stageSequence);
  assert.equal(presentation.current.state, "completed");
  assert.equal(presentation.current.stateLabel, "Completed");
  assert.equal(presentation.current.stageLabel, "Packaging the result and continuation");
  assert.equal(presentation.current.authorityLabel, "Autonomous Guest policy");
  assert.equal(presentation.current.persistenceLabel, "Approved by autonomous policy; not Human approval");
  assert.equal(presentation.current.validationLabel, "Passed authoritative validation");
  assert.equal(presentation.current.nextActionLabel, "Continue from the saved result");
  assert.equal(presentation.current.technicalEvidence.continuationRef, "guest-task:task-library-1");
});
