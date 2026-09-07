export const STORY_STRUCTURE_V2_VERSION = 1 as const;
export const STORY_BLOCK_COUNT = 24 as const;
export const MINI_BLOCKS_PER_BLOCK = 4 as const;
export const STORY_MINI_BLOCK_COUNT = STORY_BLOCK_COUNT * MINI_BLOCKS_PER_BLOCK;
export const STORY_ACT_COUNT = 4 as const;

export const STORY_WORKFLOW_STATES = ["locked", "available", "incomplete", "ready", "accepted"] as const;
export const STORY_WORKFLOW_STAGES = ["plan", "build", "storyboard"] as const;

export type StoryWorkflowState = (typeof STORY_WORKFLOW_STATES)[number];
export type StoryWorkflowStage = (typeof STORY_WORKFLOW_STAGES)[number];
export type StoryActNumber = 1 | 2 | 3 | 4;

export type StoryStageState = {
  readonly state: StoryWorkflowState;
  readonly content: string;
  readonly updatedAt: string | null;
  readonly acceptedAt: string | null;
};

export type StoryMiniBlockV2 = {
  readonly id: string;
  readonly number: number;
  readonly blockNumber: number;
  readonly ordinal: number;
  readonly title: string;
  readonly stages: Readonly<Record<StoryWorkflowStage, StoryStageState>>;
};

export type StoryBlockV2 = {
  readonly id: string;
  readonly number: number;
  readonly actNumber: StoryActNumber;
  readonly sequenceNumber: number;
  readonly title: string;
  readonly miniBlocks: readonly StoryMiniBlockV2[];
};

export type StoryStructureV2 = {
  readonly version: typeof STORY_STRUCTURE_V2_VERSION;
  readonly activeBlockNumber: number;
  readonly activeMiniBlockNumber: number;
  readonly activeStage: StoryWorkflowStage;
  readonly blocks: readonly StoryBlockV2[];
};

function blockAct(number: number): StoryActNumber {
  if (number <= 6) return 1;
  if (number <= 12) return 2;
  if (number <= 18) return 3;
  return 4;
}

function blockSequence(number: number) {
  return Math.ceil(number / 2);
}

function blockId(number: number) {
  return `block-${String(number).padStart(2, "0")}`;
}

function miniId(number: number) {
  return `mini-${String(number).padStart(2, "0")}`;
}

function createStage(state: StoryWorkflowState): StoryStageState {
  return { state, content: "", updatedAt: null, acceptedAt: null };
}

function createMiniBlock(blockNumber: number, ordinal: number, blockUnlocked: boolean): StoryMiniBlockV2 {
  const number = ((blockNumber - 1) * MINI_BLOCKS_PER_BLOCK) + ordinal;
  return {
    id: miniId(number),
    number,
    blockNumber,
    ordinal,
    title: `Mini-Block ${String(number).padStart(2, "0")}`,
    stages: {
      plan: createStage(blockUnlocked ? "available" : "locked"),
      build: createStage("locked"),
      storyboard: createStage("locked"),
    },
  };
}

function createBlock(number: number, unlocked: boolean): StoryBlockV2 {
  return {
    id: blockId(number),
    number,
    actNumber: blockAct(number),
    sequenceNumber: blockSequence(number),
    title: `Block ${String(number).padStart(2, "0")}`,
    miniBlocks: Array.from(
      { length: MINI_BLOCKS_PER_BLOCK },
      (_, index) => createMiniBlock(number, index + 1, unlocked),
    ),
  };
}

