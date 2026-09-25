import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Outline readiness remains available without altering the #2389 primary map", async () => {
  const [check, surface, cards, script, map, css] = await Promise.all([
    source("modules/plan/outline-readiness.ts"),
    source("app/skin-v1/matrix-story-map-surface.tsx"),
    source("app/skin-v1/story-card-foundation-board.tsx"),
    source("app/skin-v1/act-written-story-board.tsx"),
    source("modules/build/ui/progressive-story-map.tsx"),
    source("app/skin-v1/preproduction-review-flow.css"),
  ]);
  assert.match(check, /assessment\?\.structural.state === "unresolved"/);
  assert.match(check, /unsupportedMiniBlocks\.length/);
  assert.match(check, /page-progress-fallback/);
  assert.match(check, /assessment\?\.characters.some/);
  assert.doesNotMatch(surface, /deriveOutlineReadiness\(project\)/);
  assert.doesNotMatch(surface, /outlineReadiness=\{/);
  assert.doesNotMatch(surface, /pp-skin-v1-outline-readiness/);
  assert.match(cards, /data-outline-readiness=\{readiness\?\.status\}/);
  assert.match(script, /<details className="pp-skin-v1-written-act-mini"/);
  assert.match(script, /miniSections\.map/);
  assert.match(map, /data-outline-readiness=\{readiness\?\.status\}/);
  assert.match(css, /border-left: 2px solid var\(--outline-accent\) !important/);
});
