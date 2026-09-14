const DAY_MS = 86_400_000;
export const HISTORY_RETENTION_DAYS = 730;
export const REVISIT_COOLDOWN_DAYS = 30;
export const MATERIAL_SCORE_DELTA = 5;

const LANE_CATEGORY = Object.freeze({
  "writer-craft": "WRITER CRAFT",
  "visual-story": "VISUAL STORY",
  "story-game-engine": "STORY / GAME ENGINE",
  "learn-education": "LEARN / EDUCATION",
  "ai-architecture": "AI ARCHITECTURE",
  "platform-engineering": "ARCHITECTURE",
  "architectural-comparators": "ARCHITECTURAL COMPARATOR",
});

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function utcDate(value = new Date()) {
  const date = asDate(value);
  if (!date) throw new Error("OSS Radar requires a valid date.");
  return date.toISOString().slice(0, 10);
}

function previousUtcDate(value = new Date()) {
  const date = asDate(value);
  if (!date) throw new Error("OSS Radar requires a valid date.");
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function monthlyIssueTitle(value = new Date()) {
  const date = asDate(value);
  if (!date) throw new Error("OSS Radar requires a valid month date.");
  const label = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return `[OSS RADAR] ${label}`;
}

export function dailyMarker(date) {
  return `<!-- PLOTPICKLE-OSS-RADAR-DAY:${utcDate(date)} -->`;
}

export function encodeDailyState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `<!-- PLOTPICKLE-OSS-RADAR-STATE:${encoded} -->`;
}

