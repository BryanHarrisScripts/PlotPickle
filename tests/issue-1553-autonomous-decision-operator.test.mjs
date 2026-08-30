import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createStoryDecisionFromCouncilResult, createStoryDecisionResponse } from "../core/story-workflow/story-decisions/core.mjs";
import { operateAutonomousStoryDecision } from "../core/story-workflow/story-decisions/autonomous-operator.mjs";

const authority = {
  authorityClass: "delegated-autonomous-operator",
  delegated: true,
  autonomousRunId: "autonomous-afterglow-1",
  operatorId: "plotpickle-autonomous-editor",
  modelRole: "quality",
  modelId: "local-quality-model",
  provider: "local",
  runtime: "llama.cpp",
};

const policy = {
  enabled: true,
  allowStoryDecisionResponses: true,
  autonomousRunId: "autonomous-afterglow-1",
  projectId: "afterglow-v9",
  maxEvaluationAttempts: 2,
  minimumConfidence: 0.75,
};

function decision(overrides = {}) {
  return createStoryDecisionFromCouncilResult({
    projectId: "afterglow-v9",
    now: "2026-08-30T15:00:00.000Z",
    blockedByHuman: overrides.decisionClass === "blocked-prerequisite",
    councilResult: {
      decisionClass: "alternative-choice",
      requiresHuman: true,
      humanGate: "material-choice",
      workItemId: "work-afterglow-17",
      baseRevision: "9",
      targetRefs: ["ppf:foundations:lesson:answer"],
      evidenceRefs: ["evidence:block-17"],
      affectedDownstreamRefs: ["screenplay:block-17"],
      positions: [{ proposal: "Clarify Ren's choice.", alternatives: ["Keep the choice implicit."], severity: "medium" }],
      ...overrides,
    },
  });
}

function ports(events, candidates, input = {}) {
  return {
    async evaluateDecision(request) {
      events.push(`evaluate:${request.attempt}`);
      return candidates.shift();
    },
    async respondThroughDecisionGateway(request) {
      events.push("gateway");
      const answered = createStoryDecisionResponse(input.decision, request.response);
      return { ...answered, writesCanon: false };
    },
    async prepareStoryWorkbench(request) {
      events.push("prepare-workbench");
      return {
        package: {
          packageId: "story-change-afterglow-17",
          decisionId: request.decision.decisionId,
          baseRevision: 9,
        },
        review: { canComplete: input.canComplete !== false, canApply: true },
        impact: { staleProjectionRefs: ["screenplay:block-17"] },
      };
    },
    async applyStoryWorkbench() {
      events.push("apply-workbench");
      return { applied: true, revision: 10, changedRefs: ["ppf:foundations:lesson:answer", "screenplay:block-17"] };
    },
  };
}

test("autonomous operator uses Decision gateway before revision-safe Workbench apply", async () => {
  const item = decision();
  const events = [];
  const result = await operateAutonomousStoryDecision({
    decision: item,
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
    evidence: {},
    recordedAt: "2026-08-30T15:01:00.000Z",
  }, ports(events, [{
    responseClass: "accept-proposal",
    confidence: 0.91,
    rationale: "The recorded evidence supports the bounded clarification.",
  }], { decision: item }));
  assert.deepEqual(events, ["evaluate:1", "gateway", "prepare-workbench", "apply-workbench"]);
  assert.equal(result.status, "applied");
  assert.equal(result.receipt.authorityClass, "delegated-autonomous-operator");
  assert.equal(result.receipt.resultingRevision, "10");
  assert.equal(result.receipt.canonChanged, true);
  assert.equal(result.receipt.sourceWorkItemId, "work-afterglow-17");
  assert.equal(result.receipt.recordedAt, "2026-08-30T15:01:00.000Z");
  assert.deepEqual(result.receipt.staleProjectionRefs, ["screenplay:block-17"]);
  assert.equal(Object.hasOwn(result.receipt, "modelOutput"), false);
  assert.equal(Object.hasOwn(result.receipt, "chainOfThought"), false);
});

test("low confidence is bounded and records request-alternatives through the gateway", async () => {
  const item = decision();
  const events = [];
  const result = await operateAutonomousStoryDecision({
    decision: item,
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
  }, ports(events, [
    { responseClass: "select-alternative", selectedAlternativeId: "alternative-1", confidence: 0.4, rationale: "Evidence remains mixed." },
    { responseClass: "keep-current", confidence: 0.6, rationale: "The second pass remains uncertain." },
  ], { decision: item }));
  assert.deepEqual(events, ["evaluate:1", "evaluate:2", "gateway"]);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "evaluation-incomplete");
  assert.equal(result.receipt.responseClass, "request-alternatives");
  assert.equal(result.receipt.attempts, 2);
});

test("stale and integrity failures stop before model, gateway or Workbench", async () => {
  for (const input of [
    { currentRevision: "10", evidence: {} },
    { currentRevision: "9", evidence: { integrityFailure: true } },
  ]) {
    const item = decision();
    const events = [];
    const result = await operateAutonomousStoryDecision({
      decision: item,
      authority,
      autonomousPolicy: policy,
      ...input,
    }, ports(events, [], { decision: item }));
    assert.equal(result.status, "blocked");
    assert.deepEqual(events, []);
  }
});

test("missing prerequisites are deterministically deferred without model judgment or Workbench", async () => {
  const item = decision({ decisionClass: "blocked-prerequisite" });
  const events = [];
  const result = await operateAutonomousStoryDecision({
    decision: item,
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
    evidence: { missingPrerequisite: true },
  }, ports(events, [], { decision: item }));
  assert.deepEqual(events, ["gateway"]);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "missing-prerequisite");
  assert.equal(result.receipt.responseClass, "defer");
});

test("Workbench findings stop before apply and preserve a truthful blocker", async () => {
  const item = decision();
  const events = [];
  const result = await operateAutonomousStoryDecision({
    decision: item,
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
  }, ports(events, [{ responseClass: "accept-proposal", confidence: 0.9, rationale: "Evidence supports the proposal." }], {
    decision: item,
    canComplete: false,
  }));
  assert.deepEqual(events, ["evaluate:1", "gateway", "prepare-workbench"]);
  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "workbench-findings");
});

test("operator has no direct PPF, project command, database or fixture mutation path", async () => {
  const [source, gateway] = await Promise.all([
    readFile(new URL("../core/story-workflow/story-decisions/autonomous-operator.mjs", import.meta.url), "utf8"),
    readFile(new URL("../build/story-decisions/gateway.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(source, /applyStoryCommand|saveFoundationProject|writePrivateJson|database|fixture|localStorage|indexedDB/i);
  assert.match(source, /respondThroughDecisionGateway/);
  assert.match(source, /prepareStoryWorkbench/);
  assert.match(source, /applyStoryWorkbench/);
  assert.match(gateway, /export async function respondAutonomousStoryDecisionThroughGateway/);
  assert.match(gateway, /serverPolicy/);
  assert.match(gateway, /The Human Story Decision route cannot claim delegated autonomous authority/);
});
