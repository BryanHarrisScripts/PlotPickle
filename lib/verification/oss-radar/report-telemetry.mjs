import { candidateRadarStatus, encodeDailyState, utcDate } from "./history.mjs";

function rejectionSummary(reasons = {}) {
  const entries = Object.entries(reasons).sort(([left], [right]) => left.localeCompare(right));
  return entries.length ? entries.map(([reason, count]) => `${reason}: ${count}`).join(", ") : "none";
}

function topReviewHistory(selection, candidateHistory, reportDate) {
  const queue = selection?.reviewQueue || [];
  if (!queue.length) return ["- No retained repository was available for Top 5 review."];
  return queue.map((candidate, index) => {
    const status = candidateRadarStatus(candidate, candidateHistory, reportDate);
    const firstSeen = status.firstSeenDate ? `; first seen ${status.firstSeenDate}` : "";
    return `- ${index + 1}. **${candidate.fullName}** — ${status.label}${firstSeen}`;
  });
}

export function applyRadarTelemetry({
  body,
  entries,
  reportDate,
  discovery = {},
  selection,
  candidateHistory = new Map(),
  candidateHistorySummary = {},
  candidateLedger = [],
}) {
  const date = utcDate(reportDate);
  const age = discovery?.creationAge || {};
  const header = `## OSS Radar — ${date}`;
  const telemetry = [
    "### GitHub discovery",
    "",
    `- **Enabled lanes:** ${Number(discovery?.enabledLaneCount || 0)}`,
    `- **Search queries:** ${Number(discovery?.queryCount || 0)}`,
    `- **Per-query result cap:** ${Number(discovery?.perQueryResultCap || 0)}`,
    `- **Theoretical maximum raw pointers:** ${Number(discovery?.theoreticalMaxRawPointers || 0)}`,
    `- **Raw repository pointers returned:** ${Number(discovery?.rawResultCount || 0)}`,
    `- **Unique repositories examined:** ${Number(discovery?.uniqueCandidateCount || 0)}`,
    `- **Retained after hard rejection:** ${Number(discovery?.retainedCount || 0)}`,
    `- **Hard rejected:** ${Number(discovery?.rejectedCount || 0)}`,
    `- **Hard rejection reasons:** ${rejectionSummary(discovery?.rejectionReasons)}`,
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
    `- **First seen by Radar today:** ${Number(candidateHistorySummary?.firstSeenToday || 0)}`,
    `- **Seen by Radar yesterday:** ${Number(candidateHistorySummary?.seenYesterday || 0)}`,
    `- **Seen by Radar before yesterday:** ${Number(candidateHistorySummary?.seenBeforeYesterday || 0)}`,
    "",
    "### Top 5 Radar history",
    "",
    ...topReviewHistory(selection, candidateHistory, reportDate),
  ].join("\n");

  const withTelemetry = String(body || "").replace(header, `${header}\n\n${telemetry}`);
  const state = { schemaVersion: 1, date, entries: entries || [], candidates: candidateLedger };
  const marker = encodeDailyState(state);
  const updatedBody = withTelemetry.replace(/<!-- PLOTPICKLE-OSS-RADAR-STATE:[A-Za-z0-9_-]+ -->/u, marker);
  return { body: updatedBody, state };
}
