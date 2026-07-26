import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #112 defines the approved four-zone application shell", async () => {
  const direction = await source("lib/product-direction.ts");
  for (const label of ["Orientation", "Creative workflow", "Project actions", "Application configuration"]) {
    assert.ok(direction.includes(label), `Missing shell zone: ${label}`);
  }
  for (const label of ["Dashboard", "Learn", "Plan", "Build", "Write", "Storyboard", "Refine", "Feedback", "Reports"]) {
    assert.ok(direction.includes(`\"${label}\"`), `Missing workflow item: ${label}`);
  }
  for (const label of ["New Project", "Import", "Export", "Load Afterglow"]) {
    assert.ok(direction.includes(label), `Missing project action: ${label}`);
  }
});

test("issue #112 renames Instructions without breaking the existing workspace id", async () => {
  const direction = await source("lib/product-direction.ts");
  assert.match(direction, /id: "instructions", label: "Introduction"/);
  assert.doesNotMatch(direction, /label: "Instructions"/);
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
  const header = await source("app/application-shell-header.tsx");
  const build = await source("app/build-workspace.tsx");
  const feedback = await source("app/feedback-workspace.tsx");

  assert.match(header, /shell-zone-orientation/);
  assert.match(header, /shell-zone-workflow/);
  assert.match(header, /shell-zone-project-actions/);
  assert.match(header, /shell-zone-configuration/);
  assert.match(header, /PROJECT_ACTIONS\.map/);

  assert.match(build, /StructureMapSummary/);
  assert.match(build, /canonical story movements/i);
  assert.match(build, /stable ID/i);

  assert.match(feedback, /project\.review\.threads/);
  assert.match(feedback, /Anchored review/);
  assert.match(feedback, /Suggestions do not overwrite the screenplay automatically/);
});
