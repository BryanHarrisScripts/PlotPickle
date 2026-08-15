import type {
  WyrmwoodCompletedTurn,
  WyrmwoodDirectorTurn,
  WyrmwoodGameState,
  WyrmwoodPlayerTurn,
  WyrmwoodResolvedRound,
} from "./contracts";

export const WYRMWOOD_STORAGE_KEY = "plotpickle.wyrmwood.v1";
export const WYRMWOOD_STARTING_SPOTLIGHT = 60;
export const WYRMWOOD_PICKLES_PER_MATCH = 5;

export function createWyrmwoodGameState(): WyrmwoodGameState {
  return {
    schemaVersion: 2,
    campaignId: "fundamentals",
    trialIndex: 0,
    pickleIndex: 0,
    roundStatus: "ready",
    spotlight: WYRMWOOD_STARTING_SPOTLIGHT,
    brineCoins: 0,
    xp: 0,
    completedTrialIds: [],
    currentDirectorTurn: null,
    turnHistory: [],
  };
}

export function normalizeWyrmwoodGameState(value: unknown): WyrmwoodGameState {
  const fresh = createWyrmwoodGameState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fresh;
  const candidate = value as Partial<WyrmwoodGameState> & { readonly schemaVersion?: number };
  const roundStatus = candidate.roundStatus === "generating"
    || candidate.roundStatus === "active"
    || candidate.roundStatus === "resolved"
    ? candidate.roundStatus
    : "ready";
  return {
    ...fresh,
    trialIndex: Number.isInteger(candidate.trialIndex) && (candidate.trialIndex ?? 0) >= 0 ? candidate.trialIndex! : 0,
    pickleIndex: Number.isInteger(candidate.pickleIndex)
      ? clampNumber(candidate.pickleIndex, 0, WYRMWOOD_PICKLES_PER_MATCH - 1, 0)
      : 0,
    roundStatus: candidate.schemaVersion === 2 ? roundStatus : "ready",
    spotlight: clampNumber(candidate.spotlight, 0, 100, fresh.spotlight),
    brineCoins: clampNumber(candidate.brineCoins, 0, Number.MAX_SAFE_INTEGER, 0),
    xp: clampNumber(candidate.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    completedTrialIds: Array.isArray(candidate.completedTrialIds)
      ? candidate.completedTrialIds.filter((id): id is string => typeof id === "string")
      : [],
    currentDirectorTurn: candidate.schemaVersion === 2 && isDirectorTurn(candidate.currentDirectorTurn)
      ? candidate.currentDirectorTurn
      : null,
    turnHistory: candidate.schemaVersion === 2 && Array.isArray(candidate.turnHistory)
      ? candidate.turnHistory.filter(isCompletedTurn).slice(-60)
      : [],
  };
}

export function beginWyrmwoodRound(state: WyrmwoodGameState): WyrmwoodGameState {
  return {
    ...state,
    roundStatus: "generating",
    currentDirectorTurn: null,
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
  };
}

export function failWyrmwoodRoundGeneration(state: WyrmwoodGameState): WyrmwoodGameState {
  return {
    ...state,
    roundStatus: "ready",
    currentDirectorTurn: null,
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
    roundStatus: "resolved",
    turnHistory: [...state.turnHistory, completed].slice(-60),
  };
}

export function continueWyrmwoodLoop(
  state: WyrmwoodGameState,
  trialId: string,
  totalTrials: number,
): WyrmwoodGameState {
  if (state.roundStatus !== "resolved") return state;
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
  };
}

export function resolveWyrmwoodRound(
  state: WyrmwoodGameState,
  outcome: WyrmwoodResolvedRound,
  totalTrials: number,
): WyrmwoodGameState {
  const completedTrialIds = state.completedTrialIds.includes(outcome.trialId)
    ? state.completedTrialIds
    : [...state.completedTrialIds, outcome.trialId];
  return {
    ...state,
    trialIndex: Math.min(state.trialIndex + 1, Math.max(0, totalTrials - 1)),
    pickleIndex: 0,
    roundStatus: "resolved",
    spotlight: clampNumber(state.spotlight + outcome.spotlightDelta, 0, 100, state.spotlight),
    brineCoins: state.brineCoins + Math.max(0, Math.round(outcome.brineCoinsEarned)),
    xp: state.xp + Math.max(0, Math.round(outcome.xpGained)),
    completedTrialIds,
  };
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

function isCompletedTurn(value: unknown): value is WyrmwoodCompletedTurn {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<WyrmwoodCompletedTurn>;
  return isDirectorTurn(candidate.director)
    && Boolean(candidate.player && typeof candidate.player === "object")
    && typeof candidate.player?.response === "string";
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}
