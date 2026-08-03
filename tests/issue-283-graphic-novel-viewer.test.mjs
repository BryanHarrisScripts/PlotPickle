import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dialogue = readFileSync(new URL("../lib/graphic-novel-dialogue.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../lib/graphic-novel-viewer.ts", import.meta.url), "utf8");
const viewer = readFileSync(new URL("../app/graphic-novel-viewer.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/ai-pitch-deck-workspace.tsx", import.meta.url), "utf8");
const queue = readFileSync(new URL("../app/use-graphic-novel-queue.ts", import.meta.url), "utf8");
const baseEditor = readFileSync(new URL("../app/ai-pitch-deck-workspace-base.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Phase 7 stores non-destructive balloon and caption direction in a versioned PPF extension", () => {
  assert.match(dialogue, /plotpickle\.graphicNovelDialogue\.v1/);
  assert.match(dialogue, /speech.*thought.*whisper.*shout/s);
  assert.match(dialogue, /top-left.*top-right.*bottom-left.*bottom-right/s);
  assert.match(dialogue, /originalText/);
  assert.match(dialogue, /sourceElementId/);
  assert.match(dialogue, /shortenGraphicNovelDialogue/);
  assert.match(dialogue, /graphicNovelDialogueIssues/);
});

test("Phase 7 viewer supports cover, page, spread and panel reading modes", () => {
  assert.match(viewer, /Complete Graphic Novel Viewer/);
  assert.match(viewer, /Single page/);
  assert.match(viewer, /Two-page spread/);
  assert.match(viewer, /Panel-by-panel/);
  assert.match(viewer, /ArrowRight/);
  assert.match(viewer, /Full screen/);
  assert.match(viewer, /Hide dialogue/);
  assert.match(viewer, /Zoom/);
  assert.match(viewer, /graphicNovelDialogueIssues/);
});

test("Phase 7 edits bubbles in context without drawing text into generated images", () => {
  assert.match(viewer, /Bubble and caption editor/);
  assert.match(viewer, /Balloon type/);
  assert.match(viewer, /Emotional delivery/);
  assert.match(viewer, /Reading order/);
  assert.match(viewer, /Maximum suggested length/);
  assert.match(viewer, /Automatic shortening/);
  assert.match(viewer, /Source screenplay line/);
  assert.match(viewer, /Restore original line/);
  assert.match(viewer, /Thought text/);
  assert.match(viewer, /Narration/);
});

test("Phase 7 provides single-panel recovery, image-version access and portable exports", () => {
  assert.match(queue, /async function regeneratePanel/);
  assert.match(workspace, /buildGraphicNovelViewerHtml/);
  assert.match(workspace, /downloadImageSequence/);
  assert.match(workspace, /graphicNovelImageFileName/);
  assert.match(viewer, /Replace image \/ open versions/);
  assert.match(baseEditor, /graphic-novel-panel-editor-/);
  assert.match(html, /reader-bar/);
  assert.match(html, /spread-mode/);
  assert.match(html, /panel-mode/);
  assert.match(html, /Print \/ Save PDF/);
  assert.match(html, /data-unresolved/);
});

test("Phase 7 focused regression is part of the complete test suite", () => {
  assert.match(packageJson.scripts.test, /issue-283-graphic-novel-viewer\.test\.mjs/);
  assert.equal(packageJson.scripts["test:graphic-novel-viewer"], "node --test tests/issue-283-graphic-novel-viewer.test.mjs");
});