export function createEmptyStoryStructureV2(): StoryStructureV2 {
  return {
    version: STORY_STRUCTURE_V2_VERSION,
    activeBlockNumber: 1,
    activeMiniBlockNumber: 1,
    activeStage: "plan",
    blocks: Array.from(
      { length: STORY_BLOCK_COUNT },
      (_, index) => createBlock(index + 1, index === 0),
    ),
  };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function text(value: unknown, max = 100_000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function timestamp(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function requestedState(value: unknown): StoryWorkflowState | null {
  return STORY_WORKFLOW_STATES.includes(value as StoryWorkflowState)
    ? value as StoryWorkflowState
    : null;
}

function normalizeStage(value: unknown, unlocked: boolean): StoryStageState {
  const source = record(value);
  const content = text(source.content);
  const updatedAt = timestamp(source.updatedAt);
  const acceptedAt = timestamp(source.acceptedAt);
  const requested = requestedState(source.state);

  if (!unlocked) return { state: "locked", content, updatedAt, acceptedAt };
  if (acceptedAt && content.trim()) return { state: "accepted", content, updatedAt, acceptedAt };
  if (requested === "ready" && content.trim()) return { state: "ready", content, updatedAt, acceptedAt: null };
  if (content.trim()) return { state: "incomplete", content, updatedAt, acceptedAt: null };
  return { state: "available", content: "", updatedAt, acceptedAt: null };
}

function sourceMini(source: Readonly<Record<string, unknown>>, number: number) {
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  const blockNumber = Math.ceil(number / MINI_BLOCKS_PER_BLOCK);
  const blockSource = record(blocks[blockNumber - 1]);
  const minis = Array.isArray(blockSource.miniBlocks) ? blockSource.miniBlocks : [];
  return record(minis[(number - 1) % MINI_BLOCKS_PER_BLOCK]);
}

function normalizeMiniBlock(
  source: Readonly<Record<string, unknown>>,
  blockNumber: number,
  ordinal: number,
  blockUnlocked: boolean,
): StoryMiniBlockV2 {
  const number = ((blockNumber - 1) * MINI_BLOCKS_PER_BLOCK) + ordinal;
  const miniSource = sourceMini(source, number);
  const stages = record(miniSource.stages);
  const plan = normalizeStage(stages.plan, blockUnlocked);
  const build = normalizeStage(stages.build, blockUnlocked && plan.state === "accepted");
  const storyboard = normalizeStage(stages.storyboard, blockUnlocked && build.state === "accepted");

  return {
    id: miniId(number),
    number,
    blockNumber,
    ordinal,
    title: text(miniSource.title, 160).trim() || `Mini-Block ${String(number).padStart(2, "0")}`,
    stages: { plan, build, storyboard },
  };
}

export function storyMiniBlockState(mini: StoryMiniBlockV2): StoryWorkflowState {
  if (mini.stages.storyboard.state === "accepted") return "accepted";
  if (mini.stages.storyboard.state === "ready") return "ready";
  if (STORY_WORKFLOW_STAGES.some((stage) => ["incomplete", "ready", "accepted"].includes(mini.stages[stage].state))) return "incomplete";
  return mini.stages.plan.state === "locked" ? "locked" : "available";
}

export function storyBlockState(block: StoryBlockV2): StoryWorkflowState {
  const states = block.miniBlocks.map(storyMiniBlockState);
  if (states.every((state) => state === "locked")) return "locked";
  if (states.every((state) => state === "accepted")) return "accepted";
  if (states.every((state) => state === "accepted" || state === "ready") && states.some((state) => state === "ready")) return "ready";
  if (states.some((state) => state === "incomplete" || state === "ready" || state === "accepted")) return "incomplete";
  return "available";
}

function normalizeBlocks(source: Readonly<Record<string, unknown>>) {
  const blocks: StoryBlockV2[] = [];
  let unlocked = true;
  for (let blockNumber = 1; blockNumber <= STORY_BLOCK_COUNT; blockNumber += 1) {
    const blockSource = record((Array.isArray(source.blocks) ? source.blocks : [])[blockNumber - 1]);
    const block: StoryBlockV2 = {
      id: blockId(blockNumber),
      number: blockNumber,
      actNumber: blockAct(blockNumber),
      sequenceNumber: blockSequence(blockNumber),
      title: text(blockSource.title, 160).trim() || `Block ${String(blockNumber).padStart(2, "0")}`,
      miniBlocks: Array.from(
        { length: MINI_BLOCKS_PER_BLOCK },
        (_, index) => normalizeMiniBlock(source, blockNumber, index + 1, unlocked),
      ),
    };
    blocks.push(block);
    unlocked = storyBlockState(block) === "accepted";
  }
  return blocks;
}

function validBlockNumber(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= STORY_BLOCK_COUNT
    ? value
    : 1;
}

function validMiniNumber(value: unknown, blockNumber: number) {
  const first = ((blockNumber - 1) * MINI_BLOCKS_PER_BLOCK) + 1;
  const last = first + MINI_BLOCKS_PER_BLOCK - 1;
  return typeof value === "number" && Number.isInteger(value) && value >= first && value <= last
    ? value
    : first;
}

function validStage(value: unknown): StoryWorkflowStage {
  return STORY_WORKFLOW_STAGES.includes(value as StoryWorkflowStage)
    ? value as StoryWorkflowStage
    : "plan";
}

export function normalizeStoryStructureV2(value: unknown): StoryStructureV2 {
  const source = record(value);
  const blocks = normalizeBlocks(source);
  const requestedBlock = validBlockNumber(source.activeBlockNumber);
  const activeBlockNumber = storyBlockState(blocks[requestedBlock - 1]) === "locked" ? 1 : requestedBlock;
  const activeMiniBlockNumber = validMiniNumber(source.activeMiniBlockNumber, activeBlockNumber);
  const activeStage = validStage(source.activeStage);
  const activeMini = blocks[activeBlockNumber - 1].miniBlocks[(activeMiniBlockNumber - 1) % MINI_BLOCKS_PER_BLOCK];
  const resolvedStage = activeMini.stages[activeStage].state === "locked"
    ? STORY_WORKFLOW_STAGES.find((stage) => activeMini.stages[stage].state !== "locked") ?? "plan"
    : activeStage;

  return {
    version: STORY_STRUCTURE_V2_VERSION,
    activeBlockNumber,
    activeMiniBlockNumber,
    activeStage: resolvedStage,
    blocks,
  };
}

export function findStoryBlock(structure: StoryStructureV2, blockNumber: number) {
  return structure.blocks.find((block) => block.number === blockNumber) ?? null;
}

export function findStoryMiniBlock(structure: StoryStructureV2, miniBlockNumber: number) {
  for (const block of structure.blocks) {
    const mini = block.miniBlocks.find((candidate) => candidate.number === miniBlockNumber);
    if (mini) return mini;
  }
  return null;
}
