import { pathToFileURL } from "node:url";
import { discoverGitHubRepositories, loadDiscoveryContract } from "./discover-github.mjs";
import {
  HISTORY_RETENTION_DAYS,
  accumulateQueryEffectiveness,
  candidateLedgerEntry,
  candidateRadarStatus,
  reconstructCandidateHistory,
  reconstructQueryEffectiveness,
  summarizeCandidateHistory,
  utcDate,
} from "./history.mjs";
import { listIssueComments, publishDailyRadar, searchRadarIssues } from "./issue-lifecycle.mjs";

function recentRadarIssue(issue, now) {
  if (!issue?.created_at) return true;
  const created = new Date(issue.created_at);
  if (Number.isNaN(created.getTime())) return true;
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_RETENTION_DAYS - 31);
  return created >= cutoff;
}

async function loadRadarHistory({ repository, auth, fetchImpl, now }) {
  if (!repository || !auth) return { candidateHistory: new Map(), queryEffectivenessHistory: new Map() };
  const comments = [];
  const issues = await searchRadarIssues({ repository, auth, fetchImpl });
  for (const issue of issues.filter((item) => recentRadarIssue(item, now))) {
    comments.push(...await listIssueComments({ repository, issueNumber: issue.number, auth, fetchImpl }));
  }
  const options = { beforeDate: utcDate(now) };
  return {
    candidateHistory: reconstructCandidateHistory(comments, options),
    queryEffectivenessHistory: reconstructQueryEffectiveness(comments, options),
  };
}

export async function runRadar({
  repository = process.env.GITHUB_REPOSITORY,
  auth = process.env.GITHUB_TOKEN,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  discoveryResult = null,
} = {}) {
  const contract = await loadDiscoveryContract();
  const discovery = discoveryResult || await discoverGitHubRepositories({
    contract,
    token: auth,
    fetchImpl,
    now,
  });

  const histories = await loadRadarHistory({ repository, auth, fetchImpl, now });
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
  };

  return publishDailyRadar({
    repository,
    auth,
    contract,
    discoveryResult: { ...runtimeDiscovery, candidates },
    fetchImpl,
    now,
  });
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
