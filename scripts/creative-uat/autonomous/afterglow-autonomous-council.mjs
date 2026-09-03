import { reduceStoryCouncilContributions } from "../../../core/story-workflow/story-council/core.mjs";
import {
  createAfterglowBuzzCouncilProof,
  storyBridgeContributionToCouncilPosition,
} from "./afterglow-buzz-council.mjs";

const TARGET_REF = "ppf:foundations:foundations-essentials-essential-aspects-2-md:output-2";
const EVIDENCE_REFS = Object.freeze([
  "character:ren",
  "character:isobel",
  "afterglow-v9-block-17",
]);
const PROPOSAL = "Ren protects control because grief makes connection feel dangerous, until Isobel makes withdrawal cost more than honesty.";

function contribution(input, overrides) {
  return {
    contributionId: `${input.workItemId}:${overrides.agentId}`,
    workItemId: input.workItemId,
    runId: `autonomous-council:${input.projectId}:${input.revision}:${overrides.agentId}`,
    agentId: overrides.agentId,
    baseRevision: input.revision,
    kind: "proposal",
    targetRefs: [TARGET_REF],
    evidenceRefs: EVIDENCE_REFS,
    curriculumRequirementId: "foundations:foundations-essentials-essential-aspects-2-md:output-2",
    principleRef: "curriculum:foundations:character-motivation",
    severity: "medium",
    confidence: overrides.confidence,
    changesCanon: true,
    explanation: overrides.explanation,
    proposal: overrides.proposal,
    alternatives: overrides.alternatives || [],
    affectedDownstreamRefs: ["screenplay:afterglow-v9-block-17"],
    agreementRefs: overrides.agreementRefs || [],
    disagreementRefs: overrides.disagreementRefs || [],
    provenance: {
      transport: "local-runtime",
      roomClass: "local-only",
      recordedAt: input.recordedAt,
    },
  };
}

function localPositions(context) {
  return [
    contribution(context, {
      agentId: "tamsin-hearthquill",
      confidence: 0.91,
      explanation: "The source-backed Block 17 confrontation can make Ren's protective motive more visibly causal without changing the ending.",
      proposal: PROPOSAL,
    }),
    contribution(context, {
      agentId: "mira-threadmere",
      confidence: 0.88,
      explanation: "Continuity evidence supports the same bounded motive clarification at the existing Foundations target.",
      proposal: PROPOSAL,
      agreementRefs: [`${context.workItemId}:tamsin-hearthquill`],
    }),
    contribution(context, {
      agentId: "critics-circle",
      confidence: 0.82,
      explanation: "The existing ambiguity is credible, so preserving it remains a bounded alternative rather than an automatic rejection.",
      proposal: "Keep Ren's protective motive implicit in the Block 17 confrontation.",
      alternatives: ["Keep the current story unchanged."],
      disagreementRefs: [
        `${context.workItemId}:tamsin-hearthquill`,
        `${context.workItemId}:mira-threadmere`,
      ],
    }),
  ];
}

function buzzPositions(input) {
  const proof = createAfterglowBuzzCouncilProof(input?.buzzContributions);
  if (!proof.liveSatisfied) return { proof, positions: [] };
  const positions = input.buzzContributions
    .map(storyBridgeContributionToCouncilPosition)
    .filter(Boolean);
  return { proof, positions };
}

function preferredProposal(result) {
  return [...(result?.positions || [])]
    .filter((position) => position.proposal)
    .sort((left, right) => Number(right.confidence || 0) - Number(left.confidence || 0))[0]?.proposal || PROPOSAL;
}

function alternativesFor(result, proposedChange) {
  const values = [];
  for (const position of result?.positions || []) {
    for (const value of [position.proposal, ...(position.alternatives || [])]) {
      const text = String(value || "").trim();
      if (text && text !== proposedChange && !values.includes(text)) values.push(text);
    }
  }
  return values.length ? values.slice(0, 6) : ["Keep the current story unchanged."];
}

export function createAfterglowAutonomousCouncilResult(input) {
  const projectId = String(input?.projectId || "").trim();
  const revision = String(input?.revision || "").trim();
  if (!projectId || !revision) throw new Error("Afterglow autonomous Council requires the live working-copy project and revision.");
  const workItemId = `story-work:afterglow-block-17:${revision}`;
  const recordedAt = input?.recordedAt || new Date().toISOString();
  const context = { projectId, revision, workItemId, recordedAt };
  const live = buzzPositions(input);
  const positions = live.proof.liveSatisfied ? live.positions : localPositions(context);
  const result = reduceStoryCouncilContributions(positions)[0];
  if (!result?.requiresHuman) throw new Error("Afterglow autonomous Council did not produce a reviewable Story Decision.");
  const proposedChange = preferredProposal(result);
  const mode = live.proof.liveSatisfied ? "buzz-signed" : "degraded-local";
  const contributionProofs = live.proof.contributions.map((item) => ({
    ...item,
    affectedDecision: live.proof.liveSatisfied && result.contributionIds.includes(item.contributionId),
  }));
  return {
    projectId,
    councilResult: result,
    councilResultId: `council-result:${workItemId}:${revision}:${mode}`,
    question: "Should Block 17 make Ren's protective motive more visibly causal?",
    whyHuman: live.proof.liveSatisfied
      ? "Three independently signed BUZZ specialist positions were verified as revision-current untrusted evidence; the resulting creative proposal still requires the existing Story Decision and Workbench authority path."
      : "BUZZ was unavailable for the live reference, so the bounded local Council path preserved the same Story Decision authority without claiming signed BUZZ proof.",
    proposedChange,
    alternatives: alternativesFor(result, proposedChange),
    problemSignature: live.proof.liveSatisfied
      ? `afterglow-block-17-protective-motive:buzz-signed:${revision}`
      : `afterglow-block-17-protective-motive:${revision}`,
    choiceFamily: "clarify-protective-motive|keep-current",
    priority: 90,
    severity: "medium",
    councilEvidence: {
      mode,
      genuineContributionCount: live.proof.genuineContributionCount,
      requiredContributionCount: live.proof.requiredCount,
      liveSatisfied: live.proof.liveSatisfied,
      missingAgentIds: live.proof.missingAgentIds,
      contributions: contributionProofs,
    },
  };
}
