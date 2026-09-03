import { normalizeLifecycleEnvelope } from "../../../core/lifecycle/lifecycle-contract.mjs";
import { projectLifecycleStatus } from "../../../core/lifecycle/lifecycle-status.mjs";

const STATE_STAGE = Object.freeze({
  queued: "enter-understand",
  "preparing-context": "learn-prepare",
  working: "create-execute",
  verifying: "validate-repair",
  revising: "validate-repair",
  "waiting-for-writer": "approve-persist",
  paused: "create-execute",
  completed: "package-present-continue",
  failed: "package-present-continue",
  cancelled: "package-present-continue",
});

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function refs(value, selector) {
  return Array.isArray(value) ? value.map(selector).filter(Boolean) : [];
}

function effectiveState(run) {
  return run.state === "paused" && text(run.resumeState) ? run.resumeState : run.state;
}

function stageForRun(run) {
  return STATE_STAGE[effectiveState(run)] || "enter-understand";
}

function validationForRun(run) {
  const evidence = Array.isArray(run.verificationEvidence) ? [...run.verificationEvidence].reverse() : [];
  const authoritative = evidence.find((item) => item?.authority === "authoritative-system" || item?.authority === "writer");
  if (!authoritative) return { result: "not-run", authorityRef: "", evidenceRefs: [] };
  const result = String(authoritative.result || "");
  const normalized = ["PASS", "ACCEPT"].includes(result) ? "pass" : ["FAIL", "REJECT", "REVISE"].includes(result) ? "fail" : "not-run";
  if (normalized === "not-run") return { result: "not-run", authorityRef: "", evidenceRefs: [] };
  return {
    result: normalized,
    authorityRef: `responsibility-verifier:${text(authoritative.verifier) || authoritative.authority}`,
    evidenceRefs: [text(authoritative.evidenceRef) || `responsibility-evidence:${text(authoritative.id)}`].filter(Boolean),
  };
}

function stopReasonForRun(run) {
  if (run.state === "waiting-for-writer") return "writer-approval-required";
  if (run.state === "paused") return "paused-by-user";
  if (run.state === "failed") return text(run.stopReason) || "run-failed";
  if (run.state === "cancelled") return text(run.stopReason) || "cancelled-by-user";
  return "";
}

function nextForRun(run, stage, validation) {
  if (run.state === "queued") return { action: "prepare", ref: "lifecycle:learn-prepare", continuationRef: `responsibility-run:${run.runId}` };
  if (run.state === "preparing-context") return { action: "plan", ref: "lifecycle:plan-decide", continuationRef: `responsibility-run:${run.runId}` };
  if (run.state === "working") return { action: "validate", ref: "lifecycle:validate-repair", continuationRef: `responsibility-run:${run.runId}` };
  if (run.state === "verifying") {
    if (validation.result === "pass") return { action: "persist", ref: "lifecycle:approve-persist", continuationRef: `responsibility-run:${run.runId}` };
    return { action: "continue-verification", ref: `responsibility-run:${run.runId}`, continuationRef: `responsibility-run:${run.runId}` };
  }
  if (run.state === "revising") return { action: "repair", ref: "lifecycle:create-execute", continuationRef: `responsibility-run:${run.runId}` };
  if (run.state === "waiting-for-writer") return { action: "await-human-writer", ref: `writer-decision:${run.runId}`, continuationRef: `responsibility-run:${run.runId}` };
  if (run.state === "paused") return { action: "resume", ref: `responsibility-run:${run.runId}`, continuationRef: `responsibility-run:${run.runId}` };
  if (run.state === "completed") return { action: "continue", ref: `responsibility-run-result:${run.runId}`, continuationRef: `responsibility-run:${run.runId}` };
  void stage;
  return { action: "", ref: "", continuationRef: "" };
}

export function responsibilityRunLifecycleEnvelope(run) {
  if (!run || typeof run !== "object" || Array.isArray(run)) throw new Error("Responsibility Run lifecycle status requires a Run record.");
  const runId = text(run.runId);
  const profileId = text(run.profileId);
  if (!runId || !profileId) throw new Error("Responsibility Run lifecycle status requires run and agent profile identity.");
  const stage = stageForRun(run);
  const validation = validationForRun(run);
  const artifacts = refs(run.artifacts, (item) => text(item?.ref) || (text(item?.id) ? `responsibility-artifact:${text(item.id)}` : ""));
  const evidenceRefs = refs(run.verificationEvidence, (item) => text(item?.evidenceRef) || (text(item?.id) ? `responsibility-evidence:${text(item.id)}` : ""));
  const contextRefs = run.context && Array.isArray(run.context.sourceIds) ? run.context.sourceIds.map(text).filter(Boolean) : [];
  const attempts = Math.max(0, Number(run.usage?.attempts || 0));
  const maxAttempts = Math.max(attempts, Number(run.limits?.maxAttempts || attempts || 1));
  return normalizeLifecycleEnvelope({
    schemaVersion: 1,
    runId,
    projectId: "",
    revision: String(run.objectiveRevision || ""),
    stage,
    priorTransition: null,
    actor: {
      actorId: `agent:${profileId}`,
      kind: "agent",
      authorityClass: "bounded-agent-worker",
      delegated: false,
      humanProfileId: "",
      operatorId: profileId,
      authorityRef: `agent-profile:${profileId}`,
    },
    intent: { kind: text(run.kind) || "responsibility-run", ref: `responsibility-run:${runId}` },
    planOrDecisionRefs: [],
    capabilities: Array.isArray(run.allowedScopes) ? run.allowedScopes.map((scope) => `connector-scope:${scope}`) : [],
    contextRefs,
    inputRefs: run.context?.taskId ? [`context-task:${run.context.taskId}`] : [],
    outputRefs: artifacts,
    evidenceRefs,
    integrationRefs: Array.isArray(run.allowedConnectorIds) ? run.allowedConnectorIds.map((id) => `connector:${id}`) : [],
    contractRefs: ["responsibility-run:lib/agents/responsibility/responsibility-runs.ts"],
    validation,
    repairBudget: { attempts, maxAttempts },
    persistence: {
      classification: "durable-non-canon",
      ownerRef: "responsibility-run:local-store",
      decision: "approved",
      approvalRef: `responsibility-run-store:${runId}`,
    },
    stopReason: { code: stopReasonForRun(run), detailRef: run.handoff?.blocker ? `responsibility-handoff:${runId}` : "" },
    nextAction: nextForRun(run, stage, validation),
  });
}

export function projectResponsibilityRunLifecycleStatus(run) {
  return projectLifecycleStatus(responsibilityRunLifecycleEnvelope(run));
}
