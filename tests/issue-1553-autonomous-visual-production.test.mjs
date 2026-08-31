import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { operateAutonomousVisualAnchor } from "../core/visual-production/autonomous-operator.mjs";

const authority = {
  authorityClass: "delegated-autonomous-operator",
  delegated: true,
  autonomousRunId: "autonomous-afterglow-visual-1",
  operatorId: "plotpickle-autonomous-visual-director",
  modelRole: "visual-continuity",
  modelId: "local-visual-model",
  provider: "local",
  runtime: "llama.cpp",
};

const policy = {
  enabled: true,
  allowVisualProduction: true,
  autonomousRunId: "autonomous-afterglow-visual-1",
  projectId: "afterglow-v9",
  configuredProviders: ["local"],
  allowPaidCloud: false,
  maxEvaluationAttempts: 2,
  minimumConfidence: 0.75,
};

const input = {
  projectId: "afterglow-v9",
  currentRevision: "10",
  targetId: "block:block-17",
  miniBlockNumber: 1,
  authority,
  autonomousPolicy: policy,
  evidenceRefs: ["visual-readiness:block-17"],
  targetRefs: ["storyboard-anchor:block:block-17:mini-1"],
  recordedAt: "2026-08-30T21:00:00.000Z",
};

function baseAnchor(overrides = {}) {
  return {
    id: "storyboard-anchor:block:block-17:mini-1",
    targetId: "block:block-17",
    miniBlockNumber: 1,
    storyboardAllowed: true,
    missingPrerequisites: [],
    staleBecause: [],
    storyboardArtifactId: "",
    storyboardDependencyKey: "",
    timingAllowed: false,
    renderPlanReady: false,
    shots: [],
    staleShotIds: [],
    authoredDurationSeconds: 0,
    ...overrides,
  };
}

function successfulPorts(events) {
  let projectRevision = "10";
  let anchor = baseAnchor();
  return {
    async inspectAnchor() {
      events.push(`inspect:${projectRevision}`);
      return { projectId: "afterglow-v9", projectRevision, anchor };
    },
    async listStoryboardCandidates() {
      events.push("list-storyboard");
      return [{
        candidateId: "afterglow-block-17-mini-1",
        provider: "bundled-reference",
        costClass: "bundled",
      }];
    },
    async evaluateStoryboardCandidate() {
      events.push("evaluate-storyboard");
      throw new Error("A single bundled candidate should not require model arbitration.");
    },
    async keepStoryboardCandidate(request) {
      events.push("keep-storyboard");
      assert.equal(request.authority.authorityClass, "delegated-autonomous-operator");
      assert.equal(request.expectedRevision, "10");
      projectRevision = "11";
      anchor = baseAnchor({
        storyboardArtifactId: "storyboard-afterglow-block-17-mini-1-11",
        storyboardDependencyKey: "storyboard-upstream:storyboard-anchor:block:block-17:mini-1:abc",
        timingAllowed: true,
      });
      return {
        applied: true,
        projectRevision,
        affectedRefs: [anchor.id],
        staleProjectionRefs: ["previs:block-17:mini-1"],
      };
    },
    async createProductionShot(request) {
      events.push("create-shot");
      assert.equal(request.expectedRevision, "11");
      projectRevision = "12";
      anchor = {
        ...anchor,
        shots: [{ id: "previs-shot-17-1-12-1", durationSeconds: null, reviewState: "planned" }],
      };
      return { applied: true, projectRevision, shotId: "previs-shot-17-1-12-1", affectedRefs: [anchor.id] };
    },
    async evaluatePrevisTiming(request) {
      events.push(`evaluate-timing:${request.attempt}`);
      assert.equal(request.remainingDurationSeconds, 75);
      return {
        shotId: request.shotId,
        confidence: 0.92,
        durationSeconds: 75,
        shotSize: "Wide",
        angle: "Eye level",
        movement: "Locked",
        lens: "Natural perspective",
        visualIntent: "Hold the approved visual composition while preserving the full Mini-Block beat.",
        transitionIn: "",
        transitionOut: "",
        rationale: "The kept Storyboard frame supports one continuous establishing shot for this proof anchor.",
      };
    },
    async authorPrevisTiming(request) {
      events.push("author-timing");
      assert.equal(request.expectedRevision, "12");
      assert.equal(request.timing.reviewState, "approved");
      projectRevision = "13";
      anchor = {
        ...anchor,
        shots: [{ id: request.shotId, durationSeconds: 75, reviewState: "approved" }],
        authoredDurationSeconds: 75,
        renderPlanReady: true,
      };
      return { applied: true, projectRevision, affectedRefs: [request.shotId] };
    },
  };
}

