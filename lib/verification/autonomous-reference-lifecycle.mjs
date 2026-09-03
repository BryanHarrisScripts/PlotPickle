import {
  normalizeLifecycleEnvelope,
  transitionLifecycleEnvelope,
} from "../../core/lifecycle/lifecycle-contract.mjs";
import {
  PLOTPICKLE_DELEGATED_STORY_DECISION_AUTHORITY_CLASS,
  decideLifecycleAuthority,
} from "../../core/lifecycle/lifecycle-authority.mjs";
import {
  decideLifecycleRepair,
  normalizeLifecycleValidationEvidence,
} from "../../core/lifecycle/lifecycle-validation.mjs";

const FAILURE_STOP_CONTRACT = "tests/issue-1553-autonomous-convergence-restart.test.mjs";
const REFERENCE_RUNNER = "scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs";

function required(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function ref(value, prefix) {
  return `${prefix}:${required(value, prefix)}`;
}

function withStageState(envelope, overrides = {}) {
  return normalizeLifecycleEnvelope({ ...envelope, ...overrides });
}

function advance(envelope, toStage, reasonRef, overrides = {}) {
  const authority = decideLifecycleAuthority({ envelope, action: "transition", toStage });
  if (!authority.allowed) throw new Error(authority.reason);
  const transitioned = transitionLifecycleEnvelope(envelope, toStage, { reasonRef });
  return {
    authority,
    envelope: withStageState(transitioned, overrides),
  };
}

export function createAutonomousReferenceLifecycleProof(input) {
  const runId = required(input?.runId, "runId");
  const operatorId = required(input?.operatorId, "operatorId");
  const projectId = required(input?.projectId, "projectId");
  const baseRevision = required(input?.baseRevision, "baseRevision");
  const resultingRevision = required(input?.resultingRevision, "resultingRevision");
  const decisionId = required(input?.decisionId, "decisionId");
  const taskId = required(input?.taskId, "taskId");
  const workbenchEvidenceRef = required(input?.workbenchEvidenceRef, "workbenchEvidenceRef");
  const beforeRouteEvidenceRef = required(input?.beforeRouteEvidenceRef, "beforeRouteEvidenceRef");
  const afterRouteEvidenceRef = required(input?.afterRouteEvidenceRef, "afterRouteEvidenceRef");
  const packageRef = required(input?.packageRef, "packageRef");
  const continuationRef = required(input?.continuationRef, "continuationRef");

  if (input?.restartVerified !== true) throw new Error("The autonomous reference lifecycle requires verified application restart continuity.");
  if (input?.taskCompleted !== true) throw new Error("The autonomous reference lifecycle requires a completed durable Guest task.");
  if (input?.decisionApplied !== true) throw new Error("The autonomous reference lifecycle requires a validated delegated Story Workbench apply receipt.");
  if (input?.contractsPassed !== true) throw new Error("The autonomous reference lifecycle requires the existing autonomous contract suite to pass.");
  if (input?.idempotentContinuation !== true) throw new Error("The autonomous reference lifecycle requires truthful idempotent continuation after restart.");

  const actor = Object.freeze({
    actorId: `guest:${runId}`,
    kind: "guest",
    authorityClass: "delegated-guest-autonomous-operator",
    delegated: true,
    humanProfileId: "",
    operatorId,
    authorityRef: `authority:autonomous-guest/${runId}`,
  });
  const capabilities = Object.freeze([
    "route:library",
    "route:story-decisions",
    "route:story-workbench",
    "route:visual-readiness",
    "route:storyboard",
    "route:production-shots",
    "route:previs-animatic",
  ]);
  const contractRefs = Object.freeze([
    "guest-authority:core/auth/autonomous-guest/guest-authority.ts",
    "story-decision-authority:core/story-workflow/story-decisions/autonomous-authority.mjs",
    "story-decision-operator:core/story-workflow/story-decisions/autonomous-operator.mjs",
    "story-workbench:modules/story-workflow/workbench/workflow.ts",
    "guest-task:build/autonomous-guest/task-lifecycle.ts",
    `failure-stop-contract:${FAILURE_STOP_CONTRACT}`,
  ]);

  let current = normalizeLifecycleEnvelope({
    schemaVersion: 1,
    runId,
    projectId,
    revision: baseRevision,
    stage: "enter-understand",
    priorTransition: null,
    actor,
    intent: { kind: "autonomous-story-reference", ref: "intent:afterglow-reference" },
    planOrDecisionRefs: [],
    capabilities,
    contextRefs: [`ppf:${projectId}@${baseRevision}`],
    inputRefs: ["library-source:afterglow-v9"],
    outputRefs: [],
    evidenceRefs: [],
    integrationRefs: [],
    contractRefs,
    validation: { result: "not-run", authorityRef: "", evidenceRefs: [] },
    repairBudget: { attempts: 0, maxAttempts: 2 },
    persistence: { classification: "none", ownerRef: "", decision: "none", approvalRef: "" },
    stopReason: { code: "", detailRef: "" },
    nextAction: { action: "prepare", ref: "lifecycle:learn-prepare", continuationRef: ref(taskId, "guest-task") },
  });

  const stages = [{ stage: current.stage, envelope: current }];
  const transitions = [];

  let moved = advance(current, "learn-prepare", "evidence:afterglow-library-bootstrap", {
    evidenceRefs: ["evidence:afterglow-library-bootstrap"],
    nextAction: { action: "plan", ref: "lifecycle:plan-decide", continuationRef: ref(taskId, "guest-task") },
  });
  transitions.push(moved.authority); current = moved.envelope; stages.push({ stage: current.stage, envelope: current });

  moved = advance(current, "plan-decide", ref(decisionId, "story-decision"), {
    planOrDecisionRefs: [ref(decisionId, "story-decision")],
    nextAction: { action: "execute", ref: "lifecycle:create-execute", continuationRef: ref(taskId, "guest-task") },
  });
  transitions.push(moved.authority); current = moved.envelope; stages.push({ stage: current.stage, envelope: current });

  for (const capabilityRef of ["route:story-decisions", "route:story-workbench", "route:visual-readiness"]) {
    const execution = decideLifecycleAuthority({ envelope: current, action: "execute", capabilityRef });
    if (!execution.allowed) throw new Error(execution.reason);
  }
  moved = advance(current, "create-execute", beforeRouteEvidenceRef, {
    revision: resultingRevision,
    outputRefs: [ref(decisionId, "story-decision"), workbenchEvidenceRef],
    evidenceRefs: [beforeRouteEvidenceRef, workbenchEvidenceRef],
    nextAction: { action: "validate", ref: "lifecycle:validate-repair", continuationRef: ref(taskId, "guest-task") },
  });
  transitions.push(moved.authority); current = moved.envelope; stages.push({ stage: current.stage, envelope: current });

  const validationEvidence = normalizeLifecycleValidationEvidence({
    checkId: "autonomous-story-reference-routes",
    result: "pass",
    scopeRef: `project:${projectId}`,
    exactRevisionRef: `ppf:${projectId}@${resultingRevision}`,
    authorityRef: "verification:autonomous-story-reference-controller",
    reasonRef: "route-reference:pass",
    evidenceRefs: [beforeRouteEvidenceRef, afterRouteEvidenceRef],
    rerunRef: REFERENCE_RUNNER,
    safeNextAction: "approve-persist",
    repairActorRef: "agent:bounded-repair-worker",
  });
  moved = advance(current, "validate-repair", validationEvidence.reasonRef, {
    evidenceRefs: [beforeRouteEvidenceRef, afterRouteEvidenceRef, workbenchEvidenceRef],
    validation: {
      result: validationEvidence.result,
      authorityRef: validationEvidence.authorityRef,
      evidenceRefs: validationEvidence.evidenceRefs,
    },
    nextAction: { action: "persist", ref: "lifecycle:approve-persist", continuationRef: ref(taskId, "guest-task") },
  });
  transitions.push(moved.authority); current = moved.envelope; stages.push({ stage: current.stage, envelope: current });
  const validationDecision = decideLifecycleRepair({ envelope: current, evidence: validationEvidence });
  if (validationDecision.action !== "advance") throw new Error("The real autonomous reference validation did not deterministically advance.");

  const approvalRef = `story-workbench-policy:${decisionId}@${resultingRevision}`;
  moved = advance(current, "approve-persist", "validation:autonomous-story-reference-pass", {
    persistence: {
      classification: "canonical-project-state",
      ownerRef: "story-workbench:canonical-apply",
      decision: "approved",
      approvalRef,
    },
    nextAction: { action: "package", ref: "lifecycle:package-present-continue", continuationRef },
  });
  transitions.push(moved.authority); current = moved.envelope; stages.push({ stage: current.stage, envelope: current });

  const persistenceDecision = decideLifecycleAuthority({
    envelope: current,
    action: "persist",
    approval: {
      kind: "delegated-story-workbench",
      authorityClass: PLOTPICKLE_DELEGATED_STORY_DECISION_AUTHORITY_CLASS,
      delegated: true,
      serverPolicyApproved: true,
      workbenchValidated: true,
      humanProfileId: "",
      autonomousRunId: runId,
      operatorId,
      projectId,
      approvalRef,
      evidenceRef: workbenchEvidenceRef,
      resultingRevision,
    },
  });
  if (!persistenceDecision.allowed) throw new Error(persistenceDecision.reason);

  moved = advance(current, "package-present-continue", packageRef, {
    outputRefs: [ref(decisionId, "story-decision"), workbenchEvidenceRef, packageRef],
    nextAction: { action: "continue", ref: "autonomous-reference:completed", continuationRef },
  });
  transitions.push(moved.authority); current = moved.envelope; stages.push({ stage: current.stage, envelope: current });
  const continuationDecision = decideLifecycleAuthority({ envelope: current, action: "continue", resumeActor: actor });
  if (!continuationDecision.allowed) throw new Error(continuationDecision.reason);

  return Object.freeze({
    schemaVersion: 1,
    runId,
    projectId,
    baseRevision,
    resultingRevision,
    stageSequence: Object.freeze(stages.map((item) => item.stage)),
    stages: Object.freeze(stages),
    transitions: Object.freeze(transitions),
    validation: Object.freeze({ evidence: validationEvidence, decision: validationDecision }),
    persistence: persistenceDecision,
    continuation: continuationDecision,
    boundedFailureStopProof: Object.freeze({
      contractRef: FAILURE_STOP_CONTRACT,
      contractSuitePassed: true,
      provenStopCodes: Object.freeze(["reevaluation-fanout", "convergence-limit", "resume-state-mismatch"]),
      unboundedLoopPermitted: false,
    }),
    restart: Object.freeze({ verified: true, idempotentContinuation: true, taskId }),
    package: Object.freeze({ packageRef, continuationRef }),
    authority: Object.freeze({
      actorKind: actor.kind,
      authorityClass: actor.authorityClass,
      delegated: true,
      humanProfileId: "",
      humanApproved: persistenceDecision.humanApproved,
      autonomousPolicyApproved: persistenceDecision.autonomousPolicyApproved,
      operationalAuthorityGranted: persistenceDecision.operationalAuthorityGranted,
    }),
  });
}
