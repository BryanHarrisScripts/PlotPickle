import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  configuredQueries,
  diagnoseGitHubRepository,
  discoverGitHubRepositories,
} from "../lib/verification/oss-radar/discover-github.mjs";
import {
  deriveEnrichmentEvidence,
  enrichRepositoryCandidate,
} from "../lib/verification/oss-radar/enrichment.mjs";
import {
  accumulateQueryEffectiveness,
  encodeDailyState,
  reconstructQueryEffectiveness,
} from "../lib/verification/oss-radar/history.mjs";
import { publishDailyRadar } from "../lib/verification/oss-radar/issue-lifecycle.mjs";
import { normalizeRepository } from "../lib/verification/oss-radar/query-normalization.mjs";

const contract = JSON.parse(await readFile("config/oss-radar/discovery-contract.json", "utf8"));
const fixture = JSON.parse(await readFile("tests/fixtures/oss-radar/issue-2034-inkos.json", "utf8"));
const workflow = await readFile(".github/workflows/oss-radar.yml", "utf8");
const enrichmentSource = await readFile("lib/verification/oss-radar/enrichment.mjs", "utf8");

function contentResponse(text, status = 200, overrides = {}) {
  const content = Buffer.from(String(text), "utf8");
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      if (status === 404) return { message: "Not Found" };
      return {
        encoding: "base64",
        size: content.byteLength,
        content: content.toString("base64"),
        ...overrides,
      };
    },
  };
}

function repository(overrides = {}) {
  return {
    ...structuredClone(fixture.repository),
    ...overrides,
    owner: { ...fixture.repository.owner, ...(overrides.owner || {}) },
    license: { ...fixture.repository.license, ...(overrides.license || {}) },
  };
}

function recallContract({ enrichment = true, rawBudget = 20, perQuery = 5, shortlist = 5 } = {}) {
  const next = structuredClone(contract);
  next.lanes = [
    {
      id: "architectural-comparators",
      label: "Adjacent Systems / Architectural Comparators",
      enabled: true,
      weight: 1,
      queryFamilies: [{ id: "creative-systems", label: "Creative systems", queries: ["AI creative workbench"] }],
    },
    {
      id: "ai-architecture",
      label: "AI Architecture",
      enabled: true,
      weight: 1,
      queryFamilies: [{ id: "runtime-tools", label: "Runtime", queries: ["agent runtime"] }],
    },
  ];
  next.discoveryBudget = {
    ...next.discoveryBudget,
    perQueryResultCap: perQuery,
    rawResultBudget: rawBudget,
    enrichmentShortlistSize: shortlist,
  };
  next.enrichment.enabled = enrichment;
  return next;
}

function searchAndContentFixture({ includeContender = true, blocked = null } = {}) {
  const calls = [];
  const contender = repository({
    id: 2034002,
    name: "metadata-champion",
    full_name: "fixture/metadata-champion",
    html_url: "https://github.com/fixture/metadata-champion",
    description: "AI creative workbench with current architecture patterns.",
    topics: ["ai","creative","workbench"],
    stargazers_count: 5000,
    forks_count: 500,
  });
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push({ method: options.method || "GET", pathname: url.pathname, query: url.searchParams.get("q"), perPage: url.searchParams.get("per_page") });
    if (url.pathname === "/search/repositories") {
      const query = url.searchParams.get("q") || "";
      const items = query.startsWith("AI creative workbench")
        ? [repository(), ...(includeContender ? [contender] : []), ...(blocked ? [blocked] : [])]
        : [repository()];
      return { ok: true, status: 200, json: async () => ({ items }) };
    }
    if (url.pathname === "/repos/Narcooo/inkos/readme") return contentResponse(fixture.syntheticReadme);
    if (url.pathname === "/repos/Narcooo/inkos/contents/package.json") {
      return contentResponse(JSON.stringify(fixture.syntheticManifest));
    }
    if (url.pathname === "/repos/fixture/metadata-champion/readme") return contentResponse("A generic web application.");
    if (url.pathname === "/repos/fixture/metadata-champion/contents/package.json") return contentResponse("", 404);
    if (blocked && url.pathname.includes("/blocked/")) throw new Error("Hard-rejected repository reached enrichment");
    return contentResponse("", 404);
  };
  return { calls, fetchImpl, contender };
}

