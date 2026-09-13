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

function enrichCandidate(candidate, labels, contract, reviewQualification) {
  const fit = phase3Fit(candidate);
  const threshold = qualificationThreshold(candidate, contract);
  return {
    ...candidate,
    primaryDisposition: reviewQualification === "qualified"
      ? labels[phase3Decision(candidate)] || labels.at(-1) || "WATCH"
      : "WATCH",
    plotPickleFit: fit,
    internalCategories: fit.internalCategories,
    reviewQualification,
    qualificationThreshold: threshold,
    qualificationGap: Number(Math.max(0, threshold - Number(candidate?.score || 0)).toFixed(2)),
  };
}

export function selectDailyFindings({ candidates = [], contract, history = new Map(), reportDate }) {
  const target = Math.max(0, Number(contract?.report?.targetFindings || 5));
  const labels = contract?.report?.humanDispositions || [];
  const selected = [];
  const belowThreshold = [];
  const suppressed = { belowThreshold: 0, history: 0, reviewHistory: 0 };

  for (const candidate of candidates) {
    if (!thresholdEligible(candidate, contract)) {
      belowThreshold.push(candidate);
      suppressed.belowThreshold += 1;
      continue;
    }
    if (selected.length >= target) continue;
    const enriched = enrichCandidate(candidate, labels, contract, "qualified");
    const prior = history.get(String(candidate.repositoryStableId));
    const resurfacing = shouldResurface(enriched, prior, reportDate);
    if (!resurfacing.allowed) {
      suppressed.history += 1;
      continue;
    }
    selected.push({ ...enriched, resurfacingReason: resurfacing.reason });
  }

  const reviewSlots = Math.max(0, target - selected.length);
  const fresh = [];
  const repeated = [];
  for (const candidate of belowThreshold) {
    const enriched = enrichCandidate(candidate, labels, contract, "unqualified");
    const prior = history.get(String(candidate.repositoryStableId));
    const resurfacing = shouldResurface(enriched, prior, reportDate);
    if (resurfacing.allowed) fresh.push({ ...enriched, resurfacingReason: resurfacing.reason });
    else repeated.push({ ...enriched, resurfacingReason: "review-floor-repeat" });
  }

  const unqualified = [...fresh, ...repeated].slice(0, reviewSlots);
  suppressed.reviewHistory = repeated.length - Math.max(0, unqualified.length - fresh.length);
  const reviewQueue = [...selected, ...unqualified];
  return { selected, unqualified, reviewQueue, suppressed, target, reviewTarget: target };
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
    default: return "watch-only until stronger evidence appears";
  }
}

function findingMarkdown(candidate, index) {
  const fit = candidate.plotPickleFit || phase3Fit(candidate);
  const terms = candidate?.scoreEvidence?.relevance?.matchedTerms || [];
  const learning = terms.length
    ? `Investigate how the project approaches ${terms.slice(0, 5).join(", ")}; repository metadata alone does not prove implementation fit.`
    : `Investigate the documented approach within ${fit.targets.join(", ") || "its matched Radar lane"}; repository metadata alone does not prove implementation fit.`;
  return [
    `### ${index}. [${candidate.fullName}](${candidate.url}) — ${candidate.primaryDisposition}`,
    "",
    candidate.description || "No repository description supplied.",
    "",
    `- **Why PlotPickle should care:** ${fit.targets.join(", ") || "Radar evidence"}; deterministic score ${Number(candidate.score || 0).toFixed(2)}/100.`,
    `- **What can PlotPickle learn from this?** ${learning}`,
    `- **PlotPickle target:** ${fit.targets.join(", ") || "Unmapped; keep under review"}`,
    `- **Craft Module fit:** ${fit.craftModules.length ? fit.craftModules.join(", ") : "none evidenced"}`,
    `- **Related Issue fit:** ${fit.relatedIssues.length ? fit.relatedIssues.map((id) => `#${id}`).join(", ") : "none evidenced"}`,
    `- **Recommended review mode:** ${reviewMode(candidate)}`,
    `- **License:** ${candidate?.license?.spdxId || "UNKNOWN"} (${candidate?.license?.status || "unknown"})`,
    `- **Activity:** ${activityLabel(candidate)}`,
    `- **Score evidence:** ${Number(candidate.score || 0).toFixed(2)}/100; ${sortedUnique(candidate?.scoreEvidence?.reasonCodes || []).join(", ") || "no reason codes"}`,
    "",
  ].join("\n");
}

