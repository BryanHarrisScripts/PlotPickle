import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const routePath = "app/previs/page.tsx";
const modelPath = "app/_components/previs/previs-projection-model.ts";
const workspacePath = "app/_components/previs/previs-readiness-workspace.tsx";

test("#1425 opens Previs from the canonical PPF instead of legacy project storage", async () => {
  const [route, model, audit] = await Promise.all([
    read(routePath),
    read(modelPath),
    read("docs/architecture/previs-production-reuse-audit-1425.md"),
  ]);

  assert.match(route, /loadFoundationProject/);
  assert.match(route, /PPFProject/);
  assert.match(route, /_components\/previs\/previs-readiness-workspace/);
  assert.doesNotMatch(route, /plotpickle\.project\.v1|PlotPickleProject|localStorage/);

  assert.match(model, /deriveVisualReadiness/);
  assert.match(model, /STORYBOARD_REFERENCE_WORKFLOW/);
  assert.match(model, /currentStoryboardArtifactForFrame/);
  assert.match(model, /storyboardAnchorTargetRef/);
  assert.doesNotMatch(model, /ensureProductionWorkspace|createShotFromFrame|PlotPickleProject|plotpickle\.project\.v1|localStorage/);

  assert.match(audit, /24 Blocks \/ 96 Mini-Blocks/);
  assert.match(audit, /zero\/one\/many|no production shot yet, one shot, or many/);
  assert.match(audit, /canonical story-address/);
});

test("#1425 keeps creative Previs shots flexible while #1421 derives a fixed technical render grid", async () => {
  const [model, workspace] = await Promise.all([
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(model, /\[1, 2, 3, 4\]\.map/);
  assert.match(model, /timingAllowed = Boolean\(kept/);
  assert.match(model, /renderClipSlotsForAnchor\(blockNumber, miniBlockNumber\)/);
  assert.match(model, /allShotsTimed/);
  assert.match(model, /Math\.abs\(authoredDuration - RENDER_MINI_BLOCK_SECONDS\) < 0\.01/);
  assert.match(model, /durationSeconds: null/);
  assert.match(workspace, /24 Blocks \/ 96 Mini-Blocks/);
  assert.match(workspace, /Creative shots<\/dt>/);
  assert.match(workspace, /Render clips<\/dt>/);
  assert.match(workspace, /Previs timing<\/dt>/);
  assert.match(workspace, /Mini-Block total must reach/);
  assert.match(workspace, /creative shot may span one clip or several/i);
  assert.match(workspace, /Creative shots are not the render quota/);
});

test("#1425 preserves shared five-state language and truthful media placeholders", async () => {
  const [model, workspace, css] = await Promise.all([
    read(modelPath),
    read(workspacePath),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);

  for (const label of ["DEFINED", "OBSERVED", "EMERGING", "MISSING", "LOCKED"]) {
    assert.match(workspace, new RegExp(`${label}`));
  }
  for (const state of ["defined", "observed", "emerging", "missing", "locked"]) {
    assert.match(css, new RegExp(`\\[data-state=\\"${state}\\"\\]`));
  }

  assert.match(model, /observedReference/);
  assert.match(model, /must be kept in Storyboard before Previs timing begins/);
  assert.match(workspace, /REFERENCE ONLY/);
  assert.match(workspace, /NO TIMING YET/);
  assert.match(workspace, /loading="lazy"/);
  assert.match(workspace, /Creative timing flows onto a fixed generation grid/);
  assert.match(workspace, /Previs → Render Plan/);
  assert.match(workspace, /durationSeconds: parsedDuration/);
  assert.doesNotMatch(`${model}\n${workspace}`, /\/api\/.*generate|Render MP4/);
});
