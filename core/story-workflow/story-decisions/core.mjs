export const STORY_DECISION_VERSION = 1;

export const STORY_DECISION_STATUSES = Object.freeze([
  "new",
  "reviewing",
  "deferred",
  "answered",
  "superseded",
  "stale",
  "withdrawn",
]);

export const STORY_DECISION_RESPONSE_CLASSES = Object.freeze([
  "accept-proposal",
  "select-alternative",
  "modify-proposal",
  "reject-proposal",
  "keep-current",
  "request-alternatives",
  "defer",
  "freeform-decision",
]);

const ELIGIBLE_DECISION_CLASSES = new Set([
  "bounded-proposal",
  "alternative-choice",
  "unresolved-conflict",
]);
const STATUS_SET = new Set(STORY_DECISION_STATUSES);
const RESPONSE_SET = new Set(STORY_DECISION_RESPONSE_CLASSES);
const SEVERITY_WEIGHT = Object.freeze({ low: 1, medium: 2, high: 3 });

function decisionString(value, maximum = 1_000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function decisionStrings(value, maximum = 128, itemMaximum = 320) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => decisionString(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

function decisionIso(value, fallback = new Date().toISOString()) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function hashText(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function severityOf(positions) {
  return (Array.isArray(positions) ? positions : []).reduce((strongest, position) => {
    const next = ["low", "medium", "high"].includes(position?.severity) ? position.severity : "low";
    return SEVERITY_WEIGHT[next] > SEVERITY_WEIGHT[strongest] ? next : strongest;
  }, "low");
}

function unionPositionRefs(positions, field) {
  return decisionStrings((Array.isArray(positions) ? positions : []).flatMap((position) => position?.[field] || []));
}

function unionCurriculumRefs(positions) {
  return decisionStrings((Array.isArray(positions) ? positions : []).flatMap((position) => position?.curriculumRefs || []));
}

function collectAlternatives(positions, explicit) {
  return decisionStrings([
    ...(Array.isArray(explicit) ? explicit : []),
    ...(Array.isArray(positions) ? positions : []).flatMap((position) => position?.alternatives || []),
  ], 12, 1_200);
}

function firstProposal(positions, explicit) {
  const requested = decisionString(explicit, 4_000);
  if (requested) return requested;
  return decisionString((Array.isArray(positions) ? positions : []).map((position) => position?.proposal).find(Boolean), 4_000);
}

function problemSignature(input) {
  const result = input.councilResult || {};
  const positions = Array.isArray(result.positions) ? result.positions : [];
  const refs = decisionStrings(result.targetRefs?.length ? result.targetRefs : unionPositionRefs(positions, "targetRefs"), 64, 240).sort();
  const curriculum = decisionStrings(result.curriculumRefs?.length ? result.curriculumRefs : unionCurriculumRefs(positions), 64, 320).sort();
  return decisionString(input.problemSignature, 600) || [result.decisionClass, refs.join("|"), curriculum.join("|"), decisionString(input.question, 600)].join("::");
}

export function storyDecisionEligible(councilResult, input = {}) {
  if (!councilResult || typeof councilResult !== "object") return false;
  if (councilResult.requiresHuman !== true) return false;
  if (ELIGIBLE_DECISION_CLASSES.has(councilResult.decisionClass)) return true;
  return councilResult.decisionClass === "blocked-prerequisite" && input.blockedByHuman === true;
}

export function createStoryDecisionFromCouncilResult(input) {
  const projectId = decisionString(input?.projectId, 180);
  const councilResult = input?.councilResult;
  if (!projectId) throw new Error("Story Decision requires projectId.");
  if (!councilResult || typeof councilResult !== "object") throw new Error("Story Decision requires a structured Story Council result.");
  if (!storyDecisionEligible(councilResult, input)) return null;

  const positions = Array.isArray(councilResult.positions) ? councilResult.positions : [];
  const baseRevision = decisionString(councilResult.baseRevision, 120);
  const workItemId = decisionString(councilResult.workItemId, 180);
  if (!baseRevision || !workItemId) throw new Error("Story Decision requires Council workItemId and baseRevision.");

  const targetRefs = decisionStrings(councilResult.targetRefs?.length ? councilResult.targetRefs : unionPositionRefs(positions, "targetRefs"));
  const evidenceRefs = decisionStrings(councilResult.evidenceRefs?.length ? councilResult.evidenceRefs : unionPositionRefs(positions, "evidenceRefs"));
  const curriculumRefs = decisionStrings(councilResult.curriculumRefs?.length ? councilResult.curriculumRefs : unionCurriculumRefs(positions));
  const affectedDownstreamRefs = decisionStrings(councilResult.affectedDownstreamRefs?.length ? councilResult.affectedDownstreamRefs : unionPositionRefs(positions, "affectedDownstreamRefs"));
  const alternatives = collectAlternatives(positions, input.alternatives);
  const proposedChange = firstProposal(positions, input.proposedChange);
  const signature = problemSignature({ ...input, councilResult: { ...councilResult, targetRefs, curriculumRefs } });
  const problemKey = `story-problem-${hashText(`${projectId}|${signature}`)}`;
  const choiceFamily = decisionString(input.choiceFamily, 360) || [proposedChange, ...alternatives].join("|").slice(0, 2_000);
  const groupKey = `story-decision-group-${hashText(`${problemKey}|${baseRevision}|${choiceFamily}`)}`;
  const decisionId = `story-decision-${hashText(`${projectId}|${groupKey}`)}`;
  const createdAt = decisionIso(input.now);
  const severity = ["low", "medium", "high"].includes(input.severity) ? input.severity : severityOf(positions);
  const decisionClass = decisionString(councilResult.decisionClass, 80);
  const priority = Number.isFinite(Number(input.priority))
    ? Math.max(0, Math.min(100, Math.floor(Number(input.priority))))
    : decisionClass === "unresolved-conflict" ? 90 : severity === "high" ? 80 : decisionClass === "alternative-choice" ? 70 : 60;
  const question = decisionString(input.question, 1_200) ||
    (decisionClass === "alternative-choice" ? "Which story direction should PlotPickle carry forward?" :
      decisionClass === "unresolved-conflict" ? "How should PlotPickle resolve this story conflict?" :
        "Do you want PlotPickle to carry this proposed story change forward for validation?");
  const whyHuman = decisionString(input.whyHuman, 1_600) ||
    (decisionClass === "unresolved-conflict" ? "Credible specialist positions still disagree and evidence cannot responsibly choose for you." :
      decisionClass === "alternative-choice" ? "More than one credible creative interpretation remains." :
        "The proposed change affects creative canon and requires writer/editor approval before Workbench validation.");

  return normalizeStoryDecisionRecord({
    schemaVersion: STORY_DECISION_VERSION,
    decisionId,
    problemKey,
    groupKey,
    projectId,
    baseRevision,
    origin: {
      workItemId,
      runIds: decisionStrings(positions.map((position) => position.runId), 32, 180),
      councilResultId: decisionString(input.councilResultId, 180) || `council-result:${workItemId}:${baseRevision}`,
      contributionIds: decisionStrings(councilResult.contributionIds, 64, 180),
    },
    decisionClass,
    severity,
    priority,
    targetRefs,
    curriculumRefs,
    evidenceRefs,
    question,
    whyHuman,
    proposedChange,
    alternatives,
    predictedImpactRefs: affectedDownstreamRefs,
    visualContext: input.visualContext ?? null,
    status: "new",
    createdAt,
    updatedAt: createdAt,
    resolvedAt: "",
    response: null,
    provenance: {
      source: "story-council",
      councilSummary: decisionString(councilResult.summary, 2_000),
      humanGate: decisionString(councilResult.humanGate, 80),
      transcriptRef: decisionString(input.transcriptRef, 360),
    },
    integrity: {
      writesCanon: false,
      requiresWorkbenchValidation: true,
      revisionAware: true,
    },
    history: [{ at: createdAt, event: "created", revision: baseRevision }],
  });
}

export function normalizeStoryDecisionRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Story Decision record must be an object.");
  const decisionId = decisionString(input.decisionId, 180);
  const projectId = decisionString(input.projectId, 180);
  const baseRevision = decisionString(input.baseRevision, 120);
  if (!/^story-decision-[a-z0-9]{7,20}$/i.test(decisionId) || !projectId || !baseRevision) throw new Error("Story Decision identity is invalid.");
  const status = STATUS_SET.has(input.status) ? input.status : "new";
  const createdAt = decisionIso(input.createdAt);
  const updatedAt = decisionIso(input.updatedAt, createdAt);
  const resolvedAt = input.resolvedAt ? decisionIso(input.resolvedAt, "") : "";
  return {
    schemaVersion: STORY_DECISION_VERSION,
    decisionId,
    problemKey: decisionString(input.problemKey, 180),
    groupKey: decisionString(input.groupKey, 180),
    projectId,
    baseRevision,
    origin: {
      workItemId: decisionString(input.origin?.workItemId, 180),
      runIds: decisionStrings(input.origin?.runIds, 32, 180),
      councilResultId: decisionString(input.origin?.councilResultId, 180),
      contributionIds: decisionStrings(input.origin?.contributionIds, 64, 180),
    },
    decisionClass: decisionString(input.decisionClass, 80),
    severity: ["low", "medium", "high"].includes(input.severity) ? input.severity : "medium",
    priority: Math.max(0, Math.min(100, Math.floor(Number(input.priority) || 0))),
    targetRefs: decisionStrings(input.targetRefs),
    curriculumRefs: decisionStrings(input.curriculumRefs, 64, 320),
    evidenceRefs: decisionStrings(input.evidenceRefs),
    question: decisionString(input.question, 1_200),
    whyHuman: decisionString(input.whyHuman, 1_600),
    proposedChange: decisionString(input.proposedChange, 4_000),
    alternatives: decisionStrings(input.alternatives, 12, 1_200),
    predictedImpactRefs: decisionStrings(input.predictedImpactRefs),
    visualContext: input.visualContext && typeof input.visualContext === "object" && !Array.isArray(input.visualContext) ? input.visualContext : null,
    status,
    createdAt,
    updatedAt,
    resolvedAt,
    response: input.response && typeof input.response === "object" && !Array.isArray(input.response) ? input.response : null,
    provenance: {
      source: decisionString(input.provenance?.source, 80) || "story-council",
      councilSummary: decisionString(input.provenance?.councilSummary, 2_000),
      humanGate: decisionString(input.provenance?.humanGate, 80),
      transcriptRef: decisionString(input.provenance?.transcriptRef, 360),
    },
    integrity: {
      writesCanon: false,
      requiresWorkbenchValidation: true,
      revisionAware: true,
    },
    history: (Array.isArray(input.history) ? input.history : []).slice(-100).map((item) => ({
      at: decisionIso(item?.at),
      event: decisionString(item?.event, 80),
      revision: decisionString(item?.revision, 120),
    })),
  };
}

export function supersedeStoryDecision(input, replacementDecisionId, now) {
  const decision = normalizeStoryDecisionRecord(input);
  const replacement = decisionString(replacementDecisionId, 180);
  const updatedAt = decisionIso(now);
  return normalizeStoryDecisionRecord({
    ...decision,
    status: "superseded",
    updatedAt,
    resolvedAt: updatedAt,
    history: [...decision.history, {
      at: updatedAt,
      event: replacement ? `superseded:${replacement}` : "superseded",
      revision: decision.baseRevision,
    }],
  });
}

export function mergeStoryDecisionRecords(existingInput, incomingInput, input = {}) {
  const existing = normalizeStoryDecisionRecord(existingInput);
  const incoming = normalizeStoryDecisionRecord(incomingInput);
  if (existing.projectId !== incoming.projectId || existing.problemKey !== incoming.problemKey) return { existing, incoming, merged: false };
  if (existing.baseRevision !== incoming.baseRevision) {
    const stale = markStoryDecisionStale(existing, incoming.baseRevision, input.now);
    return { existing: stale, incoming, merged: false };
  }
  if (existing.groupKey !== incoming.groupKey) {
    return { existing: supersedeStoryDecision(existing, incoming.decisionId, input.now), incoming, merged: false };
  }
  const updatedAt = decisionIso(input.now);
  return {
    existing: normalizeStoryDecisionRecord({
      ...existing,
      severity: SEVERITY_WEIGHT[incoming.severity] > SEVERITY_WEIGHT[existing.severity] ? incoming.severity : existing.severity,
      priority: Math.max(existing.priority, incoming.priority),
      targetRefs: [...existing.targetRefs, ...incoming.targetRefs],
      curriculumRefs: [...existing.curriculumRefs, ...incoming.curriculumRefs],
      evidenceRefs: [...existing.evidenceRefs, ...incoming.evidenceRefs],
      alternatives: [...existing.alternatives, ...incoming.alternatives],
      predictedImpactRefs: [...existing.predictedImpactRefs, ...incoming.predictedImpactRefs],
      proposedChange: incoming.proposedChange || existing.proposedChange,
      whyHuman: incoming.whyHuman || existing.whyHuman,
      visualContext: incoming.visualContext || existing.visualContext,
      updatedAt,
      history: [...existing.history, { at: updatedAt, event: "refreshed", revision: existing.baseRevision }],
    }),
    incoming: null,
    merged: true,
  };
}

export function markStoryDecisionStale(input, currentRevision, now) {
  const decision = normalizeStoryDecisionRecord(input);
  const revision = decisionString(currentRevision, 120);
  if (!revision || revision === decision.baseRevision) return decision;
  const updatedAt = decisionIso(now);
  return normalizeStoryDecisionRecord({
    ...decision,
    status: "stale",
    updatedAt,
    history: [...decision.history, { at: updatedAt, event: "story-changed", revision }],
  });
}

export function withdrawStoryDecision(input, currentRevision, now) {
  const decision = normalizeStoryDecisionRecord(input);
  const updatedAt = decisionIso(now);
  return normalizeStoryDecisionRecord({
    ...decision,
    status: "withdrawn",
    updatedAt,
    resolvedAt: updatedAt,
    history: [...decision.history, { at: updatedAt, event: "withdrawn", revision: decisionString(currentRevision, 120) || decision.baseRevision }],
  });
}

export function createStoryDecisionResponse(input, responseInput) {
  const decision = normalizeStoryDecisionRecord(input);
  const responseClass = decisionString(responseInput?.responseClass, 80);
  if (!RESPONSE_SET.has(responseClass)) throw new Error("Story Decision response class is invalid.");
  const currentRevision = decisionString(responseInput?.currentRevision, 120);
  if (!currentRevision || currentRevision !== decision.baseRevision) {
    const error = new Error("Story changed since this question was created.");
    error.code = "STORY_DECISION_STALE";
    throw error;
  }
  const humanProfileId = decisionString(responseInput?.humanProfileId, 180);
  if (!humanProfileId) throw new Error("Story Decision response requires authenticated Human profile authority.");
  if (["answered", "superseded", "withdrawn", "stale"].includes(decision.status)) throw new Error(`Story Decision cannot be answered from status ${decision.status}.`);
  const selectedAlternativeId = decisionString(responseInput?.selectedAlternativeId, 180);
  const replacementContent = decisionString(responseInput?.replacementContent, 6_000);
  if (responseClass === "select-alternative" && !selectedAlternativeId) throw new Error("Selecting an alternative requires selectedAlternativeId.");
  if (["modify-proposal", "freeform-decision"].includes(responseClass) && !replacementContent) throw new Error(`${responseClass} requires writer-entered replacement content.`);
  const respondedAt = decisionIso(responseInput?.respondedAt);
  const status = responseClass === "defer" ? "deferred" : responseClass === "request-alternatives" ? "reviewing" : "answered";
  const response = {
    responseId: `story-response-${hashText(`${decision.decisionId}|${respondedAt}|${humanProfileId}|${responseClass}`)}`,
    decisionId: decision.decisionId,
    responseClass,
    humanProfileId,
    humanAuthority: "authenticated-human",
    baseRevision: decision.baseRevision,
    currentRevision,
    selectedProposalId: decisionString(responseInput?.selectedProposalId, 180),
    selectedAlternativeId,
    replacementContent,
    rationale: decisionString(responseInput?.rationale, 2_000),
    respondedAt,
    requiresWorkbenchValidation: true,
    writesCanon: false,
  };
  return {
    decision: normalizeStoryDecisionRecord({
      ...decision,
      status,
      updatedAt: respondedAt,
      resolvedAt: status === "answered" ? respondedAt : "",
      response,
      history: [...decision.history, { at: respondedAt, event: responseClass, revision: currentRevision }],
    }),
    response,
  };
}

export function rankStoryDecisions(input) {
  return (Array.isArray(input) ? input : []).map(normalizeStoryDecisionRecord).sort((left, right) => {
    const actionable = (status) => ["new", "reviewing", "deferred"].includes(status) ? 1 : 0;
    if (actionable(right.status) !== actionable(left.status)) return actionable(right.status) - actionable(left.status);
    if (right.priority !== left.priority) return right.priority - left.priority;
    return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  });
}

export function storyDecisionAttentionCount(input) {
  return rankStoryDecisions(input).filter((decision) => ["new", "reviewing", "deferred"].includes(decision.status)).length;
}
