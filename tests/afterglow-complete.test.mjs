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

test("Afterglow includes 84 bundled WebP storyboard images for source Blocks 1 through 21", async () => {
  const files = await readdir(new URL("public/afterglow/storyboard/", root));
  const webp = files.filter((file) => file.endsWith(".webp")).sort();
  assert.equal(webp.length, 84);
  assert.equal(webp[0], "block-01-mini-1.webp");
  assert.equal(webp.at(-1), "block-21-mini-4.webp");

  const storyboard = await source("data/afterglow-storyboard.ts");
  assert.match(storyboard, /bundledStoryboardBlocks = 21/);
  assert.match(storyboard, /images: bundledStoryboardBlocks \* 4/);
  assert.match(storyboard, /unresolvedBlocks: \[22, 23, 24\]/);
  assert.match(storyboard, /\/afterglow\/storyboard\/block-/);
});

test("Blocks 22 through 24 use the complete screenplay without reusing incorrect legacy images", async () => {
  const project = await source("data/afterglow-complete.ts");
  assert.match(project, /legacy Block 22–24 folders duplicated Block 6 content/);
  assert.match(project, /visuals: createAfterglowStoryboardFrames\(blockNumber\)/);
  assert.match(project, /blockNumber <= 21/);
});
