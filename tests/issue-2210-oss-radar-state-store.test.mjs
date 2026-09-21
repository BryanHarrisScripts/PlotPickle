import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writeRadarArtifactBundle } from "../lib/verification/oss-radar/artifact-bundle.mjs";
import {
  buildRadarState,
  historiesFromRadarState,
  loadRadarState,
  writeRadarState,
} from "../lib/verification/oss-radar/state-store.mjs";

function githubStateFixture() {
  const state = {
    branchExists: false,
    file: null,
    fileSha: null,
    largeFileMode: false,
    calls: [],
  };
  const fetchImpl = async (input, options = {}) => {
    const url = new URL(String(input));
    const method = options.method || "GET";
    const body = options.body ? JSON.parse(options.body) : null;
    state.calls.push({ method, pathname: url.pathname, search: url.search });

    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/contents/.oss-radar/state.json" && method === "GET") {
      if (!state.branchExists || !state.file) return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
      return {
        ok: true,
        status: 200,
        json: async () => state.largeFileMode ? ({
          encoding: "none",
          content: "",
          sha: state.fileSha,
          git_url: `https://api.github.com/repos/BryanHarrisScripts/PlotPickle/git/blobs/${state.fileSha}`,
        }) : ({
          encoding: "base64",
          content: Buffer.from(state.file, "utf8").toString("base64"),
          sha: state.fileSha,
        }),
      };
    }
    if (url.pathname === `/repos/BryanHarrisScripts/PlotPickle/git/blobs/${state.fileSha}` && method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          encoding: "base64",
          content: Buffer.from(state.file, "utf8").toString("base64"),
          sha: state.fileSha,
        }),
      };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/git/ref/heads/oss-radar-state" && method === "GET") {
      if (!state.branchExists) return { ok: false, status: 404, json: async () => ({ message: "Not Found" }) };
      return { ok: true, status: 200, json: async () => ({ ref: "refs/heads/oss-radar-state", object: { sha: "state-head" } }) };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle" && method === "GET") {
      return { ok: true, status: 200, json: async () => ({ default_branch: "main" }) };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/git/ref/heads/main" && method === "GET") {
      return { ok: true, status: 200, json: async () => ({ object: { sha: "main-head" } }) };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/git/refs" && method === "POST") {
      assert.equal(body.ref, "refs/heads/oss-radar-state");
      assert.equal(body.sha, "main-head");
      state.branchExists = true;
      return { ok: true, status: 201, json: async () => ({ ref: body.ref, object: { sha: body.sha } }) };
    }
    if (url.pathname === "/repos/BryanHarrisScripts/PlotPickle/contents/.oss-radar/state.json" && method === "PUT") {
      assert.equal(body.branch, "oss-radar-state");
      state.file = Buffer.from(body.content, "base64").toString("utf8");
      state.fileSha = "state-file-sha";
      return {
        ok: true,
        status: 201,
        json: async () => ({
          content: { sha: state.fileSha },
          commit: { sha: "state-commit-sha" },
        }),
      };
    }
    throw new Error(`Unexpected state fixture request ${method} ${url.pathname}${url.search}`);
  };
  return { state, fetchImpl };
}

function stateSnapshot() {
  const baselineReview = new Map([["old", {
    repositoryStableId: "old",
    fullName: "fixture/old",
    firstSeenDate: "2026-09-17",
    lastReviewedDate: "2026-09-17",
  }]]);
  const currentReview = new Map(baselineReview);
  currentReview.set("today", {
    repositoryStableId: "today",
    fullName: "fixture/today",
    firstSeenDate: "2026-09-18",
    lastReviewedDate: "2026-09-18",
  });
  return buildRadarState({
    reportDate: "2026-09-18",
    reviewHistory: currentReview,
    candidateHistory: new Map([["today", {
      repositoryStableId: "today",
      fullName: "fixture/today",
      firstSeenDate: "2026-09-18",
      lastSeenDate: "2026-09-18",
    }]]),
    queryEffectivenessHistory: new Map([["q1", {
      queryId: "q1",
      laneId: "ai-architecture",
      familyId: "runtime",
      query: "agent runtime",
      runsObserved: 1,
      rawPointerCount: 10,
      retainedCandidateCount: 8,
      enrichmentShortlistCount: 2,
      topFiveCount: 1,
    }]]),
    baselineHistories: {
      reviewHistory: baselineReview,
      candidateHistory: new Map(),
      queryEffectivenessHistory: new Map(),
    },
    lastReport: {
      reportDate: "2026-09-18",
      reportUrl: "https://github.com/BryanHarrisScripts/PlotPickle/issues/2014#issuecomment-1",
      reviewCount: 21,
      reviewTarget: 21,
    },
  });
}

