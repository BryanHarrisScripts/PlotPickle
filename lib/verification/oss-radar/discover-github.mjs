import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { buildGitHubSearchUrl, normalizeRepository } from "./query-normalization.mjs";
import { evaluateCandidates } from "./scoring.mjs";

const CONTRACT_URL = new URL("../../../config/oss-radar/discovery-contract.json", import.meta.url);

export async function loadDiscoveryContract() {
  return JSON.parse(await readFile(CONTRACT_URL, "utf8"));
}

function enabledQueries(contract) {
  return (contract.lanes || [])
    .filter((lane) => lane.enabled)
    .flatMap((lane) => (lane.queries || []).map((query) => ({ laneId: lane.id, query })));
}

function utcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function previousUtcDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
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

export async function discoverGitHubRepositories({
  contract,
  token,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  perQuery = 10,
} = {}) {
  if (!contract) throw new Error("OSS Radar discovery contract is required.");
  if (!token || !String(token).trim()) throw new Error("OSS Radar live discovery requires GITHUB_TOKEN.");
  if (typeof fetchImpl !== "function") throw new Error("OSS Radar discovery requires a fetch implementation.");

  const queries = enabledQueries(contract);
  const normalized = [];
  let rawResultCount = 0;
  const queryResultCap = Math.min(50, Math.max(1, Number(perQuery || 10)));

  for (const entry of queries) {
    const url = buildGitHubSearchUrl({ query: entry.query, defaults: contract.queryDefaults, now, perPage: queryResultCap });
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
      throw new Error(`OSS Radar GitHub search failed with HTTP ${response?.status ?? "unknown"}${detail}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.items) ? payload.items : [];
    rawResultCount += items.length;
    for (const item of items) normalized.push(normalizeRepository(item, entry));
  }

  const evaluated = evaluateCandidates(normalized, contract, now);
  const uniqueCandidates = [...evaluated.retained, ...evaluated.rejected];
  return {
    issue: contract.issue,
    contractSchemaVersion: contract.schemaVersion,
    discoveredAt: new Date(now).toISOString(),
    enabledLaneCount: (contract.lanes || []).filter((lane) => lane.enabled).length,
    queryCount: queries.length,
    perQueryResultCap: queryResultCap,
    theoreticalMaxRawPointers: queries.length * queryResultCap,
    rawResultCount,
    uniqueCandidateCount: uniqueCandidates.length,
    retainedCount: evaluated.retained.length,
    rejectedCount: evaluated.rejected.length,
    rejectionReasons: evaluated.rejectionReasons,
    creationAge: creationAgeBuckets(uniqueCandidates, now),
    candidates: evaluated.retained,
  };
}

export async function runDiscoveryCli({ token = process.env.GITHUB_TOKEN } = {}) {
  const contract = await loadDiscoveryContract();
  const result = await discoverGitHubRepositories({ contract, token });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result;
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  runDiscoveryCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
