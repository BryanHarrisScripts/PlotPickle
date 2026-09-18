import { utcDate } from "./history.mjs";

function sortedUnique(values = []) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function compactText(value, max = 180) {
  const text = String(value || "").replace(/\s+/gu, " ").trim();
  if (!text) return "Open-source project surfaced by today's PlotPickle OSS Radar.";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function publicCategory(candidate) {
  const lanes = new Set(candidate?.matchedLaneIds || []);
  const concepts = sortedUnique(candidate?.scoreEvidence?.relevance?.evidenceConcepts || []);
  const text = `${candidate?.description || ""} ${concepts.join(" ")} ${candidate?.searchableText || ""}`.toLowerCase();

  if (lanes.has("writer-craft") || lanes.has("learn-education")) return "WRITING";
  if (lanes.has("visual-story")) return "STORYBOARD";
  if (lanes.has("ai-architecture")) return "AGENTS";
  if (lanes.has("platform-engineering") && /local|windows|offline|desktop/u.test(text)) return "LOCAL AI";
  if (/storyboard|previs|shot|cinematic/u.test(text)) return "STORYBOARD";
  if (/production|render|edit|timeline|ffmpeg|delivery/u.test(text)) return "PRODUCTION";
  if (/video|multimodal|motion|tts|audio/u.test(text)) return "VIDEO";
  if (/agent|mcp|a2a|skill/u.test(text)) return "AGENTS";
  return "OPEN SOURCE";
}

export function whyItMatters(candidate) {
  if (candidate?.selectedArchitectureArea?.label) {
    return `${candidate.selectedArchitectureArea.label}: ${candidate.selectedArchitectureArea.description || "a transferable architectural idea for PlotPickle."}`;
  }
  switch (publicCategory(candidate)) {
    case "WRITING":
      return "Useful reference for how open tools support writers, story development or creative learning.";
    case "STORYBOARD":
      return "Relevant to the handoff from written story intent into storyboard, shot planning or previs.";
    case "VIDEO":
      return "Shows another approach to translating structured creative intent into audiovisual output.";
    case "PRODUCTION":
      return "Useful production reference for moving approved creative work through execution, review or delivery.";
    case "AGENTS":
      return "Useful architecture reference for keeping agents, skills and external tools modular rather than tightly coupled.";
    case "LOCAL AI":
      return "Relevant to local-first creative workflows, portability and keeping cloud providers optional.";
    default:
      return "Worth reviewing as another open-source approach that may transfer into PlotPickle.";
  }
}

function publicItem(candidate, index) {
  const category = publicCategory(candidate);
  const area = candidate?.selectedArchitectureArea?.backendAlias
    ? ` / ${candidate.selectedArchitectureArea.backendAlias}`
    : "";
  return [
    `${index}. ${candidate.fullName} — ${category}${area}`,
    compactText(candidate.description),
    `Why it matters: ${whyItMatters(candidate)}`,
    candidate.url,
  ].join("\n");
}

function sampleAcrossArchitectureAreas(candidates = []) {
  const queue = candidates.filter(Boolean);
  const seen = new Set();
  const sampled = [];
  for (const candidate of queue) {
    const areaId = candidate?.selectedArchitectureArea?.id;
    if (!areaId || seen.has(areaId)) continue;
    seen.add(areaId);
    sampled.push(candidate);
    if (sampled.length >= 7) return sampled;
  }
  if (!sampled.length) return queue.slice(0, 7);
  return sampled;
}

export function renderXReadyDigest({ reportDate, candidates = [] } = {}) {
  const date = utcDate(reportDate || new Date());
  const queue = sampleAcrossArchitectureAreas(candidates);
  const items = queue.length
    ? queue.map((candidate, index) => publicItem(candidate, index + 1)).join("\n\n")
    : "No repository cleared today's real review queue, so there is nothing to pad into a post.";

  return [
    `🎬 Story-to-Screen OSS Radar — ${date}`,
    "",
    "Open-source work around AI filmmaking keeps expanding. Here are today's projects worth a look:",
    "",
    items,
    "",
    "Presented by PlotPickle — Today’s OSS Radar tracks useful ideas, emerging patterns and different approaches across the open-source script-to-screen ecosystem.",
    "",
    "#OpenSource #AI #Filmmaking #Screenwriting #GenerativeAI",
  ].join("\n");
}

export function renderRadarReviewEmail({ reportDate, candidates = [], publicDigest, reportUrl } = {}) {
  const date = utcDate(reportDate || new Date());
  const digest = publicDigest || renderXReadyDigest({ reportDate: date, candidates });
  const links = candidates.filter(Boolean).map((candidate) => {
    const area = candidate?.selectedArchitectureArea?.backendAlias ? ` [${candidate.selectedArchitectureArea.backendAlias}]` : "";
    return `- ${candidate.fullName}${area}: ${candidate.url}`;
  });
  const body = [
    `PlotPickle OSS Radar — ${date}`,
    "",
    "Review the public draft below. It is intentionally stripped of internal PlotPickle scores, issue IDs, evidence lanes and implementation notes so it can be copied directly to X after your review.",
    "",
    "----- COPY FOR X -----",
    digest,
    "----- END COPY -----",
    "",
    "Internal architecture-review repository links:",
    ...(links.length ? links : ["- No public repository links today."]),
    ...(reportUrl ? ["", `Internal Radar report: ${reportUrl}`] : []),
  ].join("\n");
  return {
    subject: `PlotPickle OSS Radar - ${date} - X draft`,
    body,
  };
}
