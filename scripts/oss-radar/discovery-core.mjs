const UNKNOWN_LICENSE_IDS = new Set(["", "NOASSERTION", "OTHER"]);
const EXPLICITLY_UNUSABLE_LICENSE_IDS = new Set(["UNLICENSED", "PROPRIETARY"]);
const REVIEWABLE_OPEN_SOURCE_IDS = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "GPL-3.0-only",
  "GPL-3.0-or-later",
  "LGPL-3.0-only",
  "LGPL-3.0-or-later",
  "AGPL-3.0-only",
  "AGPL-3.0-or-later",
]);

const STOP_WORDS = new Set([
  "and", "for", "from", "into", "open", "source", "the", "with", "tool", "tools",
]);

const LOCAL_TERMS = ["windows", "desktop", "local", "offline", "ollama", "comfyui", "whisper", "speech", "voice"];

const LANE_VALUE_DIMENSIONS = Object.freeze({
  "writer-craft": ["writerValue"],
  "visual-story": ["visualStoryValue"],
  "story-game-engine": ["storyGameEngineValue"],
  "learn-education": ["studentLearningValue", "writerValue"],
  "ai-architecture": ["aiArchitectureValue", "architectureFit"],
  "platform-engineering": ["architectureFit"],
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(now, value) {
  const current = asDate(now);
  const target = asDate(value);
  if (!current || !target) return Number.POSITIVE_INFINITY;
  return Math.max(0, (current.getTime() - target.getTime()) / 86_400_000);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function tokenize(value) {
  return uniqueSorted(
    String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

export function buildGitHubSearchQuery(query, defaults, now = new Date()) {
  const terms = String(query || "").trim();
  if (!terms) throw new Error("OSS Radar query text is required.");
  const recencyDays = Math.max(1, Number(defaults?.recencyDays || 180));
  const minimumStars = Math.max(0, Number(defaults?.minimumStars || 0));
  const start = new Date(asDate(now)?.getTime() ?? Date.now());
  start.setUTCDate(start.getUTCDate() - recencyDays);
  const pushed = start.toISOString().slice(0, 10);
  return `${terms} pushed:>=${pushed} stars:>=${minimumStars}`;
}

export function buildGitHubSearchUrl({ query, defaults, now = new Date(), perPage = 10 }) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", buildGitHubSearchQuery(query, defaults, now));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(50, Math.max(1, Number(perPage || 10)))));
  return url.toString();
}

export function classifyLicense(rawLicense) {
  const spdxId = String(rawLicense?.spdx_id || "").trim();
  if (EXPLICITLY_UNUSABLE_LICENSE_IDS.has(spdxId)) {
    return { spdxId, status: "explicitly-unusable", adoptionEligibleForHumanReview: false };
  }
  if (UNKNOWN_LICENSE_IDS.has(spdxId)) {
    return { spdxId: spdxId || "UNKNOWN", status: "unknown", adoptionEligibleForHumanReview: false };
  }
  if (REVIEWABLE_OPEN_SOURCE_IDS.has(spdxId)) {
    return { spdxId, status: "known-open-source", adoptionEligibleForHumanReview: true };
  }
  return { spdxId, status: "review-required", adoptionEligibleForHumanReview: false };
}

export function normalizeRepository(raw, { laneId, query }) {
  const fullName = String(raw?.full_name || "").trim();
  const name = String(raw?.name || fullName.split("/").at(-1) || "").trim();
  const topics = Array.isArray(raw?.topics) ? raw.topics.map((topic) => String(topic).toLowerCase()) : [];
  const language = raw?.language ? String(raw.language) : null;
  const description = raw?.description ? String(raw.description) : "";
  const license = classifyLicense(raw?.license);
  const searchableText = [name, fullName, description, language || "", ...topics].join(" ").toLowerCase();

  return {
    repositoryStableId: String(raw?.id ?? raw?.node_id ?? fullName.toLowerCase()),
    fullName,
    name,
    url: String(raw?.html_url || ""),
    description,
    ownerType: raw?.owner?.type ? String(raw.owner.type) : null,
    language,
    topics: uniqueSorted(topics),
    stars: Math.max(0, Number(raw?.stargazers_count || 0)),
    forks: Math.max(0, Number(raw?.forks_count || 0)),
    openIssues: Math.max(0, Number(raw?.open_issues_count || 0)),
    archived: Boolean(raw?.archived),
    fork: Boolean(raw?.fork),
    license,
    createdAt: raw?.created_at || null,
    updatedAt: raw?.updated_at || null,
    pushedAt: raw?.pushed_at || raw?.updated_at || null,
    defaultBranch: raw?.default_branch ? String(raw.default_branch) : null,
    matchedLaneIds: uniqueSorted([laneId]),
    matchedQueries: uniqueSorted([query]),
    searchableText,
  };
}

export function mergeDuplicateCandidates(candidates) {
  const byRepository = new Map();
  for (const candidate of candidates) {
    const key = candidate.repositoryStableId || candidate.fullName.toLowerCase();
    const current = byRepository.get(key);
    if (!current) {
      byRepository.set(key, { ...candidate });
      continue;
    }
    byRepository.set(key, {
      ...current,
      matchedLaneIds: uniqueSorted([...current.matchedLaneIds, ...candidate.matchedLaneIds]),
      matchedQueries: uniqueSorted([...current.matchedQueries, ...candidate.matchedQueries]),
      topics: uniqueSorted([...current.topics, ...candidate.topics]),
      stars: Math.max(current.stars, candidate.stars),
      forks: Math.max(current.forks, candidate.forks),
      openIssues: Math.max(current.openIssues, candidate.openIssues),
      updatedAt: [current.updatedAt, candidate.updatedAt].filter(Boolean).sort().at(-1) || null,
      pushedAt: [current.pushedAt, candidate.pushedAt].filter(Boolean).sort().at(-1) || null,
    });
  }
  return [...byRepository.values()];
}

export function filterCandidate(candidate, contract, now = new Date()) {
  const reasons = [];
  if (!candidate.fullName || !candidate.url) reasons.push("missing-identity");
  if (contract.filters.hardReject.archived && candidate.archived) reasons.push("archived");
  if (contract.filters.hardReject.clearlyIncompatibleLicense && candidate.license.status === "explicitly-unusable") {
    reasons.push("explicitly-unusable-license");
  }
  const activityAgeDays = daysSince(now, candidate.pushedAt || candidate.updatedAt);
  if (activityAgeDays > Number(contract.filters.activity.rejectAfterDays || 730)) reasons.push("stale");
  if (!candidate.matchedLaneIds.length || !candidate.matchedQueries.length) reasons.push("no-discovery-evidence");
  return { rejected: reasons.length > 0, reasons, activityAgeDays };
}

function relevanceSignal(candidate) {
  const queryTerms = uniqueSorted(candidate.matchedQueries.flatMap(tokenize));
  if (!queryTerms.length) return 0;
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
      const text = candidate.searchableText;
      const localHit = LOCAL_TERMS.some((term) => text.includes(term));
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
  const threshold = Number(contract.scoring.surfaceThreshold || 65);
  const watchThreshold = Number(contract.scoring.watchEvidenceThreshold || 55);

  return {
    ...candidate,
    filter,
    score: finalScore,
    surfaceEligible: finalScore >= threshold,
    watchEvidenceEligible: finalScore >= watchThreshold,
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

export function laneValueDimensions(laneId) {
  return LANE_VALUE_DIMENSIONS[laneId] || [];
}
