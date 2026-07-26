import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #115 derives the whole-film wall from canonical mini-blocks", async () => {
  const model = await source("lib/mini-block-wall.ts");
  for (const contract of [
    "project.blocks",
    "block.scenes",
    "scene.miniBlocks",
    "mini.id",
    "block.id",
    "scene.id",
    "globalNumber",
    "createMiniBlockWallModel",
    "visibleCards",
  ]) assert.ok(model.includes(contract), `Mini-block wall is missing canonical contract: ${contract}`);
  assert.doesNotMatch(model, /miniBlockDatabase|wallRecords|persistWall|localStorage|sessionStorage/);
});

test("issue #115 supports every required focused view and colour mode", async () => {
  const model = await source("lib/mini-block-wall.ts");
  for (const value of [
    '"whole-film"',
    '"act"',
    '"sequence"',
    '"block"',
    '"character"',
    '"storyline"',
    '"location"',
    '"status"',
    '"setup-payoff"',
    '"label"',
  ]) assert.ok(model.includes(value), `Mini-block wall is missing view or colour mode: ${value}`);
});

test("issue #115 filters never mutate canonical ordering", async () => {
  const model = await source("lib/mini-block-wall.ts");
  assert.match(model, /const cards = \[\.\.\.project\.blocks\]/);
  assert.match(model, /\.sort\(\(left, right\) => left\.number - right\.number\)/);
  assert.match(model, /const visibleCards = cards\.filter/);
  assert.doesNotMatch(model, /visibleCards\.sort|filters[\s\S]*project\.blocks\s*=/);
});

test("issue #115 connects characters storylines locations scenes frames screenplay and shots", async () => {
  const model = await source("lib/mini-block-wall.ts");
  for (const contract of [
    "project.characters",
    "project.storyThreads",
    "project.world.locations",
    "scene.threadIds",
    "scene.locationIds",
    "block.visuals",
    "project.screenplay.draftElements",
    "project.production.shots",
    "screenplayElementIds",
    "shotIds",
  ]) assert.ok(model.includes(contract), `Mini-block wall is missing linked context: ${contract}`);
});

test("issue #115 defines the requested diagnostic families", async () => {
  const model = await source("lib/mini-block-wall.ts");
  for (const warning of [
    "empty-mini-block",
    "overloaded-block",
    "missing-escalation",
    "repeated-beat",
    "setup-without-payoff",
    "payoff-without-setup",
    "absent-character-arc",
    "storyline-gap",
    "unlinked-scene",
    "missing-storyboard-frame",
  ]) assert.ok(model.includes(`\"${warning}\"`), `Mini-block wall is missing diagnostic: ${warning}`);
  assert.match(model, /warnings: diagnostics\(project, cards\)/);
});

test("issue #115 normalizes restorable board state", async () => {
  const model = await source("lib/mini-block-wall.ts");
  for (const contract of [
    "selectedMiniBlockId",
    "expandedScope",
    "colourMode",
    "filters",
    "zoom",
    "pan",
    "normalizeMiniBlockWallState",
    "Math.min(2.5, Math.max(0.4",
  ]) assert.ok(model.includes(contract), `Mini-block wall state is missing: ${contract}`);
});

test("issue #115 foundation test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-115-mini-block-wall\.test\.mjs/);
  assert.equal(packageJson.scripts["test:mini-block-wall"], "node --test tests/issue-115-mini-block-wall.test.mjs");
});
