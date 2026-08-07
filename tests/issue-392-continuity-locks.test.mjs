import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #392 defines scoped continuity locks for the required visual facts", async () => {
  const model = await source("lib/continuity-locks.ts");
  for (const phrase of [
    '"identity" | "wardrobe" | "prop" | "architecture" | "palette" | "time" | "weather" | "camera"',
    '"project" | "sequence" | "block" | "scene"',
    "ContinuityLock",
    "ContinuityOverride",
    "canonItemId",
  ]) assert.ok(model.includes(phrase), `Missing continuity contract: ${phrase}`);
});

test("issue #392 resolves inherited locks by scope and permits explicit overrides", async () => {
  const model = await source("lib/continuity-locks.ts");
  assert.match(model, /PRECEDENCE/);
  assert.match(model, /effectiveContinuityLocks/);
  assert.match(model, /if \(scope\.kind === "project"\) return true/);
  assert.match(model, /scope\.id === target\.sequenceId/);
  assert.match(model, /scope\.id === target\.blockId/);
  assert.match(model, /scope\.id === target\.sceneId/);
  assert.match(model, /override\?\.value \|\| lock\.value/);
});

test("issue #392 warns on conflicting overrides before generation", async () => {
  const [model, view] = await Promise.all([
    source("lib/continuity-locks.ts"),
    source("app/continuity-locks-panel.tsx"),
  ]);
  assert.match(model, /Override conflicts with inherited/);
  assert.match(model, /continuityWarnings/);
  assert.match(view, /Review before generation/);
  assert.match(view, /role="alert"/);
  assert.match(view, /Scoped override/);
});

test("issue #392 injects effective locks and warnings into visual story context", async () => {
  const context = await source("lib/visual-context.ts");
  assert.match(context, /effectiveContinuityLocks/);
  assert.match(context, /continuityWarnings/);
  assert.match(context, /continuityLocks: EffectiveContinuityLock\[\]/);
  assert.match(context, /continuityWarnings: string\[\]/);
  assert.match(context, /const continuityLocks = effectiveContinuityLocks/);
  assert.match(context, /continuityLocks,/);
});

test("issue #392 does not mutate prior approved assets when locks change", async () => {
  const model = await source("lib/continuity-locks.ts");
  assert.match(model, /setContinuityLockActive/);
  assert.match(model, /locks: store\.locks\.map/);
  assert.doesNotMatch(model, /project\.assets\s*=|assets:\s*\[|approvedVisualCanon\s*=/);
});

test("issue #392 remains registered after Visual Canon Binder", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 392/);
  assert.match(registry, /"id": "continuity-locks"/);
  assert.match(registry, /"dependsOn": \["visual-canon-binder"\]/);
});
