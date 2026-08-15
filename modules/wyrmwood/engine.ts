import type {
  WyrmwoodCompletedTurn,
  WyrmwoodCurriculumEvaluation,
  WyrmwoodDirectorTurn,
  WyrmwoodEvaluationDimensions,
  WyrmwoodGameState,
  WyrmwoodPlayerTurn,
  WyrmwoodRank,
  WyrmwoodResolvedRound,
} from "./contracts";

export const WYRMWOOD_STORAGE_KEY = "plotpickle.wyrmwood.v1";
export const WYRMWOOD_STARTING_SPOTLIGHT = 60;
export const WYRMWOOD_PICKLES_PER_MATCH = 5;

const DIMENSION_MAXIMUMS = {
  storyLogic: 30,
  lessonApplication: 20,
  establishedElements: 15,
  consequences: 15,
  rivalCounter: 10,
  clarity: 10,
} as const;

export function createWyrmwoodGameState(): WyrmwoodGameState {
  return {
    schemaVersion: 3,
    campaignId: "fundamentals",
    trialIndex: 0,
    pickleIndex: 0,
    roundStatus: "ready",
    spotlight: WYRMWOOD_STARTING_SPOTLIGHT,
    brineCoins: 0,
    lifetimeBrineCoinsEarned: 0,
    xp: 0,
    level: 1,
    rank: "Fresh Novice",
    completedTrialIds: [],
    currentDirectorTurn: null,
    lastResolution: null,
    turnHistory: [],
  };
}

export function normalizeWyrmwoodGameState(value: unknown): WyrmwoodGameState {
  const fresh = createWyrmwoodGameState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fresh;
  const candidate = value as Partial<WyrmwoodGameState> & { readonly schemaVersion?: number };
  const v3 = candidate.schemaVersion === 3;
  const roundStatus = v3 && (
    candidate.roundStatus === "generating"
    || candidate.roundStatus === "active"
    || candidate.roundStatus === "evaluating"
    || candidate.roundStatus === "resolved"
  ) ? candidate.roundStatus : "ready";
  const xp = clampNumber(candidate.xp, 0, Number.MAX_SAFE_INTEGER, 0);
  const lifetimeBrineCoinsEarned = clampNumber(
    candidate.lifetimeBrineCoinsEarned ?? candidate.brineCoins,
    0,
    Number.MAX_SAFE_INTEGER,
    0,
  );
  const progression = progressionForTotals(xp, lifetimeBrineCoinsEarned);
  return {
    ...fresh,
    trialIndex: Number.isInteger(candidate.trialIndex) && (candidate.trialIndex ?? 0) >= 0 ? candidate.trialIndex! : 0,
    pickleIndex: Number.isInteger(candidate.pickleIndex)
      ? clampNumber(candidate.pickleIndex, 0, WYRMWOOD_PICKLES_PER_MATCH - 1, 0)
      : 0,
    roundStatus,
    spotlight: clampNumber(candidate.spotlight, 0, 100, fresh.spotlight),
    brineCoins: clampNumber(candidate.brineCoins, 0, Number.MAX_SAFE_INTEGER, 0),
    lifetimeBrineCoinsEarned,
    xp,
    level: progression.level,
    rank: progression.rank,
    completedTrialIds: Array.isArray(candidate.completedTrialIds)
      ? candidate.completedTrialIds.filter((id): id is string => typeof id === "string")
      : [],
    currentDirectorTurn: v3 && isDirectorTurn(candidate.currentDirectorTurn)
      ? candidate.currentDirectorTurn
      : null,
    lastResolution: v3 && isResolvedRound(candidate.lastResolution) ? candidate.lastResolution : null,
    turnHistory: v3 && Array.isArray(candidate.turnHistory)
      ? candidate.turnHistory.filter(isCompletedTurn).slice(-60)
      : [],
  };
}

export function beginWyrmwoodRound(state: WyrmwoodGameState): WyrmwoodGameState {
  return {
    ...state,
    roundStatus: "generating",
    currentDirectorTurn: null,
    lastResolution: null,
  };
}

export function activateWyrmwoodRound(
  state: WyrmwoodGameState,
  directorTurn: WyrmwoodDirectorTurn,
): WyrmwoodGameState {
  if (directorTurn.pickleNumber !== state.pickleIndex + 1) return state;
  return {
    ...state,
    roundStatus: "active",
    currentDirectorTurn: directorTurn,
    lastResolution: null,
  };
}

