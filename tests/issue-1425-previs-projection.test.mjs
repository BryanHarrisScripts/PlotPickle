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
  assert.match(audit, /zero, one, or many/);
  assert.match(audit, /canonical story address/);
});

test("#1425 keeps 24\/96 as provenance anchors rather than a fixed clip quota", async () => {
  const [model, workspace] = await Promise.all([
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(model, /\[1, 2, 3, 4\]\.map/);
  assert.match(model, /timingAllowed = Boolean\(kept/);
  assert.match(model, /No duration or motion is inferred/);
  assert.match(workspace, /24 Blocks \/ 96 canonical timing anchors/);
  assert.match(workspace, /0 \/ 1 \/ many/);
  assert.match(workspace, /Duration<\/dt><dd>Not inferred/);
  assert.match(workspace, /final clip count is intentionally flexible/);
  assert.match(workspace, /denser or lighter by Mini-Block, Block, Sequence or Act/);
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
  assert.match(workspace, /Timeline stays empty until timing is actually authored/);
  assert.doesNotMatch(`${model}\n${workspace}`, /\/api\/.*generate|Render MP4|saveFoundationProject/);
});
