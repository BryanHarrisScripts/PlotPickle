import type {
  ExperienceCapabilityDecision,
  ExperienceIntent,
  ExperienceIntentResult,
} from "../../core/contracts/experience";
import type { StoryMapStage } from "../../core/storage/story-map-context";

export type StoryWorkspaceEvidenceState = "defined" | "observed" | "emerging" | "missing" | "locked";

export type StoryWorkspaceMiniBlockSource = Readonly<{
  id: string;
  number: number;
  label: string;
  state: StoryWorkspaceEvidenceState;
}>;

export type StoryWorkspaceBlockSource = Readonly<{
  id: string;
  number: number;
  act: number;
  sequenceNumber: number;
  sequenceTitle: string;
  sequencePurpose: string;
  state: StoryWorkspaceEvidenceState;
  acceptedMiniBlockCount: number;
  mappingNote: string;
  miniBlocks: readonly StoryWorkspaceMiniBlockSource[];
}>;

export type StoryWorkspaceSource = Readonly<{
  projectId: string;
  projectTitle: string;
  revision: number;
  remembered: Readonly<{
    blockNumber: number;
    miniBlockNumber: number;
    stage: StoryMapStage;
  }> | null;
  blocks: readonly StoryWorkspaceBlockSource[];
}>;

export type StoryWorkspaceBlockView = Readonly<{
  id: string;
  number: number;
  act: number;
  sequenceNumber: number;
  title: string;
  state: StoryWorkspaceEvidenceState;
  acceptedMiniBlockCount: number;
  miniBlocks: readonly Readonly<{
    id: string;
    number: number;
    label: string;
    state: StoryWorkspaceEvidenceState;
  }>[];
}>;

export type StoryWorkspaceViewModel = Readonly<{
  surface: "STORY_WORKSPACE";
  projectId: string;
  projectTitle: string;
  revision: number;
  selectedBlockNumber: number;
  selectedMiniBlockNumber: number;
  selectedBlock: StoryWorkspaceBlockView;
  selectedMiniBlock: StoryWorkspaceBlockView["miniBlocks"][number];
  blocks: readonly StoryWorkspaceBlockView[];
  capabilities: readonly ExperienceCapabilityDecision[];
}>;

export interface StoryWorkspaceGateway {
  read(): Promise<StoryWorkspaceSource>;
  persistSelection(input: Readonly<{
    projectId: string;
    blockNumber: number;
    miniBlockNumber: number;
    stage: "map";
  }>): Promise<void>;
}

function boundedInteger(value: number, minimum: number, maximum: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.trunc(value))) : fallback;
}

function blockView(block: StoryWorkspaceBlockSource): StoryWorkspaceBlockView {
  return {
    id: block.id,
    number: block.number,
    act: block.act,
    sequenceNumber: block.sequenceNumber,
    title: block.sequenceTitle,
    state: block.state,
    acceptedMiniBlockCount: block.acceptedMiniBlockCount,
    miniBlocks: block.miniBlocks.map((mini) => ({
      id: mini.id,
      number: mini.number,
      label: mini.label,
      state: mini.state,
    })),
  };
}

export function projectStoryWorkspaceViewModel(
  source: StoryWorkspaceSource,
  selection: Readonly<{ blockNumber: number; miniBlockNumber: number }> | null = null,
): StoryWorkspaceViewModel {
  if (!source.blocks.length) throw new Error("STORY_WORKSPACE_REQUIRES_24_BLOCK_PROJECTION");
  const requestedBlock = boundedInteger(
    selection?.blockNumber ?? source.remembered?.blockNumber ?? 1,
    1,
    source.blocks.length,
    1,
  );
  const blocks = source.blocks.map(blockView);
  const selectedBlock = blocks.find((block) => block.number === requestedBlock) ?? blocks[0];
  const requestedMini = boundedInteger(
    selection?.miniBlockNumber ?? source.remembered?.miniBlockNumber ?? 1,
    1,
    selectedBlock.miniBlocks.length,
    1,
  );
  const selectedMiniBlock = selectedBlock.miniBlocks.find((mini) => mini.number === requestedMini)
    ?? selectedBlock.miniBlocks[0];
  if (!selectedMiniBlock) throw new Error("STORY_WORKSPACE_REQUIRES_MINI_BLOCK_PROJECTION");

  const authoringAllowed = selectedBlock.state !== "locked" && selectedMiniBlock.state !== "locked";
  return {
    surface: "STORY_WORKSPACE",
    projectId: source.projectId,
    projectTitle: source.projectTitle,
    revision: source.revision,
    selectedBlockNumber: selectedBlock.number,
    selectedMiniBlockNumber: selectedMiniBlock.number,
    selectedBlock,
    selectedMiniBlock,
    blocks,
    capabilities: [
      { capability: "SELECT_BLOCK", allowed: true, reason: null },
      { capability: "SELECT_MINI_BLOCK", allowed: true, reason: null },
      {
        capability: "AUTHOR_SELECTED_MINI_BLOCK",
        allowed: authoringAllowed,
        reason: authoringAllowed ? null : "STORY_POSITION_LOCKED",
      },
    ],
  };
}

