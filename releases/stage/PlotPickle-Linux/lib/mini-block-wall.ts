import type { PlotPickleProject, VisualFrame } from "./project";
import type { MiniBlock, StoryScene } from "./structure";

export type MiniBlockWallView = "whole-film" | "act" | "sequence" | "block" | "character" | "storyline";
export type MiniBlockWallColourMode = "character" | "storyline" | "location" | "status" | "setup-payoff" | "label";
export type MiniBlockWallCardStatus = "empty" | "developing" | "ready" | "overloaded";
export type MiniBlockWallScope = "all" | "act" | "sequence" | "block";

export type MiniBlockWallFilters = {
  characterIds: string[];
  storylineIds: string[];
  locationIds: string[];
  statuses: MiniBlockWallCardStatus[];
};

export type MiniBlockWallState = {
  view: MiniBlockWallView;
  expandedScope: MiniBlockWallScope;
  selectedMiniBlockId: string;
  act: number;
  sequenceNumber: number;
  blockId: string;
  characterId: string;
  storylineId: string;
  colourMode: MiniBlockWallColourMode;
  customLabel: string;
  filters: MiniBlockWallFilters;
  zoom: number;
  pan: { x: number; y: number };
};

export const DEFAULT_MINI_BLOCK_WALL_STATE: MiniBlockWallState = {
  view: "whole-film",
  expandedScope: "all",
  selectedMiniBlockId: "",
  act: 0,
  sequenceNumber: 0,
  blockId: "",
  characterId: "",
  storylineId: "",
  colourMode: "status",
  customLabel: "",
  filters: {
    characterIds: [],
    storylineIds: [],
    locationIds: [],
    statuses: [],
  },
  zoom: 1,
  pan: { x: 0, y: 0 },
};

export type MiniBlockWallWarningKind =
  | "empty-mini-block"
  | "overloaded-block"
  | "missing-escalation"
  | "repeated-beat"
  | "setup-without-payoff"
  | "payoff-without-setup"
  | "absent-character-arc"
  | "storyline-gap"
  | "unlinked-scene"
  | "missing-storyboard-frame";

export type MiniBlockWallWarning = {
  kind: MiniBlockWallWarningKind;
  targetId: string;
  blockId: string;
  miniBlockId: string;
  message: string;
};

export type MiniBlockWallCard = {
  id: string;
  globalNumber: number;
  number: number;
  blockId: string;
  blockNumber: number;
  blockTitle: string;
  act: number;
  sequenceNumber: number;
  sceneId: string;
  sceneTitle: string;
  sceneStatus: StoryScene["status"];
  label: string;
  function: string;
  purpose: string;
  objective: string;
  resistance: string;
  action: string;
  revelation: string;
  turn: string;
  setup: string;
  payoff: string;
  notes: string;
  characterId: string;
  characterName: string;
  storylineIds: string[];
  storylineNames: string[];
  locationIds: string[];
  locationNames: string[];
  status: MiniBlockWallCardStatus;
  frame: VisualFrame | null;
  screenplayElementIds: string[];
  shotIds: string[];
};

export type MiniBlockWallModel = {
  cards: MiniBlockWallCard[];
  visibleCards: MiniBlockWallCard[];
  warnings: MiniBlockWallWarning[];
  counts: {
    cards: number;
    visible: number;
    blocks: number;
    scenes: number;
    frames: number;
  };
};

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function populatedCount(mini: MiniBlock) {
  return [
    mini.purpose,
    mini.objective,
    mini.resistance,
    mini.action,
    mini.revelation,
    mini.turn,
    mini.visualBeat,
    mini.dialogueIntention,
    mini.entryState,
    mini.exitState,
    mini.setup,
    mini.payoff,
    mini.notes,
  ].filter((value) => value.trim()).length;
}

function cardStatus(mini: MiniBlock): MiniBlockWallCardStatus {
  const populated = populatedCount(mini);
  if (populated === 0 && mini.shortScenes.length === 0) return "empty";
  if (populated >= 11 || mini.shortScenes.length > 2) return "overloaded";
  if (populated >= 7 && Boolean(mini.turn.trim())) return "ready";
  return "developing";
}

