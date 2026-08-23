import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  acceptHarnessImprovementProposalCore,
  beginHarnessImprovementEvaluationCore,
  createHarnessImprovementProposalCore,
  harnessImprovementPromotionStatusCore,
  isProtectedHarnessTarget,
  recordHarnessImprovementVerificationCore,
} from "../lib/harness-improvement-core.mjs";
import {
  contextStrategyForTask,
  selectAdaptiveContextCandidates,
} from "../lib/agents/adaptive-context-strategy-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function proposalInput(overrides = {}) {
  return {
    proposalId: "hip-test-1",
    proposerId: "pi-repair",
    title: "Improve context selection after repeated misses",
    rationale: "The same bounded context miss occurred repeatedly.",
    targetPaths: ["lib/agents/adaptive-context-strategies.ts"],
    failure: {
      signature: "context-miss:scene-history",
      occurrences: 6,
      evidenceRefs: ["run:1", "run:2"],
      summary: "Six equivalent misses with the same context shape.",
    },
    evaluationRefs: ["tests/issue-963-context-engine.test.mjs", "tests/issue-1003-harness-improvement-proposals.test.mjs"],
    createdAt: "2026-08-18T12:00:00.000Z",
    ...overrides,
  };
}

test("protected harness paths cannot be targets while bounded execution paths remain editable", () => {
  for (const path of [
    "tests/issue-963-context-engine.test.mjs",
    ".github/workflows/learn-validation.yml",
    "lib/agents/connector-trust-policy.ts",
    "build/local-credentials.ts",
    "lib/revision-aware-ppf.ts",
    "lib/harness-improvement-proposals.ts",
    "scripts/run-plotpickle-full-check.ps1",
  ]) assert.equal(isProtectedHarnessTarget(path), true, `${path} must be protected`);

  assert.equal(isProtectedHarnessTarget("lib/agents/context-engine.ts"), false);
  assert.equal(isProtectedHarnessTarget("lib/agents/agent-orchestration.ts"), false);
  assert.throws(
    () => createHarnessImprovementProposalCore(proposalInput({ targetPaths: ["lib/agents/connector-trust-policy.ts"] })),
    /Protected harness targets cannot be self-edited/,
  );
});

test("a proposal cannot edit the evaluation that judges it", () => {
  assert.throws(
    () => createHarnessImprovementProposalCore(proposalInput({
      targetPaths: ["docs/eval-contract.md"],
      evaluationRefs: ["docs/eval-contract.md"],
    })),
    /cannot edit the evaluation that judges it/,
  );
});

test("promotion requires isolated baseline and candidate PASS evidence from an independent verifier", () => {
  let proposal = createHarnessImprovementProposalCore(proposalInput());
  assert.equal(harnessImprovementPromotionStatusCore(proposal).eligible, false);
  proposal = beginHarnessImprovementEvaluationCore(proposal, "agent/hip-test");
  assert.throws(
    () => recordHarnessImprovementVerificationCore(proposal, {
      stage: "baseline",
      verifierId: "pi-repair",
      result: "PASS",
      evidenceRef: "ci:baseline",
      summary: "self certification",
    }),
    /cannot self-certify/,
  );
  proposal = recordHarnessImprovementVerificationCore(proposal, {
    stage: "baseline",
    verifierId: "full-verification",
    result: "PASS",
    evidenceRef: "ci:baseline",
    summary: "Known-good baseline is green.",
    recordedAt: "2026-08-18T12:05:00.000Z",
  });
  assert.equal(harnessImprovementPromotionStatusCore(proposal).reason, "missing-candidate-verification");
  proposal = recordHarnessImprovementVerificationCore(proposal, {
    stage: "candidate",
    verifierId: "full-verification",
    result: "PASS",
    evidenceRef: "ci:candidate",
    summary: "Candidate is green against the same immutable eval boundary.",
    recordedAt: "2026-08-18T12:10:00.000Z",
  });
  assert.equal(harnessImprovementPromotionStatusCore(proposal).eligible, true);
  const accepted = acceptHarnessImprovementProposalCore(proposal, "Host promoted verified improvement.");
  assert.equal(accepted.state, "accepted");
});

test("a failed candidate cannot be promoted even when the baseline passed", () => {
  let proposal = beginHarnessImprovementEvaluationCore(createHarnessImprovementProposalCore(proposalInput()), "agent/hip-fail");
  proposal = recordHarnessImprovementVerificationCore(proposal, {
    stage: "baseline", verifierId: "full-verification", result: "PASS", evidenceRef: "ci:base", summary: "baseline pass",
  });
  proposal = recordHarnessImprovementVerificationCore(proposal, {
    stage: "candidate", verifierId: "full-verification", result: "FAIL", evidenceRef: "ci:candidate", summary: "candidate regression",
  });
  assert.equal(harnessImprovementPromotionStatusCore(proposal).reason, "candidate-failed");
  assert.throws(() => acceptHarnessImprovementProposalCore(proposal, "should not promote"), /not eligible for promotion/);
});

