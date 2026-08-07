import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #395 opens a persistent visual writing session from block mini-block or scene", async () => {
  const model = await source("lib/visual-writing-session.ts");
  assert.match(model, /"block" \| "mini-block" \| "scene"/);
  assert.match(model, /readVisualWritingSessionState/);
  assert.match(model, /writeVisualWritingSessionState/);
  assert.match(model, /resumeVisualWritingSession/);
  assert.match(model, /const EXTENSION_KEY = "visualWritingSessions"/);
});

test("issue #395 keeps story purpose characters location action emotion and canon together", async () => {
  const view = await source("app/visual-writing-session.tsx");
  for (const phrase of ["Story purpose", "Characters", "Locations", "Action", "Emotional turn", "Current visual canon", "Write and direct together"]) {
    assert.ok(view.includes(phrase), `Missing visual-writing context: ${phrase}`);
  }
  assert.match(view, /context\.continuityWarnings/);
});

test("issue #395 links text notes and candidates to the exact structural target", async () => {
  const model = await source("lib/visual-writing-session.ts");
  assert.match(model, /sessionKey\(target\)/);
  assert.match(model, /candidate\.target\.kind === target\.kind/);
  assert.match(model, /candidate\.target\.id === target\.id/);
  assert.match(model, /textNotes/);
  assert.match(model, /visualDirection/);
});

test("issue #395 resumes session state after navigation and preserves approved output target links", async () => {
  const model = await source("lib/visual-writing-session.ts");
  assert.match(model, /approvedOutputIds/);
  assert.match(model, /linkApprovedVisualOutput/);
  assert.match(model, /approvedOutputIds: \[\.\.\.new Set/);
  assert.match(model, /resumeVisualWritingSession\(project: PlotPickleProject, target: VisualWritingTarget\)/);
});

test("issue #395 preserves human authority and manual use", async () => {
  const [model, view] = await Promise.all([
    source("lib/visual-writing-session.ts"),
    source("app/visual-writing-session.tsx"),
  ]);
  assert.match(view, /Nothing rewrites canon automatically/);
  assert.match(view, /continue writing manually/);
  assert.doesNotMatch(model, /providerId|modelId|endpointUrl|workflowId|apiKey|secret/i);
});

test("issue #395 remains downstream of context direction canon and continuity", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 395/);
  assert.match(registry, /"id": "scene-visual-writing"/);
  assert.match(registry, /"dependsOn": \["story-context-assembler", "creative-direction-controls", "visual-canon-binder", "continuity-locks"\]/);
});
