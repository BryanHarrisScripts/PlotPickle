import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2381 Story Map exposes four Act views, each limited to its six canonical cards and three sequences", async () => {
  const [host, surface, board, map] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
  ]);
  assert.match(host, /data-story-act-rail="four-acts"/);
  assert.match(host, /\[1, 2, 3, 4\]\.map/);
  assert.match(host, /blockNumber: \(act - 1\) \* 6 \+ 1, miniBlockNumber: 1/);
  assert.match(surface, /<StoryCardFoundationBoard[^>]*act=\{activeAct\}/);
  assert.match(surface, /<ProgressiveStoryMap[^>]*act=\{activeAct\}/);
  assert.match(board, /storyCardActRows\(project\.structure\)\.filter\(\(row\) => !act \|\| row\.actNumber === act\)/);
  assert.match(map, /Math\.ceil\(sequence\.number \/ 3\) === act/);
  assert.match(map, /initialBlockNumber \?\? boundedLocation\("block", 24/);
});
