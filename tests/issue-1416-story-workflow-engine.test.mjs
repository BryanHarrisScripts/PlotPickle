import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  affectedStoryWorkItemIds,
  planStoryWorkItems,
  reduceStoryResults,
  requeueAffectedStoryWorkItems,
  storyWorkItemId,
} from "../core/story-workflow/story-workflow-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function requirement(id, overrides = {}) {
  return {
    id,
    frontier: "Foundations",
    targetRefs: [`ppf:${id}`],
    evidenceRefs: [],
    dependencyRefs: [],
    assignedAgentId: "tamsin-hearthquill",
    satisfied: false,
    locked: false,
    stale: false,
    contradiction: false,
    waitingHuman: false,
    priority: "normal",
    severity: "medium",
    ...overrides,
  };
}

test("#1416 plans only unresolved current-frontier Story Work Items with stable bounded identity", () => {
  const requirements = [
    requirement("foundations:missing", { priority: "blocking" }),
    requirement("foundations:defined", { satisfied: true }),
    requirement("world:locked", { frontier: "World", locked: true }),
    requirement("foundations:proposal", { waitingHuman: true, evidenceRefs: ["proposal:one"] }),
    requirement("foundations:stale", { satisfied: true, stale: true, dependencyRefs: ["ppf:foundations:source"] }),
  ];
  const first = planStoryWorkItems({ projectId: "afterglow-working-copy", baseRevision: 9, requirements, maxItems: 8 });
  const second = planStoryWorkItems({ projectId: "afterglow-working-copy", baseRevision: 9, requirements, maxItems: 8 });

  assert.deepEqual(first, second, "the same project revision and curriculum requirements must produce stable work identity");
  assert.deepEqual(first.map((item) => item.curriculumRequirementId), [
    "foundations:missing",
    "foundations:proposal",
    "foundations:stale",
  ]);
  assert.equal(first.find((item) => item.curriculumRequirementId === "foundations:proposal").status, "waiting-human");
  assert.equal(first.find((item) => item.curriculumRequirementId === "foundations:stale").kind, "re-evaluation");
  assert.ok(first.every((item) => item.workItemId.startsWith("story-work:")));
  assert.equal(storyWorkItemId({
    projectId: "afterglow-working-copy",
    baseRevision: 9,
    curriculumRequirementId: "foundations:missing",
    targetRefs: ["ppf:foundations:missing"],
  }), first[0].workItemId);
});

test("#1416 reduces exact duplicate findings before Human presentation and preserves real disagreement", () => {
  const base = {
    workItemId: "story-work:ren-motivation",
    targetRefs: ["ppf:character:ren:motivation"],
    evidenceRefs: ["screenplay:scene-12"],
    curriculumRequirementId: "foundations:ren-motivation",
    principleRef: "curriculum:character-motivation",
    severity: "high",
    confidence: 0.86,
    changesCanon: true,
  };
  const reduced = reduceStoryResults([
    {
      ...base,
      resultId: "r1",
      kind: "finding",
      explanation: "Ren's stated goal and the scene choice are not yet causally aligned.",
    },
    {
      ...base,
      resultId: "r2",
      kind: "finding",
      explanation: "Ren's stated goal and the scene choice are not yet causally aligned.",
    },
    {
      ...base,
      resultId: "r3",
      kind: "proposal",
      proposal: "Make Ren conceal the device to protect Isobel.",
      explanation: "One bounded repair is to make protection drive the choice.",
    },
    {
      ...base,
      resultId: "r4",
      kind: "proposal",
      proposal: "Make Ren expose the device to force the conflict into the open.",
      explanation: "A materially different repair is to make truth drive the choice.",
    },
    {
      workItemId: "story-work:no-finding",
      resultId: "r5",
      kind: "no-finding",
      targetRefs: ["ppf:foundations:tone"],
      evidenceRefs: ["screenplay:scene-4"],
      explanation: "The current tone promise is supported by the checked evidence.",
      changesCanon: false,
    },
    {
      workItemId: "story-work:needs-human",
      resultId: "r6",
      kind: "needs-human",
      targetRefs: ["ppf:foundations:ending"],
      evidenceRefs: ["screenplay:ending"],
      explanation: "Two thematically valid ending choices remain and evidence cannot choose for the writer.",
      changesCanon: true,
    },
  ]);

  assert.equal(reduced.results.filter((item) => item.kind === "finding").length, 1);
  assert.deepEqual(reduced.results.find((item) => item.kind === "finding").duplicateResultIds, ["r2"]);
  assert.equal(reduced.conflicts.length, 1, "materially different proposals for the same target must remain visible as conflict");
  assert.ok(reduced.results.filter((item) => item.kind === "proposal").every((item) => item.humanGate === "conflict"));
  assert.equal(reduced.results.find((item) => item.kind === "no-finding").humanGate, "auto-check-complete");
  assert.equal(reduced.results.find((item) => item.kind === "needs-human").humanGate, "creative-choice");
});

