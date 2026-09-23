import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { outlineTurningPoint } from "../modules/plan/outline-turning-point.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("each Act checkpoint follows its sixth Block without claiming a script address", () => {
  assert.deepEqual([1, 2, 3, 4].map((act) => outlineTurningPoint(act).blockNumber), [6, 12, 18, 24]);
  assert.match(outlineTurningPoint(4).label, /Act 4/);
});

test("Outline selection is shared across navigation, readiness, planning, and script", async () => {
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
  assert.match(surface, /onSelectAddress=\{selectAddress\}/);
  assert.match(surface, /data-outline-readiness=\{block.status\} data-selected=/);
  assert.match(surface, /onSelectTurningPoint=\{setTurningPointAct\}/);
  assert.match(plan, /data-mini-address=\{mini.id\} data-selected=/);
  assert.match(plan, /outlineTurningPoint\(act\)\.label/);
  assert.match(script, /pp-skin-v1-written-act-mini" data-mini-support=.*data-selected=/);
  assert.match(script, /No screenplay passage is assigned to a separate turning point/);
  assert.match(footer, /orchestrator:has\(\[data-dashboard-review-surface="outline"\]\) \.pp-skin-v1-orchestrator-footer \{ width: calc\(100vw - 40px\)/);
});
