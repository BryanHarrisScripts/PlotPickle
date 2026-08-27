import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const evidencePath = "core/contracts/imported-screenplay-evidence/index.ts";
const workbenchPath = "modules/story-workflow/workbench/workflow.ts";
const mapPath = "modules/build/progressive-story-map.ts";
const mapUiPath = "modules/build/ui/progressive-story-map.tsx";
const readinessPath = "app/screenplay-readiness/canonical-readiness.ts";

test("#1420 stores screenplay staleness as bounded projection provenance, not rewritten source text", async () => {
  const evidence = await source(evidencePath);

  assert.match(evidence, /ImportedScreenplayProjectionReview/);
  assert.match(evidence, /state: "needs-review"/);
  assert.match(evidence, /projectionReviews\?: readonly ImportedScreenplayProjectionReview\[\]/);
  assert.match(evidence, /\^ppf:build:block:\(\\d\{1,2\}\)/);
  assert.match(evidence, /\^block-\(\\d\{1,2\}\)/);
  assert.match(evidence, /number >= 1 && number <= 24/);
  assert.match(evidence, /affectedBlocks = \[\.\.\.new Set\(refs\.map\(projectionBlockNumber\)\.filter\(Boolean\)\)\]/);
  assert.match(evidence, /retained = existing\.filter\(\(review\) => !affectedBlocks\.includes\(review\.blockNumber\)\)/);
  assert.match(evidence, /Source passages remain immutable evidence/);
  assert.match(evidence, /\.\.\.evidence\.screenplay,[\s\S]*projectionReviews:/);
  assert.doesNotMatch(evidence, /passage\.text\s*=|text:\s*.*proposed|generated.*passages/i);
});

test("#1420 Workbench marks only dependency-backed Block text projections in the same applied revision", async () => {
  const workbench = await source(workbenchPath);

  assert.match(workbench, /markImportedScreenplayProjectionStale/);
  assert.match(workbench, /const appliedProject = applyStoryCommand/);
  assert.match(workbench, /sourceEvidence: markImportedScreenplayProjectionStale\(/);
  assert.match(workbench, /input\.prepared\.impact\.explainableRefs/);
  assert.match(workbench, /appliedProject\.revision/);
  assert.match(workbench, /previousRevision: currentRevision/);
  assert.doesNotMatch(workbench, /screenplay[^\n]{0,80}(?:rewrite|generate|replace)/i);
});

test("#1420 BUILD exposes current versus needs-review text state on the same canonical Block", async () => {
  const [model, ui] = await Promise.all([source(mapPath), source(mapUiPath)]);

  assert.match(model, /reviewState: "current" \| "needs-review"/);
  assert.match(model, /staleAtRevision: number \| null/);
  assert.match(model, /staleReasonRefs: readonly string\[\]/);
  assert.match(model, /projectionReviews\.find\(\(review\) => review\.blockNumber === number/);
  assert.match(model, /reviewState: projectionReview \? "needs-review" : "current"/);
  assert.match(ui, /data-text-review=\{selected\.backgroundText\.reviewState\}/);
  assert.match(ui, /NEEDS REVIEW/);
  assert.match(ui, /The source screenplay below has not been rewritten/);
  assert.match(ui, /only this dependency-backed Block was marked stale/);
  assert.match(ui, /data-canonical-story-id=\{selected\.backgroundText\.targetRef\}/);
});

test("#1420 readiness aggregates stale text Blocks without converting them into a fake completion score", async () => {
  const readiness = await source(readinessPath);

  assert.match(readiness, /CanonicalReadinessState = BuildStoryEvidenceState \| "current" \| "needs-review"/);
  assert.match(readiness, /backgroundText\.reviewState === "needs-review"/);
  assert.match(readiness, /textNeedsReview \?\s*"needs-review"/);
  assert.match(readiness, /dependency-backed PPF change/);
  assert.match(readiness, /observed source screenplay text remains unchanged/);
  assert.doesNotMatch(readiness, /movie complete|completion percentage|rewrite screenplay/i);
});