test("#2034 replaces compound discovery with 19-40 atomic queries and a bounded comparator lane", () => {
  const queries = configuredQueries(contract);
  assert.equal(queries.length, 26);
  assert.ok(queries.length >= 19 && queries.length <= 40);
  assert.equal(new Set(queries.map((entry) => entry.queryId)).size, queries.length);
  assert.equal(new Set(queries.map((entry) => entry.query)).size, queries.length);
  assert.ok(queries.some((entry) => entry.laneId === "architectural-comparators"));
  assert.ok(queries.some((entry) => entry.query === "agent runtime"));
  assert.ok(queries.some((entry) => entry.query === "story engine"));
  assert.ok(queries.some((entry) => entry.query === "AI creative workbench"));
  assert.ok(!queries.some((entry) => entry.query === "agent runtime orchestration context memory evaluation"));
  assert.equal(contract.discoveryBudget.perQueryResultCap, 19);
  assert.equal(contract.discoveryBudget.rawResultBudget, 500);
  assert.equal(queries.length * contract.discoveryBudget.perQueryResultCap, 494);
  assert.ok(queries.length * contract.discoveryBudget.perQueryResultCap <= contract.discoveryBudget.rawResultBudget);
});

test("#2034 enforces the raw-pointer budget and deduplicates across atomic queries", async () => {
  const bounded = recallContract({ enrichment: false, rawBudget: 3, perQuery: 2 });
  const client = searchAndContentFixture();
  const result = await discoverGitHubRepositories({
    contract: bounded,
    token: "fixture-token",
    fetchImpl: client.fetchImpl,
    now: new Date(fixture.now),
  });
  assert.equal(result.rawResultCount, 3);
  assert.equal(result.rawResultBudget, 3);
  assert.equal(result.uniqueCandidateCount, 2);
  assert.equal(result.executedQueryCount, 2);
  assert.deepEqual(client.calls.filter((call) => call.pathname === "/search/repositories").map((call) => call.perPage), ["2", "1"]);
  const inkos = result.candidates.find((candidate) => candidate.fullName === "Narcooo/inkos");
  assert.ok(inkos);
  assert.equal(inkos.matchedQueryRefs.length, 2);
});

test("#2034 hard-rejects incompatible licences before any README or manifest request", async () => {
  const blocked = repository({
    id: 2034003,
    name: "blocked-system",
    full_name: "blocked/system",
    html_url: "https://github.com/blocked/system",
    description: "AI creative workbench agent runtime.",
    license: { spdx_id: "UNLICENSED" },
  });
  const client = searchAndContentFixture({ includeContender: false, blocked });
  const result = await discoverGitHubRepositories({
    contract: recallContract(),
    token: "fixture-token",
    fetchImpl: client.fetchImpl,
    now: new Date(fixture.now),
  });
  assert.equal(result.rejectionReasons["explicitly-unusable-license"], 1);
  assert.ok(!client.calls.some((call) => call.pathname.includes("/blocked/")));
  assert.ok(!result.candidates.some((candidate) => candidate.fullName === "blocked/system"));
});

test("#2034 moves the InkOS sentinel through discovery, enrichment and strong final relevance", async () => {
  const client = searchAndContentFixture();
  const result = await discoverGitHubRepositories({
    contract: recallContract(),
    token: "fixture-token",
    fetchImpl: client.fetchImpl,
    now: new Date(fixture.now),
    diagnosticTargetFullName: "Narcooo/inkos",
  });
  const inkos = result.candidates.find((candidate) => candidate.fullName === "Narcooo/inkos");
  const contender = result.candidates.find((candidate) => candidate.fullName === "fixture/metadata-champion");
  assert.ok(inkos && contender);
  assert.equal(inkos.scoreStage, "enriched");
  assert.ok(inkos.score > inkos.discoveryScore);
  assert.ok(inkos.scoreEvidence.dimensions.aiArchitectureValue.points >= 8);
  assert.ok(inkos.scoreEvidence.dimensions.storyGameEngineValue.points >= 6);
  assert.ok(inkos.enrichment.evidenceConcepts.some((entry) => entry.id === "agent-runtime"));
  assert.ok(inkos.enrichment.evidenceConcepts.some((entry) => entry.id === "story-state"));
  assert.ok(inkos.enrichment.evidenceConcepts.some((entry) => entry.id === "atomic-persistence"));
  assert.ok(result.candidates.indexOf(inkos) < result.candidates.indexOf(contender), "Final rank must use enriched evidence, not metadata ranking alone");
  assert.equal(result.diagnostic.seenInRawDiscovery, true);
  assert.equal(result.diagnostic.retainedAfterHardRejection, true);
  assert.equal(result.diagnostic.enrichmentAttempted, true);
  assert.equal(result.diagnostic.finalRank, 1);
});

