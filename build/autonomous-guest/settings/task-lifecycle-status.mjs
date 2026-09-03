import { normalizeLifecycleEnvelope } from "../../../core/lifecycle/lifecycle-contract.mjs";
import { projectLifecycleStatus } from "../../../core/lifecycle/lifecycle-status.mjs";

const STATE_STAGE = Object.freeze({
  pending: "plan-decide",
  eligible: "create-execute",
  running: "create-execute",
  blocked: "validate-repair",
  "retry-wait": "validate-repair",
  completed: "package-present-continue",
  cancelled: "package-present-continue",
  expired: "package-present-continue",
  failed: "package-present-continue",
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function taskValidation(task) {
  const resultRefs = Array.isArray(task.resultRefs) ? task.resultRefs.map(text).filter(Boolean) : [];
  if (task.state === "completed" && resultRefs.some((ref) => ref === "disposition:operated" || ref.startsWith("revision:"))) {
    return { result: "pass", authorityRef: "autonomous-guest-task:operation-receipt", evidenceRefs: resultRefs };
  }
  if (task.state === "retry-wait" || task.state === "failed") {
    return {
      result: "fail",
      authorityRef: "autonomous-guest-task:failure-class",
      evidenceRefs: [text(task.lastFailureClass) ? `task-failure:${task.taskId}:${task.lastFailureClass}` : `task-failure:${task.taskId}`],
    };
  }
  if (task.state === "blocked") {
    return {
      result: "blocked",
      authorityRef: "autonomous-guest-task:blocker",
      evidenceRefs: [text(task.lastFailureClass) ? `task-blocker:${task.taskId}:${task.lastFailureClass}` : `task-blocker:${task.taskId}`],
    };
  }
  return { result: "not-run", authorityRef: "", evidenceRefs: [] };
}

function stopReason(task, schedule) {
  if (schedule?.status === "paused") return "paused-by-scheduler-policy";
  if (task.state === "blocked") return text(task.lastFailureClass) || "blocked-prerequisite";
  if (task.state === "retry-wait") return text(task.lastFailureClass) || "retry-wait";
  if (task.state === "failed") return text(task.lastFailureClass) || "task-failed";
  if (task.state === "cancelled") return "cancelled-by-policy";
  if (task.state === "expired") return "task-expired";
  return "";
}

function nextAction(task, schedule) {
  const continuationRef = `guest-task:${task.taskId}`;
  if (schedule?.status === "paused") return { action: "resume", ref: continuationRef, continuationRef };
  if (task.state === "pending") return { action: "wait-until-eligible", ref: continuationRef, continuationRef };
  if (task.state === "eligible") return { action: "execute-task", ref: continuationRef, continuationRef };
  if (task.state === "running") return { action: "validate", ref: "lifecycle:validate-repair", continuationRef };
  if (task.state === "retry-wait" && Number(task.attempt || 0) < Number(task.maxAttempts || 0)) {
    return { action: "repair", ref: "lifecycle:create-execute", continuationRef };
  }
  if (task.state === "blocked") {
    const policy = /(policy|provider|consent|budget|approval)/i.test(text(task.lastFailureClass));
    return { action: policy ? "await-policy" : "resolve-prerequisite", ref: continuationRef, continuationRef };
  }
  if (task.state === "completed") return { action: "continue", ref: `guest-task-result:${task.taskId}`, continuationRef };
  return { action: "", ref: "", continuationRef: "" };
}

export function autonomousGuestTaskLifecycleEnvelope({ authority, task, schedule = null }) {
  if (!authority || authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || text(authority.humanProfileId)) {
    throw new Error("Autonomous Guest lifecycle status requires delegated non-Human authority.");
  }
  if (!task || typeof task !== "object" || Array.isArray(task)) throw new Error("Autonomous Guest lifecycle status requires a task.");
  const stage = STATE_STAGE[task.state];
  if (!stage) throw new Error(`Autonomous Guest lifecycle status does not recognize task state ${String(task.state)}.`);
  const validation = taskValidation(task);
  const attempts = Math.max(0, Number(task.attempt || 0));
  const maxAttempts = Math.max(attempts, Number(task.maxAttempts || attempts || 1));
  return normalizeLifecycleEnvelope({
    schemaVersion: 1,
    runId: authority.autonomousRunId,
    projectId: text(task.projectId),
    revision: text(task.baseRevision),
    stage,
    priorTransition: null,
    actor: {
      actorId: `guest:${authority.autonomousRunId}`,
      kind: "guest",
      authorityClass: authority.authorityClass,
      delegated: true,
      humanProfileId: "",
      operatorId: authority.operatorId,
      authorityRef: `authority:autonomous-guest/${authority.autonomousRunId}`,
    },
    intent: { kind: text(task.taskKind) || "autonomous-guest-task", ref: `guest-task:${task.taskId}` },
    planOrDecisionRefs: Array.isArray(task.dependencyRefs) ? task.dependencyRefs.map(text).filter(Boolean) : [],
    capabilities: [text(task.targetRoute) ? `route:${task.targetRoute}` : ""].filter(Boolean),
    contextRefs: Array.isArray(task.dependencyRefs) ? task.dependencyRefs.map(text).filter(Boolean) : [],
    inputRefs: [text(task.providerPolicyRef) ? `provider-policy:${task.providerPolicyRef}` : ""].filter(Boolean),
    outputRefs: Array.isArray(task.resultRefs) ? task.resultRefs.map(text).filter(Boolean) : [],
    evidenceRefs: validation.evidenceRefs,
    integrationRefs: [],
    contractRefs: [
      "guest-authority:core/auth/autonomous-guest/guest-authority.ts",
      "guest-task:build/autonomous-guest/task-lifecycle.ts",
      "guest-ledger:build/autonomous-guest/task-ledger.ts",
    ],
    validation,
    repairBudget: { attempts, maxAttempts },
    persistence: {
      classification: "durable-non-canon",
      ownerRef: "guest-task:ledger",
      decision: "approved",
      approvalRef: `guest-run-policy:${authority.autonomousRunId}`,
    },
    stopReason: { code: stopReason(task, schedule), detailRef: text(task.lastFailureClass) ? `guest-task:${task.taskId}` : "" },
    nextAction: nextAction(task, schedule),
  });
}

export function projectAutonomousGuestTaskLifecycleStatus(input) {
  return projectLifecycleStatus(autonomousGuestTaskLifecycleEnvelope(input));
}
