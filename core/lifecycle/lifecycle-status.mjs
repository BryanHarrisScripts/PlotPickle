import { normalizeLifecycleEnvelope } from "./lifecycle-contract.mjs";
import { decideLifecycleAuthority } from "./lifecycle-authority.mjs";

export const PLOTPICKLE_LIFECYCLE_STATUS_KINDS = Object.freeze([
  "normal",
  "paused",
  "repairing",
  "awaiting-policy",
  "failed",
  "completed",
]);

const STAGE_LABELS = Object.freeze({
  "enter-understand": "Enter and understand",
  "learn-prepare": "Learn and prepare",
  "plan-decide": "Plan and decide",
  "create-execute": "Create and execute",
  "validate-repair": "Validate and repair",
  "approve-persist": "Approve and persist",
  "package-present-continue": "Package, present and continue",
});

function words(value) {
  return String(value || "")
    .replace(/^[a-z-]+:/i, "")
    .replaceAll(/[_:/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentence(value, fallback) {
  const text = words(value);
  if (!text) return fallback;
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function actorLabel(actor) {
  if (actor.kind === "human") return "Human";
  if (actor.kind === "guest") return "Autonomous Guest";
  if (actor.kind === "agent") return "Agent";
  return "PlotPickle system";
}

function stopKind(code) {
  const value = String(code || "").toLowerCase();
  if (!value) return "";
  if (/(policy|approval|writer|consent|authorization)/.test(value)) return "awaiting-policy";
  if (/(pause|paused|waiting|wait)/.test(value)) return "paused";
  if (/(repair|retry)/.test(value)) return "repairing";
  return "failed";
}

function statusKind(envelope) {
  const stopped = stopKind(envelope.stopReason.code);
  if (envelope.stage === "package-present-continue") {
    if (stopped && !/(complete|completed)/i.test(envelope.stopReason.code)) return stopped === "repairing" ? "failed" : stopped;
    return "completed";
  }
  if (stopped) return stopped;
  if (envelope.stage === "validate-repair" && envelope.validation.result === "fail"
    && envelope.repairBudget.attempts < envelope.repairBudget.maxAttempts) return "repairing";
  if (envelope.stage === "approve-persist" && envelope.persistence.decision === "pending") return "awaiting-policy";
  if (envelope.validation.result === "blocked") return "failed";
  return "normal";
}

function validationProjection(envelope) {
  const result = envelope.validation.result;
  if (result === "pass") return Object.freeze({ result, label: "Passed authoritative validation", blocking: false });
  if (result === "fail") return Object.freeze({ result, label: "Failed authoritative validation", blocking: true });
  if (result === "blocked") return Object.freeze({ result, label: "Validation is blocked", blocking: true });
  return Object.freeze({ result, label: "Validation has not run yet", blocking: false });
}

function persistenceProjection(envelope) {
  const persistence = envelope.persistence;
  const approved = persistence.decision === "approved";
  if (persistence.classification === "none") {
    return Object.freeze({ ...persistence, label: "Nothing is being persisted", canon: false, approvalKind: "none" });
  }
  if (persistence.classification === "evidence") {
    return Object.freeze({ ...persistence, label: approved ? "Evidence is approved for storage; it is not story canon" : "Evidence storage is not approved yet", canon: false, approvalKind: approved ? "existing-owner" : "none" });
  }
  if (persistence.classification === "durable-non-canon") {
    return Object.freeze({ ...persistence, label: approved ? "Operational state is saved; it is not story canon" : "Operational state is awaiting persistence", canon: false, approvalKind: approved ? "existing-owner" : "none" });
  }
  if (persistence.classification === "durable-knowledge") {
    return Object.freeze({ ...persistence, label: approved ? "Harness policy approved durable knowledge; this grants no operating authority" : "Durable knowledge is awaiting harness policy approval", canon: false, approvalKind: approved ? "harness-policy" : "none" });
  }
  if (!approved) {
    return Object.freeze({ ...persistence, label: "Canonical story state is awaiting approval", canon: true, approvalKind: "none" });
  }
  if (envelope.actor.kind === "human") {
    return Object.freeze({ ...persistence, label: "Human-approved canonical story state", canon: true, approvalKind: "human" });
  }
  if (envelope.actor.kind === "guest") {
    return Object.freeze({ ...persistence, label: "Autonomous policy-approved canonical story state", canon: true, approvalKind: "autonomous-policy" });
  }
  return Object.freeze({ ...persistence, label: "Canonical story state is approved by its existing authority", canon: true, approvalKind: "existing-owner" });
}

function targetStage(nextAction) {
  const match = String(nextAction.ref || "").match(/^lifecycle:(enter-understand|learn-prepare|plan-decide|create-execute|validate-repair|approve-persist|package-present-continue)$/);
  return match ? match[1] : "";
}

function nextActionProjection(envelope) {
  if (!envelope.nextAction.action) {
    return Object.freeze({ action: "", label: "No further action is recorded for this lifecycle", ref: "", continuationRef: "", valid: false, availableToActor: false });
  }
  const target = targetStage(envelope.nextAction);
  let decision;
  if (target) decision = decideLifecycleAuthority({ envelope, action: "transition", toStage: target });
  else decision = decideLifecycleAuthority({ envelope, action: "continue", resumeActor: envelope.actor });
  const external = /(?:await|wait)(?:-|_)?(?:human|writer|policy|approval)?/i.test(envelope.nextAction.action);
  return Object.freeze({
    action: envelope.nextAction.action,
    label: sentence(envelope.nextAction.action, "Continue with the recorded next action"),
    ref: envelope.nextAction.ref,
    continuationRef: envelope.nextAction.continuationRef,
    valid: decision.allowed === true,
    availableToActor: decision.allowed === true && !external,
    authorityCode: decision.code,
  });
}

function headline(kind) {
  if (kind === "paused") return "Work is paused";
  if (kind === "repairing") return "PlotPickle is repairing a verified problem";
  if (kind === "awaiting-policy") return "PlotPickle is waiting for an approval or policy decision";
  if (kind === "failed") return "This lifecycle has stopped on a blocker";
  if (kind === "completed") return "This lifecycle is complete";
  return "PlotPickle is working within the current lifecycle stage";
}

function summary(kind, envelope) {
  if (kind === "repairing") {
    const remaining = Math.max(0, envelope.repairBudget.maxAttempts - envelope.repairBudget.attempts);
    return `${headline(kind)}. ${remaining} bounded repair attempt${remaining === 1 ? " remains" : "s remain"} before the harness must stop.`;
  }
  if (kind === "awaiting-policy") return `${headline(kind)}. The active actor cannot approve or elevate itself.`;
  if (kind === "paused") return `${headline(kind)}. ${sentence(envelope.stopReason.code, "Resume only through the recorded continuation")}`;
  if (kind === "failed") return `${headline(kind)}. ${sentence(envelope.stopReason.code, "Inspect the recorded blocker before continuing")}`;
  if (kind === "completed") return `${headline(kind)}. The package and continuation references remain inspectable.`;
  return `${headline(kind)}: ${STAGE_LABELS[envelope.stage]}.`;
}

export function projectLifecycleStatus(value) {
  const envelope = normalizeLifecycleEnvelope(value);
  const kind = statusKind(envelope);
  const persistence = persistenceProjection(envelope);
  const nextAction = nextActionProjection(envelope);
  return Object.freeze({
    schemaVersion: 1,
    runId: envelope.runId,
    projectId: envelope.projectId,
    revision: envelope.revision,
    kind,
    headline: headline(kind),
    summary: summary(kind, envelope),
    stage: envelope.stage,
    stageLabel: STAGE_LABELS[envelope.stage],
    actor: Object.freeze({
      kind: envelope.actor.kind,
      label: actorLabel(envelope.actor),
      authorityClass: envelope.actor.authorityClass,
      delegated: envelope.actor.delegated,
      humanApproved: persistence.approvalKind === "human",
      autonomousPolicyApproved: persistence.approvalKind === "autonomous-policy",
    }),
    completedWork: Object.freeze({
      count: envelope.outputRefs.length,
      refs: envelope.outputRefs,
      label: envelope.outputRefs.length ? `${envelope.outputRefs.length} recorded output${envelope.outputRefs.length === 1 ? "" : "s"}` : "No completed output recorded yet",
    }),
    validation: validationProjection(envelope),
    persistence,
    stopReason: Object.freeze({
      code: envelope.stopReason.code,
      detailRef: envelope.stopReason.detailRef,
      label: envelope.stopReason.code ? sentence(envelope.stopReason.code, "Stopped") : "No stop reason",
    }),
    nextAction,
    technical: Object.freeze({
      authorityRef: envelope.actor.authorityRef,
      validationAuthorityRef: envelope.validation.authorityRef,
      evidenceRefs: envelope.evidenceRefs,
      contractRefs: envelope.contractRefs,
      persistenceOwnerRef: envelope.persistence.ownerRef,
      approvalRef: envelope.persistence.approvalRef,
      continuationRef: envelope.nextAction.continuationRef,
    }),
  });
}
