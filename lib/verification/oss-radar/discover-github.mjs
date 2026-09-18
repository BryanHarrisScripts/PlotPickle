import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { enrichRepositoryShortlist } from "./enrichment.mjs";
import { buildGitHubSearchUrl, normalizeRepository } from "./query-normalization.mjs";
import { evaluateCandidates, rankCandidates, scoreCandidate } from "./scoring.mjs";

const CONTRACT_URL = new URL("../../../config/oss-radar/discovery-contract.json", import.meta.url);
const ADAPTIVE_URL = new URL("../../../config/oss-radar/adaptive-intelligence.json", import.meta.url);

function mergeAdaptiveContract(base, adaptive) {
  if (!adaptive || adaptive?.selectionMode !== "architecture-7x3") return base;
  const extraFamilies = new Map();
  for (const family of adaptive.additionalQueryFamilies || []) {
    const list = extraFamilies.get(family.laneId) || [];
    list.push({
      id: family.id,
      label: family.label,
      queries: [...(family.queries || [])],
    });
    extraFamilies.set(family.laneId, list);
  }
  const lanes = (base.lanes || []).map((lane) => ({
    ...lane,
    queryFamilies: [
      ...(lane.queryFamilies || []),
      ...(extraFamilies.get(lane.id) || []),
    ],
  }));
  return {
    ...base,
    issue: adaptive.issue || base.issue,
    recallContractVersion: Math.max(Number(base.recallContractVersion || 1), 2),
    selectionMode: adaptive.selectionMode,
    architectureAreas: adaptive.architectureAreas || [],
    priorityProfile: adaptive.priorityProfile || {},
    lanes,
    report: {
      ...(base.report || {}),
      ...(adaptive.report || {}),
    },
    discoveryBudget: {
      ...(base.discoveryBudget || {}),
      ...(adaptive.discoveryBudget || {}),
    },
    scoring: {
      ...(base.scoring || {}),
      weights: {
        ...(base.scoring?.weights || {}),
        ...(adaptive.scoringWeights || {}),
      },
    },
    enrichment: {
      ...(base.enrichment || {}),
      evidenceConcepts: [
        ...(base.enrichment?.evidenceConcepts || []),
        ...(adaptive.additionalEvidenceConcepts || []),
      ],
    },
    adaptiveIntelligenceIssue: adaptive.issue || 2194,
  };
}

export async function loadDiscoveryContract() {
  const base = JSON.parse(await readFile(CONTRACT_URL, "utf8"));
  try {
    const adaptive = JSON.parse(await readFile(ADAPTIVE_URL, "utf8"));
    return mergeAdaptiveContract(base, adaptive);
  } catch {
    return base;
  }
}

export function configuredQueries(contract) {
  return (contract?.lanes || [])
    .filter((lane) => lane.enabled)
    .flatMap((lane) => (lane.queryFamilies || []).flatMap((family) =>
      (family.queries || []).map((query, index) => ({
        queryId: `${lane.id}/${family.id}/${String(index + 1).padStart(2, "0")}`,
        laneId: lane.id,
        familyId: family.id,
        familyLabel: family.label,
        query: String(query).trim(),
      }))
    ))
    .filter((entry) => entry.query);
}

function responseHeader(response, name) {
  if (!response?.headers) return null;
  if (typeof response.headers.get === "function") return response.headers.get(name);
  const lower = String(name).toLowerCase();
  return response.headers[name] ?? response.headers[lower] ?? null;
}

function isRateLimitFailure(status, message) {
  return (Number(status) === 403 || Number(status) === 429)
    && /rate limit|secondary rate limit|abuse detection/iu.test(String(message || ""));
}

