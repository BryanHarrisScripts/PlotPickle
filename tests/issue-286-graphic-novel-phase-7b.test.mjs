import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dialogue = readFileSync(new URL("../lib/graphic-novel-dialogue.ts", import.meta.url), "utf8");
const html = readFileSync(new URL("../lib/graphic-novel-viewer.ts", import.meta.url), "utf8");
const viewer = readFileSync(new URL("../app/graphic-novel-viewer.tsx", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../app/ai-pitch-deck-workspace.tsx", import.meta.url), "utf8");
const queue = readFileSync(new URL("../app/use-graphic-novel-queue.ts", import.meta.url), "utf8");
const baseEditor = readFileSync(new URL("../app/ai-pitch-deck-workspace-base.tsx", import.meta.url), "utf8");
const projectSource = readFileSync(new URL("../lib/project.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Phase 7B stores non-destructive writing direction in a versioned PPF extension", () => {
  assert.match(dialogue, /plotpickle\.graphicNovelDialogue\.v1/);
  assert.match(dialogue, /speech.*thought.*whisper.*shout/s);
  assert.match(dialogue, /emotionalDelivery/);
  assert.match(dialogue, /readingOrder/);
  assert.match(dialogue, /maxCharacters/);
  assert.match(dialogue, /originalText/);
  assert.match(projectSource, /schemaVersion: "1\.7\.0"/);
});

test("Phase 7B completes cover, spread, panel, dialogue visibility and zoom reading", () => {
  assert.match(viewer, /Complete Graphic Novel Viewer/);
  assert.match(viewer, /Single page/);
  assert.match(viewer, /Two-page spread/);
  assert.match(viewer, /Panel-by-panel/);
  assert.match(viewer, /Hide dialogue/);
  assert.match(viewer, /Zoom −/);
  assert.match(viewer, /ArrowLeft/);
  assert.match(viewer, /graphicNovelDialogueIssues/);
});

test("Phase 7B completes advanced bubble and caption writing controls", () => {
  assert.match(viewer, /Bubble and caption editor/);
  assert.match(viewer, /Balloon type/);
  assert.match(viewer, /Emotional delivery/);
  assert.match(viewer, /Reading order/);
  assert.match(viewer, /Maximum suggested length/);
  assert.match(viewer, /Automatic shortening/);
  assert.match(viewer, /Source screenplay line/);
  assert.match(viewer, /Restore original line/);
  assert.match(viewer, /Original narration/);
});

test("Phase 7B provides focused panel recovery and image-version access", () => {
  assert.match(queue, /async function regeneratePanel/);
  assert.match(viewer, /Regenerate current panel/);
  assert.match(viewer, /Replace image \/ open versions/);
  assert.match(workspace, /plotpickle:open-graphic-novel-panel/);
  assert.match(baseEditor, /graphic-novel-panel-editor-/);
});

test("Phase 7B provides interactive HTML, PDF and ordered image-sequence exports", () => {
  assert.match(workspace, /buildGraphicNovelViewerHtml/);
  assert.match(workspace, /downloadImageSequence/);
  assert.match(workspace, /graphicNovelImageFileName/);
  assert.match(html, /reader-bar/);
  assert.match(html, /spread-mode/);
  assert.match(html, /panel-mode/);
  assert.match(html, /Print \/ Save PDF/);
  assert.match(html, /data-unresolved/);
});

test("Phase 7B focused regression is part of the complete test suite", () => {
  assert.match(packageJson.scripts.test, /issue-286-graphic-novel-phase-7b\.test\.mjs/);
  assert.equal(packageJson.scripts["test:graphic-novel-phase-7b"], "node --test tests/issue-286-graphic-novel-phase-7b.test.mjs");
});
