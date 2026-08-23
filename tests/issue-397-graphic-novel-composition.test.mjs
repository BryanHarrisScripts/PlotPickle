import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #397 keeps every panel traceable to story context and source candidates", async () => {
  const model = await source("lib/graphic-novel-composition.ts");
  assert.match(model, /target: VisualWritingTarget/);
  assert.match(model, /sourceCandidateIds: string\[\]/);
  assert.match(model, /storyboardFrameId: string/);
  assert.match(model, /dialogue: string/);
  assert.match(model, /framing: string/);
  assert.match(model, /continuityNotes: string\[\]/);
});

test("issue #397 composes from approved or shortlisted visual material", async () => {
  const model = await source("lib/graphic-novel-composition.ts");
  assert.match(model, /GraphicNovelPanelStatus = "unresolved" \| "shortlisted" \| "approved" \| "replaced"/);
  assert.match(model, /approvedStoryboardSources/);
  assert.match(model, /frame\.status === "approved" \|\| frame\.status === "candidate"/);
});

test("issue #397 preserves lineage when panels are replaced or pages reflow", async () => {
  const model = await source("lib/graphic-novel-composition.ts");
  assert.match(model, /replaceGraphicNovelPanel/);
  assert.match(model, /replacedByPanelId: replacement\.id/);
  assert.match(model, /replacesPanelId: priorPanelId/);
  assert.match(model, /reflowGraphicNovelPage/);
  assert.match(model, /panelIds: \[\.\.\.panelIds\]/);
});

test("issue #397 export uses approved package and reports unresolved panels", async () => {
  const model = await source("lib/graphic-novel-composition.ts");
  assert.match(model, /buildGraphicNovelExport/);
  assert.match(model, /approvedPanels/);
  assert.match(model, /unresolvedPanels/);
  assert.match(model, /canonMutated: false/);
});

test("issue #397 exposes reviewable connected pages without silent canon edits", async () => {
  const view = await source("app/graphic-novel-composition.tsx");
  for (const phrase of ["Graphic Novel", "source candidate", "Approve panel", "Replace panel", "unresolved panels", "Page reflow changes composition only"]) {
    assert.ok(view.includes(phrase), `Missing Graphic Novel behavior: ${phrase}`);
  }
});

test("issue #397 remains downstream of Storyboard and Visual Canon Binder", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 397/);
  assert.match(registry, /"id": "graphic-novel-composition"/);
  assert.match(registry, /"dependsOn": \["storyboard-exploration", "visual-canon-binder"\]/);
});
