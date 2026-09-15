import { encodeDailyState, utcDate } from "./history.mjs";
import * as core from "./report-renderer-core.mjs";

export const monthlyIssueBody = core.monthlyIssueBody;
export const selectDailyFindings = core.selectDailyFindings;

function rejectionSummary(reasons = {}) {
  const entries = Object.entries(reasons).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([reason, count]) => `${reason}: ${count}`).join(", ") : "none";
}

function newestCreatedFirst(candidates = []) {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const leftTime = Date.parse(left.candidate?.createdAt || "");
      const rightTime = Date.parse(right.candidate?.createdAt || "");
      const leftValid = Number.isFinite(leftTime);
      const rightValid = Number.isFinite(rightTime);
      if (leftValid && rightValid && leftTime !== rightTime) return rightTime - leftTime;
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      return left.index - right.index;
    })
    .map(({ candidate }) => candidate);
}

function reviewHistoryLines(selection) {
  const queue = selection?.reviewQueue || [];
  if (!queue.length) return ["- No retained repository was available for Top 5 review."];
  return queue.map((candidate, index) => {
    const status = candidate?.radarHistory || {};
    const label = status.label || "Radar history unavailable";
    const firstSeen = status.firstSeenDate ? `; first seen ${status.firstSeenDate}` : "";
    return `- ${index + 1}. **${candidate.fullName}** — ${label}${firstSeen}`;
  });
}

function laneCoverageLines(coverage) {
  const entries = Object.entries(coverage?.uniqueCandidatesPerLane || {}).sort(([left], [right]) => left.localeCompare(right));
  return entries.length
    ? entries.map(([laneId, count]) => `- **${laneId}:** ${Number(count || 0)} unique candidates`)
    : ["- No candidate lane coverage was recorded."];
}

function queryEffectivenessLines(entries) {
  if (!entries?.length) return ["- No query-effectiveness evidence was recorded."];
  return entries.map((entry) =>
    `- **${entry.query}** (${entry.laneId}/${entry.familyId}) — current: ${Number(entry.retainedCandidateCount || 0)} retained, ${Number(entry.enrichmentShortlistCount || 0)} enriched, ${Number(entry.topFiveCount || 0)} Top 5; ${Number(entry.runsObserved || 1)} run(s): ${Number(entry.cumulativeRetainedCandidateCount ?? entry.retainedCandidateCount ?? 0)} retained, ${Number(entry.cumulativeEnrichmentShortlistCount ?? entry.enrichmentShortlistCount ?? 0)} enriched, ${Number(entry.cumulativeTopFiveCount ?? entry.topFiveCount ?? 0)} Top 5`
  );
}

export function renderDailyReport(args) {
  const selection = args?.selection
    ? { ...args.selection, reviewQueue: newestCreatedFirst(args.selection.reviewQueue || []) }
    : args?.selection;
  const normalizedArgs = { ...args, selection };
  const rendered = core.renderDailyReport(normalizedArgs);
  const runtime = args?.contract?.runtimeRadar;
  if (!runtime) return rendered;

  const discovery = runtime.discovery || {};
  const coverage = discovery.discoveryCoverage || {};
  const history = runtime.candidateHistorySummary || {};
  const age = discovery.creationAge || {};
  const date = utcDate(args.reportDate);
  const header = `## OSS Radar — ${date}`;
  const telemetry = [
    "### GitHub discovery",
    "",
    `- **Enabled lanes:** ${Number(discovery.enabledLaneCount || 0)}`,
    `- **Configured atomic queries:** ${Number(discovery.queryCount || 0)}`,
    `- **Queries executed:** ${Number(discovery.executedQueryCount || coverage.queriesExecuted?.length || 0)}`,
    `- **Per-query result cap:** ${Number(discovery.perQueryResultCap || 0)}`,
    `- **Raw-result budget:** ${Number(discovery.rawResultBudget || 0)}`,
    `- **Theoretical maximum raw pointers:** ${Number(discovery.theoreticalMaxRawPointers || 0)}`,
    `- **Effective maximum raw pointers:** ${Number(discovery.effectiveMaxRawPointers || 0)}`,
    `- **Raw repository pointers returned:** ${Number(discovery.rawResultCount || 0)}`,
    `- **Unique repositories examined:** ${Number(discovery.uniqueCandidateCount || 0)}`,
    `- **Retained after hard rejection:** ${Number(discovery.retainedCount || 0)}`,
    `- **Hard rejected before enrichment:** ${Number(discovery.rejectedCount || 0)}`,
    `- **Hard rejection reasons:** ${rejectionSummary(discovery.rejectionReasons)}`,
    "",
    "Metadata discovery begins with GitHub repository metadata; bounded read-only enrichment may inspect README and one primary package manifest, but it does not clone or execute repository source trees.",
    "",
    "### Discovery coverage",
    "",
    `- **Query families represented:** ${Number(coverage.queryFamiliesRepresented?.length || 0)}`,
    `- **Lanes represented by candidates:** ${(coverage.lanesRepresented || []).join(", ") || "none"}`,
    `- **Candidates matching multiple lanes:** ${Number(coverage.candidatesMatchingMultipleLanes || 0)}`,
    `- **Enrichment shortlist:** ${Number(coverage.enrichmentShortlistSize || 0)}`,
    `- **README retrieval successes:** ${Number(coverage.readmeRetrievalSuccesses || 0)}`,
    `- **README retrieval failures/missing/oversized:** ${Number(coverage.readmeRetrievalFailures || 0)}`,
    `- **Candidates rescored after enrichment:** ${Number(coverage.candidatesRescoredAfterEnrichment || 0)}`,
    `- **Enrichment failure reasons:** ${rejectionSummary(coverage.enrichmentFailuresByReason)}`,
    "",
    "#### Unique candidates per lane",
    "",
    ...laneCoverageLines(coverage),
    "",
    "### Query effectiveness",
    "",
    ...queryEffectivenessLines(discovery.queryEffectiveness || coverage.queryEffectiveness),
    "",
    "### Repository creation age — unique repositories examined",
    "",
    `- **Created today:** ${Number(age.today || 0)}`,
    `- **Created yesterday:** ${Number(age.yesterday || 0)}`,
    `- **Created earlier:** ${Number(age.earlier || 0)}`,
    `- **Creation date unavailable:** ${Number(age.unknown || 0)}`,
    "",
    "### Radar candidate history — retained candidates",
    "",
    `- **First seen by Radar today:** ${Number(history.firstSeenToday || 0)}`,
    `- **Seen by Radar yesterday:** ${Number(history.seenYesterday || 0)}`,
    `- **Seen by Radar before yesterday:** ${Number(history.seenBeforeYesterday || 0)}`,
    "",
    "### Top 5 Radar history",
    "",
    ...reviewHistoryLines(selection),
  ].join("\n");

  const state = {
    ...rendered.state,
    candidates: runtime.candidateLedger || [],
    discoveryCoverage: coverage,
    queryEffectiveness: discovery.queryEffectiveness || coverage.queryEffectiveness || [],
  };
  const marker = encodeDailyState(state);
  const body = rendered.body
    .replace(header, `${header}\n\n${telemetry}`)
    .replace(/<!-- PLOTPICKLE-OSS-RADAR-STATE:[A-Za-z0-9_-]+ -->/u, marker);
  return { ...rendered, body, state };
}