test("#1553 Slice D crosses readiness -> Storyboard -> Production Shot -> Previs through bounded ports", async () => {
  const events = [];
  const result = await operateAutonomousVisualAnchor(input, successfulPorts(events));
  assert.deepEqual(events, [
    "inspect:10",
    "list-storyboard",
    "keep-storyboard",
    "inspect:11",
    "create-shot",
    "inspect:12",
    "evaluate-timing:1",
    "author-timing",
    "inspect:13",
  ]);
  assert.equal(result.status, "ready");
  assert.equal(result.receipt.authorityClass, "delegated-autonomous-operator");
  assert.equal(result.receipt.baseRevision, "10");
  assert.equal(result.receipt.resultingRevision, "13");
  assert.equal(result.receipt.storyboardCandidateId, "afterglow-block-17-mini-1");
  assert.equal(result.receipt.storyboardArtifactId, "storyboard-afterglow-block-17-mini-1-11");
  assert.deepEqual(result.receipt.productionShotIds, ["previs-shot-17-1-12-1"]);
  assert.equal(result.receipt.renderPlanReady, true);
  assert.equal(result.receipt.storyCanonChanged, false);
  assert.equal(Object.hasOwn(result.receipt, "chainOfThought"), false);
  assert.equal(Object.hasOwn(result.receipt, "modelOutput"), false);
});

test("#1553 Slice D fails closed on integrity evidence before touching visual ports", async () => {
  const events = [];
  const result = await operateAutonomousVisualAnchor({ ...input, evidence: { integrityFailure: true } }, successfulPorts(events));
  assert.deepEqual(events, []);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "integrity-failure");
});

test("#1553 Slice D blocks stale revision and missing Storyboard prerequisites before mutation", async () => {
  for (const scenario of [
    {
      expectedCode: "stale-revision",
      inspection: { projectId: "afterglow-v9", projectRevision: "11", anchor: baseAnchor() },
    },
    {
      expectedCode: "missing-prerequisite",
      inspection: { projectId: "afterglow-v9", projectRevision: "10", anchor: baseAnchor({ storyboardAllowed: false, missingPrerequisites: ["storyboard frontier approval"] }) },
    },
  ]) {
    const events = [];
    const ports = successfulPorts(events);
    ports.inspectAnchor = async () => {
      events.push("inspect");
      return scenario.inspection;
    };
    const result = await operateAutonomousVisualAnchor(input, ports);
    assert.equal(result.status, "blocked");
    assert.equal(result.blocker.code, scenario.expectedCode);
    assert.deepEqual(events, ["inspect"]);
  }
});

test("#1553 Slice D refuses silent paid-cloud Storyboard fallback", async () => {
  const events = [];
  const ports = successfulPorts(events);
  ports.listStoryboardCandidates = async () => {
    events.push("list-storyboard");
    return [{ candidateId: "cloud-frame", provider: "cloud-image", costClass: "paid-cloud" }];
  };
  const result = await operateAutonomousVisualAnchor(input, ports);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "provider-policy");
  assert.deepEqual(events, ["inspect:10", "list-storyboard"]);
});

test("#1553 Slice D bounds ambiguous Storyboard evaluation and does not Keep below confidence", async () => {
  const events = [];
  const ports = successfulPorts(events);
  ports.listStoryboardCandidates = async () => {
    events.push("list-storyboard");
    return [
      { candidateId: "frame-a", provider: "bundled-reference", costClass: "bundled" },
      { candidateId: "frame-b", provider: "bundled-reference", costClass: "bundled" },
    ];
  };
  ports.evaluateStoryboardCandidate = async (request) => {
    events.push(`evaluate-storyboard:${request.attempt}`);
    return {
      candidateId: request.attempt === 1 ? "frame-a" : "frame-b",
      provider: "bundled-reference",
      costClass: "bundled",
      confidence: request.attempt === 1 ? 0.4 : 0.6,
      rationale: "The visual evidence remains ambiguous.",
    };
  };
  const result = await operateAutonomousVisualAnchor(input, ports);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "storyboard-evaluation-incomplete");
  assert.deepEqual(events, ["inspect:10", "list-storyboard", "evaluate-storyboard:1", "evaluate-storyboard:2"]);
});

test("#1553 Slice D preserves truthful Storyboard approval provenance for Human and delegated paths", async () => {
  const source = await readFile(new URL("../app/_components/storyboard/storyboard-editorial-model.ts", import.meta.url), "utf8");
  assert.match(source, /approvalAuthority\?: StoryboardApprovalAuthority/);
  assert.match(source, /Human Keep decision/);
  assert.match(source, /delegated autonomous Keep decision/);
  assert.match(source, /authority:delegated-autonomous-operator/);
  assert.match(source, /autonomous-run:/);
  assert.match(source, /autonomous-operator:/);
});

test("#1553 Slice D operator has no direct PPF, browser storage, database or fixture mutation path", async () => {
  const source = await readFile(new URL("../core/visual-production/autonomous-operator.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /applyStoryCommand|saveFoundationProject|writePrivateJson|database|sqlite|localStorage|sessionStorage|indexedDB|fixture/i);
  for (const port of ["keepStoryboardCandidate", "createProductionShot", "authorPrevisTiming"]) {
    assert.match(source, new RegExp(port));
  }
  assert.match(source, /allowVisualProduction/);
  assert.match(source, /allowPaidCloud/);
  assert.match(source, /delegated-autonomous-operator/);
});