function boundedRateLimitWaitMs(response, {
  fallbackWaitMs,
  maxWaitMs,
  nowMs,
}) {
  const retryAfter = Number(responseHeader(response, "retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(maxWaitMs, Math.max(0, Math.round(retryAfter * 1000)));
  }
  const resetSeconds = Number(responseHeader(response, "x-ratelimit-reset"));
  if (Number.isFinite(resetSeconds) && resetSeconds > 0) {
    const wait = Math.max(1000, Math.round((resetSeconds * 1000) - nowMs + 1000));
    return Math.min(maxWaitMs, wait);
  }
  return Math.min(maxWaitMs, Math.max(0, fallbackWaitMs));
}

async function fetchGitHubSearchWithRetry({
  url,
  options,
  entry,
  fetchImpl,
  sleepImpl,
  nowMsImpl,
  maxRetries,
  fallbackWaitMs,
  maxWaitMs,
}) {
  let retryCount = 0;
  let waitMs = 0;

  while (true) {
    const response = await fetchImpl(url, options);
    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    if (response?.ok) return { payload, retryCount, waitMs };

    const message = payload?.message || "";
    const rateLimited = isRateLimitFailure(response?.status, message);
    if (rateLimited && retryCount < maxRetries) {
      const delay = boundedRateLimitWaitMs(response, {
        fallbackWaitMs,
        maxWaitMs,
        nowMs: nowMsImpl(),
      });
      retryCount += 1;
      waitMs += delay;
      await sleepImpl(delay);
      continue;
    }

    const detail = message ? `: ${message}` : "";
    throw new Error(`OSS Radar GitHub search failed for ${entry.queryId} with HTTP ${response?.status ?? "unknown"}${detail}`);
  }
}

function utcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function previousUtcDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function creationAgeBuckets(candidates, now) {
  const today = utcDate(now);
  const yesterday = previousUtcDate(now);
  const result = { today: 0, yesterday: 0, earlier: 0, unknown: 0 };
  for (const candidate of candidates) {
    const created = utcDate(candidate?.createdAt);
    if (!created) result.unknown += 1;
    else if (created === today) result.today += 1;
    else if (created === yesterday) result.yesterday += 1;
    else result.earlier += 1;
  }
  return result;
}

function rejectionSummary(rejected) {
  const reasons = {};
  for (const candidate of rejected || []) {
    for (const reason of candidate?.filter?.reasons || []) reasons[reason] = (reasons[reason] || 0) + 1;
  }
  return reasons;
}

function uniqueLaneCounts(candidates) {
  const counts = {};
  for (const candidate of candidates || []) {
    for (const laneId of candidate.matchedLaneIds || []) counts[laneId] = (counts[laneId] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function hasQuery(candidate, queryId) {
  return (candidate?.matchedQueryRefs || []).some((entry) => entry.id === queryId);
}

function effectivenessFor(entries, rawCounts, retained, shortlist, selected) {
  return entries.map((entry) => {
    const selectedFindingCount = selected.filter((candidate) => hasQuery(candidate, entry.queryId)).length;
    return {
      queryId: entry.queryId,
      laneId: entry.laneId,
      familyId: entry.familyId,
      query: entry.query,
      rawPointerCount: Number(rawCounts.get(entry.queryId) || 0),
      retainedCandidateCount: retained.filter((candidate) => hasQuery(candidate, entry.queryId)).length,
      enrichmentShortlistCount: shortlist.filter((candidate) => hasQuery(candidate, entry.queryId)).length,
      selectedFindingCount,
      topFiveCount: selectedFindingCount,
    };
  });
}

function laneBalancedShortlist(candidates, contract, limit) {
  if (!contract?.discoveryBudget?.laneBalancedEnrichment) return candidates.slice(0, limit);
  const laneIds = (contract?.lanes || []).filter((lane) => lane.enabled).map((lane) => lane.id);
  const selected = [];
  const used = new Set();
  let progress = true;
  let round = 0;

  while (selected.length < limit && progress) {
    progress = false;
    for (const laneId of laneIds) {
      const matches = candidates.filter((candidate) =>
        !used.has(String(candidate.repositoryStableId))
        && (candidate.matchedLaneIds || []).includes(laneId)
      );
      const candidate = matches[round];
      if (!candidate) continue;
      selected.push(candidate);
      used.add(String(candidate.repositoryStableId));
      progress = true;
      if (selected.length >= limit) break;
    }
    round += 1;
  }

  if (selected.length < limit) {
    for (const candidate of candidates) {
      const id = String(candidate.repositoryStableId);
      if (used.has(id)) continue;
      selected.push(candidate);
      used.add(id);
      if (selected.length >= limit) break;
    }
  }

  return selected;
}

function enrichmentFailureSummary(enriched) {
  const reasons = {};
  for (const candidate of enriched || []) {
    for (const sourceName of ["readme", "manifest"]) {
      const source = candidate?.enrichment?.[sourceName];
      if (!source || source.status === "success" || source.status === "not-configured") continue;
      const key = `${sourceName}:${source.status}`;
      reasons[key] = (reasons[key] || 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(reasons).sort(([left], [right]) => left.localeCompare(right)));
}

function diagnosticFor(targetFullName, normalized, preliminary, finalCandidates) {
  if (!targetFullName) return null;
  const expected = String(targetFullName).trim().toLowerCase();
  const raw = normalized.find((candidate) => candidate.fullName.toLowerCase() === expected) || null;
  const retained = preliminary.retained.find((candidate) => candidate.fullName.toLowerCase() === expected) || null;
  const rejected = preliminary.rejected.find((candidate) => candidate.fullName.toLowerCase() === expected) || null;
  const final = finalCandidates.find((candidate) => candidate.fullName.toLowerCase() === expected) || null;
  return {
    targetFullName,
    seenInRawDiscovery: Boolean(raw),
    retainedAfterHardRejection: Boolean(retained),
    rejectionReasons: rejected?.filter?.reasons || [],
    matchedLaneIds: raw?.matchedLaneIds || [],
    matchedQueries: raw?.matchedQueries || [],
    discoveryRank: retained ? preliminary.retained.findIndex((candidate) => candidate.repositoryStableId === retained.repositoryStableId) + 1 : null,
    finalRank: final ? finalCandidates.findIndex((candidate) => candidate.repositoryStableId === final.repositoryStableId) + 1 : null,
    enrichmentAttempted: Boolean(final?.enrichment?.attempted),
    evidenceConcepts: (final?.enrichment?.evidenceConcepts || []).map((entry) => entry.id),
    liveSearchIsAuthoritativeCiEvidence: false,
  };
}

export async function discoverGitHubRepositories({
  contract,
  token,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  perQuery,
  rawResultBudget,
  enrichmentShortlistSize,
  enrich = true,
  diagnosticTargetFullName = "",
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  nowMsImpl = Date.now,
} = {}) {
  if (!contract) throw new Error("OSS Radar discovery contract is required.");
  if (!token || !String(token).trim()) throw new Error("OSS Radar live discovery requires GITHUB_TOKEN.");
  if (typeof fetchImpl !== "function") throw new Error("OSS Radar discovery requires a fetch implementation.");

  const queries = configuredQueries(contract);
  const configuredCap = Math.min(50, Math.max(1, Number(contract?.discoveryBudget?.perQueryResultCap || 20)));
  const configuredRawBudget = Math.max(1, Number(contract?.discoveryBudget?.rawResultBudget || 500));
  const configuredShortlist = Math.max(0, Number(contract?.discoveryBudget?.enrichmentShortlistSize || 25));
  const configuredSearchInterval = Math.max(0, Number(contract?.discoveryBudget?.searchMinIntervalMs || 0));
  const configuredRateLimitRetries = Math.max(0, Number(contract?.discoveryBudget?.searchRateLimitRetries || 0));
  const configuredRateLimitFallbackWait = Math.max(0, Number(contract?.discoveryBudget?.searchRateLimitFallbackWaitMs || 60_000));
  const configuredRateLimitMaxWait = Math.max(configuredRateLimitFallbackWait, Number(contract?.discoveryBudget?.searchRateLimitMaxWaitMs || 90_000));
  const queryResultCap = Math.min(configuredCap, Math.max(1, Number(perQuery ?? configuredCap)));
  const maximumRawPointers = Math.min(configuredRawBudget, Math.max(1, Number(rawResultBudget ?? configuredRawBudget)));
  const shortlistLimit = Math.min(configuredShortlist, Math.max(0, Number(enrichmentShortlistSize ?? configuredShortlist)));
  const normalized = [];
  const executedQueries = [];
  const rawCounts = new Map();
  let rawResultCount = 0;
  let searchRequestCount = 0;
  let searchPacingWaitMs = 0;
  let rateLimitRetryCount = 0;
  let rateLimitWaitMs = 0;
  const liveSearchIntervalMs = fetchImpl === globalThis.fetch ? configuredSearchInterval : 0;

  for (const entry of queries) {
    const remaining = maximumRawPointers - rawResultCount;
    if (remaining <= 0) break;
    const requestCap = Math.min(queryResultCap, remaining);
    const url = buildGitHubSearchUrl({ query: entry.query, defaults: contract.queryDefaults, now, perPage: requestCap });

    if (searchRequestCount > 0 && liveSearchIntervalMs > 0) {
      await sleepImpl(liveSearchIntervalMs);
      searchPacingWaitMs += liveSearchIntervalMs;
    }

    const request = await fetchGitHubSearchWithRetry({
      url,
      options: {
        method: "GET",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${String(token).trim()}`,
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "PlotPickle-OSS-Radar",
        },
      },
      entry,
      fetchImpl,
      sleepImpl,
      nowMsImpl,
      maxRetries: configuredRateLimitRetries,
      fallbackWaitMs: configuredRateLimitFallbackWait,
      maxWaitMs: configuredRateLimitMaxWait,
    });
    searchRequestCount += 1;
    rateLimitRetryCount += request.retryCount;
    rateLimitWaitMs += request.waitMs;

    const payload = request.payload;
    const items = (Array.isArray(payload?.items) ? payload.items : []).slice(0, requestCap);
    rawCounts.set(entry.queryId, items.length);
    executedQueries.push(entry);
    rawResultCount += items.length;
    for (const item of items) normalized.push(normalizeRepository(item, entry));
  }

  const preliminary = evaluateCandidates(normalized, contract, now, { stage: "discovery" });
  const uniqueCandidates = [...preliminary.retained, ...preliminary.rejected];
  const shortlist = enrich && contract?.enrichment?.enabled !== false
    ? laneBalancedShortlist(preliminary.retained, contract, shortlistLimit)
    : [];
  const enrichedShortlist = await enrichRepositoryShortlist(shortlist, { contract, token, fetchImpl });
  const enrichedById = new Map(enrichedShortlist.map((candidate) => [String(candidate.repositoryStableId), candidate]));
  const finalRetained = rankCandidates(preliminary.retained.map((candidate) => {
    const enrichedCandidate = enrichedById.get(String(candidate.repositoryStableId));
    if (!enrichedCandidate) return candidate;
    if (!enrichedCandidate.enrichment?.evidenceAvailable) return enrichedCandidate;
    return scoreCandidate(enrichedCandidate, contract, now, { stage: "enriched" });
  }));
  const reviewCount = Math.max(0, Number(contract?.discoveryBudget?.finalReviewCount || contract?.report?.targetFindings || 5));
  const provisionalSelected = finalRetained.slice(0, reviewCount);
  const queryEffectiveness = effectivenessFor(executedQueries, rawCounts, finalRetained, shortlist, provisionalSelected);
  const readmeSuccesses = enrichedShortlist.filter((candidate) => candidate.enrichment?.readme?.status === "success").length;
  const readmeFailures = enrichedShortlist.length - readmeSuccesses;
  const rescoredCount = finalRetained.filter((candidate) => candidate.scoreStage === "enriched").length;
  const lanesRepresented = [...new Set(uniqueCandidates.flatMap((candidate) => candidate.matchedLaneIds || []))].sort();
  const familyRefs = [...new Set(executedQueries.map((entry) => `${entry.laneId}/${entry.familyId}`))].sort();
  const discoveryCoverage = {
    queriesExecuted: executedQueries.map((entry) => ({
      queryId: entry.queryId,
      laneId: entry.laneId,
      familyId: entry.familyId,
      query: entry.query,
    })),
    queryFamiliesRepresented: familyRefs,
    lanesRepresented,
    uniqueCandidatesPerLane: uniqueLaneCounts(uniqueCandidates),
    candidatesMatchingMultipleLanes: uniqueCandidates.filter((candidate) => (candidate.matchedLaneIds || []).length > 1).length,
    enrichmentShortlistSize: enrichedShortlist.length,
    laneBalancedEnrichment: Boolean(contract?.discoveryBudget?.laneBalancedEnrichment),
    readmeRetrievalSuccesses: readmeSuccesses,
    readmeRetrievalFailures: readmeFailures,
    enrichmentFailuresByReason: enrichmentFailureSummary(enrichedShortlist),
    candidatesRescoredAfterEnrichment: rescoredCount,
    queryEffectiveness,
    searchMinIntervalMs: liveSearchIntervalMs,
    searchPacingWaitMs,
    rateLimitRetryCount,
    rateLimitWaitMs,
  };

  return {
    issue: contract.issue,
    recallIssue: 2034,
    adaptiveIntelligenceIssue: contract.adaptiveIntelligenceIssue || null,
    contractSchemaVersion: contract.schemaVersion,
    recallContractVersion: contract.recallContractVersion,
    discoveredAt: new Date(now).toISOString(),
    enabledLaneCount: (contract.lanes || []).filter((lane) => lane.enabled).length,
    architectureAreaCount: (contract.architectureAreas || []).length,
    queryCount: queries.length,
    executedQueryCount: executedQueries.length,
    perQueryResultCap: queryResultCap,
    rawResultBudget: maximumRawPointers,
    theoreticalMaxRawPointers: queries.length * queryResultCap,
    effectiveMaxRawPointers: Math.min(queries.length * queryResultCap, maximumRawPointers),
    searchMinIntervalMs: liveSearchIntervalMs,
    searchPacingWaitMs,
    rateLimitRetryCount,
    rateLimitWaitMs,
    rawResultCount,
    uniqueCandidateCount: uniqueCandidates.length,
    retainedCount: finalRetained.length,
    rejectedCount: preliminary.rejected.length,
    rejectionReasons: rejectionSummary(preliminary.rejected),
    creationAge: creationAgeBuckets(uniqueCandidates, now),
    discoveryCoverage,
    queryEffectiveness,
    candidates: finalRetained,
    diagnostic: diagnosticFor(diagnosticTargetFullName, normalized, preliminary, finalRetained),
  };
}

export async function diagnoseGitHubRepository({
  contract,
  token,
  fullName,
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  const result = await discoverGitHubRepositories({
    contract,
    token,
    fetchImpl,
    now,
    diagnosticTargetFullName: fullName,
  });
  return {
    diagnostic: result.diagnostic,
    discoveryCoverage: result.discoveryCoverage,
    rawResultCount: result.rawResultCount,
    rawResultBudget: result.rawResultBudget,
  };
}

export async function runDiscoveryCli({ token = process.env.GITHUB_TOKEN, args = process.argv.slice(2) } = {}) {
  const contract = await loadDiscoveryContract();
  const diagnosticIndex = args.indexOf("--diagnose");
  const diagnosticTargetFullName = diagnosticIndex >= 0 ? String(args[diagnosticIndex + 1] || "").trim() : "";
  if (diagnosticIndex >= 0 && !diagnosticTargetFullName) throw new Error("OSS Radar --diagnose requires owner/repository.");
  const result = await discoverGitHubRepositories({ contract, token, diagnosticTargetFullName });
  const output = diagnosticTargetFullName
    ? {
      diagnostic: result.diagnostic,
      discoveryCoverage: result.discoveryCoverage,
      rawResultCount: result.rawResultCount,
      rawResultBudget: result.rawResultBudget,
    }
    : result;
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output;
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  runDiscoveryCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
