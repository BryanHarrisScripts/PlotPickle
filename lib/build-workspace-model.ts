import type { PlotPickleProject, StoryBlock } from "./project";

export type BuildWorkspaceView = "whole-film" | "act" | "sequence" | "blocks";
export type BuildBlockStatus = "empty" | "developing" | "ready" | "locked";

export type BuildWorkspaceFilter = {
  query?: string;
  acts?: number[];
  sequences?: number[];
  statuses?: BuildBlockStatus[];
  labels?: string[];
};

export type BuildBlockCard = {
  id: string;
  number: number;
  act: number;
  sequenceNumber: number;
  title: string;
  purpose: string;
  conflict: string;
  characterFocus: string[];
  emotionalMovement: string;
  setup: string;
  payoff: string;
  notes: string;
  status: BuildBlockStatus;
  labels: string[];
  sceneIds: string[];
  sceneCount: number;
  miniBlockCount: number;
};

export type BuildSequenceLane = {
  id: string;
  number: number;
  act: number;
  title: string;
  purpose: string;
  cards: BuildBlockCard[];
};

export type BuildActLane = {
  number: number;
  cards: BuildBlockCard[];
  sequences: BuildSequenceLane[];
};

export type BuildWorkspaceModel = {
  cards: BuildBlockCard[];
  visibleCards: BuildBlockCard[];
  sequences: BuildSequenceLane[];
  acts: BuildActLane[];
  totals: {
    blocks: number;
    scenes: number;
    miniBlocks: number;
  };
};

export type BuildBlockPatch = Partial<Pick<StoryBlock,
  | "title"
  | "purpose"
  | "summary"
  | "characterIds"
  | "locationIds"
  | "goal"
  | "conflict"
  | "choice"
  | "action"
  | "consequence"
  | "emotionalTurn"
  | "audienceExpectation"
  | "pickleTurn"
  | "setup"
  | "payoff"
  | "storyboardDirection"
  | "notes"
>>;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildStatus(block: StoryBlock): BuildBlockStatus {
  if (block.scenes.length > 0 && block.scenes.every((scene) => scene.locked || scene.status === "locked")) return "locked";
  const completed = [
    block.title,
    block.purpose,
    block.conflict,
    block.emotionalTurn,
    block.setup,
    block.payoff,
    block.notes,
  ].filter((value) => value.trim().length > 0).length;
  if (completed >= 6 && block.scenes.length > 0) return "ready";
  if (completed > 1 || block.scenes.length > 0) return "developing";
  return "empty";
}

function cardForBlock(
  block: StoryBlock,
  characterNames: Map<string, string>,
  locationNames: Map<string, string>,
): BuildBlockCard {
  const characterFocus = block.characterIds.map((id) => characterNames.get(id) || id).filter(Boolean);
  const locations = block.locationIds.map((id) => locationNames.get(id) || id).filter(Boolean);
  const sceneStatuses = block.scenes.map((scene) => scene.status);
  return {
    id: block.id,
    number: block.number,
    act: block.act,
    sequenceNumber: block.sequenceNumber,
    title: block.title,
    purpose: block.purpose,
    conflict: block.conflict,
    characterFocus,
    emotionalMovement: block.emotionalTurn,
    setup: block.setup,
    payoff: block.payoff,
    notes: block.notes,
    status: buildStatus(block),
    labels: unique([
      `Act ${block.act}`,
      `Sequence ${block.sequenceNumber}`,
      ...characterFocus,
      ...locations,
      ...sceneStatuses,
    ]),
    sceneIds: block.scenes.map((scene) => scene.id),
    sceneCount: block.scenes.length,
    miniBlockCount: block.scenes.reduce((total, scene) => total + scene.miniBlocks.length, 0),
  };
}

function matchesFilter(card: BuildBlockCard, filter: BuildWorkspaceFilter) {
  if (filter.acts?.length && !filter.acts.includes(card.act)) return false;
  if (filter.sequences?.length && !filter.sequences.includes(card.sequenceNumber)) return false;
  if (filter.statuses?.length && !filter.statuses.includes(card.status)) return false;
  if (filter.labels?.length && !filter.labels.every((label) => card.labels.includes(label))) return false;
  const query = filter.query?.trim().toLocaleLowerCase();
  if (!query) return true;
  return [
    card.title,
    card.purpose,
    card.conflict,
    card.emotionalMovement,
    card.setup,
    card.payoff,
    card.notes,
    ...card.characterFocus,
    ...card.labels,
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

export function createBuildWorkspaceModel(
  project: PlotPickleProject,
  filter: BuildWorkspaceFilter = {},
): BuildWorkspaceModel {
  const characterNames = new Map(project.characters.map((character) => [character.id, character.name]));
  const locationNames = new Map(project.world.locations.map((location) => [location.id, location.name]));
  const cards = project.blocks
    .map((block) => cardForBlock(block, characterNames, locationNames))
    .sort((left, right) => left.number - right.number);
  const visibleCards = cards.filter((card) => matchesFilter(card, filter));
  const sequences = project.structure.sequences
    .slice()
    .sort((left, right) => left.number - right.number)
    .map((sequence) => ({
      id: sequence.id,
      number: sequence.number,
      act: sequence.act,
      title: sequence.title,
      purpose: sequence.purpose,
      cards: visibleCards.filter((card) => card.sequenceNumber === sequence.number),
    }));
  const acts = [1, 2, 3, 4].map((number) => ({
    number,
    cards: visibleCards.filter((card) => card.act === number),
    sequences: sequences.filter((sequence) => sequence.act === number),
  }));
  return {
    cards,
    visibleCards,
    sequences,
    acts,
    totals: {
      blocks: cards.length,
      scenes: cards.reduce((total, card) => total + card.sceneCount, 0),
      miniBlocks: cards.reduce((total, card) => total + card.miniBlockCount, 0),
    },
  };
}

export function updateCanonicalBuildBlock(
  project: PlotPickleProject,
  blockId: string,
  patch: BuildBlockPatch,
): PlotPickleProject {
  if (!project.blocks.some((block) => block.id === blockId)) return project;
  return {
    ...project,
    metadata: {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
    },
    blocks: project.blocks.map((block) => block.id === blockId ? { ...block, ...patch, id: block.id } : block),
  };
}
