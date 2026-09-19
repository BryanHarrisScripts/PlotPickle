export const REVIEW_STAGE_CONTRACT_VERSION = 1 as const;

export const REVIEW_STAGE_FEEDBACK_STATES = [
  "feedback-created",
  "pending-delivery",
  "delivered-to-agent",
  "acknowledged",
  "acted-on",
  "answered",
  "resolved",
] as const;

export type ReviewStageFeedbackState = (typeof REVIEW_STAGE_FEEDBACK_STATES)[number];
export type ReviewStageDomain = "developer" | "creator";
export type ReviewStageClassification =
  | "observation"
  | "inference"
  | "proposal"
  | "candidate"
  | "human-instruction"
  | "accepted-review-state";

export type ReviewStageAuthority =
  | "uat"
  | "plotpickle-project"
  | "unified-feedback"
  | "responsibility-run"
  | "creative-transaction"
  | "github";

export type ReviewStageSubjectRef = {
  authority: ReviewStageAuthority;
  kind: string;
  id: string;
  label: string;
  revision: string;
};

export type ReviewStageEvidenceRef = {
  authority: ReviewStageAuthority;
  ref: string;
  sourceRevision: string;
  capturedAt: string;
  summary: string;
};

export type ReviewStagePartKind =
  | "summary"
  | "rich-text"
  | "image"
  | "before-after"
  | "visual-diff"
  | "code"
  | "diff"
  | "terminal"
  | "structured-state"
  | "test-result"
  | "trace"
  | "story-evidence"
  | "storyboard"
  | "previs"
  | "decision"
  | "comment";

export type ReviewStagePart = {
  id: string;
  kind: ReviewStagePartKind;
  label: string;
  content: string;
  evidenceRef: string;
};

export type ReviewStageDecisionRequest = {
  id: string;
  label: string;
  options: readonly string[];
};

export type ReviewStageItem = {
  id: string;
  title: string;
  classification: ReviewStageClassification;
  subject: ReviewStageSubjectRef;
  parts: readonly ReviewStagePart[];
  evidence: readonly ReviewStageEvidenceRef[];
  decisionRequests: readonly ReviewStageDecisionRequest[];
  responsibilityRunId: string;
  targetAgentId: string;
  stale: boolean;
  canonicalMutationAllowed: false;
};

export type ReviewStageSession = {
  version: typeof REVIEW_STAGE_CONTRACT_VERSION;
  sessionId: string;
  domain: ReviewStageDomain;
  title: string;
  sourceRevision: string;
  createdAt: string;
  items: readonly ReviewStageItem[];
  projectionOnly: true;
};

export type ReviewStageFeedback = {
  version: typeof REVIEW_STAGE_CONTRACT_VERSION;
  feedbackId: string;
  sessionId: string;
  itemId: string;
  targetAgentId: string;
  actorId: string;
  decision: string;
  body: string;
  state: ReviewStageFeedbackState;
  createdAt: string;
  deliveredAt: string;
  acknowledgedAt: string;
  actedOnAt: string;
  answeredAt: string;
  resolvedAt: string;
  agentReply: string;
};

export type ReviewStageDeveloperEvent = {
  key: string;
  label: string;
  result: string;
  summary: string;
  evidenceRef?: string;
  sourceRevision?: string;
  capturedAt?: string;
};

export type ReviewStageDeveloperReview = {
  eventKey: string;
  decision: string;
  comment: string;
  updatedAt: string;
};

export type ReviewStageCreatorFeedbackRecord = {
  id: string;
  title: string;
  target: {
    kind: string;
    targetId: string;
    label: string;
    workspace: string;
  };
  author: string;
  source: string;
  body: string;
  status: string;
  proposedChange: string;
  thread: readonly {
    id: string;
    author: string;
    body: string;
    createdAt: string;
  }[];
  resolution: string;
  createdAt: string;
  updatedAt: string;
  linkedRevisionId: string;
  originId: string;
};

function cleanText(value: unknown, maximum = 1_200) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function timestamp(value: unknown, fallback = new Date().toISOString()) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function unique(values: readonly string[]) {
  return [...new Set(values.map((value) => cleanText(value, 160)).filter(Boolean))];
}

