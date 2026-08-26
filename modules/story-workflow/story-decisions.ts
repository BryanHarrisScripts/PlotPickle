import {
  createStoryDecisionFromCouncilResult,
  markStoryDecisionStale,
  mergeStoryDecisionRecords,
  normalizeStoryDecisionRecord,
  rankStoryDecisions,
  storyDecisionAttentionCount,
  withdrawStoryDecision,
  type StoryDecisionRecord,
} from "../../core/story-workflow/story-decisions/core.mjs";

export type StoryDecisionCouncilInput = {
  readonly councilResult: Readonly<Record<string, unknown>>;
  readonly councilResultId?: string;
  readonly question?: string;
  readonly whyHuman?: string;
  readonly proposedChange?: string;
  readonly alternatives?: readonly string[];
  readonly visualContext?: Readonly<Record<string, unknown>> | null;
  readonly transcriptRef?: string;
  readonly blockedByHuman?: boolean;
  readonly priority?: number;
  readonly severity?: "low" | "medium" | "high";
  readonly problemSignature?: string;
  readonly choiceFamily?: string;
};

export function createStoryDecisionsFromCouncilResults(input: {
  readonly projectId: string;
  readonly councilResults: readonly StoryDecisionCouncilInput[];
  readonly existing?: readonly StoryDecisionRecord[];
  readonly now?: string;
}): readonly StoryDecisionRecord[] {
  const records = new Map<string, StoryDecisionRecord>();
  for (const record of input.existing || []) records.set(record.decisionId, normalizeStoryDecisionRecord(record));

  for (const source of input.councilResults) {
    const candidate = createStoryDecisionFromCouncilResult({
      projectId: input.projectId,
      ...source,
      now: input.now,
    });
    if (!candidate) continue;

    const previous = [...records.values()].find((record) => record.projectId === candidate.projectId && record.problemKey === candidate.problemKey && ["new", "reviewing", "deferred"].includes(record.status));
    if (!previous) {
      records.set(candidate.decisionId, candidate);
      continue;
    }

    const result = mergeStoryDecisionRecords(previous, candidate, { now: input.now });
    records.set(result.existing.decisionId, result.existing);
    if (result.incoming) records.set(result.incoming.decisionId, result.incoming);
  }

  return rankStoryDecisions([...records.values()]);
}

export function reconcileStoryDecisionsForRevision(input: {
  readonly decisions: readonly StoryDecisionRecord[];
  readonly currentRevision: string;
  readonly activeProblemKeys?: readonly string[];
  readonly now?: string;
}): readonly StoryDecisionRecord[] {
  const active = new Set(input.activeProblemKeys || []);
  return rankStoryDecisions(input.decisions.map((record) => {
    const decision = normalizeStoryDecisionRecord(record);
    if (["answered", "superseded", "withdrawn"].includes(decision.status)) return decision;
    if (active.size && !active.has(decision.problemKey)) return withdrawStoryDecision(decision, input.currentRevision, input.now);
    return markStoryDecisionStale(decision, input.currentRevision, input.now);
  }));
}

export function storyDecisionChannelSummary(decisions: readonly StoryDecisionRecord[]) {
  const ranked = rankStoryDecisions(decisions);
  const attentionCount = storyDecisionAttentionCount(ranked);
  return {
    attentionCount,
    label: attentionCount === 1 ? "1 Story Decision needs you" : `${attentionCount} Story Decisions need you`,
    decisions: ranked,
  } as const;
}
