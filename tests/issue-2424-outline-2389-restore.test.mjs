import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2424 restores the #2389 primary Outline composition", async () => {
  const [surface, map, layout, colors, fullBrowser, planner] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("modules/build/ui/progressive-story-map.tsx"),
    read("modules/build/ui/progressive-story-map.module.css"),
    read("app/skin-v1/preproduction-matrix-contract.css"),
    read("app/skin-v1-surface-orchestrator.css"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
  ]);

  assert.ok(surface.indexOf("<ProgressiveStoryMap") < surface.indexOf("<StoryCardFoundationBoard"));
  assert.match(surface, /navigationOnly/);
  assert.match(surface, /onSelectAddress=\{onAddressChange\}/);
  assert.match(surface, /baselinePresentation/);
  assert.doesNotMatch(surface, /deriveOutlineReadiness/);
  assert.doesNotMatch(surface, /outlineReadiness=\{/);
  assert.doesNotMatch(surface, /onSelectTurningPoint=/);
  assert.doesNotMatch(surface, /turningPointSelected=/);
  assert.doesNotMatch(surface, /data-outline-hierarchy=/);
  assert.doesNotMatch(surface, /pp-skin-v1-outline-readiness/);
  assert.doesNotMatch(surface, /<ActWrittenStoryBoard/);

  assert.match(map, /locked: "BLOCKED"/);
  assert.match(map, /The story is the navigation\./);
  assert.match(layout, /\.map\[aria-label\^="Act "\] \{ grid-template-columns: repeat\(3,minmax\(240px,1fr\)\); grid-template-rows: auto; grid-auto-flow: row/);

  const palette = [...colors.matchAll(/--story-(?:defined|observed|emerging|missing|locked): (#[a-f\d]{6});/gu)].map((match) => match[1]);
  assert.equal(new Set(palette).size, 5);

  assert.match(fullBrowser, /data-skin-v1-active-surface="story-map"/);
  assert.match(fullBrowser, /width:\s*calc\(100vw - 40px\);/u);

  assert.match(planner, /baselinePresentation = false/);
  assert.match(planner, /act && !baselinePresentation/);
  assert.match(planner, /!baselinePresentation \? <div className="pp-skin-v1-outline-agent-summary"/);
});
