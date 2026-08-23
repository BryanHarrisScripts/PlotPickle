import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #315 packages a complete 96-panel Afterglow Graphic Novel sample", async () => {
  const [operations, storyboard, readme, files] = await Promise.all([
    source("lib/ai-pitch-deck.ts"),
    source("data/afterglow-storyboard.ts"),
    source("public/afterglow/storyboard/README.txt"),
    readdir(new URL("public/afterglow/storyboard/", root)),
  ]);
  const artwork = files.filter((name) => /\.(?:webp|svg)$/i.test(name));
  assert.equal(artwork.length, 96);
  assert.match(storyboard, /bundledStoryboardBlocks = 24/);
  assert.match(storyboard, /images: bundledStoryboardBlocks \* 4/);
  assert.match(readme, /84 WebP images/);
  assert.match(readme, /twelve new PlotPickle replacement concept keyframes/);
  assert.match(operations, /BUNDLED_AFTERGLOW_ASSET_PREFIX = "\/afterglow\/storyboard\/"/);
  assert.match(operations, /withBundledAfterglowGraphicNovel/);
  assert.match(operations, /status: "complete" as const/);
});

test("issue #315 preserves user artwork while providing editable bundled sample references", async () => {
  const operations = await source("lib/ai-pitch-deck.ts");
  assert.match(operations, /if \(panel\.imageSrc\) return panel/);
  assert.match(operations, /legacy\.comicPitchReferenceImages\(project, panel\)/);
  assert.match(operations, /Use the packaged storyboard frame as the editable sample reference/);
  assert.match(operations, /missingCharacterLocks: \[\]/);
  assert.match(operations, /remainingImages: hydrated\.panels\.filter/);
  assert.match(operations, /legacy\.withComicPitchDeck\(project, deck\)/);
});
