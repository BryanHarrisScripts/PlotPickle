import { reduceStoryCouncilContributions } from "../../../core/story-workflow/story-council/core.mjs";

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

export function createAfterglowAutonomousCouncilResult(input) {
  const projectId = String(input?.projectId || "").trim();
  const revision = String(input?.revision || "").trim();
  if (!projectId || !revision) throw new Error("Afterglow autonomous Council requires the live working-copy project and revision.");
  const workItemId = `story-work:afterglow-block-17:${revision}`;
  const recordedAt = input?.recordedAt || new Date().toISOString();
  const context = { projectId, revision, workItemId, recordedAt };
  const contributions = [
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
      agreementRefs: [`${workItemId}:tamsin-hearthquill`],
    }),
    contribution(context, {
      agentId: "critics-circle",
      confidence: 0.82,
      explanation: "The existing ambiguity is credible, so preserving it remains a bounded alternative rather than an automatic rejection.",
      proposal: "Keep Ren's protective motive implicit in the Block 17 confrontation.",
      alternatives: ["Keep the current story unchanged."],
      disagreementRefs: [
        `${workItemId}:tamsin-hearthquill`,
        `${workItemId}:mira-threadmere`,
      ],
    }),
  ];
  const result = reduceStoryCouncilContributions(contributions)[0];
  if (!result?.requiresHuman) throw new Error("Afterglow autonomous Council did not produce a reviewable Story Decision.");
  return {
    projectId,
    councilResult: result,
    councilResultId: `council-result:${workItemId}:${revision}`,
    question: "Should Block 17 make Ren's protective motive more visibly causal?",
    whyHuman: "The bounded Foundations and continuity positions agree on a clarification, while the independent critique preserves the current ambiguity as a credible alternative.",
    proposedChange: PROPOSAL,
    alternatives: ["Keep the current story unchanged."],
    problemSignature: `afterglow-block-17-protective-motive:${revision}`,
    choiceFamily: "clarify-protective-motive|keep-current",
    priority: 90,
    severity: "medium",
  };
}
