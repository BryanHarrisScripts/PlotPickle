import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #114 derives Build views from the canonical project", async () => {
  const model = await source("lib/build-workspace-model.ts");
  for (const contract of [
    "project.blocks",
    "project.structure.sequences",
    "project.characters",
    "project.world.locations",
    "block.scenes",
    "scene.miniBlocks",
    "whole-film",
    "act",
    "sequence",
    "blocks",
  ]) assert.ok(model.includes(contract), `Build foundation is missing canonical contract: ${contract}`);
  assert.doesNotMatch(model, /localStorage|sessionStorage|fetch\(|apiKey|accessToken/);
});

test("issue #114 supports search and filters without persisted Build-only records", async () => {
  const model = await source("lib/build-workspace-model.ts");
  for (const contract of [
    "BuildWorkspaceFilter",
    "filter.acts",
    "filter.sequences",
    "filter.statuses",
    "filter.labels",
    "filter.query",
    "BuildBlockStatus",
    "buildStatus(block)",
  ]) assert.ok(model.includes(contract), `Build filtering is missing: ${contract}`);
  assert.doesNotMatch(model, /buildDatabase|buildRecords|persistBuild|saveBuild/);
});

test("issue #114 canonical Block edits preserve stable IDs", async () => {
  const model = await source("lib/build-workspace-model.ts");
  assert.match(model, /export function updateCanonicalBuildBlock/);
  assert.match(model, /block\.id === blockId/);
  assert.match(model, /id: block\.id/);
  assert.match(model, /metadata:[\s\S]*updatedAt: new Date\(\)\.toISOString\(\)/);
  assert.doesNotMatch(model, /Pick<StoryBlock,[\s\S]*\| "id"/);
  assert.doesNotMatch(model, /Pick<StoryBlock,[\s\S]*\| "number"/);
});

test("issue #114 records reference-remapping as a prerequisite for reorder", async () => {
  const doc = await source("docs/issue-114-build-workspace.md");
  for (const phrase of [
    "reference-remapping",
    "screenplay elements",
    "thread milestones",
    "arc checkpoints",
    "production records",
    "undo tests",
    "cannot silently lose links",
  ]) assert.ok(doc.includes(phrase), `Build reorder safety note is missing: ${phrase}`);
});

test("issue #114 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-114-build-workspace\.test\.mjs/);
  assert.equal(packageJson.scripts["test:build-workspace"], "node --test tests/issue-114-build-workspace.test.mjs");
});
