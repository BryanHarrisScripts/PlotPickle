const TARGET_REF = "ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2";
const EVIDENCE_REFS = Object.freeze([
  "character:ren",
  "character:isobel",
  "afterglow-v9-block-17",
]);
const REQUIRED_SPECIALISTS = Object.freeze([
  { agentId: "tamsin-hearthquill", frontier: "Foundations", roomPurpose: "foundations" },
  { agentId: "mira-threadmere", frontier: "Character", roomPurpose: "continuity" },
  { agentId: "critics-circle", frontier: "Foundations", roomPurpose: "independent-critique" },
]);

function clean(value, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function unique(values, maximum = 128) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value, 360)).filter(Boolean))].slice(0, maximum);
}

function approximateTokens(content) {
  return Math.ceil(clean(content, 20_000).length / 4);
}

function safeRunToken(value) {
  return clean(value, 80).replace(/[^a-zA-Z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "") || "run";
}

function contextPacket({ agentId, workItemId, revision, generatedAt }) {
  const taskReference = [
    "Review one bounded Afterglow story question as advisory evidence only.",
    `Canonical target reference: ${TARGET_REF}.`,
    `Relevant evidence references: ${EVIDENCE_REFS.join(", ")}.`,
    "Question: Should the Block 17 confrontation make Ren's protective motive more visibly causal without changing the ending?",
    "Do not invent canon. Return one reviewable proposal or a reason to preserve the current ambiguity.",
  ].join(" ");
  const item = {
    id: `task-reference:afterglow-block-17:${revision}`,
    sourceType: "task-reference",
    sourceId: "afterglow-v9-block-17-review",
    content: taskReference,
    trust: "approved",
    authority: 55,
    allowedUse: "reference",
    revision,
    observedAt: generatedAt,
    required: true,
    clipped: false,
    approximateTokens: approximateTokens(taskReference),
  };
  return {
    version: 1,
    taskId: workItemId,
    goal: "Review the bounded Block 17 motivation question without changing PlotPickle canon.",
    profileId: agentId,
    expectedOutputSchema: "StoryWorkflowResult v1",
    items: [item],
    receipt: {
      version: 1,
      taskId: workItemId,
      profileId: agentId,
      generatedAt,
      budgetCharacters: 12_000,
      usedCharacters: item.content.length,
      approximateTokens: item.approximateTokens,
      includedCount: 1,
      droppedCount: 0,
      sourceCounts: { "task-reference": 1 },
      sources: [{
        id: item.id,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        trust: item.trust,
        authority: item.authority,
        allowedUse: item.allowedUse,
        revision: item.revision,
        clipped: false,
        approximateTokens: item.approximateTokens,
      }],
    },
  };
}

export function createAfterglowBuzzCouncilPlan(input) {
  const projectId = clean(input?.projectId, 240);
  const revision = clean(input?.revision, 120);
  const generatedAt = clean(input?.generatedAt, 80) || new Date().toISOString();
  if (!projectId || !revision) throw new Error("Afterglow BUZZ Council requires the live project ID and exact PPF revision.");
  const workItemId = `story-work:afterglow-block-17:${revision}`;
  const project = {
    id: projectId,
    title: "Afterglow: Reflections of Sentience",
    revision,
  };
  const runToken = safeRunToken(`${projectId}:${revision}:${generatedAt}`);
  const entries = REQUIRED_SPECIALISTS.map((specialist, index) => {
    const packet = contextPacket({ agentId: specialist.agentId, workItemId, revision, generatedAt });
    const runId = `buzz-council:${runToken}:${index + 1}:${specialist.agentId}`.slice(0, 160);
    const workItem = {
      workItemId,
      projectId,
      baseRevision: revision,
      curriculumRequirementId: "foundations:foundations-essentials-essential-aspects-2-md:output-2",
      frontier: specialist.frontier,
      targetRefs: [TARGET_REF],
      status: "running",
      reason: "Independent bounded review of the Block 17 protective-motive question.",
      evidenceRefs: [...EVIDENCE_REFS],
      assignedAgentId: specialist.agentId,
      runId,
      proposalIds: [],
      dependencyRefs: [...EVIDENCE_REFS],
      severity: "medium",
      priority: "high",
      kind: specialist.agentId === "critics-circle" ? "audit" : "requirement",
    };
    return {
      agentId: specialist.agentId,
      roomPurpose: specialist.roomPurpose,
      project,
      workItem,
      contextPacket: packet,
      responsibilityRunCreate: {
        action: "create",
        kind: "creative-proposal",
        runId,
        goal: packet.goal,
        profileId: specialist.agentId,
        skillUris: [],
        allowedScopes: [],
        allowedConnectorIds: [],
        context: {
          taskId: workItemId,
          sourceIds: packet.receipt.sources.map((source) => source.id),
          receiptGeneratedAt: packet.receipt.generatedAt,
        },
        limits: {
          maxAttempts: 1,
          timeoutMs: 120_000,
          maxContextCharacters: 12_000,
          maxTokens: 6_000,
          maxToolCalls: 6,
          maxCloudCostUsd: 0,
          maxParallelChildren: 0,
        },
      },
    };
  });
  return {
    version: 1,
    project,
    workItemId,
    targetRefs: [TARGET_REF],
    evidenceRefs: [...EVIDENCE_REFS],
    requiredAgentIds: REQUIRED_SPECIALISTS.map((item) => item.agentId),
    entries,
  };
}

export function storyBridgeContributionToCouncilPosition(contribution) {
  if (!contribution?.accepted || contribution?.state !== "accepted" || contribution?.provenance?.signatureVerified !== true || !contribution?.result) {
    return null;
  }
  const result = contribution.result;
  return {
    contributionId: clean(contribution.contributionId, 180),
    workItemId: clean(contribution.workItemId, 180),
    runId: clean(contribution.runId, 180),
    agentId: clean(contribution.agentProfileId, 180),
    baseRevision: clean(contribution.baseRevision, 120),
    kind: clean(result.kind, 80),
    targetRefs: unique(result.targetRefs),
    evidenceRefs: unique(result.evidenceRefs),
    curriculumRequirementId: clean(result.curriculumRequirementId, 360),
    principleRef: clean(result.principleRef, 360),
    severity: clean(result.severity, 40),
    confidence: Number(result.confidence || 0),
    changesCanon: result.changesCanon === true,
    explanation: clean(result.explanation, 2_000),
    proposal: clean(result.proposal, 2_000),
    alternatives: unique(result.alternatives, 24),
    affectedDownstreamRefs: unique(result.affectedDownstreamRefs),
    agreementRefs: [],
    disagreementRefs: [],
    provenance: {
      transport: "buzz",
      roomClass: "private-story-room",
      buzzActorId: clean(contribution.agentActorId, 180),
      buzzActorPublicKey: clean(contribution.provenance.pubkey, 128),
      buzzEventId: clean(contribution.provenance.eventId, 180),
      buzzSignatureVerified: true,
      recordedAt: clean(contribution.recordedAt, 80) || new Date().toISOString(),
    },
  };
}

export function createAfterglowBuzzCouncilProof(contributions, requiredAgentIds = REQUIRED_SPECIALISTS.map((item) => item.agentId)) {
  const required = unique(requiredAgentIds, 16);
  const accepted = (Array.isArray(contributions) ? contributions : [])
    .filter((item) => item?.accepted && item?.state === "accepted" && item?.provenance?.signatureVerified === true && item?.result)
    .filter((item) => required.includes(clean(item.agentProfileId, 180)));
  const byAgent = new Map();
  for (const item of accepted) {
    const agentId = clean(item.agentProfileId, 180);
    if (!byAgent.has(agentId)) byAgent.set(agentId, item);
  }
  const missingAgentIds = required.filter((agentId) => !byAgent.has(agentId));
  const proof = [...byAgent.values()].map((item) => ({
    contributionId: clean(item.contributionId, 180),
    requestId: clean(item.requestId, 180),
    workItemId: clean(item.workItemId, 180),
    runId: clean(item.runId, 180),
    baseRevision: clean(item.baseRevision, 120),
    agentProfileId: clean(item.agentProfileId, 180),
    agentActorId: clean(item.agentActorId, 180),
    eventId: clean(item.provenance?.eventId, 180),
    signatureVerified: item.provenance?.signatureVerified === true,
    transport: clean(item.provenance?.transport, 40),
    accepted: true,
  }));
  return {
    requiredCount: required.length,
    genuineContributionCount: proof.length,
    liveSatisfied: missingAgentIds.length === 0 && proof.length >= 3,
    missingAgentIds,
    contributions: proof,
  };
}

export const AFTERGLOW_BUZZ_COUNCIL_SPECIALISTS = Object.freeze(REQUIRED_SPECIALISTS.map((item) => item.agentId));