export function reviewStageEvidenceIsStale(evidenceRevision: string, currentRevision: string) {
  const evidence = cleanText(evidenceRevision, 240);
  const current = cleanText(currentRevision, 240);
  return Boolean(evidence && current && evidence !== current);
}

export function createReviewStageFeedback(input: {
  feedbackId?: string;
  sessionId: string;
  itemId: string;
  targetAgentId: string;
  actorId: string;
  decision?: string;
  body?: string;
  createdAt?: string;
}): ReviewStageFeedback {
  const sessionId = cleanText(input.sessionId, 180);
  const itemId = cleanText(input.itemId, 320);
  const targetAgentId = cleanText(input.targetAgentId, 180);
  const actorId = cleanText(input.actorId, 180);
  if (!sessionId || !itemId || !targetAgentId || !actorId) {
    throw new Error("Review Stage feedback requires session, item, target Agent and Human actor identity.");
  }
  const createdAt = timestamp(input.createdAt);
  return {
    version: REVIEW_STAGE_CONTRACT_VERSION,
    feedbackId: cleanText(input.feedbackId, 220) || `review-feedback:${stableId(`${sessionId}:${itemId}:${actorId}:${createdAt}`)}`,
    sessionId,
    itemId,
    targetAgentId,
    actorId,
    decision: cleanText(input.decision, 120),
    body: cleanText(input.body, 2_400),
    state: "feedback-created",
    createdAt,
    deliveredAt: "",
    acknowledgedAt: "",
    actedOnAt: "",
    answeredAt: "",
    resolvedAt: "",
    agentReply: "",
  };
}

export function queueReviewStageFeedback(feedback: ReviewStageFeedback): ReviewStageFeedback {
  if (feedback.state !== "feedback-created") return feedback;
  return { ...feedback, state: "pending-delivery" };
}

const DELIVERED_OR_LATER = new Set<ReviewStageFeedbackState>([
  "delivered-to-agent",
  "acknowledged",
  "acted-on",
  "answered",
  "resolved",
]);

export function deliverReviewStageFeedback(
  feedback: ReviewStageFeedback,
  agentId: string,
  deliveredAt?: string,
): ReviewStageFeedback {
  const cleanAgentId = cleanText(agentId, 180);
  if (!cleanAgentId || cleanAgentId !== feedback.targetAgentId) {
    throw new Error("Review Stage feedback may be delivered only to its exact target Agent.");
  }
  if (DELIVERED_OR_LATER.has(feedback.state)) return feedback;
  if (feedback.state !== "pending-delivery") {
    throw new Error("Review Stage feedback must be queued before delivery.");
  }
  return {
    ...feedback,
    state: "delivered-to-agent",
    deliveredAt: timestamp(deliveredAt),
  };
}

export function acknowledgeReviewStageFeedback(
  feedback: ReviewStageFeedback,
  agentId: string,
  acknowledgedAt?: string,
): ReviewStageFeedback {
  if (cleanText(agentId, 180) !== feedback.targetAgentId) {
    throw new Error("Only the target Agent may acknowledge Review Stage feedback.");
  }
  if (["acknowledged", "acted-on", "answered", "resolved"].includes(feedback.state)) return feedback;
  if (feedback.state !== "delivered-to-agent") {
    throw new Error("Review Stage feedback must be delivered before acknowledgement.");
  }
  return {
    ...feedback,
    state: "acknowledged",
    acknowledgedAt: timestamp(acknowledgedAt),
  };
}

export function markReviewStageFeedbackActedOn(
  feedback: ReviewStageFeedback,
  agentId: string,
  actedOnAt?: string,
): ReviewStageFeedback {
  if (cleanText(agentId, 180) !== feedback.targetAgentId) {
    throw new Error("Only the target Agent may act on Review Stage feedback.");
  }
  if (["acted-on", "answered", "resolved"].includes(feedback.state)) return feedback;
  if (feedback.state !== "acknowledged") {
    throw new Error("Review Stage feedback must be acknowledged before it is acted on.");
  }
  return {
    ...feedback,
    state: "acted-on",
    actedOnAt: timestamp(actedOnAt),
  };
}

