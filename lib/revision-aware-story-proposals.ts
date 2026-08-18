import type { PlotPickleProject } from "./project";
import {
  applyRevisionAwareProposal,
  createCreativeProposal,
  type CreativeGenerationProvenance,
  type CreativeProposalRecord,
  type CreativeProposalOrigin,
} from "./ppf-revision-guard";
import {
  applyStoryProposalGroups,
  type StoryProposalGroupId,
} from "./story-proposals";

export function createRevisionAwareStoryProposal(input: {
  readonly id: string;
  readonly approvedProject: PlotPickleProject;
  readonly targetIds: readonly string[];
  readonly proposingProfileId: string;
  readonly skillUri?: string;
  readonly runId: string;
  readonly generation?: CreativeGenerationProvenance;
  readonly contextSourceIds?: readonly string[];
  readonly origin?: CreativeProposalOrigin;
}) {
  return createCreativeProposal({
    id: input.id,
    kind: "story",
    project: input.approvedProject,
    targetIds: input.targetIds,
    proposingProfileId: input.proposingProfileId,
    skillUri: input.skillUri,
    runId: input.runId,
    generation: input.generation,
    contextSourceIds: input.contextSourceIds,
    origin: input.origin,
  });
}

export function applyRevisionAwareStoryProposal(input: {
  readonly approvedProject: PlotPickleProject;
  readonly proposedProject: PlotPickleProject;
  readonly proposal: CreativeProposalRecord;
  readonly selectedGroups: readonly StoryProposalGroupId[];
  readonly writerApproved: boolean;
}) {
  if (!input.writerApproved) throw new Error("Story proposal acceptance requires an explicit writer decision.");
  return applyRevisionAwareProposal({
    project: input.approvedProject,
    proposal: input.proposal,
    approvedBy: "writer",
    mutate: (project) => applyStoryProposalGroups(project, input.proposedProject, [...input.selectedGroups]),
  });
}
