import type { WyrmwoodGameState, WyrmwoodResolvedRound } from "./contracts";

export const WYRMWOOD_STORAGE_KEY = "plotpickle.wyrmwood.v1";
export const WYRMWOOD_STARTING_SPOTLIGHT = 60;

export function createWyrmwoodGameState(): WyrmwoodGameState {
  return {
    schemaVersion: 1,
    campaignId: "fundamentals",
    trialIndex: 0,
    roundStatus: "ready",
    spotlight: WYRMWOOD_STARTING_SPOTLIGHT,
    brineCoins: 0,
    xp: 0,
    completedTrialIds: [],
  };
}

export function normalizeWyrmwoodGameState(value: unknown): WyrmwoodGameState {
  const fresh = createWyrmwoodGameState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fresh;
  const candidate = value as Partial<WyrmwoodGameState>;
  return {
    ...fresh,
    trialIndex: Number.isInteger(candidate.trialIndex) && (candidate.trialIndex ?? 0) >= 0 ? candidate.trialIndex! : 0,
    roundStatus: candidate.roundStatus === "active" || candidate.roundStatus === "resolved" ? candidate.roundStatus : "ready",
    spotlight: clampNumber(candidate.spotlight, 0, 100, fresh.spotlight),
    brineCoins: clampNumber(candidate.brineCoins, 0, Number.MAX_SAFE_INTEGER, 0),
    xp: clampNumber(candidate.xp, 0, Number.MAX_SAFE_INTEGER, 0),
    completedTrialIds: Array.isArray(candidate.completedTrialIds)
      ? candidate.completedTrialIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function beginWyrmwoodRound(state: WyrmwoodGameState): WyrmwoodGameState {
  return { ...state, roundStatus: "active" };
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
    roundStatus: "resolved",
    spotlight: clampNumber(state.spotlight + outcome.spotlightDelta, 0, 100, state.spotlight),
    brineCoins: state.brineCoins + Math.max(0, Math.round(outcome.brineCoinsEarned)),
    xp: state.xp + Math.max(0, Math.round(outcome.xpGained)),
    completedTrialIds,
  };
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}
