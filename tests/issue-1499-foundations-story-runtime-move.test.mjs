import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1499 moves the Foundations Story Workflow adapter to its runtime owner", async () => {
  await assert.rejects(access(new URL("modules/story-workflow/foundations-story-workflow.ts", root)));
  const runtime = await source("modules/story-workflow/runtime/foundations-story-workflow.ts");
  assert.match(runtime, /from "\.\.\/\.\.\/\.\.\/adapters\/curriculum\/current-catalog"/);
  assert.match(runtime, /from "\.\.\/\.\.\/\.\.\/core\/story-workflow\/story-workflow-core\.mjs"/);
  assert.match(runtime, /from "\.\.\/\.\.\/\.\.\/lib\/agents\/context\/context-engine"/);
});

test("#1499 retargets all three live module consumers", async () => {
  for (const path of [
    "modules/story-workflow/ui/foundations-buzz-story-live-test.tsx",
    "modules/story-workflow/ui/foundations-story-workflow-panel.tsx",
    "modules/story-workflow/workbench/workflow.ts",
  ]) {
    const content = await source(path);
    assert.match(content, /\.\.\/runtime\/foundations-story-workflow/);
    assert.doesNotMatch(content, /\.\.\/foundations-story-workflow["']/);
  }
});

test("#1499 preserves proposal-only Story Workflow authority boundaries", async () => {
  const runtime = await source("modules/story-workflow/runtime/foundations-story-workflow.ts");
  assert.match(runtime, /FOUNDATIONS_STORY_WORKFLOW_PROFILE_ID = "tamsin-hearthquill"/);
  assert.match(runtime, /FOUNDATIONS_STORY_WORKFLOW_FRONTIER = "Foundations"/);
  assert.match(runtime, /priority: waitingHuman \? "blocking" : "high"/);
  assert.match(runtime, /Only queued Story Work Items may start a Responsibility Run/);
  assert.match(runtime, /Creative changes remain proposals\. Never write PPF\/canon directly/);
  assert.match(runtime, /verificationMode: "writer-approval"/);
  assert.match(runtime, /cloudCostBudgetUsd: 0/);
});

test("#1499 marks the machine-readable batch complete while keeping the Phase 0 history", async () => {
  const contract = JSON.parse(await source("config/repository-architecture-target.json"));
  const batch = contract.moveBatches.find((item) => item.id === "phase2-modules-story-runtime");
  assert.equal(batch?.sourceRoot, "modules/story-workflow");
  assert.equal(batch?.targetRoot, "modules/story-workflow/runtime");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, ["modules/story-workflow/foundations-story-workflow.ts"]);
  assert.deepEqual(batch?.completedTargets, ["modules/story-workflow/runtime/foundations-story-workflow.ts"]);

  const history = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.match(history, /`modules\/story-workflow\/foundations-story-workflow\.ts` → `modules\/story-workflow\/runtime\/`/);
});
