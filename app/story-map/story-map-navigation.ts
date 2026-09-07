import type { StoryMiniBlockV2, StoryStructureV2, StoryWorkflowStage } from "@/core/project/story-structure-v2";

export function nextStoryStage(mini: StoryMiniBlockV2): StoryWorkflowStage {
  if (mini.stages.plan.state !== "accepted") return "plan";
  if (mini.stages.build.state !== "accepted") return "build";
  return "storyboard";
}

/** Navigation changes location only; acceptance remains owned by the story workflow. */
export function selectStoryMapLocation(structure: StoryStructureV2, blockNumber: number, miniNumber?: number): StoryStructureV2 | null {
  const block = structure.blocks.find((candidate) => candidate.number === blockNumber);
  if (!block) return null;
  const requestedMini = miniNumber ?? (blockNumber === structure.activeBlockNumber
    ? structure.activeMiniBlockNumber
    : block.miniBlocks.find((mini) => mini.stages.storyboard.state !== "accepted")?.number ?? block.miniBlocks[0].number);
  const mini = block.miniBlocks.find((candidate) => candidate.number === requestedMini);
  if (!mini || mini.stages.plan.state === "locked") return null;
  const resume = blockNumber === structure.activeBlockNumber && mini.number === structure.activeMiniBlockNumber;
  const stage = resume && mini.stages[structure.activeStage].state !== "locked" ? structure.activeStage : nextStoryStage(mini);
  return { ...structure, activeBlockNumber: blockNumber, activeMiniBlockNumber: mini.number, activeStage: stage };
}

export function storyStageHref(structure: StoryStructureV2) {
  const ordinal = ((structure.activeMiniBlockNumber - 1) % 4) + 1;
  const query = `block=${structure.activeBlockNumber}&mini=${ordinal}`;
  return structure.activeStage === "storyboard" ? `/storyboard?${query}` : `/?workspace=${structure.activeStage}&${query}`;
}
