import { utcDate } from "./history.mjs";
import { publicCategory, whyItMatters } from "./public-digest.mjs";

function safe(value) {
  return String(value || "").replace(/\r?\n/gu, " ").trim();
}

export function renderPublicBlogDraft({ reportDate, candidates = [] } = {}) {
  const date = utcDate(reportDate || new Date());
  const selected = candidates.filter(Boolean).slice(0, 7);
  const frontmatter = [
    "---",
    "title: \"OSS Radar — " + date + "\"",
    "date: " + date,
    "series: OSS Radar",
    "status: draft",
    "publicationAuthority: human-only",
    "---",
    "",
  ];
  const intro = [
    "# OSS Radar — " + date,
    "",
    "Open-source projects and patterns worth a closer look for story technology, creative tooling and agentic production.",
    "",
    "This is a public draft generated from PlotPickle's internal OSS Radar. Internal scores, roadmap mapping and security-sensitive observations are intentionally omitted.",
    "",
  ];
  const items = selected.length ? selected.flatMap((candidate, index) => [
    "## " + (index + 1) + ". " + safe(candidate.fullName),
    "",
    "**Category:** " + publicCategory(candidate),
    "",
    safe(candidate.description || "Open-source project surfaced by today's PlotPickle OSS Radar."),
    "",
    "**Why it matters:** " + whyItMatters(candidate),
    "",
    candidate.url ? "**Source:** " + safe(candidate.url) : "",
    candidate.license ? "**License:** " + safe(candidate.license) : "",
    "",
  ].filter(Boolean)) : ["No public candidate cleared today's review queue.", ""];
  return [...frontmatter, ...intro, ...items, "Human review is required before this draft becomes a PlotPickle.com Blog post.", ""].join("\n");
}