function unqualifiedMarkdown(candidate, index) {
  const fit = candidate.plotPickleFit || phase3Fit(candidate);
  const threshold = Number(candidate.qualificationThreshold || 0);
  const gap = Number(candidate.qualificationGap || 0);
  const terms = candidate?.scoreEvidence?.relevance?.matchedTerms || [];
  const learning = terms.length
    ? `Review the project's approach to ${terms.slice(0, 5).join(", ")} as a near-miss; metadata evidence is not strong enough for qualification.`
    : `Review the documented approach within ${fit.targets.join(", ") || "its matched Radar lane"}; this is a near-miss, not a qualified finding.`;
  return [
    `### ${index}. [${candidate.fullName}](${candidate.url}) — UNQUALIFIED — REVIEW ONLY`,
    "",
    candidate.description || "No repository description supplied.",
    "",
    `- **Score:** ${Number(candidate.score || 0).toFixed(2)}/100`,
    `- **Qualification threshold:** ${threshold.toFixed(2)}/100`,
    `- **Gap to qualification:** ${gap.toFixed(2)} points`,
    `- **Why it is still worth a look:** ${fit.targets.join(", ") || "Radar evidence"}; it is among today's highest-scoring non-hard-rejected candidates below threshold.`,
    `- **What can PlotPickle learn from this?** ${learning}`,
    `- **License:** ${candidate?.license?.spdxId || "UNKNOWN"} (${candidate?.license?.status || "unknown"})`,
    `- **Activity:** ${activityLabel(candidate)}`,
    "",
  ].join("\n");
}

export function renderDailyReport({ reportDate, selection, contract, history = new Map() }) {
  const date = utcDate(reportDate);
  const findings = selection.selected || [];
  const unqualified = selection.unqualified || [];
  const reviewQueue = selection.reviewQueue || [...findings, ...unqualified];
  const target = selection.target ?? Number(contract?.report?.targetFindings || 5);
  const reviewTarget = selection.reviewTarget ?? target;
  const entries = reviewQueue.map((candidate) => historyEntryForFinding(candidate, date, history.get(String(candidate.repositoryStableId))));

  const qualifiedSections = findings.length
    ? findings.map((candidate, index) => findingMarkdown(candidate, index + 1)).join("\n")
    : "No repository met today's deterministic qualification threshold.";
  const unqualifiedSections = unqualified.length
    ? unqualified.map((candidate, index) => unqualifiedMarkdown(candidate, index + 1)).join("\n")
    : findings.length >= reviewTarget
      ? "No fallback review slots were needed because the qualified queue is full."
      : "No additional non-hard-rejected repository was available to fill the review queue.";
  const reviewNote = reviewQueue.length < reviewTarget
    ? `Only ${reviewQueue.length}/${reviewTarget} review items were available after discovery and hard rejection. PlotPickle did not invent or pad missing repositories.`
    : `The Human review queue contains ${reviewQueue.length}/${reviewTarget} real repositories. Unqualified fallback items do not lower or alter qualification thresholds.`;

  const state = { schemaVersion: 1, date, entries };
  return {
    body: [
      dailyMarker(date),
      `## OSS Radar — ${date}`,
      "",
      `**Qualified findings:** ${findings.length}/${target}`,
      `**Top unqualified findings:** ${unqualified.length}/${Math.max(0, reviewTarget - findings.length)}`,
      `**Human review queue:** ${reviewQueue.length}/${reviewTarget}`,
      "",
      reviewNote,
      "",
      "Phase 3 classifications are deterministic Radar guidance, not adoption decisions. Human review remains authoritative.",
      "",
      "## Qualified Findings",
      "",
      qualifiedSections,
      "",
      "## Top Unqualified Findings — Review Only",
      "",
      unqualifiedSections,
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
