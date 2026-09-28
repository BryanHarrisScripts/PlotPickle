import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2535 Outline projects one selected Mini-Block slice", async () => {
  const [surface, styles] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/outline-mini-block-workspace.module.css"),
  ]);

  assert.match(surface, /OutlineMiniBlockAnchorWorkspace/u);
  assert.match(surface, /data-outline-selected-slice/u);
  assert.match(surface, /styles\.focusedSlice/u);
  assert.match(styles, /story-card-row > \.pp-skin-v1-story-card:not\(\[data-selected="true"\]\)/u);
  assert.match(styles, /story-card-minis li:not\(\[data-selected="true"\]\)/u);
  assert.match(styles, /written-act-mini:not\(\[data-selected="true"\]\)/u);
});

test("#2535 Outline anchor reuses Storyboard visual identity and version state", async () => {
  const anchor = await read("app/skin-v1/outline-mini-block-anchor-workspace.tsx");

  assert.match(anchor, /storyboardAnchorTargetRef/u);
  assert.match(anchor, /storyboardReferenceCandidates/u);
  assert.match(anchor, /createStoryboardReferenceArtifact/u);
  assert.match(anchor, /storyboard-frame-webp-v2/u);
  assert.match(anchor, /storyboard-local-save:v1/u);
  assert.match(anchor, /foundations\.visual\.store/u);
  assert.match(anchor, /foundations\.visual\.accept/u);
  assert.match(anchor, /foundations\.visual\.delete/u);
  assert.match(anchor, /\/api\/local-ai\/generate\/image/u);
  assert.match(anchor, /Saved locally/u);
  assert.match(anchor, /Locked/u);
  assert.match(anchor, /Previous anchor version/u);
  assert.match(anchor, /Next anchor version/u);
  assert.match(anchor, /full 25-position Storyboard sequence remains in Storyboard/u);
});