test("#2210 creates and round-trips the dedicated OSS Radar state branch", async () => {
  const api = githubStateFixture();
  assert.equal(await loadRadarState({
    repository: "BryanHarrisScripts/PlotPickle",
    auth: "fixture-token",
    fetchImpl: api.fetchImpl,
  }), null);

  const snapshot = stateSnapshot();
  const written = await writeRadarState({
    repository: "BryanHarrisScripts/PlotPickle",
    auth: "fixture-token",
    state: snapshot,
    fetchImpl: api.fetchImpl,
  });
  assert.equal(written.branch, "oss-radar-state");
  assert.equal(written.path, ".oss-radar/state.json");
  assert.equal(written.commitSha, "state-commit-sha");
  assert.equal(api.state.branchExists, true);

  const loaded = await loadRadarState({
    repository: "BryanHarrisScripts/PlotPickle",
    auth: "fixture-token",
    fetchImpl: api.fetchImpl,
  });
  assert.equal(loaded.state.lastReportDate, "2026-09-18");
  assert.equal(loaded.state.reviewHistory.length, 2);
});

test("#2334 loads persisted Radar state through Git blob fallback when GitHub omits inline contents", async () => {
  const api = githubStateFixture();
  api.state.branchExists = true;
  api.state.file = `${JSON.stringify(stateSnapshot())}\n`;
  api.state.fileSha = "large-state-file-sha";
  api.state.largeFileMode = true;

  const loaded = await loadRadarState({
    repository: "BryanHarrisScripts/PlotPickle",
    auth: "fixture-token",
    fetchImpl: api.fetchImpl,
  });

  assert.equal(loaded.state.lastReportDate, "2026-09-18");
  assert.equal(loaded.sha, "large-state-file-sha");
  assert.equal(
    api.state.calls.some((call) => call.pathname === "/repos/BryanHarrisScripts/PlotPickle/git/blobs/large-state-file-sha"),
    true,
  );
});

test("#2210 same-day state reads use the pre-run baseline and next-day reads use committed history", () => {
  const snapshot = stateSnapshot();
  const sameDay = historiesFromRadarState(snapshot, { reportDate: "2026-09-18" });
  assert.equal(sameDay.reviewHistory.has("old"), true);
  assert.equal(sameDay.reviewHistory.has("today"), false);

  const nextDay = historiesFromRadarState(snapshot, { reportDate: "2026-09-19" });
  assert.equal(nextDay.reviewHistory.has("old"), true);
  assert.equal(nextDay.reviewHistory.has("today"), true);
});

test("#2210 builds a complete Actions artifact bundle from a successful Radar result", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "oss-radar-artifact-"));
  try {
    const resultPath = path.join(dir, "oss-radar-result.json");
    const outputDir = path.join(dir, "bundle");
    const result = {
      reportDate: "2026-09-18",
      reportBody: "# Human report",
      publicDigest: "Story-to-Screen OSS Radar",
      publicBlogDraft: "# OSS Radar Blog Draft\n\nHuman review required.",
      discovery: { rawResultCount: 42 },
      machineState: stateSnapshot(),
    };
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(resultPath, `${JSON.stringify(result)}\n`, "utf8")
    );
    const written = await writeRadarArtifactBundle({ resultPath, outputDir });
    assert.deepEqual(written.files.sort(), ["discovery.json", "public-blog-draft.md", "public-digest.txt", "report.md", "result.json", "state.json"].sort());
    assert.equal(await readFile(path.join(outputDir, "report.md"), "utf8"), "# Human report");
    assert.match(await readFile(path.join(outputDir, "public-digest.txt"), "utf8"), /Story-to-Screen/u);
    assert.match(await readFile(path.join(outputDir, "public-blog-draft.md"), "utf8"), /Human review required/u);
    const stored = JSON.parse(await readFile(path.join(outputDir, "state.json"), "utf8"));
    assert.equal(stored.lastReportDate, "2026-09-18");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
