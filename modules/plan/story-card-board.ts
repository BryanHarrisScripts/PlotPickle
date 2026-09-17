import type {
  StoryBlockV2,
  StoryMiniBlockV2,
  StoryStructureV2,
} from "../../core/project/story-structure-v2";

export const STORY_CARD_MINI_LABELS = ["Promise", "Progress", "Pressure", "Payoff"] as const;

export type StoryCardBlockPatch = {
  readonly title?: string;
  readonly note?: string;
};

export type StoryCardMiniPatch = {
  readonly title?: string;
  readonly note?: string;
};

export type StoryCardSourcePassage = {
  readonly text: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly sceneNumber: number;
};

export type StoryCardSourceCoverage = {
  readonly passageCount: number;
  readonly sceneCount: number;
  readonly wordCount: number;
  readonly sourceSharePercent: number;
  readonly miniBlocksWithEvidence: number;
  readonly miniPassageCounts: readonly [number, number, number, number];
};

export function storyCardSourceCoverage(
  passages: readonly StoryCardSourcePassage[],
  blockNumber: number,
): StoryCardSourceCoverage {
  const blockPassages = passages.filter((passage) => passage.blockNumber === blockNumber);
  const miniPassageCounts = [1, 2, 3, 4].map(
    (ordinal) => blockPassages.filter((passage) => passage.miniBlockNumber === ordinal).length,
  ) as [number, number, number, number];
  const wordCount = blockPassages.reduce((total, passage) => {
    const words = passage.text.trim().split(/\s+/).filter(Boolean).length;
    return total + words;
  }, 0);
  const scenes = new Set(blockPassages.map((passage) => passage.sceneNumber).filter((scene) => scene > 0));
  return {
    passageCount: blockPassages.length,
    sceneCount: scenes.size,
    wordCount,
    sourceSharePercent: passages.length ? Math.round((blockPassages.length / passages.length) * 1000) / 10 : 0,
    miniBlocksWithEvidence: miniPassageCounts.filter((count) => count > 0).length,
    miniPassageCounts,
  };
}

type PlanningPayload = {
  readonly title: string;
  readonly note: string;
  readonly miniBlocks: readonly {
    readonly title: string;
    readonly note: string;
  }[];
};

function validBlockNumber(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 24;
}

function clean(value: string | undefined, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : undefined;
}

function defaultBlockTitle(number: number) {
  return `Block ${String(number).padStart(2, "0")}`;
}

function defaultMiniTitle(number: number) {
  return `Mini-Block ${String(number).padStart(2, "0")}`;
}

function authoredBlockTitle(block: StoryBlockV2) {
  return block.title === defaultBlockTitle(block.number) ? "" : block.title;
}

function authoredMiniTitle(mini: StoryMiniBlockV2) {
  return mini.title === defaultMiniTitle(mini.number) ? "" : mini.title;
}

function payloadFor(block: StoryBlockV2): PlanningPayload {
  return {
    title: authoredBlockTitle(block),
    note: block.note,
    miniBlocks: block.miniBlocks.map((mini) => ({
      title: authoredMiniTitle(mini),
      note: mini.note,
    })),
  };
}

function applyPayload(block: StoryBlockV2, payload: PlanningPayload): StoryBlockV2 {
  return {
    ...block,
    title: payload.title || defaultBlockTitle(block.number),
    note: payload.note,
    miniBlocks: block.miniBlocks.map((mini, index) => {
      const source = payload.miniBlocks[index];
      return {
        ...mini,
        title: source?.title || defaultMiniTitle(mini.number),
        note: source?.note ?? "",
      };
    }),
  };
}

function replaceBlock(structure: StoryStructureV2, blockNumber: number, nextBlock: StoryBlockV2) {
  return {
    ...structure,
    blocks: structure.blocks.map((block) => block.number === blockNumber ? nextBlock : block),
  };
}

