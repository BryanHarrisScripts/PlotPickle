import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildGitHubSearchQuery,
  normalizeRepository,
} from "../lib/verification/oss-radar/query-normalization.mjs";
import { evaluateCandidates } from "../lib/verification/oss-radar/scoring.mjs";
import { discoverGitHubRepositories } from "../lib/verification/oss-radar/discover-github.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const contract = await readJson("config/oss-radar/discovery-contract.json");
const fixture = await readJson("tests/fixtures/oss-radar/phase-1-github-search.json");
const now = new Date(fixture.now);
const reducedContract = {
  ...contract,
  lanes: contract.lanes.map((lane) => ({ ...lane, queries: [lane.queries[0]] })),
};

function fixtureFetch({ fail = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (fail) {
      return {
        ok: false,
        status: 403,
        json: async () => ({ message: "fixture rate limit" }),
      };
    }
    const q = new URL(url).searchParams.get("q") || "";
    const lane = reducedContract.lanes.find((entry) => q.startsWith(entry.queries[0]));
    assert.ok(lane, `fixture lane must resolve for query: ${q}`);
    return {
      ok: true,
      status: 200,
      json: async () => ({ total_count: fixture.responses[lane.id].length, items: fixture.responses[lane.id] }),
    };
  };
  return { calls, fetchImpl };
}

function fixtureCandidates() {
  return reducedContract.lanes.flatMap((lane) =>
    fixture.responses[lane.id].map((item) => normalizeRepository(item, { laneId: lane.id, query: lane.queries[0] })),
  );
}

test("#1977 Phase 1 builds deterministic bounded GitHub search queries", () => {
  const query = buildGitHubSearchQuery("agent runtime orchestration", contract.queryDefaults, now);
  assert.match(query, /^agent runtime orchestration /u);
  assert.match(query, /pushed:>=2026-03-16/u);
  assert.match(query, /stars:>=0/u);
});

test("#1977 Phase 1 discovers all six lanes through read-only authenticated repository search", async () => {
  const fixtureClient = fixtureFetch();
  const result = await discoverGitHubRepositories({
    contract: reducedContract,
    token: "fixture-token",
    fetchImpl: fixtureClient.fetchImpl,
    now,
    perQuery: 10,
  });

  assert.equal(result.enabledLaneCount, 6);
  assert.equal(result.queryCount, 6);
  assert.equal(result.rawResultCount, 10);
  assert.equal(result.uniqueCandidateCount, 9);
  assert.equal(result.retainedCount, 7);
  assert.equal(result.rejectedCount, 2);
  assert.equal(result.rejectionReasons.archived, 1);
  assert.equal(result.rejectionReasons.stale, 1);
  assert.equal(fixtureClient.calls.length, 6);

  for (const call of fixtureClient.calls) {
    const url = new URL(call.url);
    assert.equal(url.origin, "https://api.github.com");
    assert.equal(url.pathname, "/search/repositories");
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.headers.Authorization, "Bearer fixture-token");
    assert.equal(call.options.headers["X-GitHub-Api-Version"], "2022-11-28");
  }

  const observedLanes = new Set(result.candidates.flatMap((candidate) => candidate.matchedLaneIds));
  assert.deepEqual([...observedLanes].sort(), reducedContract.lanes.map((lane) => lane.id).sort());
});

test("#1977 Phase 1 collapses duplicate repositories without losing lane/query evidence", async () => {
  const fixtureClient = fixtureFetch();
  const result = await discoverGitHubRepositories({
    contract: reducedContract,
    token: "fixture-token",
    fetchImpl: fixtureClient.fetchImpl,
    now,
  });
  const duplicate = result.candidates.find((candidate) => candidate.repositoryStableId === "105");
  assert.ok(duplicate);
  assert.deepEqual(duplicate.matchedLaneIds, ["ai-architecture", "platform-engineering"]);
  assert.equal(duplicate.matchedQueries.length, 2);
});

test("#1977 Phase 1 keeps unknown-license evidence non-adoptable and keeps forks without inventing divergence", async () => {
  const fixtureClient = fixtureFetch();
  const result = await discoverGitHubRepositories({
    contract: reducedContract,
    token: "fixture-token",
    fetchImpl: fixtureClient.fetchImpl,
    now,
  });

  const unknown = result.candidates.find((candidate) => candidate.repositoryStableId === "104");
  assert.ok(unknown);
  assert.equal(unknown.license.status, "unknown");
  assert.equal(unknown.adoptionEligibleForHumanReview, false);
  assert.equal(unknown.dispositionCeiling, "WATCH");
  assert.equal(unknown.scoreEvidence.dimensions.licenseFit.points, 0);

  const fork = result.candidates.find((candidate) => candidate.repositoryStableId === "109");
  assert.ok(fork);
  assert.equal(fork.fork, true);
  assert.ok(fork.scoreEvidence.reasonCodes.includes("fork:unverified-divergence"));
});

test("#1977 Phase 1 scoring is bounded, explainable and stable regardless of candidate input order", () => {
  const forward = evaluateCandidates(fixtureCandidates(), reducedContract, now);
  const reverse = evaluateCandidates([...fixtureCandidates()].reverse(), reducedContract, now);
  assert.deepEqual(forward.retained.map((candidate) => candidate.fullName), reverse.retained.map((candidate) => candidate.fullName));

  for (const candidate of forward.retained) {
    assert.ok(candidate.score >= 0 && candidate.score <= contract.scoring.baseMaximum);
    assert.equal(typeof candidate.scoreEvidence.finalScore, "number");
    assert.ok(candidate.scoreEvidence.reasonCodes.length >= 3);
    for (const evidence of Object.values(candidate.scoreEvidence.dimensions)) {
      assert.ok(evidence.points >= 0);
      assert.ok(evidence.points <= evidence.weight);
    }
  }
});

test("#1977 Phase 1 fails explicitly without a token or when GitHub search fails", async () => {
  await assert.rejects(
    discoverGitHubRepositories({ contract: reducedContract, token: "", fetchImpl: fixtureFetch().fetchImpl, now }),
    /requires GITHUB_TOKEN/u,
  );
  await assert.rejects(
    discoverGitHubRepositories({ contract: reducedContract, token: "fixture-token", fetchImpl: fixtureFetch({ fail: true }).fetchImpl, now }),
    /HTTP 403: fixture rate limit/u,
  );
});
