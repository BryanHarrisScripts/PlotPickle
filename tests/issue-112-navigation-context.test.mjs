import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #112 follows the current ordered workflow-group application shell", async () => {
  const direction = await source("lib/product-direction.ts");
  for (const label of ["Discovery & Pre-Production", "Production & Polishing", "Project actions", "Application configuration"]) {
    assert.ok(direction.includes(label), `Missing shell zone: ${label}`);
  }
  for (const label of ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Pitch", "Build", "Feedback", "Refine", "Reports"]) {
    assert.ok(direction.includes(`\"${label}\"`), `Missing workflow item: ${label}`);
  }
  for (const label of ["New Project", "Import", "Export", "Load Afterglow"]) {
    assert.ok(direction.includes(label), `Missing project action: ${label}`);
  }
});

test("Introduction is retained as a compatible deep workspace, not a primary step", async () => {
  const direction = await source("lib/product-direction.ts");
  const primary = direction.slice(direction.indexOf("PRIMARY_WORKFLOW_NAVIGATION"), direction.indexOf("PRODUCT_NAVIGATION"));
  assert.match(direction, /ProductNavigationId[^;]*"instructions"/);
  assert.doesNotMatch(primary, /instructions|Introduction/);
  assert.match(primary, /id: "learn"[\s\S]*introduction and terminology/);
});

test("issue #112 context model preserves required working selections", async () => {
  const context = await source("lib/workspace-context.ts");
  for (const field of [
    "workspace",
    "submenu",
    "blockId",
    "miniBlockId",
    "sceneId",
    "characterId",
    "feedbackTargetId",
    "inspector",
    "filter",
    "zoom",
    "boardPosition",
    "scrollPosition",
  ]) {
    assert.ok(context.includes(field), `Missing context field: ${field}`);
  }
  assert.match(context, /restorePreviousContext/);
  assert.match(context, /previous: history\.current/);
});

test("issue #112 supplies reusable live shell, Build and Feedback components", async () => {
  const [header, build, buildOrder, feedback] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/build-workspace.tsx"),
    source("lib/build-workspace-order.ts"),
    source("app/feedback-workspace.tsx"),
  ]);

  assert.match(header, /shell-zone-discovery/);
  assert.match(header, /shell-zone-production/);
  assert.match(header, /shell-zone-project-actions/);
  assert.match(header, /shell-zone-configuration/);
  assert.match(header, /PROJECT_ACTIONS\.map/);

  assert.match(build, /createBuildWorkspaceModel/);
  assert.match(build, /Whole film/);
  assert.match(build, /onProjectChange/);
  assert.match(buildOrder, /canonicalBuildOrder/);
  assert.match(buildOrder, /block\.id/);

  assert.match(feedback, /project\.review\.threads/);
  assert.match(feedback, /Anchored review/);
  assert.match(feedback, /Suggestions do not overwrite the screenplay automatically/);
});