function miniBlockCard(
  project: PlotPickleProject,
  block: PlotPickleProject["blocks"][number],
  scene: StoryScene,
  mini: MiniBlock,
  globalNumber: number,
): MiniBlockWallCard {
  const characters = new Map(project.characters.map((character) => [character.id, character.name]));
  const locations = new Map(project.world.locations.map((location) => [location.id, location.name]));
  const threads = new Map(project.storyThreads.map((thread) => [thread.id, thread.name]));
  const storylineIds = unique([
    ...scene.threadIds,
    ...project.storyThreads.filter((thread) => thread.sceneIds.includes(scene.id)).map((thread) => thread.id),
  ]);
  const frame = block.visuals.find((visual) => visual.miniBlockNumber === mini.number) ?? null;
  return {
    id: mini.id,
    globalNumber,
    number: mini.number,
    blockId: block.id,
    blockNumber: block.number,
    blockTitle: block.title,
    act: block.act,
    sequenceNumber: block.sequenceNumber,
    sceneId: scene.id,
    sceneTitle: scene.title,
    sceneStatus: scene.status,
    label: mini.label,
    function: mini.function,
    purpose: mini.purpose,
    objective: mini.objective,
    resistance: mini.resistance,
    action: mini.action,
    revelation: mini.revelation,
    turn: mini.turn,
    setup: mini.setup,
    payoff: mini.payoff,
    notes: mini.notes,
    characterId: mini.characterId,
    characterName: characters.get(mini.characterId) ?? "",
    storylineIds,
    storylineNames: storylineIds.map((id) => threads.get(id) ?? id),
    locationIds: scene.locationIds,
    locationNames: scene.locationIds.map((id) => locations.get(id) ?? id),
    status: cardStatus(mini),
    frame,
    screenplayElementIds: project.screenplay.draftElements
      .filter((element) => element.blockNumber === block.number && element.miniBlockNumber === mini.number && (!element.sceneId || element.sceneId === scene.id))
      .map((element) => element.id),
    shotIds: project.production.shots
      .filter((shot) => shot.blockNumber === block.number && shot.miniBlockNumber === mini.number && (!shot.sceneId || shot.sceneId === scene.id))
      .map((shot) => shot.id),
  };
}

function matchesFilters(card: MiniBlockWallCard, filters: MiniBlockWallFilters) {
  if (filters.characterIds.length && !filters.characterIds.includes(card.characterId)) return false;
  if (filters.storylineIds.length && !filters.storylineIds.some((id) => card.storylineIds.includes(id))) return false;
  if (filters.locationIds.length && !filters.locationIds.some((id) => card.locationIds.includes(id))) return false;
  if (filters.statuses.length && !filters.statuses.includes(card.status)) return false;
  return true;
}

function matchesView(card: MiniBlockWallCard, state: MiniBlockWallState) {
  if (state.view === "act" && state.act) return card.act === state.act;
  if (state.view === "sequence" && state.sequenceNumber) return card.sequenceNumber === state.sequenceNumber;
  if (state.view === "block" && state.blockId) return card.blockId === state.blockId;
  if (state.view === "character" && state.characterId) return card.characterId === state.characterId;
  if (state.view === "storyline" && state.storylineId) return card.storylineIds.includes(state.storylineId);
  return true;
}

function warning(
  kind: MiniBlockWallWarningKind,
  card: MiniBlockWallCard,
  message: string,
): MiniBlockWallWarning {
  return { kind, targetId: card.id, blockId: card.blockId, miniBlockId: card.id, message };
}

