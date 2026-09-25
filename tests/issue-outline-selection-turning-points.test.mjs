import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { outlineTurningPoint } from "../modules/plan/outline-turning-point.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("each Act checkpoint follows its sixth Block without claiming a script address", () => {
  assert.deepEqual([1, 2, 3, 4].map((act) => outlineTurningPoint(act).blockNumber), [6, 12, 18, 24]);
  assert.match(outlineTurningPoint(4).label, /Act 4/);
});

test("turning-point and selection capabilities remain available without changing the #2389 primary Outline", async () => {
  const [surface, map, plan, script, footer] = await Promise.all([
    source("app/skin-v1/matrix-story-map-surface.tsx"),
    source("modules/build/ui/progressive-story-map.tsx"),
    source("app/skin-v1/story-card-foundation-board.tsx"),
    source("app/skin-v1/act-written-story-board.tsx"),
    source("app/skin-v1-surface-orchestrator.css"),
  ]);
  assert.match(map, /data-mini-number=\{mini.number\}/);
  assert.match(map, /onSelectAddress\?\.\(\{ blockNumber, miniBlockNumber \}\)/);
  assert.match(map, /onSelectTurningPoint\?\.\(Math.ceil\(sequence.number \/ 3\)\)/);
  assert.match(surface, /onSelectAddress=\{onAddressChange\}/);
  assert.doesNotMatch(surface, /onSelectTurningPoint=/);
  assert.doesNotMatch(surface, /turningPointSelected=/);
  assert.match(surface, /baselinePresentation/);
  assert.match(plan, /outlineTurningPoint\(act\)\.label/);
  assert.match(plan, /act && !baselinePresentation/);
  assert.match(script, /No screenplay passage is assigned to a separate turning point/);
  assert.match(footer, /orchestrator:has\(\[data-dashboard-review-surface="outline"\]\) \.pp-skin-v1-orchestrator-footer \{ width: calc\(100vw - 40px\)/);
});
