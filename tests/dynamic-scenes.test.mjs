import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the structure model treats 48 scenes as a template rather than a restriction", async () => {
  const structure = await source("lib/structure.ts");

  for (const phrase of [
    "export type SceneType",
    "entryCondition",
    "exitCondition",
    "charactersEntering",
    "charactersLeaving",
    "pageEstimate",
    "shortScenes",
    "export function addDynamicScene",
    "export function duplicateDynamicScene",
    "export function removeDynamicScene",
    "export function moveDynamicScene",
    "export function moveSceneBetweenBlocks",
    "export function assignMiniBlockToScene",
    "export function addShortSceneToMini",
  ]) {
    assert.ok(structure.includes(phrase), `Dynamic scene model is missing: ${phrase}`);
  }

  assert.match(structure, /if \(!Array\.isArray\(value\) \|\| value\.length === 0\)/);
  assert.doesNotMatch(structure, /return defaults\.map\(\(scene, index\)/);
});

test("the Structure Engine exposes complete dynamic scene controls", async () => {
  const page = await source("app/structure/page.tsx");

  for (const phrase of [
    "The template is guidance, not a restriction.",
    "Add after",
    "Duplicate",
    "Delete",
    "Move scene",
    "Scene type",
    "Entry condition",
    "Exit condition",
    "Characters entering",
    "Characters leaving",
    "Duration seconds",
    "Page estimate",
    "Assign one to four mini-blocks to a scene.",
    "Add short scene",
  ]) {
    assert.ok(page.includes(phrase), `Structure Engine is missing: ${phrase}`);
  }
});
