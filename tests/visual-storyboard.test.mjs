import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Visual Storyboard exposes the 24-block overview and all 96 mini-block visual slots", async () => {
  const page = await source("app/page.tsx");
  const board = await source("app/visual-storyboard.tsx");
  assert.match(page, /<VisualStoryboard/);
  for (const phrase of ["24 Blocks", "96 Mini-blocks", "/96 images", "miniBlockNumber", "storyboardPrompt"]) {
    assert.ok(board.includes(phrase), `Visual Storyboard is missing ${phrase}`);
  }
});

test("default prompts combine story, scene, character identity, location, screenplay, shot, and continuity context", async () => {
  const board = await source("app/visual-storyboard.tsx");
  for (const context of ["Block purpose", "Scene purpose", "Dramatic function", "CHARACTER IDENTITY LOCKS", "Location:", "Screenplay evidence", "Camera and composition", "Continuity lock"]) {
    assert.ok(board.includes(context), `Storyboard prompt is missing ${context}`);
  }
});

test("storyboard images use the private local gateway, landscape output, and local assets", async () => {
  const board = await source("app/visual-storyboard.tsx");
  const gateway = await source("build/local-ai-gateway.ts");
  assert.match(board, /\/api\/local-ai\/generate\/image/);
  assert.match(board, /aspect: "landscape"/);
  assert.match(board, /Refine with AI/);
  assert.match(board, /Copy prompt/);
  assert.match(gateway, /input\.aspect === "landscape" \? "1536x1024"/);
  assert.match(gateway, /input\.assetId \|\| input\.characterId/);
});

test("schema 1.7 migrates earlier projects into four storyboard slots per block", async () => {
  const project = await source("lib/project.ts");
  const schema = JSON.parse(await source("schema/plotpickle-project.schema.json"));
  assert.match(project, /createDefaultStoryboardFrames/);
  assert.match(project, /normalizeStoryboardFrames/);
  assert.ok(schema.$defs.visual.required.includes("miniBlockNumber"));
  assert.equal(schema.$defs.visual.properties.miniBlockNumber.maximum, 4);
});
