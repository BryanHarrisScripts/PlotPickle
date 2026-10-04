import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2725 Outline is a selected-Block workspace with separate Block and Mini-Block anchors", async () => {
  const [surface, blockAnchor, miniAnchor, styles] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/outline-block-anchor-workspace.tsx"),
    read("app/skin-v1/outline-mini-block-anchor-workspace.tsx"),
    read("app/skin-v1/outline-mini-block-workspace.module.css"),
  ]);
  assert.match(surface, /data-outline-selected-block-only="true"/u);
  assert.match(surface, /selectedReadiness/u);
  assert.doesNotMatch(surface, /actReadiness\.map\(\(block\)/u);
  assert.match(surface, /<OutlineBlockAnchorWorkspace/u);
  assert.match(surface, /<OutlineMiniBlockAnchorWorkspace/u);
  assert.match(blockAnchor, /BLOCK VISUAL ANCHOR/u);
  assert.match(blockAnchor, /Mini-Block anchors and Storyboard's 25 shots remain separate layers/u);
  assert.match(miniAnchor, /VISUAL ANCHOR · SHARED WITH STORYBOARD/u);
  assert.match(miniAnchor, /full 25-position Storyboard sequence remains in Storyboard/u);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
});

test("#2725 Mind Map and World Map shared header contains navigation only", async () => {
  const shared = await read("app/skin-v1/story-development-surface-header.tsx");
  assert.match(shared, /data-story-development-act-rail="shared"/u);
  assert.match(shared, /data-story-development-topic-rail="canonical"/u);
  assert.doesNotMatch(shared, /className=\{styles\.identityRow\}/u);
  assert.doesNotMatch(shared, /<h1>\{title\}<\/h1>/u);
  assert.doesNotMatch(shared, />\s*Back to Dashboard\s*<\/button>/u);
});