export function parseDailyState(body) {
  const match = String(body || "").match(/<!-- PLOTPICKLE-OSS-RADAR-STATE:([A-Za-z0-9_-]+) -->/u);
  if (!match) return null;
  try {
    const payload = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
    if (payload?.schemaVersion !== 1 || !/^\d{4}-\d{2}-\d{2}$/u.test(payload?.date || "") || !Array.isArray(payload?.entries)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function findDailyComment(comments, date) {
  const marker = dailyMarker(date);
  const matches = (comments || []).filter((comment) => String(comment?.body || "").includes(marker));
  if (matches.length > 1) throw new Error(`OSS Radar found duplicate daily comments for ${utcDate(date)}.`);
  return matches[0] || null;
}

function sortedUnique(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function laneCategories(candidate) {
  return sortedUnique((candidate?.matchedLaneIds || []).map((lane) => LANE_CATEGORY[lane]));
}

function daysBetween(left, right) {
  const a = asDate(left);
  const b = asDate(right);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / DAY_MS));
}

function statesBefore(comments, beforeDate, retentionDays = HISTORY_RETENTION_DAYS) {
  const end = utcDate(beforeDate || new Date());
  const cutoff = asDate(end);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const start = cutoff.toISOString().slice(0, 10);
  return (comments || [])
    .map((comment) => parseDailyState(comment?.body))
    .filter(Boolean)
    .filter((state) => state.date < end && state.date >= start)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function reconstructHistory(comments, { beforeDate, retentionDays = HISTORY_RETENTION_DAYS } = {}) {
  const history = new Map();
  for (const state of statesBefore(comments, beforeDate, retentionDays)) {
    for (const entry of state.entries) {
      if (!entry?.repositoryStableId) continue;
      const key = String(entry.repositoryStableId);
      const prior = history.get(key);
      if (!prior) {
        history.set(key, { ...entry });
        continue;
      }
      history.set(key, {
        ...prior,
        ...entry,
        firstSeenDate: [prior.firstSeenDate, entry.firstSeenDate].filter(Boolean).sort()[0] || entry.firstSeenDate,
        plotPickleDecision: prior.plotPickleDecision && prior.plotPickleDecision !== "unreviewed"
          ? prior.plotPickleDecision
          : entry.plotPickleDecision || "unreviewed",
      });
    }
  }
  return history;
}

export function reconstructCandidateHistory(comments, { beforeDate, retentionDays = HISTORY_RETENTION_DAYS } = {}) {
  const history = new Map();
  for (const state of statesBefore(comments, beforeDate, retentionDays)) {
    for (const entry of Array.isArray(state.candidates) ? state.candidates : []) {
      if (!entry?.repositoryStableId) continue;
      const key = String(entry.repositoryStableId);
      const prior = history.get(key);
      if (!prior) {
        history.set(key, { ...entry });
        continue;
      }
      history.set(key, {
        ...prior,
        ...entry,
        firstSeenDate: [prior.firstSeenDate, entry.firstSeenDate].filter(Boolean).sort()[0] || entry.firstSeenDate,
        lastSeenDate: [prior.lastSeenDate, entry.lastSeenDate].filter(Boolean).sort().at(-1) || entry.lastSeenDate,
      });
    }
  }
  return history;
}

function categorySignature(values) {
  return sortedUnique(values).join("|");
}

function meaningfulMarker(candidate) {
  return candidate?.pushedAt || candidate?.updatedAt || null;
}

function candidateQualification(candidate) {
  if (candidate?.reviewQualification) return String(candidate.reviewQualification);
  const qualified = candidate?.license?.status === "unknown"
    ? Boolean(candidate?.watchEvidenceEligible)
    : Boolean(candidate?.surfaceEligible);
  return qualified ? "qualified" : "below-threshold";
}

export function candidateLedgerEntry(candidate, reportDate, prior = null) {
  return {
    repositoryStableId: String(candidate.repositoryStableId),
    fullName: candidate.fullName,
    firstSeenDate: prior?.firstSeenDate || utcDate(reportDate),
    lastSeenDate: utcDate(reportDate),
    lastMeaningfulMarker: meaningfulMarker(candidate),
    latestScore: Number(candidate?.score || 0),
    latestQualification: candidateQualification(candidate),
  };
}

export function candidateRadarStatus(candidate, history = new Map(), reportDate = new Date()) {
  const prior = history.get(String(candidate?.repositoryStableId));
  if (!prior) {
    return {
      category: "first-seen-today",
      label: "first seen by Radar today",
      firstSeenDate: utcDate(reportDate),
      lastSeenDate: null,
    };
  }
  const yesterday = previousUtcDate(reportDate);
  const seenYesterday = prior.lastSeenDate === yesterday;
  return {
    category: seenYesterday ? "seen-yesterday" : "seen-before-yesterday",
    label: seenYesterday ? "seen by Radar yesterday" : "seen by Radar before yesterday",
    firstSeenDate: prior.firstSeenDate || null,
    lastSeenDate: prior.lastSeenDate || null,
  };
}

export function summarizeCandidateHistory(candidates = [], history = new Map(), reportDate = new Date()) {
  const summary = { firstSeenToday: 0, seenYesterday: 0, seenBeforeYesterday: 0 };
  for (const candidate of candidates) {
    const status = candidateRadarStatus(candidate, history, reportDate);
    if (status.category === "first-seen-today") summary.firstSeenToday += 1;
    else if (status.category === "seen-yesterday") summary.seenYesterday += 1;
    else summary.seenBeforeYesterday += 1;
  }
  return summary;
}

export function reconstructQueryEffectiveness(comments, { beforeDate, retentionDays = HISTORY_RETENTION_DAYS } = {}) {
  const history = new Map();
  for (const state of statesBefore(comments, beforeDate, retentionDays)) {
    const entries = Array.isArray(state.queryEffectiveness)
      ? state.queryEffectiveness
      : Array.isArray(state?.discoveryCoverage?.queryEffectiveness)
        ? state.discoveryCoverage.queryEffectiveness
        : [];
    for (const entry of entries) {
      if (!entry?.queryId) continue;
      const prior = history.get(entry.queryId) || {
        queryId: entry.queryId,
        laneId: entry.laneId,
        familyId: entry.familyId,
        query: entry.query,
        runsObserved: 0,
        rawPointerCount: 0,
        retainedCandidateCount: 0,
        enrichmentShortlistCount: 0,
        topFiveCount: 0,
      };
      history.set(entry.queryId, {
        ...prior,
        laneId: entry.laneId || prior.laneId,
        familyId: entry.familyId || prior.familyId,
        query: entry.query || prior.query,
        runsObserved: prior.runsObserved + 1,
        rawPointerCount: prior.rawPointerCount + Number(entry.rawPointerCount || 0),
        retainedCandidateCount: prior.retainedCandidateCount + Number(entry.retainedCandidateCount || 0),
        enrichmentShortlistCount: prior.enrichmentShortlistCount + Number(entry.enrichmentShortlistCount || 0),
        topFiveCount: prior.topFiveCount + Number(entry.topFiveCount || 0),
      });
    }
  }
  return history;
}

export function accumulateQueryEffectiveness(current = [], history = new Map()) {
  return current.map((entry) => {
    const prior = history.get(entry.queryId);
    return {
      ...entry,
      runsObserved: Number(prior?.runsObserved || 0) + 1,
      cumulativeRawPointerCount: Number(prior?.rawPointerCount || 0) + Number(entry.rawPointerCount || 0),
      cumulativeRetainedCandidateCount: Number(prior?.retainedCandidateCount || 0) + Number(entry.retainedCandidateCount || 0),
      cumulativeEnrichmentShortlistCount: Number(prior?.enrichmentShortlistCount || 0) + Number(entry.enrichmentShortlistCount || 0),
      cumulativeTopFiveCount: Number(prior?.topFiveCount || 0) + Number(entry.topFiveCount || 0),
    };
  });
}

export function shouldResurface(candidate, prior, reportDate, options = {}) {
  if (!prior) return { allowed: true, reason: "not-reviewed" };
  const previousQualification = String(prior?.previousQualification || "qualified");
  const currentQualification = String(candidate?.reviewQualification || "qualified");
  if (previousQualification !== currentQualification) return { allowed: true, reason: "qualification-change" };
  const cooldown = options.cooldownDays ?? REVISIT_COOLDOWN_DAYS;
  const scoreDelta = options.materialScoreDelta ?? MATERIAL_SCORE_DELTA;
  if (categorySignature(laneCategories(candidate)) !== categorySignature(prior.internalCategories || [])) {
    return { allowed: true, reason: "category-change" };
  }
  const previousScore = Number(prior?.previousScoreEvidence?.finalScore);
  const currentScore = Number(candidate?.score);
  if (Number.isFinite(previousScore) && Number.isFinite(currentScore) && Math.abs(currentScore - previousScore) >= scoreDelta) {
    return { allowed: true, reason: "score-change" };
  }
  const elapsed = daysBetween(prior.lastReviewedDate, reportDate);
  const markerChanged = Boolean(meaningfulMarker(candidate)) && meaningfulMarker(candidate) !== prior.lastMeaningfulMarker;
  if (markerChanged && elapsed >= cooldown) return { allowed: true, reason: "activity-after-cooldown" };
  return { allowed: false, reason: elapsed < cooldown ? "recently-reviewed" : "no-material-change" };
}

export function historyEntryForFinding(candidate, reportDate, prior = null) {
  return {
    repositoryStableId: String(candidate.repositoryStableId),
    fullName: candidate.fullName,
    firstSeenDate: prior?.firstSeenDate || utcDate(reportDate),
    lastReviewedDate: utcDate(reportDate),
    lastMeaningfulMarker: meaningfulMarker(candidate),
    previousDisposition: candidate.primaryDisposition || "WATCH",
    previousQualification: candidate.reviewQualification || "qualified",
    internalCategories: laneCategories(candidate),
    previousScoreEvidence: {
      finalScore: Number(candidate.score || 0),
      reasonCodes: sortedUnique(candidate?.scoreEvidence?.reasonCodes || []),
      matchedLaneIds: sortedUnique(candidate?.matchedLaneIds || []),
    },
    plotPickleDecision: prior?.plotPickleDecision || "unreviewed",
  };
}
