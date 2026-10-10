import { discoverGitHubRepositories } from "../discover-github.mjs";
import { enrichRepositoryCandidate } from "../enrichment.mjs";
import { monthlyIssueTitle, utcDate } from "../history.mjs";
import { listIssueComments, searchRadarIssues } from "../issue-lifecycle.mjs";
import { filterCandidate, mergeDuplicateCandidates, normalizeRepository } from "../query-normalization.mjs";
import {
  balancedCreativeShortlist, creativeEnrichmentContract, describeCreativeCoverage,
  loadCreativeBaseline, loadCreativeFocus, rankCreative, refreshedCreativeEvidence, scoreCreativeCandidate,
} from "./score.mjs";

export function focusedMonthlyTitles(now) {
  const previous = new Date(now);
  previous.setUTCDate(1);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  return [monthlyIssueTitle(previous), monthlyIssueTitle(now)];
}

// The prior *published* creative selection is the authority, not yesterday's score.
// Same-date reruns deliberately ignore today's comment, even when it already exists.
export function latestPriorCreativeSelection(comments, now = new Date()) {
  const today = utcDate(now);
  const heading = "## Creative Focus — Storytelling Education and Visual Production Top 3";
  const reports = new Map();
  for (const comment of comments || []) {
    const body = String(comment?.body || "");
    const date = body.match(/PLOTPICKLE-OSS-RADAR-DAY:(\d{4}-\d{2}-\d{2})/u)?.[1];
    if (!date || date >= today) continue;
    const start = body.indexOf(heading);
    if (start < 0) continue;
    const section = body.slice(start + heading.length).split(/^## /mu)[0];
    const repositories = new Set();
    for (const match of section.matchAll(/^### Focus \d+\. \[([a-z0-9_.-]+\/[a-z0-9_.-]+)\]\(https:\/\/github\.com\/([a-z0-9_.-]+\/[a-z0-9_.-]+)\)/gimu)) {
      if (match[1].toLowerCase() === match[2].toLowerCase()) repositories.add(match[1].toLowerCase());
    }
    if (reports.has(date)) throw new Error("Duplicate Creative Focus reports for " + date);
    reports.set(date, { reportDate: date, repositories: [...repositories] });
  }
  return [...reports.values()].sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0]
    || { reportDate: null, repositories: [] };
}

export function historicalCreativeSeeds(comments) {
  const seeds = new Map();
  for (const comment of [...comments].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    const date = String(comment.body || "").match(/PLOTPICKLE-OSS-RADAR-DAY:(\d{4}-\d{2}-\d{2})/u)?.[1];
    if (!date) continue;
    const parts = comment.body.split(/^### \d+\. /mu).slice(1);
    for (const part of parts) {
      const heading = part.match(/^\[([a-z0-9_.-]+\/[a-z0-9_.-]+)\]\(https:\/\/github\.com\/([a-z0-9_.-]+\/[a-z0-9_.-]+)\)/iu);
      if (!heading || heading[1].toLowerCase() !== heading[2].toLowerCase()) continue;
      const section = part.split(/^## /mu)[0];
      const fullName = heading[1];
      const prior = seeds.get(fullName.toLowerCase());
      const score = section.match(/(?:Enriched PlotPickle Score|Discovery Score):\*\*\s*([\d.]+)\/100/u);
      seeds.set(fullName.toLowerCase(), {
        fullName, url: `https://github.com/${fullName}`,
        // Preserve only bounded evidence already in the report, never hidden state.
        searchableText: section.slice(0, 6000).toLowerCase(),
        description: section.split("\n\n")[1]?.slice(0, 500) || "",
        origin: "historical-radar", broadScore: score ? Number(score[1]) : null,
        provenance: [...(prior?.provenance || []), { date, url: comment.html_url }],
      });
    }
  }
  return [...seeds.values()];
}

async function repositoryMetadata(fullName, { auth, fetchImpl }) {
  const response = await fetchImpl(`https://api.github.com/repos/${fullName}`, {
    method: "GET", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${auth}` },
  });
  if (!response.ok) throw new Error(`metadata HTTP ${response.status}`);
  return response.json();
}

function focusedSearchContract(contract, profile) {
  return { ...contract, selectionMode: "creative-companion", architectureAreas: [],
    lanes: profile.queryFamilies.map((family) => ({ id: family.laneId, enabled: true, queryFamilies: [family] })),
    discoveryBudget: { ...contract.discoveryBudget, perQueryResultCap: 8, rawResultBudget: 64, enrichmentShortlistSize: 0 },
  };
}

function focusedRefreshEntry() {
  return { laneId: "writer-craft", familyId: "creative-history", query: "storytelling visual production" };
}

export async function runCreativeReview({ repository, auth, contract, fetchImpl = globalThis.fetch,
  now = new Date(), currentCandidates = [], comments = null, freshResult = null, profile = null,
} = {}) {
  const focus = profile || await loadCreativeFocus();
  if (!focus.enabled) return { status: "disabled", selected: [] };
  const warnings = [];
  let historyComments = comments;
  if (historyComments === null) {
    historyComments = [];
    try {
      const titles = focusedMonthlyTitles(now);
      const issues = await searchRadarIssues({ repository, auth, fetchImpl });
      for (const issue of issues.filter((item) => titles.includes(item.title))) {
        historyComments.push(...await listIssueComments({ repository, issueNumber: issue.number, auth, fetchImpl }));
      }
    } catch {
      // No verified previous Top 3 means no Creative Focus publishing: fail closed.
      return { schemaVersion: 1, issue: focus.issue, reportDate: utcDate(now),
        status: "unavailable", selected: [], warnings: ["Creative Focus report history is unavailable; no unverified repeat selections were published."] };
    }
  }
  const priorCreative = latestPriorCreativeSelection(historyComments, now);
  const blocked = new Set(priorCreative.repositories);
  // Ignore the current dated report on same-day reruns: it must not seed a different shortlist.
  const priorComments = historyComments.filter((comment) => {
    const date = String(comment?.body || "").match(/PLOTPICKLE-OSS-RADAR-DAY:(\d{4}-\d{2}-\d{2})/u)?.[1];
    return date && date < utcDate(now);
  });
  const seeds = historicalCreativeSeeds(priorComments);
  const historicalByName = new Map(seeds.map((seed) => [seed.fullName.toLowerCase(), seed]));
  const historical = balancedCreativeShortlist(seeds.filter((item) => !blocked.has(item.fullName.toLowerCase())), focus, focus.historyRefreshLimit);
  let fresh = freshResult;
  if (fresh === null) {
    try {
      fresh = await discoverGitHubRepositories({ contract: focusedSearchContract(contract, focus), token: auth, fetchImpl, now, enrich: false });
    } catch { warnings.push("Focused GitHub discovery failed; historical/current candidates only."); }
  }
  const recent = mergeDuplicateCandidates([...(fresh?.candidates || []), ...currentCandidates])
    .filter((item) => !blocked.has(item.fullName.toLowerCase()));
  const freshShortlist = balancedCreativeShortlist(recent, focus, focus.freshRefreshLimit);
  const queue = new Map(historical.map((candidate) => [candidate.fullName.toLowerCase(), candidate]));
  for (const candidate of freshShortlist) {
    const key = candidate.fullName.toLowerCase();
    queue.set(key, { ...candidate, origin: "fresh-github", ...historicalByName.get(key), ...queue.get(key) });
  }
  const enriched = [];
  const failures = [];
  const enrichmentContract = creativeEnrichmentContract(contract, focus);
  const baseline = await loadCreativeBaseline();
  for (const seed of queue.values()) {
    try {
      const raw = await repositoryMetadata(seed.fullName, { auth, fetchImpl });
      const candidate = { ...normalizeRepository(raw, focusedRefreshEntry()),
        origin: seed.origin, broadScore: seed.broadScore ?? null, provenance: seed.provenance || [],
      };
      const filtered = filterCandidate(candidate, contract, now);
      if (filtered.rejected) { failures.push({ fullName: seed.fullName, reasons: filtered.reasons }); continue; }
      const refreshed = await enrichRepositoryCandidate(candidate, { contract: enrichmentContract, token: auth, fetchImpl });
      const scored = scoreCreativeCandidate({ ...refreshed, focusedEvidence: refreshedCreativeEvidence(refreshed, focus) }, focus, now);
      if (!scored.focusedEligible) {
        failures.push({ fullName: seed.fullName, unavailable: refreshed.enrichment.readme.status !== "success", reasons: [refreshed.enrichment.readme.status !== "success"
          ? `README ${refreshed.enrichment.readme.status}` : "insufficient direct creative evidence or focused score"] });
        continue;
      }
      scored.coverage = await describeCreativeCoverage(scored, focus, baseline);
      enriched.push(scored);
    } catch { failures.push({ fullName: seed.fullName, unavailable: true, reasons: ["GitHub metadata/enrichment unavailable"] }); }
  }
  const ranked = rankCreative(enriched).filter((item) => !blocked.has(item.fullName.toLowerCase()));
  const selected = ranked.slice(0, focus.targetFindings);
  const historicalTop = rankCreative(enriched.filter((candidate) => candidate.provenance.length)).slice(0, focus.targetFindings);
  const selectedNames = new Set(selected.map((candidate) => candidate.fullName));
  return { schemaVersion: 1, issue: focus.issue, profile: "story-education-and-visual-production", reportDate: utcDate(now),
    status: warnings.length || failures.some((item) => item.unavailable) || selected.length < focus.targetFindings ? "partial" : "available", warnings,
    dailyNovelty: { previousReportDate: priorCreative.reportDate, excludedRepositories: priorCreative.repositories,
      target: focus.targetFindings, selected: selected.length, shortfall: Math.max(0, focus.targetFindings - selected.length) },
    historicalMonths: focusedMonthlyTitles(now), historicalScanned: seeds.length, historicalRefreshed: historical.length,
    freshQueriesExecuted: fresh?.executedQueryCount || 0, freshCandidatesExamined: fresh?.uniqueCandidateCount || 0,
    refreshAttempted: queue.size, revalidated: enriched.length, baseline, selected, failures,
    historicalComparison: historicalTop.map((candidate) => ({ fullName: candidate.fullName, focusedScore: candidate.focusedScore,
      result: selectedNames.has(candidate.fullName) ? "held" : "displaced by higher focused score" })),
    candidates: ranked,
  };
}
