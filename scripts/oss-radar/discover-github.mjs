import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  buildGitHubSearchUrl,
  evaluateCandidates,
  normalizeRepository,
} from "./discovery-core.mjs";

const CONTRACT_URL = new URL("../../config/oss-radar/discovery-contract.json", import.meta.url);

export async function loadDiscoveryContract() {
  return JSON.parse(await readFile(CONTRACT_URL, "utf8"));
}

function enabledQueries(contract) {
  return (contract.lanes || [])
    .filter((lane) => lane.enabled)
    .flatMap((lane) => (lane.queries || []).map((query) => ({ laneId: lane.id, query })));
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

  for (const entry of queries) {
    const url = buildGitHubSearchUrl({
      query: entry.query,
      defaults: contract.queryDefaults,
      now,
      perPage: perQuery,
    });
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
  return {
    issue: contract.issue,
    contractSchemaVersion: contract.schemaVersion,
    discoveredAt: new Date(now).toISOString(),
    enabledLaneCount: (contract.lanes || []).filter((lane) => lane.enabled).length,
    queryCount: queries.length,
    rawResultCount,
    uniqueCandidateCount: evaluated.retained.length + evaluated.rejected.length,
    retainedCount: evaluated.retained.length,
    rejectedCount: evaluated.rejected.length,
    rejectionReasons: evaluated.rejectionReasons,
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