export function answerReviewStageFeedback(
  feedback: ReviewStageFeedback,
  agentId: string,
  reply: string,
  answeredAt?: string,
): ReviewStageFeedback {
  if (cleanText(agentId, 180) !== feedback.targetAgentId) {
    throw new Error("Only the target Agent may answer Review Stage feedback.");
  }
  if (feedback.state === "answered" || feedback.state === "resolved") return feedback;
  if (feedback.state !== "acknowledged" && feedback.state !== "acted-on") {
    throw new Error("Review Stage feedback must be acknowledged before it is answered.");
  }
  const agentReply = cleanText(reply, 2_400);
  if (!agentReply) throw new Error("Review Stage Agent replies cannot be empty.");
  return {
    ...feedback,
    state: "answered",
    agentReply,
    answeredAt: timestamp(answeredAt),
  };
}

export function resolveReviewStageFeedback(
  feedback: ReviewStageFeedback,
  actorId: string,
  resolvedAt?: string,
): ReviewStageFeedback {
  if (!cleanText(actorId, 180)) throw new Error("Resolving Review Stage feedback requires a Human or host identity.");
  if (feedback.state === "resolved") return feedback;
  if (feedback.state !== "answered" && feedback.state !== "acted-on") {
    throw new Error("Review Stage feedback may be resolved only after the Agent acted on or answered it.");
  }
  return {
    ...feedback,
    state: "resolved",
    resolvedAt: timestamp(resolvedAt),
  };
}

export function reviewStageFeedbackInbox(feedback: readonly ReviewStageFeedback[], agentId: string) {
  const cleanAgentId = cleanText(agentId, 180);
  return feedback.filter((item) =>
    item.targetAgentId === cleanAgentId
    && item.state !== "feedback-created"
    && item.state !== "resolved");
}

function creatorClassification(record: ReviewStageCreatorFeedbackRecord): ReviewStageClassification {
  if (["accepted", "partially-accepted", "resolved"].includes(record.status)) return "accepted-review-state";
  if (record.source === "human" || record.source === "approval" || record.source === "collaboration") return "human-instruction";
  if (record.proposedChange) return "proposal";
  if (record.source === "ai") return "inference";
  return "observation";
}

export function projectCreatorReviewStage(
  records: readonly ReviewStageCreatorFeedbackRecord[],
  input: {
    sessionId: string;
    title?: string;
    projectId: string;
    currentRevision: string;
    targetAgentId?: string;
    responsibilityRunId?: string;
    createdAt?: string;
  },
): ReviewStageSession {
  const currentRevision = cleanText(input.currentRevision, 240);
  const targetAgentId = cleanText(input.targetAgentId, 180);
  const responsibilityRunId = cleanText(input.responsibilityRunId, 180);
  const items = records.map((record): ReviewStageItem => {
    const evidenceRevision = cleanText(record.linkedRevisionId, 240) || currentRevision;
    const parts: ReviewStagePart[] = [{
      id: `${record.id}:summary`,
      kind: "summary",
      label: "Review finding",
      content: cleanText(record.body, 4_000),
      evidenceRef: record.originId,
    }];
    if (record.proposedChange) parts.push({
      id: `${record.id}:proposal`,
      kind: "rich-text",
      label: "Proposed change",
      content: cleanText(record.proposedChange, 4_000),
      evidenceRef: record.originId,
    });
    record.thread.forEach((message) => parts.push({
      id: message.id,
      kind: "comment",
      label: cleanText(message.author, 160) || "Review comment",
      content: cleanText(message.body, 4_000),
      evidenceRef: record.originId,
    }));
    if (record.resolution) parts.push({
      id: `${record.id}:resolution`,
      kind: "decision",
      label: "Existing review resolution",
      content: cleanText(record.resolution, 4_000),
      evidenceRef: record.originId,
    });
    return {
      id: record.id,
      title: cleanText(record.title, 320),
      classification: creatorClassification(record),
      subject: {
        authority: "plotpickle-project",
        kind: cleanText(record.target.kind, 120),
        id: cleanText(record.target.targetId, 320),
        label: cleanText(record.target.label, 320),
        revision: evidenceRevision,
      },
      parts,
      evidence: [{
        authority: "unified-feedback",
        ref: cleanText(record.originId || record.id, 500),
        sourceRevision: evidenceRevision,
        capturedAt: timestamp(record.updatedAt || record.createdAt),
        summary: cleanText(record.body, 800),
      }],
      decisionRequests: [{
        id: `${record.id}:human-review`,
        label: "Human review",
        options: ["comment", "accept-review-finding", "reject-review-finding", "revise"],
      }],
      responsibilityRunId,
      targetAgentId,
      stale: reviewStageEvidenceIsStale(evidenceRevision, currentRevision),
      canonicalMutationAllowed: false,
    };
  });
  return {
    version: REVIEW_STAGE_CONTRACT_VERSION,
    sessionId: cleanText(input.sessionId, 180),
    domain: "creator",
    title: cleanText(input.title, 320) || "Creator Review Stage",
    sourceRevision: currentRevision,
    createdAt: timestamp(input.createdAt),
    items,
    projectionOnly: true,
  };
}

