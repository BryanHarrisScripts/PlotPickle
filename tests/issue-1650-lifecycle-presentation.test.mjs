import assert from "node:assert/strict";
import test from "node:test";

import { presentLifecycleEnvelope, presentLifecycleProof } from "../core/lifecycle/lifecycle-presentation.mjs";

function envelope(overrides = {}) {
  return {
    schemaVersion: 1,
    runId: "run-1650",
    projectId: "project-1650",
    revision: "rev-1",
    stage: "learn-prepare",
    priorTransition: { from: "enter-understand", to: "learn-prepare", at: "", reasonRef: "evidence:context" },
    actor: {
      actorId: "guest:run-1650",
      kind: "guest",
      authorityClass: "delegated-guest-autonomous-operator",
      delegated: true,
      humanProfileId: "",
      operatorId: "plotpickle-autonomous-reference",
      authorityRef: "authority:autonomous-guest/run-1650",
    },
    intent: { kind: "story-run", ref: "intent:1650" },
    planOrDecisionRefs: [],
    capabilities: ["route:story-workbench"],
    contextRefs: ["ppf:project-1650@rev-1"],
    inputRefs: [],
    outputRefs: [],
    evidenceRefs: ["evidence:context"],
    integrationRefs: [],
    contractRefs: ["lifecycle:core"],
    validation: { result: "not-run", authorityRef: "", evidenceRefs: [] },
    repairBudget: { attempts: 0, maxAttempts: 2 },
    persistence: { classification: "none", ownerRef: "", decision: "none", approvalRef: "" },
    stopReason: { code: "", detailRef: "" },
    nextAction: { action: "plan", ref: "lifecycle:plan-decide", continuationRef: "guest-task:1650" },
    ...overrides,
  };
}

test("#1650 normal lifecycle state is plain language and preserves technical evidence separately", () => {
  const status = presentLifecycleEnvelope(envelope());
  assert.equal(status.state, "normal");
  assert.equal(status.stateLabel, "In progress");
  assert.equal(status.stageLabel, "Preparing trusted context");
  assert.equal(status.authorityLabel, "Autonomous Guest policy");
  assert.equal(status.nextActionLabel, "Create the bounded plan");
  assert.deepEqual(status.progress, { current: 2, total: 7 });
  assert.equal(status.technicalEvidence.continuationRef, "guest-task:1650");
});

test("#1650 repairing and exhausted repair states are deterministic", () => {
  const failedValidation = {
    result: "fail",
    authorityRef: "verification:ben",
    evidenceRefs: ["finding:fanout"],
  };
  const repairing = presentLifecycleEnvelope(envelope({
    stage: "validate-repair",
    priorTransition: { from: "create-execute", to: "validate-repair", at: "", reasonRef: "verification:ben" },
    validation: failedValidation,
    repairBudget: { attempts: 1, maxAttempts: 2 },
    nextAction: { action: "repair", ref: "repair:finding:fanout", continuationRef: "guest-task:1650" },
  }));
  assert.equal(repairing.state, "repairing");
  assert.equal(repairing.stateLabel, "Repairing a specific failure");
  assert.equal(repairing.nextActionLabel, "Repair the specific failed check");

  const exhausted = presentLifecycleEnvelope(envelope({
    stage: "validate-repair",
    priorTransition: { from: "create-execute", to: "validate-repair", at: "", reasonRef: "verification:ben" },
    validation: failedValidation,
    repairBudget: { attempts: 2, maxAttempts: 2 },
    nextAction: { action: "stop", ref: "stop:repair-budget", continuationRef: "guest-task:1650" },
  }));
  assert.equal(exhausted.state, "failed");
  assert.equal(exhausted.stateLabel, "Stopped with a blocker");
});

