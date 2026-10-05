import { access, readFile } from "node:fs/promises";
import { deriveEnrichmentEvidence } from "../enrichment.mjs";
import { clamp, daysSince } from "../query-normalization.mjs";

export async function loadCreativeFocus() {
  return JSON.parse(await readFile(new URL("../../../../config/oss-radar/creative-focus.json", import.meta.url), "utf8"));
}

function matching(text, definitions) {
  return deriveEnrichmentEvidence(text, { enrichment: { evidenceConcepts: definitions } }).concepts;
}

export function creativeEvidence(text, profile) {
  const anchors = matching(text, Object.entries(profile.anchors).map(([id, phrases]) => ({ id, phrases })));
  const domains = new Set(anchors.map((entry) => entry.id));
  const groups = matching(text, profile.groups).filter((entry) => domains.has(profile.groups.find((group) => group.id === entry.id)?.domain));
  const accessEvidence = matching(text, Object.entries(profile.access).map(([id, phrases]) => ({ id, phrases })));
  const depth = matching(text, Object.entries(profile.depth).filter(([id]) => domains.has(id)).map(([id, phrases]) => ({ id, phrases })));
  return { anchors, groups, access: accessEvidence, depth };
}

export function creativeEnrichmentContract(contract, profile) {
  const definitions = [
    ...profile.groups,
    ...Object.entries(profile.anchors).map(([id, phrases]) => ({ id: `anchor-${id}`, phrases })),
    ...Object.entries(profile.access).map(([id, phrases]) => ({ id: `access-${id}`, phrases })),
    ...Object.entries(profile.depth).map(([id, phrases]) => ({ id: `depth-${id}`, phrases })),
  ].map((entry) => ({ ...entry, id: `creative-${entry.id}` }));
  return { ...contract, enrichment: { ...contract.enrichment,
    evidenceConcepts: [...contract.enrichment.evidenceConcepts, ...definitions],
  } };
}

export function refreshedCreativeEvidence(candidate, profile) {
  const phrases = (candidate.enrichment?.evidenceConcepts || [])
    .filter((entry) => entry.id.startsWith("creative-"))
    .flatMap((entry) => entry.matchedPhrases);
  return creativeEvidence(phrases.join(" "), profile);
}

export function scoreCreativeCandidate(candidate, profile, now = new Date()) {
  const evidence = candidate.focusedEvidence || creativeEvidence(candidate.searchableText || candidate.description || "", profile);
  const counts = Object.fromEntries(["education", "visual"].map((domain) => [domain,
    evidence.groups.filter((entry) => profile.groups.find((group) => group.id === entry.id)?.domain === domain).length,
  ]));
  const strongestDomain = counts.education >= counts.visual ? "education" : "visual";
  const directFit = clamp(Math.max(counts.education, counts.visual) / 4);
  const accessPhrases = evidence.access.reduce((count, entry) => count + entry.matchedPhrases.length, 0);
  const depthPhrases = Math.max(0, ...evidence.depth.map((entry) => entry.matchedPhrases.length));
  const age = daysSince(now, candidate.pushedAt || candidate.updatedAt);
  const activity = age <= 30 ? 1 : age <= 180 ? 0.7 : age <= 365 ? 0.4 : 0.1;
  const ratios = {
    creativeFit: directFit,
    reusableAccess: clamp(accessPhrases / 3),
    teachingPlaybackDepth: clamp(depthPhrases / 3),
    // Candidate evidence suggests extensions; it does not prove a hole in PlotPickle.
    extensionOpportunity: clamp(evidence.groups.length / 3),
    maintenanceMaturity: activity * 0.8 + clamp(Math.log10((candidate.stars || 0) + 1) / 4) * 0.2,
    license: candidate.license?.status === "known-open-source" ? 1 : 0.2,
    localPortability: /\b(?:windows|local-first|local first|offline|cross-platform)\b/iu.test(candidate.searchableText || "")
      || candidate.enrichment?.evidenceConcepts?.some((entry) => ["windows-local", "local-ai"].includes(entry.id)) ? 1 : 0,
  };
  const dimensions = Object.fromEntries(Object.entries(profile.weights).map(([id, weight]) => [id, {
    weight, ratio: Number(ratios[id].toFixed(4)), points: Number((ratios[id] * weight).toFixed(2)),
  }]));
  const score = Number(Object.values(dimensions).reduce((sum, item) => sum + item.points, 0).toFixed(2));
  const refreshed = candidate.enrichment?.readme?.status === "success";
  return { ...candidate, focusedScore: score, focusedEvidence: evidence, focusedDimensions: dimensions,
    focusedDomain: strongestDomain, focusedEligible: refreshed && directFit > 0 && score >= profile.minimumScore };
}

export function rankCreative(candidates) {
  return [...candidates].sort((a, b) => b.focusedScore - a.focusedScore
    || String(b.pushedAt || "").localeCompare(String(a.pushedAt || "")) || a.fullName.localeCompare(b.fullName));
}

export function balancedCreativeShortlist(candidates, profile, limit) {
  const eligible = rankCreative(candidates.map((candidate) => scoreCreativeCandidate(candidate, profile)))
    .filter((candidate) => candidate.focusedEvidence.groups.length);
  const selected = new Map();
  const lanes = ["education", "visual"].map((domain) => eligible.filter((candidate) => candidate.focusedEvidence.groups
    .some((entry) => profile.groups.find((group) => group.id === entry.id)?.domain === domain)));
  for (let index = 0; index < eligible.length && selected.size < limit; index += 1) {
    for (const lane of lanes) {
      if (lane[index] && selected.size < limit) selected.set(lane[index].fullName.toLowerCase(), lane[index]);
    }
  }
  return [...selected.values()];
}

export async function loadCreativeBaseline() {
  const index = JSON.parse(await readFile(new URL("../../../../learn/index.json", import.meta.url), "utf8"));
  const registry = JSON.parse(await readFile(new URL("../../../../config/agent-skills.json", import.meta.url), "utf8"));
  return { skills: registry.skills.map(({ id, name, entry }) => ({ id, name, path: entry })), lessonCount: index.lessonCount, topics: index.files.map(({ topic, title, lessonCount, file }) => ({
    id: topic, title, lessonCount, path: `learn/${file}`,
  })) };
}

export async function describeCreativeCoverage(candidate, profile, baseline) {
  const groups = profile.groups.filter((group) => candidate.focusedEvidence.groups.some((entry) => entry.id === group.id));
  const topics = baseline.topics.filter((topic) => groups.some((group) => group.topic === topic.id));
  const paths = [];
  for (const source of [...new Set(groups.flatMap((group) => group.baselinePaths))]) {
    try {
      await access(new URL(`../../../../${source}`, import.meta.url));
      paths.push(source);
    } catch { continue; }
  }
  const relevantSkillIds = new Set(groups.flatMap((group) => group.baselineSkillIds || []));
  const skills = baseline.skills.filter((skill) => relevantSkillIds.has(skill.id));
  return { topics, paths, skills,
    proposedExtension: `Review ${groups.map((group) => group.label.toLowerCase()).join(", ")} for deeper examples, reusable procedures or workflow support; a missing capability is not yet established.`,
  };
}
