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
  "architectural-comparators": "Adjacent Systems / Architectural Comparators",
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
  if (lanes.has("architectural-comparators")) {
    categories.add("ARCHITECTURAL COMPARATOR");
    categories.add("AI ARCHITECTURE");
    categories.add("ARCHITECTURE");
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

function candidateConcepts(candidate) {
  return sortedUnique(candidate?.scoreEvidence?.relevance?.evidenceConcepts || []);
}

function candidateText(candidate) {
  return `${candidate?.fullName || ""} ${candidate?.description || ""} ${candidate?.searchableText || ""}`.toLowerCase();
}

function areaAffinity(candidate, area) {
  const laneSet = new Set(candidate?.matchedLaneIds || []);
  const conceptSet = new Set(candidateConcepts(candidate));
  const directLaneHits = (area?.discoveryLaneIds || []).filter((laneId) => laneSet.has(laneId));
  const conceptHits = (area?.evidenceConceptIds || []).filter((conceptId) => conceptSet.has(conceptId));
  const text = candidateText(candidate);
  const keywordHits = (area?.keywords || []).filter((keyword) => text.includes(String(keyword).toLowerCase()));
  const score = (directLaneHits.length * 2) + (conceptHits.length * 3) + Math.min(2, keywordHits.length * 0.5);
  return { score, directLaneHits, conceptHits, keywordHits };
}

function areaFamilies(candidate, area) {
  const allowed = new Set(area?.discoveryLaneIds || []);
  return sortedUnique((candidate?.matchedQueryRefs || [])
    .filter((entry) => allowed.has(entry?.laneId))
    .map((entry) => `${entry.laneId}/${entry.familyId}`));
}

function areaConcepts(candidate, area) {
  const allowed = new Set(area?.evidenceConceptIds || []);
  return candidateConcepts(candidate).filter((concept) => allowed.has(concept));
}

function noveltyBonus(candidate, area, selected) {
  if (!selected.length) return 0;
  const usedFamilies = new Set(selected.flatMap((item) => areaFamilies(item, area)));
  const usedConcepts = new Set(selected.flatMap((item) => areaConcepts(item, area)));
  const newFamilies = areaFamilies(candidate, area).filter((value) => !usedFamilies.has(value)).length;
  const newConcepts = areaConcepts(candidate, area).filter((value) => !usedConcepts.has(value)).length;
  return (Math.min(2, newFamilies) * 2) + (Math.min(3, newConcepts) * 1.25);
}

function selectArchitectureFindings({ candidates, contract, history, reportDate }) {
  const areas = contract?.architectureAreas || [];
  const labels = contract?.report?.humanDispositions || [];
  const perArea = Math.max(1, Number(contract?.report?.findingsPerArea || 3));
  const suppressReviewed = contract?.report?.suppressPreviouslyReviewedWithoutMeaningfulChange !== false;
  const enrichedCandidates = candidates.map((candidate) => enrichCandidate(candidate, labels, contract));
  const used = new Set();
  const suppressedIds = new Set();
  const areaSelections = areas.map((area) => ({ area, findings: [] }));

  for (let round = 0; round < perArea; round += 1) {
    for (const section of areaSelections) {
      const scored = [];
      for (const candidate of enrichedCandidates) {
        const id = String(candidate.repositoryStableId);
        if (used.has(id)) continue;
        const affinity = areaAffinity(candidate, section.area);
        if (affinity.score <= 0) continue;
        const prior = history.get(id);
        const resurfacing = shouldResurface(candidate, prior, reportDate);
        if (suppressReviewed && prior && !resurfacing.allowed) {
          suppressedIds.add(id);
          continue;
        }
        const score = Number(candidate.score || 0)
          + (affinity.score * 1.5)
          + noveltyBonus(candidate, section.area, section.findings);
        scored.push({
          candidate,
          prior,
          resurfacing,
          affinity,
          score,
        });
      }
      scored.sort((left, right) => {
        const scoreDelta = right.score - left.score;
        if (scoreDelta !== 0) return scoreDelta;
        const baseDelta = Number(right.candidate.score || 0) - Number(left.candidate.score || 0);
        if (baseDelta !== 0) return baseDelta;
        return left.candidate.fullName.localeCompare(right.candidate.fullName);
      });
      const winner = scored[0];
      if (!winner) continue;
      const selected = {
        ...winner.candidate,
        previouslyReviewed: Boolean(winner.prior),
        resurfacingReason: winner.resurfacing.reason,
        selectedArchitectureArea: {
          id: section.area.id,
          label: section.area.label,
          backendAlias: section.area.backendAlias,
          description: section.area.description,
        },
        architectureAreaEvidence: {
          affinity: Number(winner.affinity.score.toFixed(2)),
          discoveryLaneHits: winner.affinity.directLaneHits,
          evidenceConceptHits: winner.affinity.conceptHits,
          keywordHits: winner.affinity.keywordHits,
        },
      };
      section.findings.push(selected);
      used.add(String(selected.repositoryStableId));
    }
  }

  const reviewQueue = areaSelections.flatMap((section) => section.findings);
  const qualified = reviewQueue.filter((candidate) => candidate.reviewQualification === "qualified");
  const belowThreshold = reviewQueue.filter((candidate) => candidate.reviewQualification === "below-threshold");
  const target = areas.length * perArea;
  return {
    selected: qualified,
    belowThreshold,
    reviewQueue,
    target,
    reviewTarget: target,
    findingsPerArea: perArea,
    areaSelections,
    suppressed: enrichedCandidates
      .filter((candidate) => suppressedIds.has(String(candidate.repositoryStableId)))
      .map((candidate) => candidate.fullName)
      .sort(),
  };
}

export function selectDailyFindings({ candidates = [], contract, history = new Map(), reportDate }) {
  if (contract?.selectionMode === "architecture-7x3" && Array.isArray(contract?.architectureAreas)) {
    return selectArchitectureFindings({ candidates, contract, history, reportDate });
  }

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
  const concepts = candidateConcepts(candidate);
  const evidenceTargets = candidate?.scoreEvidence?.relevance?.plotPickleTargets || [];
  const area = candidate?.selectedArchitectureArea;
  const learning = concepts.length
    ? `Inspect the documented approach to ${concepts.slice(0, 6).join(", ")}; bounded README/package evidence is a research signal, not proof of implementation fit.`
    : terms.length
      ? `Investigate how the project approaches ${terms.slice(0, 5).join(", ")}; repository metadata alone does not prove implementation fit.`
      : `Investigate the documented approach within ${fit.targets.join(", ") || "its matched Radar lane"}; current evidence does not prove implementation fit.`;
  const status = candidate.reviewQualification === "qualified"
    ? `Meets qualification threshold (${Number(candidate.qualificationThreshold || 0).toFixed(2)}/100).`
    : `Below qualification threshold by ${Number(candidate.qualificationGap || 0).toFixed(2)} points; included because it ranked in today's ${area?.label || "review"} Top 3.`;
  const whyCare = area
    ? `${area.label} (${area.backendAlias}): ${area.description}`
    : `${fit.targets.join(", ") || "Radar evidence"}.`;
  return [
    `### ${index}. [${candidate.fullName}](${candidate.url}) — ${candidate.primaryDisposition}`,
    "",
    candidate.description || "No repository description supplied.",
    "",
    `- **Review status:** ${status}`,
    `- **Enriched PlotPickle Score:** ${Number(candidate.score || 0).toFixed(2)}/100`,
    `- **Discovery Score:** ${Number(candidate.discoveryScore ?? candidate.score ?? 0).toFixed(2)}/100`,
    `- **Evidence stage:** ${candidate.scoreStage === "enriched" ? "bounded README/package enrichment" : "repository metadata"}`,
    `- **Matched discovery queries:** ${sortedUnique(candidate.matchedQueries || []).join(", ") || "none recorded"}`,
    `- **README/package evidence:** ${concepts.length ? concepts.join(", ") : "no bounded concept evidence available"}`,
    `- **Why PlotPickle should care:** ${whyCare}`,
    `- **What can PlotPickle learn from this?** ${learning}`,
    `- **PlotPickle evidence target:** ${evidenceTargets.length ? evidenceTargets.join(", ") : "none evidenced"}`,
    `- **PlotPickle target:** ${area?.backendAlias || fit.targets.join(", ") || "Unmapped; keep under review"}`,
    `- **Architecture-area evidence:** lanes ${candidate?.architectureAreaEvidence?.discoveryLaneHits?.join(", ") || "none"}; concepts ${candidate?.architectureAreaEvidence?.evidenceConceptHits?.join(", ") || "none"}`,
    `- **Craft Module fit:** ${fit.craftModules.length ? fit.craftModules.join(", ") : "none evidenced"}`,
    `- **Related Issue fit:** ${fit.relatedIssues.length ? fit.relatedIssues.map((id) => `#${id}`).join(", ") : "none evidenced"}`,
    `- **Recommended review mode:** ${reviewMode(candidate)}`,
    `- **License:** ${candidate?.license?.spdxId || "UNKNOWN"} (${candidate?.license?.status || "unknown"})`,
    `- **Activity:** ${activityLabel(candidate)}`,
    `- **Review history:** ${candidate.previouslyReviewed ? `seen previously; resurfaced because ${candidate.resurfacingReason}` : "first Radar review"}`,
    `- **Score evidence:** ${sortedUnique(candidate?.scoreEvidence?.reasonCodes || []).join(", ") || "no reason codes"}`,
    "",
  ].join("\n");
}

function architectureSections(selection) {
  return (selection?.areaSelections || []).map((section, areaIndex) => {
    const area = section.area;
    const findings = section.findings || [];
    const findingText = findings.length
      ? findings.map((candidate, index) => findingMarkdown(candidate, index + 1)).join("\n")
      : "No eligible distinct repository was available for this architecture area today.";
    const shortfall = findings.length < Number(selection.findingsPerArea || 3)
      ? `\nOnly ${findings.length}/${Number(selection.findingsPerArea || 3)} real candidates were available after relevance, uniqueness and history suppression.\n`
      : "";
    return [
      `## ${areaIndex + 1}. ${area.label}`,
      "",
      `**Backend alias:** ${area.backendAlias}`,
      "",
      area.description,
      shortfall,
      findingText,
    ].join("\n");
  }).join("\n\n");
}

export function renderDailyReport({ reportDate, selection, contract, history = new Map() }) {
  const date = utcDate(reportDate);
  const findings = selection.selected || [];
  const belowThreshold = selection.belowThreshold || [];
  const reviewQueue = selection.reviewQueue || [...findings, ...belowThreshold];
  const target = selection.target ?? Number(contract?.report?.targetFindings || 5);
  const reviewTarget = selection.reviewTarget ?? target;
  const entries = reviewQueue.map((candidate) => ({
    ...historyEntryForFinding(candidate, date, history.get(String(candidate.repositoryStableId))),
    selectedArchitectureAreaId: candidate?.selectedArchitectureArea?.id || null,
    selectedArchitectureAreaLabel: candidate?.selectedArchitectureArea?.label || null,
  }));

  const adaptive = contract?.selectionMode === "architecture-7x3" && selection?.areaSelections;
  const sections = adaptive
    ? architectureSections(selection)
    : reviewQueue.length
      ? reviewQueue.map((candidate, index) => findingMarkdown(candidate, index + 1)).join("\n")
      : "No non-hard-rejected repository was available for review today.";
  const reviewNote = reviewQueue.length < reviewTarget
    ? `Only ${reviewQueue.length}/${reviewTarget} real review candidates were available after discovery, hard rejection, architecture fit, uniqueness and history suppression. PlotPickle did not invent missing repositories.`
    : adaptive
      ? `Today's review queue contains ${reviewQueue.length} distinct repositories across seven PlotPickle architecture areas. Unchanged previously reviewed repositories are suppressed so the Radar behaves as daily intelligence rather than a persistent leaderboard.`
      : `The daily review queue contains the Top ${reviewQueue.length} real repositories from today's retained candidates. Qualification status is context only and never blanks the report.`;

  const state = { schemaVersion: 1, date, entries };
  return {
    body: [
      dailyMarker(date),
      `## OSS Radar — ${date}`,
      "",
      adaptive ? `**Architecture findings for review:** ${reviewQueue.length}/${reviewTarget}` : `**Top repositories for review:** ${reviewQueue.length}/${reviewTarget}`,
      `**Meets qualification threshold:** ${findings.length}/${reviewQueue.length || 0}`,
      `**Below threshold but included for review:** ${belowThreshold.length}/${reviewQueue.length || 0}`,
      adaptive ? `**Previously reviewed unchanged candidates suppressed:** ${selection?.suppressed?.length || 0}` : "",
      "",
      reviewNote,
      "",
      "Classifications are deterministic Radar guidance, not adoption decisions. Human review remains authoritative.",
      "",
      adaptive ? "## Seven PlotPickle Architecture Areas" : "## Top Repositories for Review",
      "",
      sections,
      "",
      encodeDailyState(state),
    ].filter((line) => line !== null && line !== undefined).join("\n"),
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
