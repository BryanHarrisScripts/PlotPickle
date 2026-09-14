import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { enrichRepositoryShortlist } from "./enrichment.mjs";
import { buildGitHubSearchUrl, normalizeRepository } from "./query-normalization.mjs";
import { evaluateCandidates, rankCandidates, scoreCandidate } from "./scoring.mjs";

const CONTRACT_URL = new URL("../../../config/oss-radar/discovery-contract.json", import.meta.url);

export async function loadDiscoveryContract() {
  return JSON.parse(await readFile(CONTRACT_URL, "utf8"));
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

function effectivenessFor(entries, rawCounts, retained, shortlist, topFive) {
  return entries.map((entry) => ({
    queryId: entry.queryId,
    laneId: entry.laneId,
    familyId: entry.familyId,
    query: entry.query,
    rawPointerCount: Number(rawCounts.get(entry.queryId) || 0),
    retainedCandidateCount: retained.filter((candidate) => hasQuery(candidate, entry.queryId)).length,
    enrichmentShortlistCount: shortlist.filter((candidate) => hasQuery(candidate, entry.queryId)).length,
    topFiveCount: topFive.filter((candidate) => hasQuery(candidate, entry.queryId)).length,
  }));
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
} = {}) {
  if (!contract) throw new Error("OSS Radar discovery contract is required.");
  if (!token || !String(token).trim()) throw new Error("OSS Radar live discovery requires GITHUB_TOKEN.");
  if (typeof fetchImpl !== "function") throw new Error("OSS Radar discovery requires a fetch implementation.");

  const queries = configuredQueries(contract);
  const configuredCap = Number(contract?.discoveryBudget?.perQueryResultCap || 20);
  const configuredRawBudget = Number(contract?.discoveryBudget?.rawResultBudget || 500);
  const configuredShortlist = Number(contract?.discoveryBudget?.enrichmentShortlistSize || 25);
  const queryResultCap = Math.min(50, Math.max(1, Number(perQuery ?? configuredCap)));
  const maximumRawPointers = Math.max(1, Number(rawResultBudget ?? configuredRawBudget));
  const shortlistLimit = Math.max(0, Number(enrichmentShortlistSize ?? configuredShortlist));
  const normalized = [];
  const executedQueries = [];
  const rawCounts = new Map();
  let rawResultCount = 0;

  for (const entry of queries) {
    const remaining = maximumRawPointers - rawResultCount;
    if (remaining <= 0) break;
    const requestCap = Math.min(queryResultCap, remaining);
    const url = buildGitHubSearchUrl({ query: entry.query, defaults: contract.queryDefaults, now, perPage: requestCap });
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${String(token).trim()}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "PlotPickle-OSS-Radar",
      },
    });

    if (!response?.ok) {
      let detail = "";
      try {
        const payload = await response.json();
        detail = payload?.message ? `: ${payload.message}` : "";
      } catch {
        detail = "";
      }
      throw new Error(`OSS Radar GitHub search failed for ${entry.queryId} with HTTP ${response?.status ?? "unknown"}${detail}`);
    }

    const payload = await response.json();
    const items = (Array.isArray(payload?.items) ? payload.items : []).slice(0, remaining);
    rawCounts.set(entry.queryId, items.length);
    executedQueries.push(entry);
    rawResultCount += items.length;
    for (const item of items) normalized.push(normalizeRepository(item, entry));
  }

  const preliminary = evaluateCandidates(normalized, contract, now, { stage: "discovery" });
  const uniqueCandidates = [...preliminary.retained, ...preliminary.rejected];
  const shortlist = enrich && contract?.enrichment?.enabled !== false
    ? preliminary.retained.slice(0, shortlistLimit)
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
  const topFive = finalRetained.slice(0, reviewCount);
  const queryEffectiveness = effectivenessFor(executedQueries, rawCounts, finalRetained, shortlist, topFive);
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
    readmeRetrievalSuccesses: readmeSuccesses,
    readmeRetrievalFailures: readmeFailures,
    enrichmentFailuresByReason: enrichmentFailureSummary(enrichedShortlist),
    candidatesRescoredAfterEnrichment: rescoredCount,
    queryEffectiveness,
  };

  return {
    issue: contract.issue,
    recallIssue: 2034,
    contractSchemaVersion: contract.schemaVersion,
    recallContractVersion: contract.recallContractVersion,
    discoveredAt: new Date(now).toISOString(),
    enabledLaneCount: (contract.lanes || []).filter((lane) => lane.enabled).length,
    queryCount: queries.length,
    executedQueryCount: executedQueries.length,
    perQueryResultCap: queryResultCap,
    rawResultBudget: maximumRawPointers,
    theoreticalMaxRawPointers: queries.length * queryResultCap,
    effectiveMaxRawPointers: Math.min(queries.length * queryResultCap, maximumRawPointers),
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