test("adaptive context strategies keep writer PPF and schema evidence while re-ranking optional candidates", () => {
  const writer = { id: "writer", sourceType: "writer-instruction", trust: "owner-trusted", authority: 100, allowedUse: "instruction", content: "Writer request" };
  const ppf = { id: "ppf", sourceType: "ppf-canon", trust: "approved", authority: 95, allowedUse: "canon", content: "Canonical fact" };
  const schema = { id: "schema", sourceType: "task-schema", trust: "trusted", authority: 88, allowedUse: "schema", content: "Output schema" };
  const items = [
    writer,
    ppf,
    schema,
    { id: "curriculum", sourceType: "curriculum-current", trust: "trusted", authority: 90, allowedUse: "reference", content: "Craft lesson" },
    { id: "conversation", sourceType: "recent-conversation", trust: "approved", authority: 65, allowedUse: "reference", content: "Recent chat" },
    { id: "memory", sourceType: "project-memory", trust: "approved", authority: 72, allowedUse: "evidence", content: "Approved decision" },
    { id: "graph", sourceType: "story-knowledge-graph", trust: "approved", authority: 76, allowedUse: "evidence", content: "Derived relationship" },
    { id: "reference", sourceType: "task-reference", trust: "approved", authority: 55, allowedUse: "reference", content: "Scene reference" },
    { id: "external", sourceType: "external-tool", trust: "untrusted", authority: 20, allowedUse: "untrusted-suggestion", content: "External claim" },
    { id: "buzz", sourceType: "buzz-peer", trust: "untrusted", authority: 10, allowedUse: "untrusted-suggestion", content: "Peer idea" },
  ];
  const selected = selectAdaptiveContextCandidates({ strategyId: "continuity", budgetCharacters: 13_500, items });
  const ids = selected.map((item) => item.id);
  assert.ok(ids.includes("writer"));
  assert.ok(ids.includes("ppf"));
  assert.ok(ids.includes("schema"));
  assert.ok(ids.includes("curriculum"));
  assert.ok(ids.indexOf("graph") < ids.indexOf("curriculum"), "continuity strategy should prefer story graph before optional curriculum candidates");
  assert.deepEqual(selected.find((item) => item.id === "ppf"), ppf, "strategy selection must not rewrite trust/authority/use metadata");
});

test("task language selects a bounded strategy deterministically", () => {
  assert.equal(contextStrategyForTask("Check character continuity against canon"), "continuity");
  assert.equal(contextStrategyForTask("Rewrite this scene and improve dialogue"), "scene-rewrite");
  assert.equal(contextStrategyForTask("Review the 24/96 structure and turning points"), "structure-review");
  assert.equal(contextStrategyForTask("Keep wardrobe and storyboard images consistent"), "visual-continuity");
  assert.equal(contextStrategyForTask("What should I work on next?"), "general");
});

test("runtime integration keeps the protected Context Engine and host cancellation boundary authoritative", async () => {
  const [adaptive, sage, interrupts, runs] = await Promise.all([
    read("lib/agents/adaptive-context-strategies.ts"),
    read("modules/creative-room/sage-context-engine.ts"),
    read("lib/agents/responsibility-run-interrupts.ts"),
    read("lib/agents/responsibility-runs.ts"),
  ]);
  assert.match(adaptive, /assembleContextPacket\(/, "adaptive strategies must delegate final assembly to the protected Context Engine");
  assert.match(adaptive, /strategyId: input\.strategyId/);
  assert.match(adaptive, /\.\.\.packet\.receipt/);
  assert.match(sage, /selectAdaptiveContextCandidates/);
  assert.match(sage, /assembleContextPacket\(/);
  assert.match(sage, /contextStrategyForTask\(question\)/);
  assert.match(sage, /strategyVersion: 1/);
  assert.match(interrupts, /cancelResponsibilityRun\(/);
  assert.match(interrupts, /limitsAtInterrupt = \{ \.\.\.input\.run\.limits \}/);
  assert.match(interrupts, /immutable: true/);
  for (const limit of ["maxAttempts", "timeoutMs", "maxParallelChildren", "maxContextCharacters", "maxTokens", "maxToolCalls", "maxCloudCostUsd"]) {
    assert.match(runs, new RegExp(limit));
  }
});