test("#2034 handles missing, oversized and malformed enrichment sources without failing discovery", async () => {
  const candidate = normalizeRepository(repository(), {
    queryId: "architectural-comparators/creative-systems/01",
    laneId: "architectural-comparators",
    familyId: "creative-systems",
    query: "AI creative workbench",
  });
  const calls = [];
  const enriched = await enrichRepositoryCandidate(candidate, {
    contract,
    token: "fixture-token",
    fetchImpl: async (input, options = {}) => {
      const url = new URL(String(input));
      calls.push({ method: options.method, pathname: url.pathname });
      if (url.pathname.endsWith("/readme")) {
        return contentResponse("", 200, { size: contract.enrichment.readmeMaxBytes + 1 });
      }
      return contentResponse("{not-json");
    },
  });
  assert.equal(enriched.enrichment.readme.status, "oversized");
  assert.equal(enriched.enrichment.manifest.status, "malformed");
  assert.equal(enriched.enrichment.evidenceAvailable, false);
  assert.ok(calls.every((call) => call.method === "GET"));
});

test("#2034 treats adversarial README text as inert data and retains derived evidence only", async () => {
  const candidate = normalizeRepository(repository(), {
    queryId: "ai-architecture/runtime-tools/01",
    laneId: "ai-architecture",
    familyId: "runtime-tools",
    query: "agent runtime",
  });
  const enriched = await enrichRepositoryCandidate(candidate, {
    contract,
    token: "fixture-token",
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      return url.pathname.endsWith("/readme")
        ? contentResponse(fixture.adversarialReadme)
        : contentResponse("", 404);
    },
  });
  const persisted = JSON.stringify(enriched.enrichment);
  assert.equal(enriched.enrichment.executionAuthority, false);
  assert.equal(enriched.enrichment.trust, "untrusted-research-data");
  assert.ok(enriched.enrichment.evidenceConcepts.some((entry) => entry.id === "agent-runtime"));
  assert.ok(!persisted.includes("rm -rf"));
  assert.ok(!persisted.includes("Ignore prior instructions"));
  assert.doesNotMatch(enrichmentSource, /node:child_process|\\bexec\\s*\\(|\\bspawn\\s*\\(|\\beval\\s*\\(|\\bimport\\s*\\(/u);
});

test("#2034 records discovery blind spots and per-query Top-5 contribution evidence", async () => {
  const client = searchAndContentFixture();
  const result = await discoverGitHubRepositories({
    contract: recallContract(),
    token: "fixture-token",
    fetchImpl: client.fetchImpl,
    now: new Date(fixture.now),
  });
  const coverage = result.discoveryCoverage;
  assert.equal(coverage.queriesExecuted.length, 2);
  assert.equal(coverage.queryFamiliesRepresented.length, 2);
  assert.deepEqual(coverage.lanesRepresented, ["ai-architecture", "architectural-comparators"]);
  assert.ok(coverage.candidatesMatchingMultipleLanes >= 1);
  assert.equal(coverage.enrichmentShortlistSize, 2);
  assert.equal(coverage.readmeRetrievalSuccesses, 2);
  assert.equal(coverage.candidatesRescoredAfterEnrichment, 2);
  const comparator = coverage.queryEffectiveness.find((entry) => entry.query === "AI creative workbench");
  assert.ok(comparator.rawPointerCount >= 2);
  assert.ok(comparator.retainedCandidateCount >= 2);
  assert.ok(comparator.enrichmentShortlistCount >= 2);
  assert.ok(comparator.topFiveCount >= 2);
});

test("#2034 accumulates query effectiveness by run without double-counting cumulative fields", () => {
  const current = [{
    queryId: "ai-architecture/runtime-tools/01",
    laneId: "ai-architecture",
    familyId: "runtime-tools",
    query: "agent runtime",
    rawPointerCount: 4,
    retainedCandidateCount: 2,
    enrichmentShortlistCount: 1,
    topFiveCount: 1,
  }];
  const marker = encodeDailyState({
    schemaVersion: 1,
    date: "2026-09-13",
    entries: [],
    queryEffectiveness: current,
  });
  const history = reconstructQueryEffectiveness([{ body: marker }], { beforeDate: "2026-09-14" });
  const accumulated = accumulateQueryEffectiveness(current, history)[0];
  assert.equal(accumulated.runsObserved, 2);
  assert.equal(accumulated.cumulativeRawPointerCount, 8);
  assert.equal(accumulated.cumulativeRetainedCandidateCount, 4);
  assert.equal(accumulated.cumulativeEnrichmentShortlistCount, 2);
  assert.equal(accumulated.cumulativeTopFiveCount, 2);
});

test("#2034 live diagnostic reports whether current discovery sees a named repository without becoming a CI gate", async () => {
  const client = searchAndContentFixture({ includeContender: false });
  const diagnostic = await diagnoseGitHubRepository({
    contract: recallContract(),
    token: "fixture-token",
    fullName: "Narcooo/inkos",
    fetchImpl: client.fetchImpl,
    now: new Date(fixture.now),
  });
  assert.equal(diagnostic.diagnostic.seenInRawDiscovery, true);
  assert.equal(diagnostic.diagnostic.liveSearchIsAuthoritativeCiEvidence, false);
  assert.equal(contract.diagnostics.liveSearchIsRequiredCiGate, false);
  assert.match(contract.diagnostics.liveRepositoryCommand, /--diagnose Narcooo\\/inkos/u);
});

function issueApiFixture() {
  const state = {
    issues: [{ number: 20340, title: "[OSS RADAR] September 2026", created_at: "2026-09-01T00:00:00Z" }],
    comments: [],
    nextComment: 9000,
  };
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    if (url.pathname === "/search/issues") return { ok: true, status: 200, json: async () => ({ items: state.issues }) };
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/issues/20340/comments" && method === "GET") {
      return { ok: true, status: 200, json: async () => state.comments };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/issues/20340/comments" && method === "POST") {
      const comment = { id: state.nextComment++, body: body.body };
      state.comments.push(comment);
      return { ok: true, status: 201, json: async () => comment };
    }
    if (/^\\/repos\\/BryanHarrisScripts\\/PlotPickle\\/issues\\/comments\\/\\d+$/u.test(url.pathname) && method === "PATCH") {
      const id = Number(url.pathname.split("/").at(-1));
      const index = state.comments.findIndex((comment) => comment.id === id);
      state.comments[index] = { ...state.comments[index], body: body.body };
      return { ok: true, status: 200, json: async () => state.comments[index] };
    }
    throw new Error(`Unexpected issue fixture request ${method} ${url.pathname}`);
  };
  return { state, fetchImpl };
}

test("#2034 enriched Top 5 reporting remains same-day idempotent and exposes coverage", async () => {
  const client = searchAndContentFixture();
  const discovery = await discoverGitHubRepositories({
    contract: recallContract(),
    token: "fixture-token",
    fetchImpl: client.fetchImpl,
    now: new Date(fixture.now),
  });
  const runtimeContract = recallContract();
  runtimeContract.runtimeRadar = {
    discovery,
    candidateHistorySummary: { firstSeenToday: discovery.candidates.length, seenYesterday: 0, seenBeforeYesterday: 0 },
    candidateLedger: discovery.candidates.map((candidate) => ({
      repositoryStableId: candidate.repositoryStableId,
      fullName: candidate.fullName,
      firstSeenDate: "2026-09-14",
      lastSeenDate: "2026-09-14",
      lastMeaningfulMarker: candidate.pushedAt,
      latestScore: candidate.score,
      latestQualification: "qualified",
    })),
  };
  const api = issueApiFixture();
  const args = {
    repository: "BryanHarrisScripts/PlotPickle",
    auth: "fixture-token",
    contract: runtimeContract,
    discoveryResult: discovery,
    fetchImpl: api.fetchImpl,
    now: new Date(fixture.now),
  };
  const first = await publishDailyRadar(args);
  const second = await publishDailyRadar(args);
  assert.equal(first.action, "created");
  assert.equal(second.action, "updated");
  assert.equal(api.state.comments.length, 1);
  assert.match(second.reportBody, /Discovery coverage/u);
  assert.match(second.reportBody, /Query effectiveness/u);
  assert.match(second.reportBody, /Enriched PlotPickle Score/u);
  assert.deepEqual(second.state.discoveryCoverage.lanesRepresented, discovery.discoveryCoverage.lanesRepresented);
});

test("#2034 keeps search/rate failures diagnosable and the daily workflow focused", async () => {
  await assert.rejects(
    discoverGitHubRepositories({
      contract: recallContract({ enrichment: false }),
      token: "fixture-token",
      fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({ message: "rate limit" }) }),
      now: new Date(fixture.now),
    }),
    /architectural-comparators\\/creative-systems\\/01.*HTTP 403: rate limit/u,
  );
  assert.match(workflow, /issue-2034-oss-radar-\\*\\.test\\.mjs/u);
  assert.match(workflow, /contents: read\\n\\s+issues: write/u);
  assert.doesNotMatch(workflow, /^\\s*pull_request:/mu);
});

test("#2034 deterministic evidence taxonomy covers the agreed InkOS architectural signals", () => {
  const evidence = deriveEnrichmentEvidence(fixture.syntheticReadme, contract);
  for (const concept of [
    "agent-runtime",
    "deterministic-host",
    "human-approval",
    "skills-plugins",
    "retrieval",
    "context-management",
    "provider-routing",
    "story-state",
    "rollback-recovery",
    "atomic-persistence",
    "creative-writing",
  ]) {
    assert.ok(evidence.concepts.some((entry) => entry.id === concept), `Missing concept ${concept}`);
  }
  assert.ok(evidence.laneIds.includes("ai-architecture"));
  assert.ok(evidence.laneIds.includes("story-game-engine"));
  assert.ok(evidence.plotPickleTargets.includes("Context Engine"));
  assert.ok(evidence.plotPickleTargets.includes("PPF"));
});
