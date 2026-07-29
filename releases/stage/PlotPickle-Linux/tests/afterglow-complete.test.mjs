import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the default app resolves to the complete renamed Afterglow project", async () => {
  const tsconfig = JSON.parse(await source("tsconfig.json"));
  const project = await source("data/afterglow-complete.ts");
  assert.deepEqual(tsconfig.compilerOptions.paths["@/data/afterglow"], ["./data/afterglow-complete"]);
  assert.match(project, /Afterglow: Reflections of Sentience/);
  assert.match(project, /originally titled “Afterglow: Echoes of Sentience,”/);
  assert.match(project, /written by Bryan Elgin Harris/);
  assert.match(project, /CC BY-SA 4\.0/);
  assert.match(project, /The Promise Fulfilled/);
  assert.match(project, /A New Family/);
  assert.match(project, /Reflections of Sentience/);
});

test("Afterglow includes 84 source WebP images and twelve replacement SVG keyframes", async () => {
  const files = await readdir(new URL("public/afterglow/storyboard/", root));
  const webp = files.filter((file) => file.endsWith(".webp")).sort();
  const svg = files.filter((file) => file.endsWith(".svg")).sort();
  assert.equal(webp.length, 84);
  assert.equal(svg.length, 12);
  assert.equal(webp[0], "block-01-mini-1.webp");
  assert.equal(webp.at(-1), "block-21-mini-4.webp");
  assert.equal(svg[0], "block-22-mini-1.svg");
  assert.equal(svg.at(-1), "block-24-mini-4.svg");

  const storyboard = await source("data/afterglow-storyboard.ts");
  assert.match(storyboard, /bundledStoryboardBlocks = 24/);
  assert.match(storyboard, /replacementBlocks = \[22, 23, 24\]/);
  assert.match(storyboard, /replacementImages: replacementBlocks\.length \* 4/);
  assert.match(storyboard, /unresolvedBlocks: \[]/);
});

test("Blocks 22 through 24 use new replacement concepts rather than incorrect legacy images", async () => {
  const project = await source("data/afterglow-complete.ts");
  assert.match(project, /legacy Block 22–24 folders duplicated Block 6 content/);
  assert.match(project, /replacement concept keyframes/);
  assert.match(project, /visuals: createAfterglowStoryboardFrames\(blockNumber\)/);
});
