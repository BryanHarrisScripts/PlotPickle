import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const modelPath = "app/story-workbench/visual-impact.ts";
const pagePath = "app/story-workbench/page.tsx";

test("#1420 previews dependency-backed visual and text impact without creating parallel canon", async () => {
  const [model, page] = await Promise.all([source(modelPath), source(pagePath)]);

  assert.match(model, /deriveWorkbenchProjectionImpacts/);
  assert.match(model, /selectedTargetRef/);
  assert.match(model, /explainableRefs/);
  assert.match(model, /requiresCanonApply/);
  assert.match(model, /Visual story state/);
  assert.match(model, /Background story text/);
  assert.match(model, /Storyboard \/ visual identity/);
  assert.match(model, /Production Shot \/ Previs/);
  assert.match(model, /marks the projection for review instead of silently rewriting source or Human-authored screenplay text/);
  assert.match(model, /Only dependency-backed visual targets may become stale/);
  assert.match(model, /unrelated timing and approved assets stay current/);
  assert.doesNotMatch(model, /localStorage|plotpickle\.project\.v1|applyStoryCommand|saveFoundationProject/);

  assert.match(page, /deriveWorkbenchProjectionImpacts/);
  assert.match(page, /Projection impact preview/);
  assert.match(page, /data-projection-impact=/);
  assert.match(page, /No downstream projection is claimed affected without dependency evidence/);
});

test("#1420 keeps Human authority explicit in the Workbench impact preview", async () => {
  const [model, page] = await Promise.all([source(modelPath), source(pagePath)]);
  assert.match(model, /Existing kept visuals remain Human-approved/);
  assert.match(page, /Preview only/);
  assert.match(page, /does not regenerate media or rewrite script text/);
});
