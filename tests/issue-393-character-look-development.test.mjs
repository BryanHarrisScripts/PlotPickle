import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #393 begins from character story data and attached references", async () => {
  const model = await source("lib/character-look-development.ts");
  assert.match(model, /buildCharacterLookBrief/);
  assert.match(model, /project\.characters\.find/);
  assert.match(model, /characterReferences/);
  assert.match(model, /assembleVisualStoryContext\(project, \{ kind: "character"/);
  for (const field of ["description", "want", "need", "arc", "voice"]) assert.ok(model.includes(field));
});

test("issue #393 covers the required character look dimensions", async () => {
  const model = await source("lib/character-look-development.ts");
  for (const dimension of ["face", "silhouette", "age", "wardrobe", "expression", "movement", "relationship-presentation"]) {
    assert.ok(model.includes(`\"${dimension}\"`), `Missing character look dimension: ${dimension}`);
  }
});

test("issue #393 reuses approved identity and continuity without requiring generation", async () => {
  const model = await source("lib/character-look-development.ts");
  assert.match(model, /approvedVisualCanon/);
  assert.match(model, /item\.kind === "character-identity"/);
  assert.match(model, /effectiveContinuityLocks/);
  assert.match(model, /reusableCharacterIdentity/);
  assert.match(model, /manualReferenceOnlyReady: true/);
  assert.doesNotMatch(model, /providerId|modelId|endpointUrl|workflowId|apiKey|secret/i);
});

test("issue #393 exposes a story-first manual-or-AI character look workspace", async () => {
  const view = await source("app/character-look-development.tsx");
  for (const phrase of [
    "Character Look Development",
    "Story foundation",
    "Approved identity",
    "Develop the look",
    "References",
    "Reusable continuity",
    "Explore looks",
    "manual references",
    "Storyboard and Graphic Novel",
  ]) assert.ok(view.includes(phrase), `Missing workspace behavior: ${phrase}`);
});

test("issue #393 remains downstream of direction canon and continuity", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 393/);
  assert.match(registry, /"id": "character-look-development"/);
  assert.match(registry, /"dependsOn": \["creative-direction-controls", "visual-canon-binder", "continuity-locks"\]/);
});