function diagnostics(project: PlotPickleProject, cards: MiniBlockWallCard[]) {
  const warnings: MiniBlockWallWarning[] = [];
  const setupCards = new Map<string, MiniBlockWallCard[]>();
  const payoffCards = new Map<string, MiniBlockWallCard[]>();

  cards.forEach((card, index) => {
    if (card.status === "empty") warnings.push(warning("empty-mini-block", card, `Mini-block ${card.globalNumber} is empty.`));
    if (!card.frame?.src) warnings.push(warning("missing-storyboard-frame", card, `Mini-block ${card.globalNumber} has no storyboard frame.`));
    if (card.number === 3 && !card.resistance.trim() && !card.revelation.trim() && !card.turn.trim()) {
      warnings.push(warning("missing-escalation", card, `Block ${card.blockNumber} has no clear pressure or escalation in its third mini-block.`));
    }
    const previous = cards[index - 1];
    const beat = normalized(card.turn || card.action || card.purpose);
    const previousBeat = previous ? normalized(previous.turn || previous.action || previous.purpose) : "";
    if (beat && previousBeat && beat === previousBeat) {
      warnings.push(warning("repeated-beat", card, `Mini-block ${card.globalNumber} repeats the previous dramatic beat.`));
    }
    const setup = normalized(card.setup);
    const payoff = normalized(card.payoff);
    if (setup) setupCards.set(setup, [...(setupCards.get(setup) ?? []), card]);
    if (payoff) payoffCards.set(payoff, [...(payoffCards.get(payoff) ?? []), card]);
  });

  setupCards.forEach((setupGroup, key) => {
    if (payoffCards.has(key)) return;
    setupGroup.forEach((card) => warnings.push(warning("setup-without-payoff", card, `Setup in mini-block ${card.globalNumber} has no matching payoff.`)));
  });
  payoffCards.forEach((payoffGroup, key) => {
    if (setupCards.has(key)) return;
    payoffGroup.forEach((card) => warnings.push(warning("payoff-without-setup", card, `Payoff in mini-block ${card.globalNumber} has no matching setup.`)));
  });

  project.blocks.forEach((block) => {
    const blockCards = cards.filter((card) => card.blockId === block.id);
    if (blockCards.filter((card) => card.status === "overloaded").length >= 2) {
      const card = blockCards[0];
      if (card) warnings.push(warning("overloaded-block", card, `Block ${block.number} contains multiple overloaded mini-blocks.`));
    }
    block.scenes.filter((scene) => scene.miniBlocks.length === 0).forEach((scene) => {
      const card = blockCards[0];
      if (card) warnings.push({ kind: "unlinked-scene", targetId: scene.id, blockId: block.id, miniBlockId: "", message: `${scene.title} is not linked to a mini-block.` });
    });
  });

  project.characters.forEach((character) => {
    if (cards.some((card) => card.characterId === character.id)) return;
    const card = cards.find((candidate) => candidate.blockNumber === character.arcMatrix.checkpoints.find((checkpoint) => checkpoint.blockNumber)?.blockNumber) ?? cards[0];
    if (card) warnings.push({ kind: "absent-character-arc", targetId: character.id, blockId: card.blockId, miniBlockId: card.id, message: `${character.name || "A character"} has no mini-block focus across the wall.` });
  });

  project.storyThreads.forEach((thread) => {
    const positions = cards.filter((card) => card.storylineIds.includes(thread.id)).map((card) => card.globalNumber);
    for (let index = 1; index < positions.length; index += 1) {
      if (positions[index] - positions[index - 1] <= 12) continue;
      const card = cards.find((candidate) => candidate.globalNumber === positions[index]);
      if (card) warnings.push({ kind: "storyline-gap", targetId: thread.id, blockId: card.blockId, miniBlockId: card.id, message: `${thread.name} disappears for more than three Blocks.` });
    }
  });

  return [...new Map(warnings.map((item) => [
    `${item.kind}:${item.targetId}:${item.miniBlockId}:${item.message}`,
    item,
  ])).values()];
}

export function normalizeMiniBlockWallState(state: Partial<MiniBlockWallState> | undefined): MiniBlockWallState {
  const filters = state?.filters ?? DEFAULT_MINI_BLOCK_WALL_STATE.filters;
  return {
    ...DEFAULT_MINI_BLOCK_WALL_STATE,
    ...state,
    filters: {
      characterIds: unique(filters.characterIds ?? []),
      storylineIds: unique(filters.storylineIds ?? []),
      locationIds: unique(filters.locationIds ?? []),
      statuses: unique(filters.statuses ?? []) as MiniBlockWallCardStatus[],
    },
    zoom: Math.min(2.5, Math.max(0.4, Number(state?.zoom) || 1)),
    pan: {
      x: Number(state?.pan?.x) || 0,
      y: Number(state?.pan?.y) || 0,
    },
  };
}

export function createMiniBlockWallModel(
  project: PlotPickleProject,
  inputState: Partial<MiniBlockWallState> = {},
): MiniBlockWallModel {
  const state = normalizeMiniBlockWallState(inputState);
  let globalNumber = 0;
  const cards = [...project.blocks]
    .sort((left, right) => left.number - right.number)
    .flatMap((block) => [...block.scenes]
      .sort((left, right) => left.order - right.order || left.number - right.number)
      .flatMap((scene) => [...scene.miniBlocks]
        .sort((left, right) => left.number - right.number)
        .map((mini) => {
          globalNumber += 1;
          return miniBlockCard(project, block, scene, mini, globalNumber);
        })));
  const visibleCards = cards.filter((card) => matchesView(card, state) && matchesFilters(card, state.filters));
  return {
    cards,
    visibleCards,
    warnings: diagnostics(project, cards),
    counts: {
      cards: cards.length,
      visible: visibleCards.length,
      blocks: new Set(cards.map((card) => card.blockId)).size,
      scenes: new Set(cards.map((card) => card.sceneId)).size,
      frames: cards.filter((card) => Boolean(card.frame?.src)).length,
    },
  };
}