export function storyCardIsLocked(structure: StoryStructureV2, blockNumber: number) {
  const block = structure.blocks.find((candidate) => candidate.number === blockNumber);
  return Boolean(block?.planningLockedAt);
}

export function storyCardAffectedRefs(blockNumbers: readonly number[]) {
  return [...new Set(blockNumbers)]
    .filter(validBlockNumber)
    .sort((left, right) => left - right)
    .map((number) => `ppf:structure:block-${number}`);
}

export function updateStoryCard(
  structure: StoryStructureV2,
  blockNumber: number,
  patch: StoryCardBlockPatch,
) {
  const block = structure.blocks.find((candidate) => candidate.number === blockNumber);
  if (!block || block.planningLockedAt) return structure;
  const title = clean(patch.title, 160);
  const note = clean(patch.note, 1200);
  const nextBlock: StoryBlockV2 = {
    ...block,
    title: title === undefined ? block.title : title || defaultBlockTitle(block.number),
    note: note === undefined ? block.note : note,
  };
  if (nextBlock.title === block.title && nextBlock.note === block.note) return structure;
  return replaceBlock(structure, blockNumber, nextBlock);
}

export function updateStoryCardMini(
  structure: StoryStructureV2,
  blockNumber: number,
  ordinal: number,
  patch: StoryCardMiniPatch,
) {
  const block = structure.blocks.find((candidate) => candidate.number === blockNumber);
  if (!block || block.planningLockedAt || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4) return structure;
  const mini = block.miniBlocks.find((candidate) => candidate.ordinal === ordinal);
  if (!mini) return structure;
  const title = clean(patch.title, 160);
  const note = clean(patch.note, 800);
  const nextMini: StoryMiniBlockV2 = {
    ...mini,
    title: title === undefined ? mini.title : title || defaultMiniTitle(mini.number),
    note: note === undefined ? mini.note : note,
  };
  if (nextMini.title === mini.title && nextMini.note === mini.note) return structure;
  return replaceBlock(structure, blockNumber, {
    ...block,
    miniBlocks: block.miniBlocks.map((candidate) => candidate.ordinal === ordinal ? nextMini : candidate),
  });
}

export function setStoryCardPlanningLock(
  structure: StoryStructureV2,
  blockNumber: number,
  locked: boolean,
  occurredAt: string,
) {
  const block = structure.blocks.find((candidate) => candidate.number === blockNumber);
  if (!block) return structure;
  const planningLockedAt = locked ? occurredAt : null;
  if (block.planningLockedAt === planningLockedAt || (!locked && !block.planningLockedAt)) return structure;
  return replaceBlock(structure, blockNumber, { ...block, planningLockedAt });
}

export function moveStoryCardContent(
  structure: StoryStructureV2,
  sourceBlockNumber: number,
  targetBlockNumber: number,
) {
  if (!validBlockNumber(sourceBlockNumber) || !validBlockNumber(targetBlockNumber) || sourceBlockNumber === targetBlockNumber) {
    return structure;
  }

  const first = Math.min(sourceBlockNumber, targetBlockNumber);
  const last = Math.max(sourceBlockNumber, targetBlockNumber);
  const affected = structure.blocks.filter((block) => block.number >= first && block.number <= last);
  if (affected.some((block) => Boolean(block.planningLockedAt))) return structure;

  const payloads = structure.blocks.map(payloadFor);
  const [moving] = payloads.splice(sourceBlockNumber - 1, 1);
  if (!moving) return structure;
  payloads.splice(targetBlockNumber - 1, 0, moving);

  return {
    ...structure,
    blocks: structure.blocks.map((block, index) => applyPayload(block, payloads[index])),
  };
}

export function storyCardActRows(structure: StoryStructureV2) {
  return [1, 2, 3, 4].map((actNumber) => ({
    actNumber,
    blocks: structure.blocks.filter((block) => block.actNumber === actNumber),
  }));
}
