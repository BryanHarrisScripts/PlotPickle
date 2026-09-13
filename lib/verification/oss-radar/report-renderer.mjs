import {
  dailyMarker,
  encodeDailyState,
  historyEntryForFinding,
  monthlyIssueTitle,
  shouldResurface,
  utcDate,
} from "./history.mjs";

const LANE_LABEL = Object.freeze({
  "writer-craft": "Writer Craft",
  "visual-story": "Visual Story",
  "story-game-engine": "STORY / Game Engine",
  "learn-education": "LEARN / Education",
  "ai-architecture": "AI Architecture",
  "platform-engineering": "Platform / Engineering",
});

function sortedUnique(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function laneLabels(candidate) {
  return sortedUnique((candidate?.matchedLaneIds || []).map((lane) => LANE_LABEL[lane] || lane));
}

function thresholdEligible(candidate, contract) {
  const score = Number(candidate?.score || 0);
  if (score >= Number(contract?.scoring?.surfaceThreshold || 65)) return true;
  return candidate?.license?.status === "unknown"
    && score >= Number(contract?.scoring?.watchEvidenceThreshold || 55);
}

export function selectDailyFindings({ candidates = [], contract, history = new Map(), reportDate }) {
  const target = Math.max(0, Number(contract?.report?.targetFindings || 5));
  const selected = [];
  const suppressed = { belowThreshold: 0, history: 0 };
  for (const candidate of candidates) {
    if (!thresholdEligible(candidate, contract)) {
      suppressed.belowThreshold += 1;
      continue;
    }
    const prior = history.get(String(candidate.repositoryStableId));
    const resurfacing = shouldResurface(candidate, prior, reportDate);
    if (!resurfacing.allowed) {
      suppressed.history += 1;
      continue;
    }
    selected.push({ ...candidate, primaryDisposition: "WATCH", resurfacingReason: resurfacing.reason });
    if (selected.length >= target) break;
  }
  return { selected, suppressed, target };
}

function activityLabel(candidate) {
  const days = Number(candidate?.scoreEvidence?.activity?.ageDays);
  if (!Number.isFinite(days)) return "unknown";
  if (days <= 30) return `active within ${Math.max(0, Math.round(days))} days`;
  return `last activity about ${Math.round(days)} days ago`;
}

function benefit(candidate, laneId, text) {
  return (candidate?.matchedLaneIds || []).includes(laneId) ? text : "No deterministic Phase 2 signal yet.";
}

function findingMarkdown(candidate, index) {
  const lanes = laneLabels(candidate);
  const terms = candidate?.scoreEvidence?.relevance?.matchedTerms || [];
  const learning = terms.length
    ? `Inspect how the project approaches ${terms.slice(0, 5).join(", ")}; Phase 2 does not infer beyond repository metadata.`
    : `Inspect the project's documented approach within ${lanes.join(", ") || "its matched Radar lane"}; Phase 2 does not infer beyond repository metadata.`;
  return [
    `### ${index}. [${candidate.fullName}](${candidate.url}) — WATCH`,
    "",
    candidate.description || "No repository description supplied.",
    "",
    `- **Why PlotPickle should care:** Matched ${lanes.join(", ") || "Radar evidence"} with deterministic score ${Number(candidate.score || 0).toFixed(2)}/100.`,
    `- **What can PlotPickle learn from this?** ${learning}`,
    `- **Writer benefit:** ${benefit(candidate, "writer-craft", "Surfaced through the Writer Craft lane for Human review.")}`,
    `- **Student / LEARN benefit:** ${benefit(candidate, "learn-education", "Surfaced through the LEARN / Education lane for Human review.")}`,
    `- **Visual-story benefit:** ${benefit(candidate, "visual-story", "Surfaced through the Visual Story lane for Human review.")}`,
    `- **STORY / game-engine benefit:** ${benefit(candidate, "story-game-engine", "Surfaced through the STORY / Game Engine lane for Human review.")}`,
    `- **AI-architecture benefit:** ${benefit(candidate, "ai-architecture", "Surfaced through the AI Architecture lane for Human review.")}`,
    `- **Radar fit:** ${lanes.join(", ") || "Unclassified"}`,
    `- **Single most useful piece:** Review the repository approach in its matched Radar lane before choosing adopt, adapt, learn, add or pass.`,
    `- **Integration effort:** Unassessed in Phase 2.`,
    `- **License:** ${candidate?.license?.spdxId || "UNKNOWN"} (${candidate?.license?.status || "unknown"})`,
    `- **Activity:** ${activityLabel(candidate)}`,
    `- **Score evidence:** ${Number(candidate.score || 0).toFixed(2)}/100; ${sortedUnique(candidate?.scoreEvidence?.reasonCodes || []).join(", ") || "no reason codes"}`,
    "",
  ].join("\n");
}

export function renderDailyReport({ reportDate, selection, contract, history = new Map() }) {
  const date = utcDate(reportDate);
  const findings = selection.selected || [];
  const target = selection.target ?? Number(contract?.report?.targetFindings || 5);
  const entries = findings.map((candidate) => historyEntryForFinding(
    candidate,
    date,
    history.get(String(candidate.repositoryStableId)),
  ));
  const noPadding = findings.length < target
    ? `Only ${findings.length} finding${findings.length === 1 ? "" : "s"} qualified. We did not pad the report with weaker or recently reviewed candidates.`
    : `All ${target} target slots were filled by qualifying findings.`;
  const sections = findings.length
    ? findings.map((candidate, index) => findingMarkdown(candidate, index + 1)).join("\n")
    : "No repository qualified for today's report after deterministic thresholds and history suppression.";
  const state = { schemaVersion: 1, date, entries };
  const body = [
    dailyMarker(date),
    `## OSS Radar — ${date}`,
    "",
    `**Findings:** ${findings.length}/${target}`,
    "",
    noPadding,
    "",
    "Phase 2 uses **WATCH** as the conservative disposition for every surfaced finding. SAVE / IMPROVE / ADD / LEARN mapping begins in Phase 3. Human review remains the adoption authority.",
    "",
    sections,
    "",
    encodeDailyState(state),
  ].join("\n");
  return { body, state, entries };
}

export function monthlyIssueBody(value = new Date()) {
  return [
    `# ${monthlyIssueTitle(value)}`,
    "",
    "One rolling monthly thread for PlotPickle OSS Radar daily discovery reports.",
    "",
    "Reports are deterministic discovery evidence for Human review. Surfaced repositories are not automatically adopted, installed, copied into PlotPickle, turned into curriculum, or converted into implementation work.",
    "",
    "Human review remains required before any product, curriculum, architecture or dependency decision.",
  ].join("\n");
}
