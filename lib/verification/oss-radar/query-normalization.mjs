const UNKNOWN_LICENSE_IDS = new Set(["", "NOASSERTION", "OTHER"]);
const EXPLICITLY_UNUSABLE_LICENSE_IDS = new Set(["UNLICENSED", "PROPRIETARY"]);
const REVIEWABLE_OPEN_SOURCE_IDS = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0",
  "GPL-3.0-only", "GPL-3.0-or-later", "LGPL-3.0-only", "LGPL-3.0-or-later",
  "AGPL-3.0-only", "AGPL-3.0-or-later",
]);
const STOP_WORDS = new Set(["and", "for", "from", "into", "open", "source", "the", "with", "tool", "tools"]);

export const LOCAL_TERMS = ["windows", "desktop", "local", "offline", "ollama", "comfyui", "whisper", "speech", "voice"];

export function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysSince(now, value) {
  const current = asDate(now);
  const target = asDate(value);
  if (!current || !target) return Number.POSITIVE_INFINITY;
  return Math.max(0, (current.getTime() - target.getTime()) / 86_400_000);
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function tokenize(value) {
  return uniqueSorted(
    String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9+#.-]+/u)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  );
}

export function buildGitHubSearchQuery(query, defaults, now = new Date()) {
  const terms = String(query || "").trim();
  if (!terms) throw new Error("OSS Radar query text is required.");
  const recencyDays = Math.max(1, Number(defaults?.recencyDays || 180));
  const minimumStars = Math.max(0, Number(defaults?.minimumStars || 0));
  const start = new Date(asDate(now)?.getTime() ?? Date.now());
  start.setUTCDate(start.getUTCDate() - recencyDays);
  return `${terms} pushed:>=${start.toISOString().slice(0, 10)} stars:>=${minimumStars}`;
}

export function buildGitHubSearchUrl({ query, defaults, now = new Date(), perPage = 10 }) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", buildGitHubSearchQuery(query, defaults, now));
  url.searchParams.set("sort", "updated");
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(Math.min(50, Math.max(1, Number(perPage || 10)))));
  return url.toString();
}

export function classifyLicense(rawLicense) {
  const spdxId = String(rawLicense?.spdx_id || "").trim();
  if (EXPLICITLY_UNUSABLE_LICENSE_IDS.has(spdxId)) {
    return { spdxId, status: "explicitly-unusable", adoptionEligibleForHumanReview: false };
  }
  if (UNKNOWN_LICENSE_IDS.has(spdxId)) {
    return { spdxId: spdxId || "UNKNOWN", status: "unknown", adoptionEligibleForHumanReview: false };
  }
  if (REVIEWABLE_OPEN_SOURCE_IDS.has(spdxId)) {
    return { spdxId, status: "known-open-source", adoptionEligibleForHumanReview: true };
  }
  return { spdxId, status: "review-required", adoptionEligibleForHumanReview: false };
}

export function normalizeRepository(raw, { laneId, query }) {
  const fullName = String(raw?.full_name || "").trim();
  const name = String(raw?.name || fullName.split("/").at(-1) || "").trim();
  const topics = Array.isArray(raw?.topics) ? raw.topics.map((topic) => String(topic).toLowerCase()) : [];
  const language = raw?.language ? String(raw.language) : null;
  const description = raw?.description ? String(raw.description) : "";
  const license = classifyLicense(raw?.license);
  return {
    repositoryStableId: String(raw?.id ?? raw?.node_id ?? fullName.toLowerCase()),
    fullName,
    name,
    url: String(raw?.html_url || ""),
    description,
    ownerType: raw?.owner?.type ? String(raw.owner.type) : null,
    language,
    topics: uniqueSorted(topics),
    stars: Math.max(0, Number(raw?.stargazers_count || 0)),
    forks: Math.max(0, Number(raw?.forks_count || 0)),
    openIssues: Math.max(0, Number(raw?.open_issues_count || 0)),
    archived: Boolean(raw?.archived),
    fork: Boolean(raw?.fork),
    license,
    createdAt: raw?.created_at || null,
    updatedAt: raw?.updated_at || null,
    pushedAt: raw?.pushed_at || raw?.updated_at || null,
    defaultBranch: raw?.default_branch ? String(raw.default_branch) : null,
    matchedLaneIds: uniqueSorted([laneId]),
    matchedQueries: uniqueSorted([query]),
    searchableText: [name, fullName, description, language || "", ...topics].join(" ").toLowerCase(),
  };
}

export function mergeDuplicateCandidates(candidates) {
  const byRepository = new Map();
  for (const candidate of candidates) {
    const key = candidate.repositoryStableId || candidate.fullName.toLowerCase();
    const current = byRepository.get(key);
    if (!current) {
      byRepository.set(key, { ...candidate });
      continue;
    }
    const descriptions = uniqueSorted([current.description, candidate.description]).sort(
      (left, right) => right.length - left.length || left.localeCompare(right),
    );
    byRepository.set(key, {
      ...current,
      description: descriptions[0] || "",
      searchableText: uniqueSorted(tokenize(`${current.searchableText} ${candidate.searchableText}`)).join(" "),
      matchedLaneIds: uniqueSorted([...current.matchedLaneIds, ...candidate.matchedLaneIds]),
      matchedQueries: uniqueSorted([...current.matchedQueries, ...candidate.matchedQueries]),
      topics: uniqueSorted([...current.topics, ...candidate.topics]),
      stars: Math.max(current.stars, candidate.stars),
      forks: Math.max(current.forks, candidate.forks),
      openIssues: Math.max(current.openIssues, candidate.openIssues),
      updatedAt: [current.updatedAt, candidate.updatedAt].filter(Boolean).sort().at(-1) || null,
      pushedAt: [current.pushedAt, candidate.pushedAt].filter(Boolean).sort().at(-1) || null,
    });
  }
  return [...byRepository.values()];
}

export function filterCandidate(candidate, contract, now = new Date()) {
  const reasons = [];
  if (!candidate.fullName || !candidate.url) reasons.push("missing-identity");
  if (contract.filters.hardReject.archived && candidate.archived) reasons.push("archived");
  if (contract.filters.hardReject.clearlyIncompatibleLicense && candidate.license.status === "explicitly-unusable") {
    reasons.push("explicitly-unusable-license");
  }
  const activityAgeDays = daysSince(now, candidate.pushedAt || candidate.updatedAt);
  if (activityAgeDays > Number(contract.filters.activity.rejectAfterDays || 730)) reasons.push("stale");
  if (!candidate.matchedLaneIds.length || !candidate.matchedQueries.length) reasons.push("no-discovery-evidence");
  return { rejected: reasons.length > 0, reasons, activityAgeDays };
}