export function failWyrmwoodRoundGeneration(state: WyrmwoodGameState): WyrmwoodGameState {
  return {
    ...state,
    roundStatus: "ready",
    currentDirectorTurn: null,
    lastResolution: null,
  };
}

export function submitWyrmwoodPlayerTurn(
  state: WyrmwoodGameState,
  playerTurn: WyrmwoodPlayerTurn,
): WyrmwoodGameState {
  const director = state.currentDirectorTurn;
  if (!director || state.roundStatus !== "active") return state;
  if (
    playerTurn.trialId !== director.trialId
    || playerTurn.pickleId !== director.pickle.id
    || playerTurn.pickleNumber !== director.pickleNumber
  ) return state;
  const response = playerTurn.response.trim();
  if (!response || response.split(/\s+/).length > 150) return state;
  const completed: WyrmwoodCompletedTurn = {
    director,
    player: { ...playerTurn, response },
  };
  return {
    ...state,
    roundStatus: "evaluating",
    lastResolution: null,
    turnHistory: [...state.turnHistory, completed].slice(-60),
  };
}

export function applyWyrmwoodEvaluation(
  state: WyrmwoodGameState,
  evaluation: WyrmwoodCurriculumEvaluation,
): WyrmwoodGameState {
  const director = state.currentDirectorTurn;
  const latest = state.turnHistory.at(-1);
  if (!director || !latest || state.roundStatus !== "evaluating") return state;
  if (
    latest.player.trialId !== director.trialId
    || latest.player.pickleId !== director.pickle.id
    || latest.player.pickleNumber !== director.pickleNumber
  ) return state;

  const dimensions = normalizeDimensions(evaluation.dimensions);
  const score = Object.values(dimensions).reduce((total, value) => total + value, 0);
  const spotlightDelta = spotlightDeltaForScore(score);
  const tropeCounterBonus = dimensions.rivalCounter >= 8;
  const brineCoinsEarned = brineForScore(score) + (tropeCounterBonus ? 25 : 0);
  const xpGained = score * 2;
  const nextLifetimeBrine = state.lifetimeBrineCoinsEarned + brineCoinsEarned;
  const nextXp = state.xp + xpGained;
  const before = progressionForTotals(state.xp, state.lifetimeBrineCoinsEarned);
  const after = progressionForTotals(nextXp, nextLifetimeBrine);

  const resolution: WyrmwoodResolvedRound = {
    trialId: latest.player.trialId,
    pickleId: latest.player.pickleId,
    pickleNumber: latest.player.pickleNumber,
    score,
    spotlightDelta,
    brineCoinsEarned,
    xpGained,
    tropeCounterBonus,
    dimensions,
    whatWorked: evaluation.whatWorked.slice(0, 3),
    whatNeedsWork: evaluation.whatNeedsWork.slice(0, 3),
    conceptUsed: evaluation.conceptUsed.trim().slice(0, 240),
    teachingDebrief: evaluation.teachingDebrief.trim().slice(0, 900),
    rankBefore: before.rank,
    rankAfter: after.rank,
    levelBefore: before.level,
    levelAfter: after.level,
    evaluatedAt: evaluation.evaluatedAt,
  };

  return {
    ...state,
    roundStatus: "resolved",
    spotlight: clampNumber(state.spotlight + spotlightDelta, 0, 100, state.spotlight),
    brineCoins: state.brineCoins + brineCoinsEarned,
    lifetimeBrineCoinsEarned: nextLifetimeBrine,
    xp: nextXp,
    level: after.level,
    rank: after.rank,
    lastResolution: resolution,
    turnHistory: [
      ...state.turnHistory.slice(0, -1),
      { ...latest, resolution },
    ].slice(-60),
  };
}

export function continueWyrmwoodLoop(
  state: WyrmwoodGameState,
  trialId: string,
  totalTrials: number,
): WyrmwoodGameState {
  if (state.roundStatus !== "resolved" || !state.lastResolution) return state;
  const completedMatch = state.pickleIndex >= WYRMWOOD_PICKLES_PER_MATCH - 1;
  const completedTrialIds = completedMatch && !state.completedTrialIds.includes(trialId)
    ? [...state.completedTrialIds, trialId]
    : state.completedTrialIds;
  return {
    ...state,
    trialIndex: completedMatch
      ? Math.min(state.trialIndex + 1, Math.max(0, totalTrials - 1))
      : state.trialIndex,
    pickleIndex: completedMatch ? 0 : state.pickleIndex + 1,
    roundStatus: "ready",
    currentDirectorTurn: null,
    lastResolution: null,
    completedTrialIds,
  };
}

