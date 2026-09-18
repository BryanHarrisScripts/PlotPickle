import { pathToFileURL } from "node:url";
import { discoverGitHubRepositories, loadDiscoveryContract } from "./discover-github.mjs";
import {
  HISTORY_RETENTION_DAYS,
  accumulateQueryEffectiveness,
  candidateLedgerEntry,
  candidateRadarStatus,
  reconstructCandidateHistory,
  reconstructHistory,
  reconstructQueryEffectiveness,
  summarizeCandidateHistory,
  utcDate,
} from "./history.mjs";
import { listIssueComments, publishDailyRadar, searchRadarIssues } from "./issue-lifecycle.mjs";
import {
  buildRadarState,
  historiesFromRadarState,
  loadRadarState,
  mergeCandidateHistory,
  mergeReviewHistory,
  queryHistoryFromAccumulated,
  writeRadarState,
} from "./state-store.mjs";

function recentRadarIssue(issue, now) {
  if (!issue?.created_at) return true;
  const created = new Date(issue.created_at);
  if (Number.isNaN(created.getTime())) return true;
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_RETENTION_DAYS - 31);
  return created >= cutoff;
}

async function loadLegacyRadarHistory({ repository, auth, fetchImpl, now }) {
  if (!repository || !auth) {
    return {
      reviewHistory: new Map(),
      candidateHistory: new Map(),
      queryEffectivenessHistory: new Map(),
    };
  }
  const comments = [];
  const issues = await searchRadarIssues({ repository, auth, fetchImpl });
  for (const issue of issues.filter((item) => recentRadarIssue(item, now))) {
    comments.push(...await listIssueComments({ repository, issueNumber: issue.number, auth, fetchImpl }));
  }
  const options = { beforeDate: utcDate(now) };
  return {
    reviewHistory: reconstructHistory(comments, options),
    candidateHistory: reconstructCandidateHistory(comments, options),
    queryEffectivenessHistory: reconstructQueryEffectiveness(comments, options),
  };
}

function defaultStateAdapter() {
  return {
    load: loadRadarState,
    save: writeRadarState,
  };
}

async function resolveRadarHistories({
  repository,
  auth,
  fetchImpl,
  now,
  stateAdapter,
}) {
  const reportDate = utcDate(now);
  const stored = await stateAdapter.load({ repository, auth, fetchImpl });
  if (stored?.state) {
    return {
      ...historiesFromRadarState(stored.state, { reportDate }),
      source: "state-branch",
      migrated: false,
      stored,
    };
  }
  const legacy = await loadLegacyRadarHistory({ repository, auth, fetchImpl, now });
  return {
    ...legacy,
    source: "legacy-comments",
    migrated: true,
    stored: null,
  };
}

function mergeQueryHistory(prior, accumulatedEntries) {
  const result = new Map(prior);
  for (const [key, value] of queryHistoryFromAccumulated(accumulatedEntries)) result.set(key, value);
  return result;
}

export async function runRadar({
  repository = process.env.GITHUB_REPOSITORY,
  auth = process.env.GITHUB_TOKEN,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  discoveryResult = null,
  stateAdapter = null,
} = {}) {
  const contract = await loadDiscoveryContract();
  const adapter = stateAdapter || defaultStateAdapter();
  const discovery = discoveryResult || await discoverGitHubRepositories({
    contract,
    token: auth,
    fetchImpl,
    now,
  });

  const histories = await resolveRadarHistories({
    repository,
    auth,
    fetchImpl,
    now,
    stateAdapter: adapter,
  });
  const queryEffectiveness = accumulateQueryEffectiveness(
    discovery.queryEffectiveness || discovery?.discoveryCoverage?.queryEffectiveness || [],
    histories.queryEffectivenessHistory,
  );
  const runtimeDiscovery = {
    ...discovery,
    queryEffectiveness,
    discoveryCoverage: {
      ...(discovery.discoveryCoverage || {}),
      queryEffectiveness,
    },
  };
  const candidateHistorySummary = summarizeCandidateHistory(runtimeDiscovery.candidates, histories.candidateHistory, now);
  const candidateLedger = runtimeDiscovery.candidates.map((candidate) =>
    candidateLedgerEntry(candidate, now, histories.candidateHistory.get(String(candidate.repositoryStableId)))
  );
  const candidates = runtimeDiscovery.candidates.map((candidate) => ({
    ...candidate,
    radarHistory: candidateRadarStatus(candidate, histories.candidateHistory, now),
  }));

  contract.runtimeRadar = {
    discovery: runtimeDiscovery,
    candidateHistorySummary,
    candidateLedger,
    stateSource: histories.source,
  };

  const published = await publishDailyRadar({
    repository,
    auth,
    contract,
    discoveryResult: { ...runtimeDiscovery, candidates },
    history: histories.reviewHistory,
    fetchImpl,
    now,
  });

  const nextReviewHistory = mergeReviewHistory(histories.reviewHistory, published.state.entries);
  const nextCandidateHistory = mergeCandidateHistory(histories.candidateHistory, candidateLedger);
  const nextQueryHistory = mergeQueryHistory(histories.queryEffectivenessHistory, queryEffectiveness);
  const machineState = buildRadarState({
    reportDate: published.reportDate,
    reviewHistory: nextReviewHistory,
    candidateHistory: nextCandidateHistory,
    queryEffectivenessHistory: nextQueryHistory,
    baselineHistories: {
      reviewHistory: histories.reviewHistory,
      candidateHistory: histories.candidateHistory,
      queryEffectivenessHistory: histories.queryEffectivenessHistory,
    },
    lastReport: {
      reportDate: published.reportDate,
      monthlyIssueNumber: published.monthlyIssueNumber,
      commentId: published.commentId,
      reportUrl: published.reportUrl,
      reviewCount: published.reviewCount,
      reviewTarget: published.reviewTarget,
    },
  });
  const stateWrite = await adapter.save({
    repository,
    auth,
    fetchImpl,
    state: machineState,
    message: `OSS Radar state ${published.reportDate}`,
  });

  return {
    ...published,
    discovery: runtimeDiscovery,
    machineState,
    stateStorage: {
      source: histories.source,
      migratedFromLegacyComments: histories.migrated,
      branch: stateWrite?.branch || histories.stored?.branch || null,
      path: stateWrite?.path || histories.stored?.path || null,
      commitSha: stateWrite?.commitSha || null,
    },
  };
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  runRadar()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
