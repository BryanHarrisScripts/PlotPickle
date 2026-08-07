import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #396 builds storyboard frame direction from scene and mini-block context", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /buildStoryboardFrameDirection/);
  assert.match(model, /buildVisualWritingSession/);
  assert.match(model, /context\.miniBlock\?\.purpose \|\| context\.scene\?\.purpose/);
  assert.match(model, /context\.miniBlock\?\.action \|\| context\.scene\?\.action/);
  assert.match(model, /context\.miniBlock\?\.turn \|\| context\.scene\?\.turn/);
});

test("issue #396 uses approved visual canon and continuity by default", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /approvedCanonItemIds: session\.approvedCanon\.map/);
  assert.match(model, /continuityNotes: context\.continuityLocks\.map/);
  assert.match(model, /storyboardApprovalWarnings/);
  assert.match(model, /context\.continuityWarnings/);
});

test("issue #396 treats manual and generated frames through the same review model", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /StoryboardFrameSourceKind = "generated" \| "manual-import"/);
  assert.match(model, /StoryboardFrameCandidate/);
  assert.match(model, /sourceKind: StoryboardFrameSourceKind/);
  assert.match(model, /status: StoryboardFrameStatus/);
  assert.match(model, /addStoryboardFrameCandidate/);
});

test("issue #396 preserves prior versions when a new frame is approved", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /status: "superseded" as const/);
  assert.match(model, /supersededByCandidateId: frameId/);
  assert.match(model, /supersedesCandidateId: currentApproved\?\.id \|\| ""/);
  assert.match(model, /frames: \[\.\.\.store\.frames, frame\]/);
});

test("issue #396 blocks approval when continuity conflicts are present", async () => {
  const [model, view] = await Promise.all([
    source("lib/storyboard-exploration.ts"),
    source("app/storyboard-exploration.tsx"),
  ]);
  assert.match(model, /if \(warnings\.length\) return \{ project, approved: false, warnings \}/);
  assert.match(view, /Resolve before approval/);
  assert.match(view, /disabled=\{warnings\.length > 0\}/);
  assert.match(view, /role="alert"/);
});

test("issue #396 exposes coherent frame exploration and manual import in one workspace", async () => {
  const view = await source("app/storyboard-exploration.tsx");
  for (const phrase of ["Storyboard Exploration", "Frame direction", "Continuity", "Alternate frames", "Explore staging", "Add manual image", "Approve frame"]) {
    assert.ok(view.includes(phrase), `Missing storyboard workspace behavior: ${phrase}`);
  }
  assert.match(view, /both enter the same review history/);
});

test("issue #396 remains downstream of scene visual writing and continuity", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 396/);
  assert.match(registry, /"id": "storyboard-exploration"/);
  assert.match(registry, /"dependsOn": \["scene-visual-writing", "continuity-locks"\]/);
});
