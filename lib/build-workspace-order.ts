import type { PlotPickleProject, StoryBlock } from "./project";

function sortedBlocks(blocks: StoryBlock[]) {
  return [...blocks].sort((left, right) => left.number - right.number);
}

function remapNumber(value: number, mapping: Map<number, number>) {
  return mapping.get(value) ?? value;
}

function remapNullableNumber(value: number | null, mapping: Map<number, number>) {
  return value === null ? null : remapNumber(value, mapping);
}

export function canonicalBuildOrder(project: PlotPickleProject) {
  return sortedBlocks(project.blocks).map((block) => block.id);
}

export function applyCanonicalBuildOrder(
  project: PlotPickleProject,
  orderedBlockIds: string[],
): PlotPickleProject {
  const current = sortedBlocks(project.blocks);
  const currentIds = current.map((block) => block.id);
  if (orderedBlockIds.length !== currentIds.length) return project;
  if (new Set(orderedBlockIds).size !== currentIds.length) return project;
  if (currentIds.some((id) => !orderedBlockIds.includes(id))) return project;
  if (currentIds.every((id, index) => id === orderedBlockIds[index])) return project;

  const blocksById = new Map(current.map((block) => [block.id, block]));
  const reordered = orderedBlockIds.map((id) => blocksById.get(id)).filter((block): block is StoryBlock => Boolean(block));
  if (reordered.length !== current.length) return project;

  const numberMapping = new Map<number, number>();
  reordered.forEach((block, index) => numberMapping.set(block.number, index + 1));
  const now = new Date().toISOString();
  const blocks = reordered.map((block, index) => ({
    ...block,
    number: index + 1,
    act: Math.floor(index / 6) + 1,
    sequenceNumber: Math.floor(index / 2) + 1,
  }));
  const blockNumberById = new Map(blocks.map((block) => [block.id, block.number]));

  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    blocks,
    screenplay: {
      ...project.screenplay,
      draftElements: project.screenplay.draftElements.map((element) => {
        const blockNumber = remapNumber(element.blockNumber, numberMapping);
        return blockNumber === element.blockNumber ? element : { ...element, blockNumber, updatedAt: now };
      }),
    },
    characters: project.characters.map((character) => ({
      ...character,
      arcMatrix: {
        ...character.arcMatrix,
        checkpoints: character.arcMatrix.checkpoints.map((checkpoint) => ({
          ...checkpoint,
          blockNumber: remapNullableNumber(checkpoint.blockNumber, numberMapping),
        })),
      },
    })),
    storyThreads: project.storyThreads.map((thread) => ({
      ...thread,
      introducedBlockNumber: remapNullableNumber(thread.introducedBlockNumber, numberMapping),
      resolvedBlockNumber: remapNullableNumber(thread.resolvedBlockNumber, numberMapping),
      milestones: thread.milestones.map((milestone) => ({
        ...milestone,
        blockNumber: remapNumber(milestone.blockNumber, numberMapping),
      })),
      updatedAt: now,
    })),
    review: {
      ...project.review,
      threads: project.review.threads.map((thread) => {
        if (thread.anchor.kind !== "block") return thread;
        const blockNumber = blockNumberById.get(thread.anchor.targetId);
        if (!blockNumber) return thread;
        return {
          ...thread,
          anchor: {
            ...thread.anchor,
            label: thread.anchor.label.replace(/\bBlock\s+\d+\b/i, `Block ${blockNumber}`),
          },
          updatedAt: now,
        };
      }),
    },
    production: {
      ...project.production,
      shots: project.production.shots.map((shot) => ({
        ...shot,
        blockNumber: remapNumber(shot.blockNumber, numberMapping),
        updatedAt: now,
      })),
      cues: project.production.cues.map((cue) => ({
        ...cue,
        blockNumber: remapNumber(cue.blockNumber, numberMapping),
        updatedAt: now,
      })),
      breakdowns: project.production.breakdowns.map((breakdown) => ({
        ...breakdown,
        blockNumber: remapNumber(breakdown.blockNumber, numberMapping),
        updatedAt: now,
      })),
    },
  };
}

export function moveCanonicalBuildBlock(
  project: PlotPickleProject,
  blockId: string,
  targetNumber: number,
): PlotPickleProject {
  const order = canonicalBuildOrder(project);
  const sourceIndex = order.indexOf(blockId);
  if (sourceIndex < 0) return project;
  const targetIndex = Math.min(order.length - 1, Math.max(0, Math.round(targetNumber) - 1));
  if (sourceIndex === targetIndex) return project;
  const nextOrder = [...order];
  const [movedId] = nextOrder.splice(sourceIndex, 1);
  nextOrder.splice(targetIndex, 0, movedId);
  return applyCanonicalBuildOrder(project, nextOrder);
}
