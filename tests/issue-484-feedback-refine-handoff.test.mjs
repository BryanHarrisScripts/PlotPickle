import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#484 presents the reviewed feedback state language over canonical stored statuses", async () => {
  const workspace = await source("app/feedback-workspace.tsx");

  assert.match(workspace, /label: "Open", status: "open"/);
  assert.match(workspace, /label: "Considered", status: "under-review"/);
  assert.match(workspace, /label: "Deferred", status: "deferred"/);
  assert.match(workspace, /label: "Resolved", status: "resolved"/);
  assert.match(workspace, /updateSelected\(\{ status: item\.status \}\)/);
  assert.match(workspace, /updateFeedback\(project, selectedRecord\.id, patch\)/);
});

test("#484 keeps feedback decisions non-destructive", async () => {
  const workspace = await source("app/feedback-workspace.tsx");

  assert.match(workspace, /Feedback never changes canon automatically/);
  assert.match(workspace, /Classify this note without changing the story/);
  assert.doesNotMatch(workspace, /approveGraphicNovelAssetVersion|reconcileProductionDraft|approvedImageVersionId\s*=|fetch\(/);
});

test("#484 sends the selected feedback record and exact story position to Refine", async () => {
  const workspace = await source("app/feedback-workspace.tsx");

  assert.match(workspace, /function openRefine\(record: UnifiedFeedbackRecord\)/);
  assert.match(workspace, /record\.target\.blockId/);
  assert.match(workspace, /record\.target\.sceneId/);
  assert.match(workspace, /record\.target\.miniBlockId/);
  assert.match(workspace, /record\.target\.screenplayElementId/);
  assert.match(workspace, /url\.searchParams\.set\("workspace", "refine"\)/);
  assert.match(workspace, /url\.searchParams\.set\("block", String\(blockNumber\)\)/);
  assert.match(workspace, /url\.searchParams\.set\("mini", String\(miniBlockNumber\)\)/);
  assert.match(workspace, /url\.searchParams\.set\("feedback", record\.id\)/);
  assert.match(workspace, /url\.searchParams\.set\("target", record\.target\.targetId\)/);
  assert.match(workspace, /Continue to Refine/);
});

test("#484 keeps imported synthetic evidence read-only while still allowing Refine review", async () => {
  const workspace = await source("app/feedback-workspace.tsx");

  assert.match(workspace, /disabled=\{selectedRecord\.synthetic\}/);
  assert.match(workspace, /Imported diagnostic or revision evidence is read-only/);
  assert.match(workspace, /onClick=\{\(\) => openRefine\(selectedRecord\)\}/);
});
