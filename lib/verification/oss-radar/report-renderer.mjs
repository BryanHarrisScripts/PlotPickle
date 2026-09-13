import {
  dailyMarker,
  encodeDailyState,
  historyEntryForFinding,
  monthlyIssueTitle,
  shouldResurface,
  utcDate,
} from "./history.mjs";
import { phase3Decision } from "./phase3-decision.mjs";

const LANE_LABEL = Object.freeze({
  "writer-craft": "LEARN / Writers Craft",
  "visual-story": "Visual Story / Storyboard / Previs",
  "story-game-engine": "STORY / Game Engine",
  "learn-education": "LEARN / Education",
  "ai-architecture": "Agent Runtime / Context / Provider",
  "platform-engineering": "Validation / Local Platform / Documentation",
});

function sortedUnique(values) {
  return [...new Set((values || []).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function laneLabels(candidate) {
  return sortedUnique((candidate?.matchedLaneIds || []).map((lane) => LANE_LABEL[lane] || lane));
}

function qualificationThreshold(candidate, contract) {
  return candidate?.license?.status === "unknown"
    ? Number(contract?.scoring?.watchEvidenceThreshold || 55)
    : Number(contract?.scoring?.surfaceThreshold || 65);
}

function thresholdEligible(candidate, contract) {
  return Number(candidate?.score || 0) >= qualificationThreshold(candidate, contract);
}

function phase3Fit(candidate) {
  const lanes = new Set(candidate?.matchedLaneIds || []);
  const text = String(candidate?.searchableText || "").toLowerCase();
  const modules = new Set();
  const issues = new Set();
  const categories = new Set();

  if (lanes.has("writer-craft")) {
    categories.add("WRITER CRAFT");
    categories.add("LEARN / EDUCATION");
    issues.add(1918);
    if (/character/u.test(text)) ["03", "05", "10"].forEach((id) => modules.add(id));
    if (/dialogue|subtext/u.test(text)) ["11", "13", "14"].forEach((id) => modules.add(id));
    if (/structure|beat|plot/u.test(text)) ["07", "08", "09"].forEach((id) => modules.add(id));
    if (/revision/u.test(text)) ["17", "18"].forEach((id) => modules.add(id));
    if (/adaptation/u.test(text)) ["15", "16"].forEach((id) => modules.add(id));
    if (/television|comedy|writers.? room/u.test(text)) ["20", "21", "22", "23", "24"].forEach((id) => modules.add(id));
    if (modules.size) issues.add(1976);
  }
  if (lanes.has("learn-education")) {
    categories.add("LEARN / EDUCATION");
    categories.add("CREATIVE UX");
    issues.add(1918);
  }
  if (lanes.has("visual-story")) {
    categories.add("VISUAL STORY");
    categories.add("CREATIVE UX");
    modules.add("12");
  }
  if (lanes.has("story-game-engine")) {
    categories.add("STORY / GAME ENGINE");
    categories.add("NEW CAPABILITY");
    categories.add("MISSING PIECE");
    issues.add(1675);
  }
  if (lanes.has("ai-architecture")) {
    categories.add("AI ARCHITECTURE");
    categories.add("AGENT / AI");
    categories.add("ARCHITECTURE");
  }
  if (lanes.has("platform-engineering")) {
    categories.add("ARCHITECTURE");
    if (/windows|installer/u.test(text)) issues.add(1692);
  }
  return {
    targets: laneLabels(candidate),
    craftModules: [...modules].sort(),
    relatedIssues: [...issues].sort((a, b) => a - b),
    internalCategories: [...categories].sort(),
  };
}

function enrichCandidate(candidate, labels, contract) {
  const fit = phase3Fit(candidate);
  const threshold = qualificationThreshold(candidate, contract);
  const qualified = thresholdEligible(candidate, contract);
  return {
    ...candidate,
    primaryDisposition: qualified
      ? labels[phase3Decision(candidate)] || labels.at(-1) || "WATCH"
      : "WATCH",
    plotPickleFit: fit,
    internalCategories: fit.internalCategories,
    reviewQualification: qualified ? "qualified" : "below-threshold",
    qualificationThreshold: threshold,
    qualificationGap: Number(Math.max(0, threshold - Number(candidate?.score || 0)).toFixed(2)),
  };
}

export function selectDailyFindings({ candidates = [], contract, history = new Map(), reportDate }) {
  const target = Math.max(0, Number(contract?.report?.targetFindings || 5));
  const labels = contract?.report?.humanDispositions || [];
  const reviewQueue = candidates.slice(0, target).map((candidate) => {
    const enriched = enrichCandidate(candidate, labels, contract);
    const prior = history.get(String(candidate.repositoryStableId));
    const resurfacing = shouldResurface(enriched, prior, reportDate);
    return {
      ...enriched,
      resurfacingReason: resurfacing.reason,
      previouslyReviewed: Boolean(prior),
    };
  });
  const qualified = reviewQueue.filter((candidate) => candidate.reviewQualification === "qualified");
  const belowThreshold = reviewQueue.filter((candidate) => candidate.reviewQualification === "below-threshold");
  return { selected: qualified, belowThreshold, reviewQueue, target, reviewTarget: target };
}

function activityLabel(candidate) {
  const days = Number(candidate?.scoreEvidence?.activity?.ageDays);
  if (!Number.isFinite(days)) return "unknown";
  if (days <= 30) return `active within ${Math.max(0, Math.round(days))} days`;
  return `last activity about ${Math.round(days)} days ago`;
}

function reviewMode(candidate) {
  switch (candidate.primaryDisposition) {
    case "SAVE": return "adopt-component candidate; Human license/fit review required";
    case "IMPROVE": return "adapt architecture or UX idea into an existing PlotPickle system";
    case "ADD": return "evaluate as a missing capability before opening implementation work";
    case "LEARN": return "independently author or adapt learning insight; do not copy source material";
    default: return "review the repository before deciding whether it merits WATCH or stronger follow-up";
  }
}

function findingMarkdown(candidate, index) {
  const fit = candidate.plotPickleFit || phase3Fit(candidate);
  const terms = candidate?.scoreEvidence?.relevance?.matchedTerms || [];
  const learning = terms.length
    ? `Investigate how the project approaches ${terms.slice(0, 5).join(", ")}; repository metadata alone does not prove implementation fit.`
    : `Investigate the documented approach within ${fit.targets.join(", ") || "its matched Radar lane"}; repository metadata alone does not prove implementation fit.`;
  const status = candidate.reviewQualification === "qualified"
    ? `Meets qualification threshold (${Number(candidate.qualificationThreshold || 0).toFixed(2)}/100).`
    : `Below qualification threshold by ${Number(candidate.qualificationGap || 0).toFixed(2)} points; included because it ranked in today's Top 5.`;
  return [
    `### ${index}. [${candidate.fullName}](${candidate.url}) — ${candidate.primaryDisposition}`,
    "",
    candidate.description || "No repository description supplied.",
    "",
    `- **Review status:** ${status}`,
    `- **Score:** ${Number(candidate.score || 0).toFixed(2)}/100`,
    `- **Why PlotPickle should care:** ${fit.targets.join(", ") || "Radar evidence"}.`,
    `- **What can PlotPickle learn from this?** ${learning}`,
    `- **PlotPickle target:** ${fit.targets.join(", ") || "Unmapped; keep under review"}`,
    `- **Craft Module fit:** ${fit.craftModules.length ? fit.craftModules.join(", ") : "none evidenced"}`,
    `- **Related Issue fit:** ${fit.relatedIssues.length ? fit.relatedIssues.map((id) => `#${id}`).join(", ") : "none evidenced"}`,
    `- **Recommended review mode:** ${reviewMode(candidate)}`,
    `- **License:** ${candidate?.license?.spdxId || "UNKNOWN"} (${candidate?.license?.status || "unknown"})`,
    `- **Activity:** ${activityLabel(candidate)}`,
    `- **Review history:** ${candidate.previouslyReviewed ? "seen in a previous Radar review" : "first Radar review"}`,
    `- **Score evidence:** ${sortedUnique(candidate?.scoreEvidence?.reasonCodes || []).join(", ") || "no reason codes"}`,
    "",
  ].join("\n");
}

export function renderDailyReport({ reportDate, selection, contract, history = new Map() }) {
  const date = utcDate(reportDate);
  const findings = selection.selected || [];
  const belowThreshold = selection.belowThreshold || [];
  const reviewQueue = selection.reviewQueue || [...findings, ...belowThreshold];
  const target = selection.target ?? Number(contract?.report?.targetFindings || 5);
  const reviewTarget = selection.reviewTarget ?? target;
  const entries = reviewQueue.map((candidate) => historyEntryForFinding(candidate, date, history.get(String(candidate.repositoryStableId))));

  const sections = reviewQueue.length
    ? reviewQueue.map((candidate, index) => findingMarkdown(candidate, index + 1)).join("\n")
    : "No non-hard-rejected repository was available for review today.";
  const reviewNote = reviewQueue.length < reviewTarget
    ? `Only ${reviewQueue.length}/${reviewTarget} real review candidates were available after discovery and hard rejection. PlotPickle did not invent missing repositories.`
    : `The daily review queue contains the Top ${reviewQueue.length} real repositories from today's retained candidates. Qualification status is context only and never blanks the report.`;

  const state = { schemaVersion: 1, date, entries };
  return {
    body: [
      dailyMarker(date),
      `## OSS Radar — ${date}`,
      "",
      `**Top repositories for review:** ${reviewQueue.length}/${reviewTarget}`,
      `**Meets qualification threshold:** ${findings.length}/${reviewQueue.length || 0}`,
      `**Below threshold but included for review:** ${belowThreshold.length}/${reviewQueue.length || 0}`,
      "",
      reviewNote,
      "",
      "Phase 3 classifications are deterministic Radar guidance, not adoption decisions. Human review remains authoritative.",
      "",
      "## Top Repositories for Review",
      "",
      sections,
      "",
      encodeDailyState(state),
    ].join("\n"),
    state,
    entries,
  };
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
