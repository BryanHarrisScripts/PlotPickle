import {
  LOCAL_TERMS,
  clamp,
  filterCandidate,
  mergeDuplicateCandidates,
  tokenize,
  uniqueSorted,
} from "./query-normalization.mjs";

function metadataRelevance(candidate) {
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

function enrichmentContext(candidate, stage) {
  const enrichment = candidate?.enrichment || {};
  const concepts = (enrichment.evidenceConcepts || []).map((entry) => entry.id);
  const available = stage === "enriched" && enrichment.evidenceAvailable === true;
  const conceptSignal = available ? clamp(0.2 + (concepts.length * 0.08)) : 0;
  const evidenceLaneIds = available ? (enrichment.evidenceLaneIds || []) : [];
  return {
    available,
    concepts,
    conceptSignal,
    evidenceLaneIds,
    plotPickleTargets: available ? (enrichment.plotPickleTargets || []) : [],
  };
}

function relevanceSignal(candidate, stage) {
  const metadata = metadataRelevance(candidate);
  const enrichment = enrichmentContext(candidate, stage);
  return {
    signal: enrichment.available ? Math.max(metadata.signal, enrichment.conceptSignal) : metadata.signal,
    metadataSignal: metadata.signal,
    queryTerms: metadata.queryTerms,
    matchedTerms: metadata.matchedTerms,
    enrichment,
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

function laneSignal(candidate, laneId, enrichment) {
  return candidate.matchedLaneIds.includes(laneId) || enrichment.evidenceLaneIds.includes(laneId) ? 1 : 0;
}

function dimensionRatio(candidate, dimension, relevance, activity, maturity) {
  const lane = (id) => laneSignal(candidate, id, relevance.enrichment);
  const comparator = lane("architectural-comparators");
  switch (dimension) {
    case "problemOpportunityFit": return relevance.signal;
    case "evolutionValue": return clamp((relevance.signal * 0.55) + (activity * 0.45));
    case "writerValue": return clamp(Math.max(lane("writer-craft"), lane("learn-education") * 0.35, comparator * 0.35) * relevance.signal);
    case "studentLearningValue": return Math.max(lane("learn-education"), comparator * 0.2) * relevance.signal;
    case "visualStoryValue": return Math.max(lane("visual-story"), comparator * 0.2) * relevance.signal;
    case "storyGameEngineValue": return Math.max(lane("story-game-engine"), comparator * 0.6) * relevance.signal;
    case "aiArchitectureValue": return clamp(Math.max(lane("ai-architecture"), lane("platform-engineering") * 0.25, comparator * 0.75) * relevance.signal);
    case "saveWorkValue": return clamp((relevance.signal * 0.65) + (maturity * 0.35));
    case "missingPieceValue": return clamp(relevance.signal * (0.8 + ((1 - maturity) * 0.2)));
    case "architectureFit": {
      const architectureLane = Math.max(
        lane("ai-architecture"),
        lane("platform-engineering") * 0.9,
        lane("story-game-engine") * 0.7,
        comparator,
        0.45,
      );
      return clamp(architectureLane * relevance.signal);
    }
    case "maturityMaintenance": return clamp((activity * 0.65) + (maturity * 0.35));
    case "licenseFit": return candidate.license.status === "known-open-source" ? 1 : candidate.license.status === "review-required" ? 0.25 : 0;
    case "windowsLocalFit": {
      const localEvidence = relevance.enrichment.concepts.some((id) => id === "local-ai" || id === "windows-local");
      const localHit = localEvidence || LOCAL_TERMS.some((term) => candidate.searchableText.includes(term));
      return localHit ? 1 : lane("platform-engineering") * 0.25;
    }
    case "roadmapRelevance": return Math.max(0.4, comparator * 0.65, relevance.enrichment.conceptSignal * 0.8);
    default: return 0;
  }
}

export function scoreCandidate(candidate, contract, now = new Date(), { stage = "discovery" } = {}) {
  const filter = filterCandidate(candidate, contract, now);
  if (filter.rejected) return { ...candidate, filter, score: null, scoreEvidence: null };

  const relevance = relevanceSignal(candidate, stage);
  const activity = activitySignal(filter.activityAgeDays, contract);
  const maturity = maturitySignal(candidate);
  const dimensions = {};
  let baseScore = 0;

  for (const [dimension, weightValue] of Object.entries(contract.scoring.weights)) {
    const weight = Number(weightValue || 0);
    const ratio = clamp(dimensionRatio(candidate, dimension, relevance, activity, maturity));
    const points = Number((weight * ratio).toFixed(2));
    dimensions[dimension] = { weight, ratio: Number(ratio.toFixed(4)), points };
    baseScore += points;
  }

  const integrationCostPenalty = Math.min(
    Number(contract.scoring.integrationCostPenalty.maximum || 10),
    Math.max(Number(contract.scoring.integrationCostPenalty.minimum || 0), 4),
  );
  const finalScore = Number(Math.max(0, baseScore - integrationCostPenalty).toFixed(2));
  const discoveryScore = stage === "discovery"
    ? finalScore
    : Number(candidate.discoveryScore ?? candidate.score ?? finalScore);

  return {
    ...candidate,
    filter,
    discoveryScore,
    score: finalScore,
    scoreStage: stage === "enriched" && relevance.enrichment.available ? "enriched" : "discovery",
    surfaceEligible: finalScore >= Number(contract.scoring.surfaceThreshold || 65),
    watchEvidenceEligible: finalScore >= Number(contract.scoring.watchEvidenceThreshold || 55),
    adoptionEligibleForHumanReview: candidate.license.adoptionEligibleForHumanReview,
    dispositionCeiling: candidate.license.status === "unknown" ? "WATCH" : null,
    scoreEvidence: {
      stage: stage === "enriched" && relevance.enrichment.available ? "enriched" : "discovery",
      discoveryScore,
      baseScore: Number(baseScore.toFixed(2)),
      integrationCostPenalty,
      finalScore,
      relevance: {
        signal: Number(relevance.signal.toFixed(4)),
        metadataSignal: Number(relevance.metadataSignal.toFixed(4)),
        enrichmentSignal: Number(relevance.enrichment.conceptSignal.toFixed(4)),
        matchedTerms: relevance.matchedTerms,
        queryTerms: relevance.queryTerms,
        evidenceConcepts: relevance.enrichment.concepts,
        evidenceLaneIds: relevance.enrichment.evidenceLaneIds,
        plotPickleTargets: relevance.enrichment.plotPickleTargets,
      },
      activity: { ageDays: Number(filter.activityAgeDays.toFixed(2)), signal: activity },
      maturity: { signal: Number(maturity.toFixed(4)), stars: candidate.stars, forks: candidate.forks },
      dimensions,
      reasonCodes: uniqueSorted([
        ...candidate.matchedLaneIds.map((laneId) => `lane:${laneId}`),
        ...relevance.enrichment.evidenceLaneIds.map((laneId) => `evidence-lane:${laneId}`),
        ...relevance.enrichment.concepts.map((concept) => `evidence:${concept}`),
        `score-stage:${stage === "enriched" && relevance.enrichment.available ? "enriched" : "discovery"}`,
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

export function evaluateCandidates(candidates, contract, now = new Date(), { stage = "discovery" } = {}) {
  const merged = mergeDuplicateCandidates(candidates);
  const evaluated = merged.map((candidate) => scoreCandidate(candidate, contract, now, { stage }));
  const retained = evaluated.filter((candidate) => !candidate.filter.rejected);
  const rejected = evaluated.filter((candidate) => candidate.filter.rejected);
  const rejectionReasons = {};
  for (const candidate of rejected) {
    for (const reason of candidate.filter.reasons) rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
  }
  return { retained: rankCandidates(retained), rejected, rejectionReasons };
}
