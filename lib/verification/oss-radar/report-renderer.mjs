import { utcDate } from "./history.mjs";
import { renderXReadyDigest } from "./public-digest.mjs";
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
  if (!queue.length) return ["- No repository was selected for today's architecture review."];
  return queue.map((candidate, index) => {
    const status = candidate?.radarHistory || {};
    const label = status.label || "Radar history unavailable";
    const firstSeen = status.firstSeenDate ? `; first seen ${status.firstSeenDate}` : "";
    const area = candidate?.selectedArchitectureArea?.label ? ` [${candidate.selectedArchitectureArea.label}]` : "";
    return `- ${index + 1}. **${candidate.fullName}**${area} — ${label}${firstSeen}`;
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
  return entries.map((entry) => {
    const currentSelected = Number(entry.selectedFindingCount ?? entry.topFiveCount ?? 0);
    const cumulativeSelected = Number(entry.cumulativeSelectedFindingCount ?? entry.cumulativeTopFiveCount ?? entry.topFiveCount ?? 0);
    return `- **${entry.query}** (${entry.laneId}/${entry.familyId}) — current: ${Number(entry.retainedCandidateCount || 0)} retained, ${Number(entry.enrichmentShortlistCount || 0)} enriched, ${currentSelected} provisional selected; ${Number(entry.runsObserved || 1)} run(s): ${Number(entry.cumulativeRetainedCandidateCount ?? entry.retainedCandidateCount ?? 0)} retained, ${Number(entry.cumulativeEnrichmentShortlistCount ?? entry.enrichmentShortlistCount ?? 0)} enriched, ${cumulativeSelected} selected`;
  });
}

function ossRulesSection(value) {
  const findings = (value?.findings || []).slice(0, 3);
  const summary = findings.map((item) => `- **${item.pattern}** — ${item.repository} (${item.area}): ${item.meaning} ${item.plotPickleFit} **${item.disposition}**. [Pinned source](${item.sourceUrl})`);
  return [
    "## OSS Rules — Agent Instruction Intelligence",
    "",
    ...(value?.status === "unavailable" ? ["OSS Rules enrichment unavailable; GitHub-first Radar results remain intact."] :
      summary.length ? summary : ["No relevant, pinned OSS Rules match was found among today's selected repositories."]),
  ].join("\n");
}

export function renderDailyReport(args) {
  const adaptive = args?.contract?.selectionMode === "architecture-7x3";
  const selection = args?.selection
    ? adaptive
      ? args.selection
      : { ...args.selection, reviewQueue: newestCreatedFirst(args.selection.reviewQueue || []) }
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
    `- **Enabled discovery lanes:** ${Number(discovery.enabledLaneCount || 0)}`,
    `- **PlotPickle architecture areas:** ${Number(discovery.architectureAreaCount || args?.contract?.architectureAreas?.length || 0)}`,
    `- **Configured atomic queries:** ${Number(discovery.queryCount || 0)}`,
    `- **Queries executed:** ${Number(discovery.executedQueryCount || coverage.queriesExecuted?.length || 0)}`,
    `- **Per-query result cap:** ${Number(discovery.perQueryResultCap || 0)}`,
    `- **Raw-result budget:** ${Number(discovery.rawResultBudget || 0)}`,
    `- **Theoretical maximum raw pointers:** ${Number(discovery.theoreticalMaxRawPointers || 0)}`,
    `- **Effective maximum raw pointers:** ${Number(discovery.effectiveMaxRawPointers || 0)}`,
    `- **Search request pacing:** ${Number(discovery.searchMinIntervalMs || 0)} ms minimum interval`,
    `- **Search pacing wait:** ${Number(discovery.searchPacingWaitMs || 0)} ms`,
    `- **Rate-limit retries:** ${Number(discovery.rateLimitRetryCount || 0)}`,
    `- **Rate-limit retry wait:** ${Number(discovery.rateLimitWaitMs || 0)} ms`,
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
    `- **Discovery lanes represented by candidates:** ${(coverage.lanesRepresented || []).join(", ") || "none"}`,
    `- **Candidates matching multiple discovery lanes:** ${Number(coverage.candidatesMatchingMultipleLanes || 0)}`,
    `- **Enrichment shortlist:** ${Number(coverage.enrichmentShortlistSize || 0)}`,
    `- **Lane-balanced enrichment:** ${coverage.laneBalancedEnrichment ? "yes" : "no"}`,
    `- **README retrieval successes:** ${Number(coverage.readmeRetrievalSuccesses || 0)}`,
    `- **README retrieval failures/missing/oversized:** ${Number(coverage.readmeRetrievalFailures || 0)}`,
    `- **Candidates rescored after enrichment:** ${Number(coverage.candidatesRescoredAfterEnrichment || 0)}`,
    `- **Enrichment failure reasons:** ${rejectionSummary(coverage.enrichmentFailuresByReason)}`,
    "",
    "#### Unique candidates per discovery lane",
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
    "### Selected finding history",
    "",
    ...reviewHistoryLines(selection),
  ].join("\n");

  const publicDigest = renderXReadyDigest({ reportDate: date, candidates: selection?.reviewQueue || [] });
  const publicSection = [
    "## X-ready public digest",
    "",
    "Copy/review this section for public posting. Internal scores, issue IDs, evidence lanes and implementation notes are intentionally omitted.",
    "",
    "```text",
    publicDigest,
    "```",
  ].join("\n");

  const state = {
    ...rendered.state,
    candidates: runtime.candidateLedger || [],
    discoveryCoverage: coverage,
    queryEffectiveness: discovery.queryEffectiveness || coverage.queryEffectiveness || [],
  };
  const body = [
    rendered.body.replace(header, `${header}\n\n${telemetry}`),
    "",
    ossRulesSection(args.ossRules),
    "",
    publicSection,
    "",
    "---",
    "",
    "Presented by PlotPickle — Today’s OSS Radar.",
  ].join("\n");
  return { ...rendered, body, state, publicDigest };
}
