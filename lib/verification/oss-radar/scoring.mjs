import {
  LOCAL_TERMS,
  clamp,
  filterCandidate,
  mergeDuplicateCandidates,
  tokenize,
  uniqueSorted,
} from "./query-normalization.mjs";

function relevanceSignal(candidate) {
  const queryTerms = uniqueSorted(candidate.matchedQueries.flatMap(tokenize));
  if (!queryTerms.length) return { signal: 0, queryTerms: [], matchedTerms: [] };
  const textTerms = new Set(tokenize(candidate.searchableText));
  const matchedTerms = queryTerms.filter((term) => textTerms.has(term));
  const lexicalRatio = matchedTerms.length / Math.min(8, queryTerms.length);
  return {
    signal: clamp(0.35 + (0.65 * lexicalRatio)),
    queryTerms,
    matchedTerms,
  };
}

function activitySignal(activityAgeDays, contract) {
  const penaltyAfter = Number(contract.filters.activity.stalenessPenaltyAfterDays || 365);
  const rejectAfter = Number(contract.filters.activity.rejectAfterDays || 730);
  if (activityAgeDays <= 30) return 1;
  if (activityAgeDays <= 90) return 0.85;
  if (activityAgeDays <= 180) return 0.7;
  if (activityAgeDays <= penaltyAfter) return 0.5;
  if (activityAgeDays <= rejectAfter) return 0.2;
  return 0;
}

function maturitySignal(candidate) {
  const starSignal = clamp(Math.log10(candidate.stars + 1) / 4);
  const forkSignal = clamp(Math.log10(candidate.forks + 1) / 3);
  return clamp((starSignal * 0.7) + (forkSignal * 0.3));
}

function laneSignal(candidate, laneId) {
  return candidate.matchedLaneIds.includes(laneId) ? 1 : 0;
}

function dimensionRatio(candidate, dimension, relevance, activity, maturity) {
  switch (dimension) {
    case "problemOpportunityFit": return relevance;
    case "evolutionValue": return clamp((relevance * 0.55) + (activity * 0.45));
    case "writerValue": return clamp(Math.max(laneSignal(candidate, "writer-craft"), laneSignal(candidate, "learn-education") * 0.35) * relevance);
    case "studentLearningValue": return laneSignal(candidate, "learn-education") * relevance;
    case "visualStoryValue": return laneSignal(candidate, "visual-story") * relevance;
    case "storyGameEngineValue": return laneSignal(candidate, "story-game-engine") * relevance;
    case "aiArchitectureValue": return clamp(Math.max(laneSignal(candidate, "ai-architecture"), laneSignal(candidate, "platform-engineering") * 0.25) * relevance);
    case "saveWorkValue": return clamp((relevance * 0.65) + (maturity * 0.35));
    case "missingPieceValue": return clamp(relevance * (0.8 + ((1 - maturity) * 0.2)));
    case "architectureFit": {
      const architectureLane = Math.max(
        laneSignal(candidate, "ai-architecture"),
        laneSignal(candidate, "platform-engineering") * 0.9,
        laneSignal(candidate, "story-game-engine") * 0.7,
        0.45,
      );
      return clamp(architectureLane * relevance);
    }
    case "maturityMaintenance": return clamp((activity * 0.65) + (maturity * 0.35));
    case "licenseFit": return candidate.license.status === "known-open-source" ? 1 : candidate.license.status === "review-required" ? 0.25 : 0;
    case "windowsLocalFit": {
      const localHit = LOCAL_TERMS.some((term) => candidate.searchableText.includes(term));
      return localHit ? 1 : laneSignal(candidate, "platform-engineering") * 0.25;
    }
    case "roadmapRelevance": return 0.4;
    default: return 0;
  }
}

export function scoreCandidate(candidate, contract, now = new Date()) {
  const filter = filterCandidate(candidate, contract, now);
  if (filter.rejected) return { ...candidate, filter, score: null, scoreEvidence: null };

  const relevance = relevanceSignal(candidate);
  const activity = activitySignal(filter.activityAgeDays, contract);
  const maturity = maturitySignal(candidate);
  const dimensions = {};
  let baseScore = 0;

  for (const [dimension, weightValue] of Object.entries(contract.scoring.weights)) {
    const weight = Number(weightValue || 0);
    const ratio = clamp(dimensionRatio(candidate, dimension, relevance.signal, activity, maturity));
    const points = Number((weight * ratio).toFixed(2));
    dimensions[dimension] = { weight, ratio: Number(ratio.toFixed(4)), points };
    baseScore += points;
  }

  const integrationCostPenalty = Math.min(
    Number(contract.scoring.integrationCostPenalty.maximum || 10),
    Math.max(Number(contract.scoring.integrationCostPenalty.minimum || 0), 4),
  );
  const finalScore = Number(Math.max(0, baseScore - integrationCostPenalty).toFixed(2));

  return {
    ...candidate,
    filter,
    score: finalScore,
    surfaceEligible: finalScore >= Number(contract.scoring.surfaceThreshold || 65),
    watchEvidenceEligible: finalScore >= Number(contract.scoring.watchEvidenceThreshold || 55),
    adoptionEligibleForHumanReview: candidate.license.adoptionEligibleForHumanReview,
    dispositionCeiling: candidate.license.status === "unknown" ? "WATCH" : null,
    scoreEvidence: {
      baseScore: Number(baseScore.toFixed(2)),
      integrationCostPenalty,
      finalScore,
      relevance: {
        signal: Number(relevance.signal.toFixed(4)),
        matchedTerms: relevance.matchedTerms,
        queryTerms: relevance.queryTerms,
      },
      activity: { ageDays: Number(filter.activityAgeDays.toFixed(2)), signal: activity },
      maturity: { signal: Number(maturity.toFixed(4)), stars: candidate.stars, forks: candidate.forks },
      dimensions,
      reasonCodes: uniqueSorted([
        ...candidate.matchedLaneIds.map((lane) => `lane:${lane}`),
        `license:${candidate.license.status}`,
        candidate.fork ? "fork:unverified-divergence" : "fork:no",
        activity >= 0.7 ? "activity:recent" : "activity:older",
      ]),
    },
  };
}

export function rankCandidates(candidates) {
  return [...candidates].sort((left, right) => {
    const scoreDelta = Number(right.score || 0) - Number(left.score || 0);
    if (scoreDelta !== 0) return scoreDelta;
    const starDelta = Number(right.stars || 0) - Number(left.stars || 0);
    if (starDelta !== 0) return starDelta;
    return left.fullName.localeCompare(right.fullName);
  });
}

export function evaluateCandidates(candidates, contract, now = new Date()) {
  const merged = mergeDuplicateCandidates(candidates);
  const evaluated = merged.map((candidate) => scoreCandidate(candidate, contract, now));
  const retained = evaluated.filter((candidate) => !candidate.filter.rejected);
  const rejected = evaluated.filter((candidate) => candidate.filter.rejected);
  const rejectionReasons = {};
  for (const candidate of rejected) {
    for (const reason of candidate.filter.reasons) rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
  }
  return { retained: rankCandidates(retained), rejected, rejectionReasons };
}
