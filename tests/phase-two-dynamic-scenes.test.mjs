import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Phase 2 keeps screenplay elements attached to stable scene identities", async () => {
  const project = await source("lib/project.ts");
  const draft = await source("lib/screenplay-draft.ts");
  const management = await source("lib/scene-management.ts");
  const writer = await source("app/script-workspace.tsx");

  assert.match(project, /sceneId\?: string/);
  assert.match(project, /sceneId: typeof draft\.sceneId === "string"/);
  assert.match(draft, /sceneId = ""/);
  for (const operation of [
    "buildGlobalSceneIndex",
    "synchronizeScreenplaySceneReferences",
    "assignDraftElementToScene",
    "analyzeSceneStructure",
  ]) {
    assert.match(management, new RegExp(`export function ${operation}\\b`), `Missing Phase 2 operation: ${operation}`);
  }
  assert.match(writer, /Add to Scene \{currentSceneEntry\?\.globalNumber/);
  assert.match(writer, /assignDraftElementToScene/);
  assert.match(writer, /S\{element\.sceneNumber\} · B\{element\.blockNumber\}/);
});

test("the canonical compatibility schema accepts flexible scenes and short scenes", async () => {
  const schema = JSON.parse(await source("schema/plotpickle-project.schema.json"));
  const scenes = schema.$defs.block.properties.scenes;
  const scene = schema.$defs.scene;
  const mini = schema.$defs.miniBlock;

  assert.equal(scenes.minItems, 1);
  assert.equal(scenes.maxItems, undefined);
  assert.equal(scene.properties.number.maximum, undefined);
  assert.equal(scene.properties.miniBlocks.minItems, undefined);
  assert.equal(scene.properties.miniBlocks.maxItems, 4);
  assert.ok(scene.required.includes("sceneType"));
  assert.ok(scene.required.includes("entryCondition"));
  assert.ok(scene.required.includes("charactersEntering"));
  assert.ok(scene.required.includes("pageEstimate"));
  assert.ok(mini.required.includes("shortScenes"));
  assert.equal(mini.properties.shortScenes.items.$ref, "#/$defs/shortScene");
  assert.equal(schema.$defs.screenplayDraftElement.properties.sceneId.type, "string");
});

test("the project validator no longer restores the two-scene restriction", async () => {
  const project = await source("lib/project.ts");
  assert.doesNotMatch(project, /block\.scenes\.length === 2/);
  assert.doesNotMatch(project, /scene\.miniBlocks\.length === 2/);
  assert.match(project, /block\.scenes\.length < 1/);
  assert.match(project, /miniNumbers\.length === 4/);
});

test("the Structure Engine reports scene health and global numbering", async () => {
  const page = await source("app/structure/page.tsx");
  const css = await source("app/structure/structure.module.css");
  const home = await source("app/page.tsx");

  for (const phrase of [
    "Scene health",
    "Global Scene {globalSceneNumber}",
    "Unassigned scenes",
    "Mini-block errors",
    "Continuity notices",
    "synchronizeScreenplaySceneReferences",
  ]) {
    assert.ok(page.includes(phrase), `Structure Engine is missing: ${phrase}`);
  }
  assert.match(css, /\.sceneDiagnostics/);
  assert.match(css, /\.diagnosticGrid/);
  assert.match(css, /\.continuityDetails/);
  assert.match(home, /flexible scenes → 96/);
  assert.match(home, /synchronizeScreenplaySceneReferences/);
});
