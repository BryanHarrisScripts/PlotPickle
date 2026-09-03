import { PLOTPICKLE_LIFECYCLE_STAGES, normalizeLifecycleEnvelope } from "./lifecycle-contract.mjs";

const STAGE_LABELS = Object.freeze({
  "enter-understand": "Understanding the request",
  "learn-prepare": "Preparing trusted context",
  "plan-decide": "Planning the next bounded action",
  "create-execute": "Creating through approved routes",
  "validate-repair": "Checking the result",
  "approve-persist": "Deciding what may persist",
  "package-present-continue": "Packaging the result and continuation",
});

const ACTION_LABELS = Object.freeze({
  prepare: "Prepare approved context",
  plan: "Create the bounded plan",
  execute: "Run the approved creative work",
  validate: "Run deterministic validation",
  repair: "Repair the specific failed check",
  persist: "Apply the approved persistence decision",
  package: "Package and present the result",
  continue: "Continue from the saved result",
  stop: "Stop safely",
  pause: "Resume when the blocker is cleared",
});

function plainState(envelope) {
  const stopCode = envelope.stopReason.code.toLowerCase();
  if (stopCode.startsWith("awaiting-policy") || (envelope.stage === "approve-persist" && envelope.persistence.decision === "pending")) {
    return "awaiting-policy";
  }
  if (stopCode.startsWith("pause") || stopCode.startsWith("paused")) return "paused";
  if (envelope.stage === "validate-repair" && envelope.validation.result === "fail" && envelope.repairBudget.attempts < envelope.repairBudget.maxAttempts && !stopCode) {
    return "repairing";
  }
  if (envelope.validation.result === "blocked" || stopCode) return "failed";
  if (envelope.stage === "package-present-continue" && envelope.nextAction.action === "continue") return "completed";
  return "normal";
}

function stateLabel(state) {
  return ({
    normal: "In progress",
    paused: "Paused safely",
    failed: "Stopped with a blocker",
    repairing: "Repairing a specific failure",
    "awaiting-policy": "Awaiting an approved policy decision",
    completed: "Completed",
  })[state];
}

function authorityLabel(envelope) {
  if (envelope.actor.kind === "human") return "Human authority";
  if (envelope.actor.kind === "guest") return "Autonomous Guest policy";
  if (envelope.actor.kind === "agent") return "Delegated agent authority";
  return "PlotPickle system authority";
}

function validationLabel(envelope) {
  if (envelope.validation.result === "not-run") return "Not run yet";
  if (envelope.validation.result === "pass") return "Passed authoritative validation";
  if (envelope.validation.result === "fail") return "Failed authoritative validation";
  return "Blocked by authoritative validation";
}

function persistenceLabel(envelope) {
  if (envelope.persistence.classification === "none" || envelope.persistence.decision === "none") return "Nothing durable requested";
  if (envelope.persistence.decision === "pending") return "Persistence is waiting for approval";
  if (envelope.persistence.decision === "rejected") return "Persistence was rejected";
  if (envelope.persistence.decision === "stale") return "Persistence decision is stale";
  if (envelope.actor.kind === "guest") return "Approved by autonomous policy; not Human approval";
  if (envelope.actor.kind === "human") return "Approved through Human authority";
  return "Approved by the owning harness policy";
}

function nextActionLabel(envelope, state) {
  if (state === "failed") return envelope.nextAction.action ? ACTION_LABELS[envelope.nextAction.action] || "Review the safe next action" : "Review the blocker before continuing";
  if (state === "paused") return "Resume from the saved continuation point when ready";
  if (state === "awaiting-policy") return "Wait for the existing harness policy decision";
  if (state === "completed") return envelope.nextAction.continuationRef ? "Continue from the saved result" : "No further action is required";
  return ACTION_LABELS[envelope.nextAction.action] || (envelope.nextAction.action ? "Continue with the next approved action" : "No next action is currently available");
}

export function presentLifecycleEnvelope(value) {
  const envelope = normalizeLifecycleEnvelope(value);
  const state = plainState(envelope);
  const stageIndex = PLOTPICKLE_LIFECYCLE_STAGES.indexOf(envelope.stage);
  return Object.freeze({
    schemaVersion: 1,
    runId: envelope.runId,
    projectId: envelope.projectId,
    revision: envelope.revision,
    state,
    stateLabel: stateLabel(state),
    stage: envelope.stage,
    stageLabel: STAGE_LABELS[envelope.stage],
    progress: Object.freeze({ current: stageIndex + 1, total: PLOTPICKLE_LIFECYCLE_STAGES.length }),
    authorityLabel: authorityLabel(envelope),
    authorityKind: envelope.actor.kind,
    authorityClass: envelope.actor.authorityClass,
    validationLabel: validationLabel(envelope),
    persistenceLabel: persistenceLabel(envelope),
    stopReason: envelope.stopReason.code,
    nextActionLabel: nextActionLabel(envelope, state),
    canContinue: Boolean(envelope.nextAction.action || envelope.nextAction.continuationRef),
    technicalEvidence: Object.freeze({
      validationAuthorityRef: envelope.validation.authorityRef,
      evidenceRefs: Object.freeze([...envelope.validation.evidenceRefs, ...envelope.evidenceRefs]),
      approvalRef: envelope.persistence.approvalRef,
      continuationRef: envelope.nextAction.continuationRef,
    }),
  });
}

export function presentLifecycleProof(proof) {
  if (!proof || !Array.isArray(proof.stages) || proof.stages.length === 0) throw new Error("A lifecycle proof with at least one canonical stage is required.");
  const history = proof.stages.map((item) => presentLifecycleEnvelope(item.envelope));
  const current = history[history.length - 1];
  return Object.freeze({
    schemaVersion: 1,
    runId: current.runId,
    projectId: current.projectId,
    current,
    history: Object.freeze(history),
  });
}
