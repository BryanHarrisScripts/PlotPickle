import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #1165 extends the existing Storyboard direction with one minimal structured shot", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  for (const field of [
    "shotId",
    "narrativePurpose",
    "shotSize",
    "cameraAngle",
    "cameraMovement",
    "lensIntent",
    "lightingIntent",
    "continuityLockReferences",
    "notes",
  ]) {
    assert.match(model, new RegExp(`\\b${field}\\b`), `Missing structured shot field: ${field}`);
  }
  assert.match(model, /structuredShot: StoryboardStructuredShot/);
  assert.match(model, /const EXTENSION_KEY = "storyboardExploration"/);
  assert.doesNotMatch(model, /EXTENSION_KEY\s*=\s*"storyboardShots"/);
});

test("issue #1165 validates minimal structured shots without inventing a cinematic vocabulary", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /validateStoryboardStructuredShot/);
  assert.match(model, /shotId is required/);
  assert.match(model, /continuityLockReferences must be an array of strings/);
  assert.match(model, /shotSize: string/);
  assert.match(model, /cameraAngle: string/);
  assert.doesNotMatch(model, /exactFocalLength|cameraCoordinates|focusChoreography|depthLayers|directorBook/i);
});

test("issue #1165 keeps shot identity stable across edits and candidate regeneration", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /storyboardShotIdForTarget\(target/);
  assert.match(model, /shotId: storyboardShotIdForTarget\(target\)/);
  assert.match(model, /shotId: frame\.direction\.structuredShot\.shotId/);
  assert.doesNotMatch(model, /shotId:\s*frame\.id/);
});

test("issue #1165 round-trips all legacy Storyboard prose without converting vague text into fake precision", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  for (const field of ["shot", "staging", "composition", "camera", "movement"]) {
    assert.match(model, new RegExp(`${field}: text\\(direction\\.${field}\\)`), `Legacy ${field} no longer round-trips`);
  }
  assert.match(model, /shotSize: text\(raw\.shotSize\)/);
  assert.match(model, /cameraAngle: text\(raw\.cameraAngle\)/);
  assert.match(model, /cameraMovement: text\(raw\.cameraMovement\)/);
  assert.match(model, /lensIntent: text\(raw\.lensIntent\)/);
  assert.doesNotMatch(model, /shotSize:\s*text\(direction\.shot\)/);
  assert.doesNotMatch(model, /cameraAngle:\s*text\(direction\.camera\)/);
  assert.doesNotMatch(model, /cameraMovement:\s*text\(direction\.movement\)/);
});

test("issue #1165 keeps continuity-lock references attached independently of display notes", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  assert.match(model, /continuityLockReferences: context\.continuityLocks\.map\(\(lock\) => lock\.id\)/);
  assert.match(model, /continuityLockReferences: strings\(raw\.continuityLockReferences\)/);
  assert.match(model, /continuityNotes: context\.continuityLocks\.map/);
});

test("issue #1165 preserves manual AI-disabled use and existing candidate approval behavior", async () => {
  const [model, view] = await Promise.all([
    source("lib/storyboard-exploration.ts"),
    source("app/storyboard-exploration.tsx"),
  ]);
  assert.match(view, /sourceKind: "manual-import"/);
  assert.match(view, /direction,/);
  assert.match(view, /Add manual image/);
  assert.match(model, /if \(warnings\.length\) return \{ project, approved: false, warnings \}/);
  assert.match(model, /status: "superseded" as const/);
  assert.match(model, /supersededByCandidateId: frameId/);
  assert.match(model, /supersedesCandidateId: currentApproved\?\.id \|\| ""/);
});

test("issue #1165 derives presentation summary from structured direction with legacy fallback", async () => {
  const [model, view] = await Promise.all([
    source("lib/storyboard-exploration.ts"),
    source("app/storyboard-exploration.tsx"),
  ]);
  assert.match(model, /export function storyboardShotSummary/);
  assert.match(model, /direction\.shot \|\| direction\.camera \|\| direction\.movement \|\| direction\.staging/);
  assert.match(view, /storyboardShotSummary\(frame\.direction\)/);
});
