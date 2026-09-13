import { encodeDailyState, utcDate } from "./history.mjs";
import * as core from "./report-renderer-core.mjs";

export const monthlyIssueBody = core.monthlyIssueBody;
export const selectDailyFindings = core.selectDailyFindings;

function rejectionSummary(reasons = {}) {
  const entries = Object.entries(reasons).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([reason, count]) => `${reason}: ${count}`).join(", ") : "none";
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

export function renderDailyReport(args) {
  const rendered = core.renderDailyReport(args);
  const runtime = args?.contract?.runtimeRadar;
  if (!runtime) return rendered;

  const discovery = runtime.discovery || {};
  const history = runtime.candidateHistorySummary || {};
  const age = discovery.creationAge || {};
  const date = utcDate(args.reportDate);
  const header = `## OSS Radar — ${date}`;
  const telemetry = [
    "### GitHub discovery",
    "",
    `- **Enabled lanes:** ${Number(discovery.enabledLaneCount || 0)}`,
    `- **Search queries:** ${Number(discovery.queryCount || 0)}`,
    `- **Per-query result cap:** ${Number(discovery.perQueryResultCap || 0)}`,
    `- **Theoretical maximum raw pointers:** ${Number(discovery.theoreticalMaxRawPointers || 0)}`,
    `- **Raw repository pointers returned:** ${Number(discovery.rawResultCount || 0)}`,
    `- **Unique repositories examined:** ${Number(discovery.uniqueCandidateCount || 0)}`,
    `- **Retained after hard rejection:** ${Number(discovery.retainedCount || 0)}`,
    `- **Hard rejected:** ${Number(discovery.rejectedCount || 0)}`,
    `- **Hard rejection reasons:** ${rejectionSummary(discovery.rejectionReasons)}`,
    "",
    "Metadata discovery only: this stage follows GitHub repository pointers and metadata; it does not clone or inspect repository source trees.",
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
    ...reviewHistoryLines(args.selection),
  ].join("\n");

  const state = { ...rendered.state, candidates: runtime.candidateLedger || [] };
  const marker = encodeDailyState(state);
  const body = rendered.body
    .replace(header, `${header}\n\n${telemetry}`)
    .replace(/<!-- PLOTPICKLE-OSS-RADAR-STATE:[A-Za-z0-9_-]+ -->/u, marker);
  return { ...rendered, body, state };
}
