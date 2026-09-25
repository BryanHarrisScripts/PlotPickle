import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Outline projects six canonical script cards after the planning board without filling sparse Blocks", async () => {
  const [surface, board, css] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/act-written-story-board.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);
  assert.ok(surface.indexOf("<StoryCardFoundationBoard") < surface.indexOf("<ActWrittenStoryBoard"));
  assert.match(board, /storyCardActRows\(project\.structure\)\.find\(\(candidate\) => candidate\.actNumber === act\)/);
  assert.match(board, /row\.blocks\.map\(\(block\) =>/);
  assert.match(board, /blockWritingEntry\(project\.writing, address\)/);
  assert.match(board, /screenplay\?\.passages\.filter\(\(passage\) => passage\.blockNumber === block\.number && passage\.miniBlockNumber === address\.miniBlockNumber\)/);
  assert.match(board, /saved \? \(/);
  assert.match(board, /No script mapped to this Block yet\./);
  assert.match(board, /passagesTruncated/);
  assert.match(css, /\.pp-skin-v1-written-act-board \.pp-skin-v1-story-card/);
});
