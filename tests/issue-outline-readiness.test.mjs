import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Outline separates observed screenplay evidence from deterministic support and review", async () => {
  const [check, surface, cards, script, map, css] = await Promise.all([
    source("modules/plan/outline-readiness.ts"),
    source("app/skin-v1/matrix-story-map-surface.tsx"),
    source("app/skin-v1/story-card-foundation-board.tsx"),
    source("app/skin-v1/act-written-story-board.tsx"),
    source("modules/build/ui/progressive-story-map.tsx"),
    source("app/skin-v1/preproduction-review-flow.css"),
  ]);
  assert.match(check, /finding\?\.state === "unresolved"/);
  assert.match(check, /unsupportedMiniBlocks\.length/);
  assert.match(check, /page-progress-fallback/);
  assert.match(check, /unresolved-insufficient-evidence/);
  assert.match(surface, /deriveOutlineReadiness\(project\)/);
  assert.match(cards, /data-outline-readiness=\{readiness\?\.status\}/);
  assert.match(script, /<details className="pp-skin-v1-written-act-mini"/);
  assert.match(script, /miniSections\.map/);
  assert.match(map, /data-outline-readiness=\{readiness\?\.status\}/);
  assert.match(css, /border-left: 2px solid var\(--outline-accent\) !important/);
});
