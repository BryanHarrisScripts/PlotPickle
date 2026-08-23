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
  const wall = await source("app/mini-block-wall.tsx");
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
  ]) assert.ok(model.includes(value) || wall.includes(value), `Mini-block wall is missing view or colour mode: ${value}`);
  assert.match(wall, /VIEW_OPTIONS/);
  assert.match(wall, /COLOUR_OPTIONS/);
  assert.match(wall, /legendValues/);
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
  const wall = await source("app/mini-block-wall.tsx");
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
  for (const contract of ["card.frame?.src", "selected.scene.title", "screenplay elements", "production shots"]) {
    assert.ok(wall.includes(contract), `Mini-block wall UI is missing linked context: ${contract}`);
  }
});

test("issue #115 defines and renders every diagnostic family", async () => {
  const model = await source("lib/mini-block-wall.ts");
  const wall = await source("app/mini-block-wall.tsx");
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
  assert.match(wall, /Diagnostics · \{model\.warnings\.length\} signals/);
  assert.match(wall, /revealCard\(card\)/);
});

test("issue #115 restores selection views filters zoom pan and expansion per project", async () => {
  const model = await source("lib/mini-block-wall.ts");
  const wall = await source("app/mini-block-wall.tsx");
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
  for (const contract of [
    "wallStateByProject",
    "wallStateByProject.get(project.id)",
    "wallStateByProject.set(project.id, next)",
    "Reset wall",
  ]) assert.ok(wall.includes(contract), `Mini-block wall restoration is missing: ${contract}`);
  assert.doesNotMatch(wall, /localStorage|sessionStorage/);
});

test("issue #115 edits canonical mini-blocks while preserving stable IDs and order", async () => {
  const edit = await source("lib/mini-block-wall-edit.ts");
  const wall = await source("app/mini-block-wall.tsx");
  for (const contract of [
    "project.blocks",
    "block.scenes",
    "scene.miniBlocks",
    "mini.id !== miniBlockId",
    "id: mini.id",
    "number: mini.number",
    "updateCanonicalMiniBlock",
  ]) assert.ok(edit.includes(contract), `Canonical mini-block editing is missing: ${contract}`);
  assert.match(wall, /onProjectChange\(updateCanonicalMiniBlock\(project, selectedCard\.id, patch\)\)/);
  assert.doesNotMatch(edit, /push\(|splice\(|sort\(/);
});

test("issue #115 renders setup payoff relationships and accessible keyboard movement", async () => {
  const wall = await source("app/mini-block-wall.tsx");
  for (const contract of [
    "relationshipCards",
    "Setup / payoff relationships",
    "normalized(card.payoff)",
    "normalized(card.setup)",
    'event.key === "ArrowRight"',
    'event.key === "ArrowLeft"',
    'event.key === "Home"',
    'event.key === "End"',
    "tabIndex={card.id === selectedCard?.id ? 0 : -1}",
    "requestAnimationFrame",
    "aria-pressed",
  ]) assert.ok(wall.includes(contract), `Wall relationship or keyboard contract is missing: ${contract}`);
});

test("issue #115 is responsive and exposes expand zoom pan filter and reset controls", async () => {
  const wall = await source("app/mini-block-wall.tsx");
  const css = await source("app/mini-block-wall.module.css");
  for (const contract of [
    "All 96 expanded",
    "Selected act",
    "Selected sequence",
    "Selected Block",
    "Zoom out",
    "Zoom in",
    "Pan left",
    "Pan right",
    "Character filter",
    "Storyline filter",
    "Location filter",
    "Status filter",
  ]) assert.ok(wall.includes(contract), `Wall control is missing: ${contract}`);
  assert.match(css, /@media\(max-width:1320px\)/);
  assert.match(css, /@media\(max-width:1060px\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /overflow:auto/);
  assert.match(css, /grid-template-columns:repeat\(6/);
});

test("issue #115 mounts the wall as Build's fifth canonical view", async () => {
  const build = await source("app/build-workspace.tsx");
  for (const contract of [
    'import MiniBlockWall from "./mini-block-wall"',
    'BuildWorkspaceView | "mini-blocks"',
    'id: "mini-blocks", label: "96 Mini-blocks"',
    'view === "mini-blocks"',
    "<MiniBlockWall project={project} onProjectChange={onProjectChange} onOpenBlock={onOpenBlock}",
    "!wallMode",
  ]) assert.ok(build.includes(contract), `Build integration is missing: ${contract}`);
});

test("issue #115 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-115-mini-block-wall\.test\.mjs/);
  assert.equal(packageJson.scripts["test:mini-block-wall"], "node --test tests/issue-115-mini-block-wall.test.mjs");
});