test("#1416 requeues only affected dependencies after one accepted story change", () => {
  const workItems = [
    {
      workItemId: "work-character",
      status: "resolved",
      targetRefs: ["ppf:character:ren"],
      dependencyRefs: ["ppf:foundations:protagonist"],
      proposalIds: ["proposal-1"],
      runId: "run-1",
      kind: "requirement",
    },
    {
      workItemId: "work-structure",
      status: "resolved",
      targetRefs: ["ppf:structure:block-4"],
      dependencyRefs: ["ppf:foundations:protagonist"],
      proposalIds: ["proposal-2"],
      runId: "run-2",
      kind: "requirement",
    },
    {
      workItemId: "work-unrelated-visual",
      status: "resolved",
      targetRefs: ["ppf:visual:location-7"],
      dependencyRefs: ["ppf:world:location-7"],
      proposalIds: ["proposal-3"],
      runId: "run-3",
      kind: "requirement",
    },
  ];

  assert.deepEqual(affectedStoryWorkItemIds(workItems, ["ppf:foundations:protagonist"]), ["work-character", "work-structure"]);
  const next = requeueAffectedStoryWorkItems(workItems, ["ppf:foundations:protagonist"]);
  assert.equal(next[0].status, "queued");
  assert.equal(next[1].status, "queued");
  assert.equal(next[2].status, "resolved", "unrelated completed work must not be invalidated");
  assert.equal(next[2].runId, "run-3");
});

test("#1416 adapter derives work from live Foundations and reuses Context, Responsibility Run and graph authority", async () => {
  const [adapter, core, foundationPlan, contextEngine, runs, graph] = await Promise.all([
    read("modules/story-workflow/runtime/foundations-story-workflow.ts"),
    read("core/story-workflow/story-workflow-core.mjs"),
    read("core/contracts/foundation-plan.ts"),
    read("lib/agents/context/context-engine.ts"),
    read("lib/agents/responsibility/responsibility-runs.ts"),
    read("lib/agents/responsibility/responsibility-graph.ts"),
  ]);

  for (const contract of [
    "plotPickleCurriculum",
    "buildFoundationPlanLessons(curriculum)",
    "planStoryWorkItems",
    "assembleContextPacket",
    "createResponsibilityRun",
    "createResponsibilityGraph",
    'profileId: input.workItem.assignedAgentId || FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID',
    'kind: "creative-proposal"',
    'verificationMode: "writer-approval"',
    "maxCloudCostUsd: 0",
    "exclusiveResources: item.targetRefs",
    "proposal-container",
    "current Foundations frontier",
  ]) assert.ok(adapter.includes(contract), `Story Workflow adapter is missing reuse-first contract: ${contract}`);

  assert.match(foundationPlan, /export function buildFoundationPlanLessons/);
  assert.match(contextEngine, /task-scoped|ContextPacket|budgetCharacters/);
  assert.match(runs, /maxParallelChildren/);
  assert.match(graph, /exclusiveResources/);
  assert.match(core, /locked \|\| satisfied/);
  assert.match(core, /waitingHuman \? "waiting-human" : "queued"/);
  assert.doesNotMatch(adapter, /BUZZ|buzz-managed|\/rooms\/|channels/i, "Phase 2 Story Workflow must not depend on BUZZ execution authority");
  assert.doesNotMatch(adapter, /saveActiveLibraryProject|writeProject|canon-write|ppf-direct-write/i, "Story workers must not write canon directly");
  assert.doesNotMatch(adapter, /LangGraph|Hermes/i, "Phase 2 must not introduce another orchestration framework");
});

test("#1416 product path starts bounded local Runs and stores only reviewable PLAN proposals", async () => {
  const [panel, gateway, appPage, coverage] = await Promise.all([
    read("modules/story-workflow/ui/foundations-story-workflow-panel.tsx"),
    read("build/responsibility-run-gateway.ts"),
    read("app/page.tsx"),
    read("modules/build/ui/foundations-story-coverage.tsx"),
  ]);

  for (const contract of [
    'fetch("/api/responsibility-runs"',
    'action: "create"',
    'action: "start"',
    'action: "proposal-ready"',
    'fetch("/api/writing-assistant/chat"',
    'provider: "local"',
    'modelRole: "quality"',
    'agentId: "foundations-planner"',
    "selectIndependent(queued, 2)",
    'type: "foundations.proposal.store"',
    "Nothing was accepted automatically",
  ]) assert.ok(panel.includes(contract), `Story Workflow product path is missing: ${contract}`);
  assert.doesNotMatch(panel, /foundations\.proposal\.accept|provider:\s*"openai"|provider:\s*"minimax"/,
    "Story Workflow must stop at a reviewable proposal and must not silently use paid cloud");

  for (const contract of [
    "ResponsibilityRunContextRef",
    'action === "start"',
    "prepareResponsibilityRun",
    "beginResponsibilityAttempt",
    'action === "proposal-ready"',
    "addResponsibilityArtifact",
    "requestWriterApproval",
  ]) assert.ok(gateway.includes(contract), `Responsibility Run gateway is missing Story Workflow lifecycle support: ${contract}`);

  assert.match(appPage, /FoundationsStoryWorkflowPanel/);
  assert.match(appPage, /project=\{loadFoundationProject\(\)\}/);
  assert.doesNotMatch(coverage, /story-workflow|FoundationsStoryWorkflowPanel/,
    "Feature modules must not import sibling private implementations; app composition owns the cross-module join");
});

test("#1416 keeps the Afterglow reference lazy and uses Phase 1 as stable workflow input", async () => {
  const [fixture, library] = await Promise.all([
    read("modules/library/reference/afterglow-v9-foundations.ts"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);
  assert.match(fixture, /AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID/);
  assert.match(fixture, /completedLessonIds/);
  assert.match(fixture, /referenceFixture/);
  assert.match(library, /await import\("\.\.\/reference\/afterglow-v9-foundations"\)/);
  assert.doesNotMatch(library, /story-workflow\/foundations-story-workflow/,
    "Story Workflow execution must not move onto Library/core startup just because Phase 2 exists");
});