export async function readStoryWorkspaceViewModel(gateway: StoryWorkspaceGateway) {
  return projectStoryWorkspaceViewModel(await gateway.read());
}

function result(
  intentId: string,
  outcome: ExperienceIntentResult["outcome"],
  revision: number,
  reason: string | null,
): ExperienceIntentResult {
  return { intentId, outcome, revision, reason };
}

async function resolveSelection(input: Readonly<{
  intentId: string;
  baseRevision: number;
  blockNumber: number;
  miniBlockNumber: number;
  gateway: StoryWorkspaceGateway;
}>) {
  const source = await input.gateway.read();
  const view = projectStoryWorkspaceViewModel(source, {
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
  });
  await input.gateway.persistSelection({
    projectId: source.projectId,
    blockNumber: view.selectedBlockNumber,
    miniBlockNumber: view.selectedMiniBlockNumber,
    stage: "map",
  });

  const rebased = input.baseRevision !== source.revision;
  return {
    result: result(
      input.intentId,
      rebased ? "rebased" : "accepted",
      source.revision,
      rebased ? "SELECTION_REBASED_TO_CURRENT_REVISION" : null,
    ),
    view,
  } as const;
}

export async function executeSelectBlockIntent(input: Readonly<{
  intent: Extract<ExperienceIntent, { type: "SelectBlock" }>;
  gateway: StoryWorkspaceGateway;
}>) {
  const source = await input.gateway.read();
  const block = source.blocks.find((candidate) => candidate.id === input.intent.blockId);
  if (!block) {
    return {
      result: result(input.intent.intentId, "rejected", source.revision, "UNKNOWN_BLOCK"),
      view: projectStoryWorkspaceViewModel(source),
    } as const;
  }
  const current = projectStoryWorkspaceViewModel(source);
  return resolveSelection({
    intentId: input.intent.intentId,
    baseRevision: input.intent.baseRevision,
    blockNumber: block.number,
    miniBlockNumber: current.selectedMiniBlockNumber,
    gateway: input.gateway,
  });
}

export async function executeSelectMiniBlockIntent(input: Readonly<{
  intent: Extract<ExperienceIntent, { type: "SelectMiniBlock" }>;
  gateway: StoryWorkspaceGateway;
}>) {
  const source = await input.gateway.read();
  const block = source.blocks.find((candidate) => candidate.id === input.intent.blockId);
  if (!block) {
    return {
      result: result(input.intent.intentId, "rejected", source.revision, "UNKNOWN_BLOCK"),
      view: projectStoryWorkspaceViewModel(source),
    } as const;
  }
  const mini = block.miniBlocks.find((candidate) => candidate.number === input.intent.miniBlockNumber);
  if (!mini) {
    return {
      result: result(input.intent.intentId, "rejected", source.revision, "UNKNOWN_MINI_BLOCK"),
      view: projectStoryWorkspaceViewModel(source),
    } as const;
  }
  return resolveSelection({
    intentId: input.intent.intentId,
    baseRevision: input.intent.baseRevision,
    blockNumber: block.number,
    miniBlockNumber: mini.number,
    gateway: input.gateway,
  });
}
