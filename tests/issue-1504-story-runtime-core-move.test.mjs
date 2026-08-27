import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  affectedStoryWorkItemIds,
  planStoryWorkItems,
  reduceStoryResults,
  requeueAffectedStoryWorkItems,
  storyWorkItemId,
} from "../core/story-workflow/runtime/story-workflow-core.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1504 moves the generic Story Workflow core pair to its ratified runtime owner", async () => {
  await assert.rejects(access(new URL("core/story-workflow/story-workflow-core.mjs", root)));
  await assert.rejects(access(new URL("core/story-workflow/story-workflow-core.d.ts", root)));
  await access(new URL("core/story-workflow/runtime/story-workflow-core.mjs", root));
  await access(new URL("core/story-workflow/runtime/story-workflow-core.d.ts", root));
});

test("#1504 preserves stable work identity, Human gates and targeted re-evaluation behavior", () => {
  const requirements = [{
    id: "foundations:motivation",
    frontier: "Foundations",
    targetRefs: ["ppf:foundations:motivation"],
    dependencyRefs: ["ppf:foundations:premise"],
    waitingHuman: false,
    satisfied: false,
    locked: false,
    priority: "high",
  }];
  const first = planStoryWorkItems({ projectId: "afterglow-working-copy", baseRevision: 9, requirements });
  const second = planStoryWorkItems({ projectId: "afterglow-working-copy", baseRevision: 9, requirements });
  assert.deepEqual(first, second);
  assert.equal(first[0].workItemId, storyWorkItemId({
    projectId: "afterglow-working-copy",
    baseRevision: 9,
    curriculumRequirementId: "foundations:motivation",
    targetRefs: ["ppf:foundations:motivation"],
  }));

  const reduced = reduceStoryResults([
    { workItemId: first[0].workItemId, kind: "proposal", targetRefs: first[0].targetRefs, explanation: "One bounded proposal.", proposal: "Keep Human review." },
  ]);
  assert.equal(reduced.results[0].humanGate, "proposal-review");

  assert.deepEqual(affectedStoryWorkItemIds(first, ["ppf:foundations:premise"]), [first[0].workItemId]);
  const requeued = requeueAffectedStoryWorkItems([{ ...first[0], status: "resolved", runId: "run-1", proposalIds: ["proposal-1"] }], ["ppf:foundations:premise"]);
  assert.equal(requeued[0].status, "queued");
  assert.equal(requeued[0].runId, "");
  assert.deepEqual(requeued[0].proposalIds, []);
});

test("#1504 retargets every known direct consumer without a root compatibility shim", async () => {
  const canonical = "core/story-workflow/runtime/story-workflow-core.mjs";
  for (const path of [
    "modules/story-workflow/council/story-council-runtime.ts",
    "modules/story-workflow/bridge/buzz-story-bridge.ts",
    "modules/story-workflow/workbench/workflow.ts",
    "modules/story-workflow/council/story-council.ts",
    "modules/story-workflow/runtime/foundations-story-workflow.ts",
    "modules/story-workflow/ui/foundations-story-workflow-panel.tsx",
    "modules/story-workflow/ui/foundations-buzz-story-live-test.tsx",
    "tests/issue-1416-story-workflow-engine.test.mjs",
  ]) {
    const content = await source(path);
    assert.ok(content.includes(canonical), `${path} is not retargeted to the runtime-owned Story Workflow core`);
    assert.ok(!content.includes("core/story-workflow/story-workflow-core.mjs"), `${path} still names the retired root core`);
  }
  for (const path of [
    "core/story-workflow/story-council/core.mjs",
    "core/story-workflow/story-council/core.d.ts",
    "core/story-workflow/buzz/buzz-story-bridge-core.mjs",
    "core/story-workflow/buzz/buzz-story-bridge-core.d.ts",
  ]) {
    const content = await source(path);
    assert.ok(content.includes('../runtime/story-workflow-core.mjs'), `${path} is not retargeted to the sibling runtime owner`);
    assert.ok(!content.includes('../story-workflow-core.mjs'), `${path} still points at the retired root core`);
  }
});

test("#1504 retargets Story Bridge CI to the runtime-owned core paths", async () => {
  const workflow = await source(".github/workflows/story-bridge.yml");
  assert.ok(workflow.includes('core/story-workflow/runtime/story-workflow-core.mjs'));
  assert.ok(workflow.includes('core/story-workflow/runtime/story-workflow-core.d.ts'));
  assert.ok(!workflow.includes('core/story-workflow/story-workflow-core.mjs'));
  assert.ok(!workflow.includes('core/story-workflow/story-workflow-core.d.ts'));
});

test("#1504 marks the final Phase 2 move batch complete while preserving the Phase 0 historical map", async () => {
  const architecture = JSON.parse(await source("config/repository-architecture-target.json"));
  const batch = architecture.moveBatches.find((item) => item.id === "phase2-core-story-runtime");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, [
    "core/story-workflow/story-workflow-core.d.ts",
    "core/story-workflow/story-workflow-core.mjs",
  ]);
  assert.deepEqual(batch?.completedTargets, [
    "core/story-workflow/runtime/story-workflow-core.d.ts",
    "core/story-workflow/runtime/story-workflow-core.mjs",
  ]);
  const history = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.ok(history.includes('legacy root `core/story-workflow/story-workflow-core.*` → `core/story-workflow/runtime/`'));
});