export function openWyrmwoodTrial(state: WyrmwoodGameState, trialIndex: number): WyrmwoodGameState {
  return {
    ...state,
    trialIndex: Math.max(0, Math.floor(trialIndex)),
    pickleIndex: 0,
    roundStatus: "ready",
    currentDirectorTurn: null,
    lastResolution: null,
  };
}

export function progressionForTotals(xp: number, lifetimeBrineCoinsEarned: number): {
  readonly level: number;
  readonly rank: WyrmwoodRank;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const safeBrine = Math.max(0, Math.floor(lifetimeBrineCoinsEarned));
  if (safeXp >= 50_000) {
    return { level: 50 + Math.floor((safeXp - 50_000) / 5_000), rank: "Grand Fermenter" };
  }
  if (safeXp >= 15_000 && safeBrine >= 10_000) {
    return { level: 31 + Math.min(18, Math.floor((safeXp - 15_000) / 1_850)), rank: "Spicy Arch-Mage" };
  }
  if (safeXp >= 5_000 && safeBrine >= 2_500) {
    return { level: 16 + Math.min(14, Math.floor((safeXp - 5_000) / 670)), rank: "Master Untangler" };
  }
  if (safeXp >= 1_000 && safeBrine >= 500) {
    return { level: 6 + Math.min(9, Math.floor((safeXp - 1_000) / 400)), rank: "Junior Spellscribe" };
  }
  return { level: 1 + Math.min(4, Math.floor(safeXp / 200)), rank: "Fresh Novice" };
}

export function scoreWyrmwoodDimensions(dimensions: WyrmwoodEvaluationDimensions) {
  const normalized = normalizeDimensions(dimensions);
  return Object.values(normalized).reduce((total, value) => total + value, 0);
}

function normalizeDimensions(dimensions: WyrmwoodEvaluationDimensions): WyrmwoodEvaluationDimensions {
  return {
    storyLogic: clampNumber(dimensions.storyLogic, 0, DIMENSION_MAXIMUMS.storyLogic, 0),
    lessonApplication: clampNumber(dimensions.lessonApplication, 0, DIMENSION_MAXIMUMS.lessonApplication, 0),
    establishedElements: clampNumber(dimensions.establishedElements, 0, DIMENSION_MAXIMUMS.establishedElements, 0),
    consequences: clampNumber(dimensions.consequences, 0, DIMENSION_MAXIMUMS.consequences, 0),
    rivalCounter: clampNumber(dimensions.rivalCounter, 0, DIMENSION_MAXIMUMS.rivalCounter, 0),
    clarity: clampNumber(dimensions.clarity, 0, DIMENSION_MAXIMUMS.clarity, 0),
  };
}

function spotlightDeltaForScore(score: number) {
  if (score >= 90) return 20;
  if (score >= 75) return 12;
  if (score >= 60) return 6;
  if (score >= 45) return -4;
  if (score >= 30) return -10;
  return -18;
}

function brineForScore(score: number) {
  if (score >= 90) return 100;
  if (score >= 75) return 85;
  if (score >= 60) return 65;
  if (score >= 45) return 40;
  return 20;
}

function isDirectorTurn(value: unknown): value is WyrmwoodDirectorTurn {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WyrmwoodDirectorTurn>;
  return typeof candidate.trialId === "string"
    && typeof candidate.pickleNumber === "number"
    && typeof candidate.oakenOpening === "string"
    && Boolean(candidate.pickle && typeof candidate.pickle === "object")
    && Boolean(candidate.rivals && typeof candidate.rivals === "object")
    && typeof candidate.model === "string"
    && typeof candidate.generatedAt === "string";
}

function isResolvedRound(value: unknown): value is WyrmwoodResolvedRound {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WyrmwoodResolvedRound>;
  return typeof candidate.trialId === "string"
    && typeof candidate.pickleId === "string"
    && typeof candidate.score === "number"
    && typeof candidate.teachingDebrief === "string";
}

function isCompletedTurn(value: unknown): value is WyrmwoodCompletedTurn {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WyrmwoodCompletedTurn>;
  return isDirectorTurn(candidate.director)
    && Boolean(candidate.player && typeof candidate.player === "object")
    && typeof candidate.player?.response === "string";
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.round(value)))
    : fallback;
}