export function projectDeveloperReviewStage(input: {
  sessionId: string;
  title?: string;
  buildRef: string;
  sourceRevision?: string;
  targetAgentId?: string;
  responsibilityRunId?: string;
  events: readonly ReviewStageDeveloperEvent[];
  reviews?: readonly ReviewStageDeveloperReview[];
  createdAt?: string;
}): ReviewStageSession {
  const buildRef = cleanText(input.buildRef, 240);
  const sourceRevision = cleanText(input.sourceRevision, 240) || buildRef;
  const targetAgentId = cleanText(input.targetAgentId, 180) || "bram-gatewick";
  const responsibilityRunId = cleanText(input.responsibilityRunId, 180);
  const reviews = input.reviews ?? [];
  const items = input.events.map((event): ReviewStageItem => {
    const review = reviews.find((candidate) => candidate.eventKey === event.key);
    const eventRevision = cleanText(event.sourceRevision, 240) || sourceRevision;
    const parts: ReviewStagePart[] = [{
      id: `${event.key}:result`,
      kind: "test-result",
      label: cleanText(event.label, 240) || "Deterministic result",
      content: `${cleanText(event.result, 80)} — ${cleanText(event.summary, 2_400)}`,
      evidenceRef: cleanText(event.evidenceRef, 500),
    }];
    if (review?.comment) parts.push({
      id: `${event.key}:human-comment`,
      kind: "comment",
      label: `Human review · ${cleanText(review.decision, 120)}`,
      content: cleanText(review.comment, 2_400),
      evidenceRef: event.key,
    });
    return {
      id: cleanText(event.key, 320),
      title: cleanText(event.label, 320) || cleanText(event.key, 320),
      classification: "observation",
      subject: {
        authority: "uat",
        kind: "uat-event",
        id: cleanText(event.key, 320),
        label: cleanText(event.label, 320) || cleanText(event.key, 320),
        revision: eventRevision,
      },
      parts,
      evidence: [{
        authority: "uat",
        ref: cleanText(event.evidenceRef, 500) || cleanText(event.key, 320),
        sourceRevision: eventRevision,
        capturedAt: timestamp(event.capturedAt || review?.updatedAt || input.createdAt),
        summary: cleanText(event.summary, 800),
      }],
      decisionRequests: [{
        id: `${event.key}:human-review`,
        label: "Human review",
        options: ["acknowledge", "needs-review", "continue", "comment"],
      }],
      responsibilityRunId,
      targetAgentId,
      stale: reviewStageEvidenceIsStale(eventRevision, sourceRevision),
      canonicalMutationAllowed: false,
    };
  });
  return {
    version: REVIEW_STAGE_CONTRACT_VERSION,
    sessionId: cleanText(input.sessionId, 180),
    domain: "developer",
    title: cleanText(input.title, 320) || "Developer Review Stage",
    sourceRevision,
    createdAt: timestamp(input.createdAt),
    items,
    projectionOnly: true,
  };
}

export function reviewStageAuthoritySummary() {
  return {
    projectionOnly: true as const,
    developerEvidenceAuthority: "UAT Semantic Review / deterministic verification",
    creatorFeedbackAuthority: "Unified Feedback / project review threads",
    agentWorkAuthority: "Responsibility Runs",
    canonPromotionAuthority: "Creative Transactions / PPF approval boundary",
    duplicatedAuthority: false as const,
  };
}
