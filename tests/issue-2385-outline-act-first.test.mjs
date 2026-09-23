import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Outline presents Act selection, story navigation, then the six-card planning board", async () => {
  const [host, surface, map, frame] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.module.css"),
  ]);
  assert.ok(host.indexOf("<StoryActRail activeAct=") < host.indexOf("<MatrixStoryMapSurface"));
  assert.ok(surface.indexOf("<ProgressiveStoryMap") < surface.indexOf("<StoryCardFoundationBoard"));
  assert.match(map, /navigationOnly \? <article|!navigationOnly \? <article/);
  assert.match(surface, /navigationOnly/);
  assert.doesNotMatch(surface, /WRITTEN STORY|PAGEFLOW|LEARN THIS STORY POSITION|data-writer-story-action/);
  assert.match(frame, /reviewSurface\[data-dashboard-review-surface="outline"\][\s\S]*border: 0/);
});
