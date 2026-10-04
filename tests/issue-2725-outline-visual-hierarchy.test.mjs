import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2725 Outline expands one selected Block and keeps Block/Mini visual layers distinct", async () => {
  const [surface, css, blockAnchor, miniAnchor] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/outline-mini-block-workspace.module.css"),
    read("app/skin-v1/outline-block-anchor-workspace.tsx"),
    read("app/skin-v1/outline-mini-block-anchor-workspace.tsx"),
  ]);

  assert.match(surface, /const selectedReadiness = actReadiness\.find/u);
  assert.doesNotMatch(surface, /\{actReadiness\.map\(/u);
  assert.match(surface, /data-outline-selected-block=/u);
  assert.match(surface, /<OutlineBlockAnchorWorkspace[\s\S]*<OutlineMiniBlockAnchorWorkspace/u);
  assert.match(css, /\.selectedReadiness[\s\S]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(css, /\.focusedSlice :global\(\.pp-skin-v1-story-card-row\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(blockAnchor, /BLOCK VISUAL ANCHOR/u);
  assert.match(blockAnchor, /data-outline-block-anchor=/u);
  assert.match(blockAnchor, /outline-block-anchor:block:block-/u);
  assert.match(blockAnchor, /afterglow-visual-manifest\.json/u);
  assert.match(blockAnchor, /kind === "block-cover"/u);
  assert.match(blockAnchor, /Generate Block Anchor/u);
  assert.match(blockAnchor, /25-shot sequence remains in Storyboard/u);
  assert.match(miniAnchor, /MINI-BLOCK VISUAL ANCHOR · SHARED WITH STORYBOARD/u);
  assert.match(miniAnchor, /independent of the Block Visual Anchor above/u);
  assert.match(miniAnchor, /25-shot Storyboard sequence remains in Storyboard/u);
});

test("#2725 Mind Map and World Map do not duplicate shell title or return control", async () => {
  const [shared, acceptance] = await Promise.all([
    read("app/skin-v1/story-development-surface-header.tsx"),
    read("core/sidecars/webmcp-acceptance-sidecar.mjs"),
  ]);
  assert.match(shared, /data-story-development-act-rail="shared"/u);
  assert.match(shared, /data-story-development-topic-rail="canonical"/u);
  assert.doesNotMatch(shared, /<h1>/u);
  assert.doesNotMatch(shared, /Back to Dashboard/u);
  assert.doesNotMatch(shared, /pp-skin-v1-return/u);
  assert.doesNotMatch(shared, /className=\{styles\.identityRow\}/u);
  assert.match(acceptance, /shellSurfaceLabel/u);
  assert.match(acceptance, /mind-map-local-identity-removed/u);
  assert.match(acceptance, /world-map-local-identity-removed/u);
  assert.match(acceptance, /\.pp-skin-v1-home-link/u);
  assert.doesNotMatch(acceptance, /mind-map-header-title|world-map-header-title/u);
});
