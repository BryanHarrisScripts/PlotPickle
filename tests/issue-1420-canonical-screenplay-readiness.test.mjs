import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const pagePath = "app/screenplay-readiness/page.tsx";
const modelPath = "app/screenplay-readiness/canonical-readiness.ts";

test("#1420 retires the reachable screenplay-readiness parallel story store", async () => {
  const [page, model] = await Promise.all([source(pagePath), source(modelPath)]);

  assert.match(page, /loadFoundationProject/);
  assert.match(page, /PPFProject/);
  assert.match(page, /deriveCanonicalScreenplayReadiness/);
  assert.match(page, /data-canonical-project-id=\{project\.id\}/);
  assert.doesNotMatch(`${page}\n${model}`, /plotpickle\.project\.v1|PlotPickleProject|normalizePlotPickleProject|assessScreenplayReadiness|readinessDestinations/);
  assert.doesNotMatch(page, /localStorage/);
});

test("#1420 reports separate canonical coverage, source-text and production timing projections", async () => {
  const model = await source(modelPath);

  assert.match(model, /deriveProgressiveStoryMap\(project\)/);
  assert.match(model, /project\.production\.shots/);
  assert.match(model, /id: "visual-story-coverage"/);
  assert.match(model, /id: "background-story-text"/);
  assert.match(model, /id: "production-timing"/);
  assert.match(model, /Coverage is not a movie-complete percentage/);
  assert.match(model, /does not infer a finished screenplay from visual progress/);
  assert.match(model, /Timing remains Human-authored/);
  assert.doesNotMatch(model, /completionPercent|readinessScore|screenplayComplete\s*=|100%/);
});

test("#1420 keeps source mapping review and visual progress honest on the readiness surface", async () => {
  const [page, model] = await Promise.all([source(pagePath), source(modelPath)]);

  assert.match(model, /Some Block placement still requires Human review/);
  assert.match(model, /Current imported placement is reviewed/);
  assert.match(page, /Readiness is shown as canonical story coverage, source-text evidence and production timing—not one score/);
  assert.match(page, /Story and screenplay completion are never inferred from visual progress alone/);
  assert.match(page, /Open visual BUILD/);
  assert.match(page, /Open Storyboard/);
  assert.match(page, /Open Previs/);
  assert.match(page, /Save PPF backup/);
});
