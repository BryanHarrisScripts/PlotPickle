import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1420 Afterglow v9 uses its existing Block 17 Council dependency as the Phase 10 propagation proof", async () => {
  const [councilProof, reference, richSource, importBridge] = await Promise.all([
    source("tests/issue-1417-story-council-afterglow.test.mjs"),
    source("modules/library/reference/afterglow-v9-foundations.ts"),
    source("data/afterglow-complete.ts"),
    source("modules/library/import/rich-ppf-to-library-project.ts"),
  ]);

  assert.match(councilProof, /affectedDownstreamRefs: \["ppf:structure:block-17"\]/,
    "Phase 10 must reuse the established Afterglow Council dependency rather than inventing a demo-only target");
  assert.match(reference, /createAfterglowProject as createRichAfterglowProject/);
  assert.match(reference, /richPpfToLibraryProject/);
  assert.match(reference, /afterglow-v9-block-17/);
  assert.match(richSource, /const blockNumber = index \+ 1/);
  assert.match(richSource, /"Lost and Found in Venice Beach",\s*"Waves of Connections"/,
    "the v9 source keeps the adjacent Block 16/17 movements available as distinct evidence");
  assert.match(importBridge, /blockNumber: element\.blockNumber/);
  assert.match(importBridge, /text: element\.text/);
});

test("#1420 maps the established Afterglow Structure ref onto the same canonical Block text projection", async () => {
  const [evidence, workbench, map] = await Promise.all([
    source("core/contracts/imported-screenplay-evidence/index.ts"),
    source("modules/story-workflow/workbench/workflow.ts"),
    source("modules/build/progressive-story-map.ts"),
  ]);

  assert.match(evidence, /\^ppf:\(\?:build:block:\|structure:block\[-:\]\)\(\\d\{1,2\}\)/);
  assert.match(evidence, /affectedBlocks = \[\.\.\.new Set\(refs\.map\(projectionBlockNumber\)\.filter\(Boolean\)\)\]/);
  assert.match(evidence, /reasonRefs: refs\.filter\(\(ref\) => projectionBlockNumber\(ref\) === blockNumber\)/);
  assert.match(workbench, /input\.prepared\.impact\.explainableRefs/);
  assert.match(workbench, /appliedProject\.revision/);
  assert.match(map, /projectionReviews\.find\(\(review\) => review\.blockNumber === number/);
});

test("#1420 Afterglow propagation keeps unrelated screenplay Blocks current and never rewrites v9 source text", async () => {
  const [evidence, map, ui, readiness] = await Promise.all([
    source("core/contracts/imported-screenplay-evidence/index.ts"),
    source("modules/build/progressive-story-map.ts"),
    source("modules/build/ui/progressive-story-map.tsx"),
    source("app/screenplay-readiness/canonical-readiness.ts"),
  ]);

  assert.match(evidence, /retained = existing\.filter\(\(review\) => !affectedBlocks\.includes\(review\.blockNumber\)\)/,
    "unrelated Block review state must survive targeted invalidation unchanged");
  assert.match(map, /reviewState: projectionReview \? "needs-review" : "current"/,
    "a Block without matching projection evidence stays current");
  assert.match(ui, /only this dependency-backed Block was marked stale/);
  assert.match(ui, /The source screenplay below has not been rewritten/);
  assert.match(readiness, /observed source screenplay text remains unchanged/);
  assert.doesNotMatch(evidence, /passage\.text\s*=|generated.*passages|rewrite.*screenplay/i);
});

test("#1420 Afterglow vertical proof remains Human-gated and revision-safe through Story Workbench", async () => {
  const [decisionCore, workbench, workbenchPage] = await Promise.all([
    source("core/story-workflow/story-decisions/core.d.ts"),
    source("modules/story-workflow/workbench/workflow.ts"),
    source("app/story-workbench/page.tsx"),
  ]);

  assert.match(decisionCore, /writesCanon: false/);
  assert.match(decisionCore, /requiresWorkbenchValidation: true/);
  assert.match(workbench, /currentRevision !== input\.prepared\.package\.baseRevision/);
  assert.match(workbench, /applyStoryCommand/);
  assert.match(workbenchPage, /saveFoundationProjectAtRevision/);
  assert.match(workbenchPage, /Only dependency-backed story work was re-evaluated; unrelated completed work stayed current/);
  assert.match(workbenchPage, /No automatic storyboard\/script regeneration/);
});
