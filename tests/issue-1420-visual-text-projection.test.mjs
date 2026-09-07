import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const modelPath = "modules/build/progressive-story-map.ts";
const uiPath = "modules/build/ui/progressive-story-map.tsx";
const cssPath = "modules/build/ui/progressive-story-map.module.css";

test("#1420 binds visual and background text projections to the same canonical Block identity", async () => {
  const [model, ui] = await Promise.all([source(modelPath), source(uiPath)]);

  assert.match(model, /const blockId = `block-\$\{String\(number\)\.padStart\(2, "0"\)\}`/);
  assert.match(model, /targetRef: blockId/);
  assert.match(model, /backgroundText: ProgressiveStoryTextProjection/);
  assert.match(ui, /data-canonical-story-id=\{block\.id\}/);
  assert.match(ui, /data-canonical-story-id=\{selected\.id\}/);
  assert.match(ui, /data-canonical-story-id=\{selected\.backgroundText\.targetRef\}/);
  assert.match(ui, /Background story text/);
  assert.match(ui, /Same canonical Block/);
  assert.match(ui, /Read-only source projection/);
});

test("#1420 projects bounded screenplay evidence without rewriting or inflating canon", async () => {
  const [model, ui] = await Promise.all([source(modelPath), source(uiPath)]);

  assert.match(model, /normalizeProjectSourceEvidence/);
  assert.match(model, /blockPassages\.slice\(0, 6\)/);
  for (const field of ["id: passage.id", "type: passage.type", "text: passage.text", "sceneNumber: passage.sceneNumber", "miniBlockNumber: passage.miniBlockNumber"]) {
    assert.ok(model.includes(field), `Background text projection is missing source field: ${field}`);
  }
  assert.match(model, /sourceKind: blockPassages\.length \? "observed-screenplay" : "none"/);
  assert.match(model, /placementReviewed: reviewedMapping/);
  assert.match(ui, /Observed source text is shown without rewriting/);
  assert.match(ui, /suggested Block placement still requires Human review/);
  assert.doesNotMatch(`${model}\n${ui}`, /plotpickle\.project\.v1|PlotPickleProject|\/api\/.*generate|provider.*generate/i);
});

test("#1420 keeps missing background text visibly missing instead of fabricating a script", async () => {
  const [model, ui, css] = await Promise.all([source(modelPath), source(uiPath), source(cssPath)]);

  assert.match(model, /state: blockPassages\.length \? reviewedMapping \? "observed" : "emerging" : "missing"/);
  assert.match(ui, /No observed screenplay text is attached to this Block\. PlotPickle does not fabricate background script text/);
  assert.match(ui, /No source screenplay passage currently supports this exact Block\. The text projection remains missing instead of generating filler/);
  assert.match(ui, /data-text-projection=\{selected\.backgroundText\.state\}/);
  assert.match(css, /\.textProjection \{ grid-column: 1 \/ -1/);
  assert.match(css, /\.sourcePassages/);
  assert.match(css, /\.textProvenance/);
});