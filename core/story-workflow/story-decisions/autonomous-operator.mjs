import { authorizeStoryDecisionAuthority } from "./autonomous-authority.mjs";
import {
  STORY_DECISION_RESPONSE_CLASSES,
  normalizeStoryDecisionRecord,
} from "./core.mjs";

const RESPONSE_CLASSES = new Set(STORY_DECISION_RESPONSE_CLASSES);
const WORKBENCH_RESPONSE_CLASSES = new Set([
  "accept-proposal",
  "select-alternative",
  "modify-proposal",
  "reject-proposal",
  "keep-current",
  "freeform-decision",
]);

function text(value, maximum = 2_000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function strings(value, maximum = 128, itemMaximum = 360) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

function boundedInteger(value, fallback, minimum = 1, maximum = 3) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function confidence(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
}

function iso(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function blocker(decision, authority, code, message, attempts = 0, extra = {}) {
  return {
    status: "blocked",
    blocker: { code, message: text(message, 600) },
    receipt: {
      autonomousRunId: authority.autonomousRunId,
      authorityClass: authority.authorityClass,
      operatorId: authority.operatorId,
      modelRole: authority.modelRole,
      modelId: authority.modelId,
      provider: authority.provider,
      runtime: authority.runtime,
      decisionId: decision.decisionId,
      sourceWorkItemId: decision.origin.workItemId,
      sourceCouncilResultId: decision.origin.councilResultId,
      responseId: text(extra.responseId, 180),
      packageId: text(extra.packageId, 180),
      baseRevision: decision.baseRevision,
      currentRevision: text(extra.currentRevision, 120),
      responseClass: text(extra.responseClass, 80),
      attempts,
      evidenceRefs: strings(decision.evidenceRefs),
      targetRefs: strings(decision.targetRefs),
      rationale: text(extra.rationale, 600),
      validationResult: "blocked",
      canonChanged: false,
      affectedRefs: [],
      staleProjectionRefs: [],
      recordedAt: iso(extra.recordedAt),
    },
  };
}

function normalizeCandidate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Autonomous Story Decision evaluation must return a structured candidate.");
  }
  const responseClass = text(input.responseClass, 80);
  if (!RESPONSE_CLASSES.has(responseClass)) throw new Error("Autonomous Story Decision response class is invalid.");
  const candidate = {
    responseClass,
    confidence: confidence(input.confidence),
    selectedProposalId: text(input.selectedProposalId, 180),
    selectedAlternativeId: text(input.selectedAlternativeId, 180),
    replacementContent: text(input.replacementContent, 6_000),
    rationale: text(input.rationale, 2_000),
  };
  if (!candidate.rationale) throw new Error("Autonomous Story Decision evaluation requires a concise audit rationale.");
  if (responseClass === "select-alternative" && !candidate.selectedAlternativeId) {
    throw new Error("Autonomous alternative selection requires selectedAlternativeId.");
  }
  if (["modify-proposal", "freeform-decision"].includes(responseClass) && !candidate.replacementContent) {
    throw new Error(`${responseClass} requires replacement content.`);
  }
  return candidate;
}

function deterministicCandidate(decision, evidence) {
  if (evidence.missingPrerequisite === true || decision.decisionClass === "blocked-prerequisite") {
    return {
      responseClass: "defer",
      confidence: 1,
      rationale: "A required dependency is unavailable, so the Decision remains blocked.",
    };
  }
  if (evidence.clearNonMaterialRepair === true && decision.proposedChange) {
    return {
      responseClass: "accept-proposal",
      confidence: 1,
      rationale: "The bounded proposal is supported by the recorded evidence and policy permits this repair.",
    };
  }
  return null;
}

function validatePorts(ports) {
  for (const name of ["evaluateDecision", "respondThroughDecisionGateway", "prepareStoryWorkbench", "applyStoryWorkbench"]) {
    if (typeof ports?.[name] !== "function") throw new Error(`Autonomous Story Decision operator requires the ${name} port.`);
  }
}

