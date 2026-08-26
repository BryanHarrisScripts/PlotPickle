import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  reduceStoryCouncilContributions,
  selectStoryCouncilSpecialists,
} from "../core/story-workflow/story-council-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const afterglowWorkItem = {
  workItemId: "story-work:afterglow-ren-motivation",
  projectId: "afterglow-v9",
  baseRevision: "9",
  curriculumRequirementId: "story-council:afterglow-v9:ren-motivation",
  frontier: "Foundations",
  targetRefs: ["ppf:character:ren:motivation"],
  status: "queued",
  reason: "Trace whether Ren's grief and protective need drive visible choices strongly enough to support the current Foundations story engine.",
  evidenceRefs: ["character:ren", "development.foundations.storyEngine", "story.theme"],
  assignedAgentId: "tamsin-hearthquill",
  runId: "",
  proposalIds: [],
  dependencyRefs: ["ppf:foundations:protagonist", "ppf:foundations:stakes"],
  severity: "high",
  priority: "blocking",
  kind: "audit",
};

function afterglowContribution(overrides = {}) {
  return {
    contributionId: "afterglow-tamsin",
    workItemId: afterglowWorkItem.workItemId,
    runId: "run-tamsin",
    agentId: "tamsin-hearthquill",
    baseRevision: "9",
    kind: "proposal",
    targetRefs: afterglowWorkItem.targetRefs,
    evidenceRefs: afterglowWorkItem.evidenceRefs,
    curriculumRequirementId: afterglowWorkItem.curriculumRequirementId,
    principleRef: "curriculum:foundations:motivation",
    severity: "high",
    confidence: 0.82,
    changesCanon: true,
    explanation: "The checked evidence supports protection as a strong motive, but one transition could make the causal chain more visible.",
    proposal: "Strengthen one existing setup/payoff that connects Ren's protective impulse to the later choice.",
    affectedDownstreamRefs: ["ppf:structure:block-17"],
    agreementRefs: [],
    disagreementRefs: [],
    provenance: { transport: "local-runtime", roomClass: "local-only", recordedAt: "2026-08-26T21:20:00.000Z" },
    ...overrides,
  };
}

test("#1417 Afterglow v9 routes one bounded problem to two distinct specialists plus an independent check", () => {
  const plan = selectStoryCouncilSpecialists(afterglowWorkItem, { maxSpecialists: 3, buzzAvailable: true, allowPublicDiscussion: false });
  assert.deepEqual(plan.specialists.map((specialist) => specialist.agentId), [
    "tamsin-hearthquill",
    "mira-threadmere",
    "critics-circle",
  ]);
  assert.deepEqual(plan.specialists.map((specialist) => specialist.responsibility), [
    "foundations-application",
    "continuity",
    "independent-critique",
  ]);
  assert.equal(plan.maxParallelism, 2, "Council width stays host-bounded instead of waking every Agent");
  assert.equal(plan.buzz.mode, "private-story-room", "PPF evidence never defaults into a public/federated room");
  assert.equal(plan.coordinatorAgentId, "sage-brinewick");
});

test("#1417 Afterglow v9 exercise uses the stable reference, task-scoped Context and existing Run/Graph architecture", async () => {
  const [exercise, council, contextEngine, graph, reference] = await Promise.all([
    read("modules/story-workflow/afterglow-v9-story-council.ts"),
    read("modules/story-workflow/story-council.ts"),
    read("lib/agents/context/context-engine.ts"),
    read("lib/agents/responsibility/responsibility-graph.ts"),
    read("modules/library/reference/afterglow-v9-foundations.ts"),
  ]);

  for (const contract of [
    "createAfterglowV9FoundationsReference",
    "story-council:afterglow-v9:ren-motivation",
    '"character:ren"',
    "selectedEvidence: selected",
    ".slice(0, 6)",
    'sourceType: "ppf-canon"',
    'sourceType: "curriculum-current"',
    "createStoryCouncilContextPacket",
    "createStoryCouncilParentRun",
    "createStoryCouncilResponsibilityRuns",
    "createStoryCouncilGraph",
  ]) assert.ok(exercise.includes(contract), `Afterglow Story Council exercise is missing: ${contract}`);

  for (const contract of [
    "assembleContextPacket",
    "budgetCharacters: 18_000",
    "createResponsibilityRun",
    "createResponsibilityGraph",
    "maxParallelChildren: input.plan.maxParallelism",
    "maxParallelism: input.plan.maxParallelism",
    "proposal-revision",
    "maxCloudCostUsd: 0",
  ]) assert.ok(council.includes(contract), `Story Council execution adapter is missing: ${contract}`);

  assert.match(contextEngine, /task-scoped|budgetCharacters/);
  assert.match(graph, /maxParallelism/);
  assert.match(reference, /createAfterglowV9FoundationsReference/);
  assert.doesNotMatch(exercise, /data\/afterglow-complete|messages send|channels add-member|provider:\s*["'](?:openai|minimax|anthropic)/i,
    "Afterglow Council proof must reuse the bounded reference and must not pull the full source, mutate BUZZ membership, or force cloud");
  assert.doesNotMatch(council, /saveActiveLibraryProject|ppf-direct-write|canon-write\s*:/i,
    "Story Council execution remains proposal/evidence only");
});

test("#1417 Afterglow v9 reduction keeps one agreement and one deliberate disagreement visible", () => {
  const result = reduceStoryCouncilContributions([
    afterglowContribution(),
    afterglowContribution({
      contributionId: "afterglow-mira",
      runId: "run-mira",
      agentId: "mira-threadmere",
      explanation: "The continuity evidence supports the existing protective motive and agrees that one transition is under-signaled.",
      proposal: "Strengthen one existing setup/payoff that connects Ren's protective impulse to the later choice.",
      agreementRefs: ["afterglow-tamsin"],
    }),
    afterglowContribution({
      contributionId: "afterglow-critics",
      runId: "run-critics",
      agentId: "critics-circle",
      explanation: "A different creative reading is also supportable: the ambiguity may be part of the intended grief pattern and should not be repaired automatically.",
      proposal: "Keep the ambiguity and ask the writer whether the unresolved motive is intentional.",
      disagreementRefs: ["afterglow-tamsin", "afterglow-mira"],
    }),
  ])[0];

  assert.equal(result.positions.length, 3);
  assert.ok(result.agreements.length >= 1);
  assert.ok(result.disagreements.length >= 1);
  assert.equal(result.humanGate, "conflict");
  assert.equal(result.decisionClass, "unresolved-conflict");
  assert.equal(result.requiresHuman, true);
  assert.match(result.summary, /Human judgment or approval is required/);
  assert.ok(result.evidenceRefs.includes("character:ren"));
  assert.equal(Object.hasOwn(result, "winner"), false);
});