test("#1650 paused, blocked and awaiting-policy states explain why continuation is bounded", () => {
  const paused = presentLifecycleEnvelope(envelope({
    stopReason: { code: "paused-provider-unavailable", detailRef: "provider:local" },
    nextAction: { action: "pause", ref: "provider:local", continuationRef: "guest-task:1650" },
  }));
  assert.equal(paused.state, "paused");
  assert.equal(paused.nextActionLabel, "Resume from the saved continuation point when ready");

  const blocked = presentLifecycleEnvelope(envelope({
    stage: "validate-repair",
    priorTransition: { from: "create-execute", to: "validate-repair", at: "", reasonRef: "verification:visual" },
    validation: { result: "blocked", authorityRef: "verification:visual-readiness", evidenceRefs: ["finding:missing-reference"] },
    stopReason: { code: "visual-readiness-blocked", detailRef: "finding:missing-reference" },
    nextAction: { action: "stop", ref: "finding:missing-reference", continuationRef: "guest-task:1650" },
  }));
  assert.equal(blocked.state, "failed");
  assert.equal(blocked.validationLabel, "Blocked by authoritative validation");

  const awaitingPolicy = presentLifecycleEnvelope(envelope({
    stage: "approve-persist",
    priorTransition: { from: "validate-repair", to: "approve-persist", at: "", reasonRef: "verification:pass" },
    validation: { result: "pass", authorityRef: "verification:story-workbench", evidenceRefs: ["receipt:workbench"] },
    persistence: { classification: "canonical-project-state", ownerRef: "story-workbench:canonical-apply", decision: "pending", approvalRef: "" },
    nextAction: { action: "persist", ref: "policy:story-workbench", continuationRef: "guest-task:1650" },
  }));
  assert.equal(awaitingPolicy.state, "awaiting-policy");
  assert.equal(awaitingPolicy.persistenceLabel, "Persistence is waiting for approval");
  assert.equal(awaitingPolicy.nextActionLabel, "Wait for the existing harness policy decision");
});

test("#1650 completed Guest status never presents autonomous policy as Human approval", () => {
  const completed = presentLifecycleEnvelope(envelope({
    stage: "package-present-continue",
    priorTransition: { from: "approve-persist", to: "package-present-continue", at: "", reasonRef: "package:1650" },
    revision: "rev-2",
    validation: { result: "pass", authorityRef: "verification:story-workbench", evidenceRefs: ["receipt:workbench"] },
    persistence: {
      classification: "canonical-project-state",
      ownerRef: "story-workbench:canonical-apply",
      decision: "approved",
      approvalRef: "story-workbench-policy:1650@rev-2",
    },
    nextAction: { action: "continue", ref: "run:completed", continuationRef: "guest-task:1650" },
  }));
  assert.equal(completed.state, "completed");
  assert.equal(completed.stateLabel, "Completed");
  assert.equal(completed.persistenceLabel, "Approved by autonomous policy; not Human approval");
  assert.equal(completed.nextActionLabel, "Continue from the saved result");
});

test("#1650 packaged lifecycle proof restores one truthful current status plus history", () => {
  const first = envelope();
  const final = envelope({
    stage: "package-present-continue",
    priorTransition: { from: "approve-persist", to: "package-present-continue", at: "", reasonRef: "package:1650" },
    validation: { result: "pass", authorityRef: "verification:reference", evidenceRefs: ["receipt:reference"] },
    persistence: { classification: "durable-non-canon", ownerRef: "guest-task:ledger", decision: "approved", approvalRef: "policy:guest-task" },
    nextAction: { action: "continue", ref: "run:completed", continuationRef: "guest-task:1650" },
  });
  const presentation = presentLifecycleProof({ stages: [{ stage: first.stage, envelope: first }, { stage: final.stage, envelope: final }] });
  assert.equal(presentation.current.state, "completed");
  assert.equal(presentation.current.stage, "package-present-continue");
  assert.equal(presentation.history.length, 2);
  assert.equal(presentation.runId, "run-1650");
});