export async function operateAutonomousStoryDecision(input, ports) {
  validatePorts(ports);
  const decision = normalizeStoryDecisionRecord(input?.decision);
  const currentRevision = text(input?.currentRevision, 120);
  const authority = authorizeStoryDecisionAuthority(input?.authority, input?.autonomousPolicy, decision.projectId);
  const evidence = input?.evidence && typeof input.evidence === "object" && !Array.isArray(input.evidence) ? input.evidence : {};
  const recordedAt = iso(input?.recordedAt);
  const maxEvaluationAttempts = boundedInteger(input?.autonomousPolicy?.maxEvaluationAttempts, 2);
  const minimumConfidence = Math.max(0.5, Math.min(1, Number(input?.autonomousPolicy?.minimumConfidence) || 0.75));

  if (!currentRevision || currentRevision !== decision.baseRevision) {
    return blocker(decision, authority, "stale-revision", "Story state changed before autonomous evaluation.", 0, { currentRevision, recordedAt });
  }
  if (evidence.securityFailure === true || evidence.integrityFailure === true) {
    return blocker(decision, authority, "integrity-failure", "Security or integrity evidence requires fail-closed handling.", 0, { currentRevision, recordedAt });
  }

  let candidate = deterministicCandidate(decision, evidence);
  let attempts = 0;
  let lastLowConfidence = null;
  while (!candidate && attempts < maxEvaluationAttempts) {
    attempts += 1;
    const evaluated = normalizeCandidate(await ports.evaluateDecision({
      decision,
      evidenceRefs: strings(decision.evidenceRefs),
      targetRefs: strings(decision.targetRefs),
      curriculumRefs: strings(decision.curriculumRefs, 64, 360),
      attempt: attempts,
      maxAttempts: maxEvaluationAttempts,
      minimumConfidence,
    }));
    if (evaluated.confidence >= minimumConfidence) candidate = evaluated;
    else lastLowConfidence = evaluated;
  }

  if (!candidate) {
    candidate = {
      responseClass: "request-alternatives",
      confidence: lastLowConfidence?.confidence ?? 0,
      rationale: "Bounded evaluation ended below the configured confidence threshold; another supported alternative is required.",
    };
  }
  candidate = normalizeCandidate(candidate);

  const gatewayResult = await ports.respondThroughDecisionGateway({
    decisionId: decision.decisionId,
    response: {
      ...candidate,
      currentRevision,
      authority,
      autonomousPolicy: input.autonomousPolicy,
    },
  });
  if (!gatewayResult || gatewayResult.writesCanon !== false || gatewayResult.response?.writesCanon !== false) {
    throw new Error("Autonomous Story Decision gateway violated the non-canon response boundary.");
  }

  if (!WORKBENCH_RESPONSE_CLASSES.has(candidate.responseClass)) {
    return blocker(decision, authority, candidate.responseClass === "defer" ? "missing-prerequisite" : "evaluation-incomplete",
      candidate.rationale, attempts, {
        currentRevision,
        responseClass: candidate.responseClass,
        rationale: candidate.rationale,
        responseId: gatewayResult.response?.responseId,
        recordedAt,
      });
  }

  const prepared = await ports.prepareStoryWorkbench({
    decision: gatewayResult.decision,
    response: gatewayResult.response,
    currentRevision,
  });
  if (!prepared?.package || prepared.package.decisionId !== decision.decisionId || String(prepared.package.baseRevision) !== currentRevision) {
    throw new Error("Autonomous Story Workbench preparation returned mismatched Decision or revision identity.");
  }
  if (!prepared.review?.canComplete) {
    return blocker(decision, authority, "workbench-findings", "Story Workbench reported blocking validation findings.", attempts, {
      currentRevision,
      responseClass: candidate.responseClass,
      rationale: candidate.rationale,
      responseId: gatewayResult.response?.responseId,
      packageId: prepared?.package?.packageId,
      recordedAt,
    });
  }

  const applied = await ports.applyStoryWorkbench({ prepared, expectedRevision: currentRevision });
  const canonChanged = applied?.applied === true;
  const resultingRevision = text(applied?.revision ?? currentRevision, 120);
  if (canonChanged && resultingRevision === currentRevision) {
    throw new Error("Autonomous Story Workbench reported a canon change without a resulting revision.");
  }
  return {
    status: canonChanged ? "applied" : "completed-no-change",
    decision: gatewayResult.decision,
    response: gatewayResult.response,
    workbench: { packageId: prepared.package.packageId, applied: canonChanged },
    receipt: {
      autonomousRunId: authority.autonomousRunId,
      authorityClass: authority.authorityClass,
      operatorId: authority.operatorId,
      modelRole: authority.modelRole,
      modelId: authority.modelId,
      provider: authority.provider,
      runtime: authority.runtime,
      decisionId: decision.decisionId,
      sourceWorkItemId: decision.origin.workItemId,
      sourceCouncilResultId: decision.origin.councilResultId,
      responseId: text(gatewayResult.response?.responseId, 180),
      packageId: text(prepared.package.packageId, 180),
      baseRevision: decision.baseRevision,
      currentRevision,
      resultingRevision,
      responseClass: candidate.responseClass,
      attempts,
      evidenceRefs: strings(decision.evidenceRefs),
      targetRefs: strings(decision.targetRefs),
      rationale: candidate.rationale,
      validationResult: "passed",
      canonChanged,
      affectedRefs: strings(applied?.changedRefs),
      staleProjectionRefs: strings(prepared?.impact?.staleProjectionRefs),
      recordedAt,
    },
  };
}
