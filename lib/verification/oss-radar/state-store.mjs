const API = "https://api.github.com";

export const RADAR_STATE_BRANCH = "oss-radar-state";
export const RADAR_STATE_PATH = ".oss-radar/state.json";
export const RADAR_STATE_SCHEMA_VERSION = 1;

function repoPath(repository) {
  if (!/^[^/]+\/[^/]+$/u.test(String(repository || ""))) throw new Error("OSS Radar state requires repository identity as owner/name.");
  return String(repository);
}

function headers(auth, hasBody = false) {
  const result = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PlotPickle-OSS-Radar",
  };
  if (auth) result.Authorization = `Bearer ${String(auth).trim()}`;
  if (hasBody) result["Content-Type"] = "application/json";
  return result;
}

async function requestJson(url, {
  auth,
  fetchImpl,
  method = "GET",
  body,
  allow404 = false,
} = {}) {
  const response = await fetchImpl(url, {
    method,
    headers: headers(auth, body !== undefined),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (allow404 && response?.status === 404) return null;
  if (!response?.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.message ? `: ${payload.message}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`OSS Radar state API failed with HTTP ${response?.status ?? "unknown"}${detail}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function decodeContent(payload) {
  if (!payload?.content) return null;
  const encoding = String(payload.encoding || "base64").toLowerCase();
  if (encoding !== "base64") throw new Error(`OSS Radar state file used unsupported encoding ${encoding}.`);
  return Buffer.from(String(payload.content).replace(/\n/gu, ""), "base64").toString("utf8");
}

function validState(value) {
  return value
    && value.schemaVersion === RADAR_STATE_SCHEMA_VERSION
    && Array.isArray(value.reviewHistory)
    && Array.isArray(value.candidateHistory)
    && Array.isArray(value.queryEffectivenessHistory);
}

export async function loadRadarState({
  repository,
  auth,
  fetchImpl = globalThis.fetch,
  branch = RADAR_STATE_BRANCH,
  path = RADAR_STATE_PATH,
} = {}) {
  if (!auth || !String(auth).trim()) throw new Error("OSS Radar state loading requires authentication.");
  const repo = repoPath(repository);
  const url = new URL(`${API}/repos/${repo}/contents/${path}`);
  url.searchParams.set("ref", branch);
  const payload = await requestJson(url.toString(), { auth, fetchImpl, allow404: true });
  if (!payload) return null;

  let state;
  try {
    state = JSON.parse(decodeContent(payload));
  } catch (error) {
    throw new Error(`OSS Radar state file is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!validState(state)) throw new Error("OSS Radar state file failed schema validation.");
  return {
    state,
    sha: payload.sha || null,
    branch,
    path,
  };
}

async function ensureStateBranch({ repository, auth, fetchImpl, branch }) {
  const repo = repoPath(repository);
  const refUrl = `${API}/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`;
  const existing = await requestJson(refUrl, { auth, fetchImpl, allow404: true });
  if (existing) return existing;

  const metadata = await requestJson(`${API}/repos/${repo}`, { auth, fetchImpl });
  const defaultBranch = String(metadata?.default_branch || "main");
  const baseRef = await requestJson(
    `${API}/repos/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    { auth, fetchImpl },
  );
  const baseSha = baseRef?.object?.sha;
  if (!baseSha) throw new Error("OSS Radar state branch creation could not resolve the default-branch SHA.");

  return requestJson(`${API}/repos/${repo}/git/refs`, {
    auth,
    fetchImpl,
    method: "POST",
    body: {
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    },
  });
}

export async function writeRadarState({
  repository,
  auth,
  state,
  fetchImpl = globalThis.fetch,
  branch = RADAR_STATE_BRANCH,
  path = RADAR_STATE_PATH,
  message,
} = {}) {
  if (!auth || !String(auth).trim()) throw new Error("OSS Radar state writing requires authentication.");
  if (!validState(state)) throw new Error("OSS Radar state writing requires a valid state snapshot.");

  const repo = repoPath(repository);
  await ensureStateBranch({ repository: repo, auth, fetchImpl, branch });
  const current = await loadRadarState({ repository: repo, auth, fetchImpl, branch, path });
  const url = `${API}/repos/${repo}/contents/${path}`;
  const payload = await requestJson(url, {
    auth,
    fetchImpl,
    method: "PUT",
    body: {
      message: message || `OSS Radar state ${state.lastReportDate || state.updatedAt || "update"}`,
      content: Buffer.from(`${JSON.stringify(state, null, 2)}\n`, "utf8").toString("base64"),
      branch,
      ...(current?.sha ? { sha: current.sha } : {}),
    },
  });
  return {
    branch,
    path,
    commitSha: payload?.commit?.sha || null,
    contentSha: payload?.content?.sha || null,
  };
}

function mapFromEntries(entries = []) {
  return new Map(entries
    .filter((entry) => entry?.repositoryStableId || entry?.queryId)
    .map((entry) => [String(entry.repositoryStableId || entry.queryId), { ...entry }]));
}

export function historiesFromRadarState(state) {
  if (!validState(state)) {
    return {
      reviewHistory: new Map(),
      candidateHistory: new Map(),
      queryEffectivenessHistory: new Map(),
    };
  }
  return {
    reviewHistory: mapFromEntries(state.reviewHistory),
    candidateHistory: mapFromEntries(state.candidateHistory),
    queryEffectivenessHistory: mapFromEntries(state.queryEffectivenessHistory),
  };
}

function sortMapValues(map, field) {
  return [...map.values()].sort((left, right) => String(left?.[field] || "").localeCompare(String(right?.[field] || "")));
}

function withinRetention(entry, dateField, reportDate, retentionDays) {
  const value = entry?.[dateField];
  if (!value) return true;
  const seen = new Date(`${value}T00:00:00Z`);
  const report = new Date(`${reportDate}T00:00:00Z`);
  if (Number.isNaN(seen.getTime()) || Number.isNaN(report.getTime())) return true;
  return (report.getTime() - seen.getTime()) <= retentionDays * 86_400_000;
}

export function buildRadarState({
  reportDate,
  reviewHistory = new Map(),
  candidateHistory = new Map(),
  queryEffectivenessHistory = new Map(),
  lastReport = null,
  retentionDays = 730,
} = {}) {
  const review = new Map(
    [...reviewHistory].filter(([, entry]) => withinRetention(entry, "lastReviewedDate", reportDate, retentionDays)),
  );
  const candidates = new Map(
    [...candidateHistory].filter(([, entry]) => withinRetention(entry, "lastSeenDate", reportDate, retentionDays)),
  );
  return {
    schemaVersion: RADAR_STATE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    lastReportDate: reportDate,
    reviewHistory: sortMapValues(review, "repositoryStableId"),
    candidateHistory: sortMapValues(candidates, "repositoryStableId"),
    queryEffectivenessHistory: sortMapValues(queryEffectivenessHistory, "queryId"),
    lastReport,
  };
}

export function mergeReviewHistory(history, entries = []) {
  const result = new Map(history);
  for (const entry of entries) {
    if (!entry?.repositoryStableId) continue;
    const key = String(entry.repositoryStableId);
    const prior = result.get(key);
    result.set(key, {
      ...(prior || {}),
      ...entry,
      firstSeenDate: [prior?.firstSeenDate, entry.firstSeenDate].filter(Boolean).sort()[0] || entry.firstSeenDate,
      plotPickleDecision: prior?.plotPickleDecision && prior.plotPickleDecision !== "unreviewed"
        ? prior.plotPickleDecision
        : entry.plotPickleDecision || "unreviewed",
    });
  }
  return result;
}

export function mergeCandidateHistory(history, entries = []) {
  const result = new Map(history);
  for (const entry of entries) {
    if (!entry?.repositoryStableId) continue;
    const key = String(entry.repositoryStableId);
    const prior = result.get(key);
    result.set(key, {
      ...(prior || {}),
      ...entry,
      firstSeenDate: [prior?.firstSeenDate, entry.firstSeenDate].filter(Boolean).sort()[0] || entry.firstSeenDate,
      lastSeenDate: [prior?.lastSeenDate, entry.lastSeenDate].filter(Boolean).sort().at(-1) || entry.lastSeenDate,
    });
  }
  return result;
}

export function queryHistoryFromAccumulated(entries = []) {
  return new Map(entries.filter((entry) => entry?.queryId).map((entry) => [
    entry.queryId,
    {
      queryId: entry.queryId,
      laneId: entry.laneId,
      familyId: entry.familyId,
      query: entry.query,
      runsObserved: Number(entry.runsObserved || 1),
      rawPointerCount: Number(entry.cumulativeRawPointerCount ?? entry.rawPointerCount ?? 0),
      retainedCandidateCount: Number(entry.cumulativeRetainedCandidateCount ?? entry.retainedCandidateCount ?? 0),
      enrichmentShortlistCount: Number(entry.cumulativeEnrichmentShortlistCount ?? entry.enrichmentShortlistCount ?? 0),
      topFiveCount: Number(entry.cumulativeTopFiveCount ?? entry.topFiveCount ?? 0),
    },
  ]));
}
