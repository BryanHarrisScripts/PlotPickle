import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #399 connects concepts references candidates canon locks and story changes", async () => {
  const model = await source("lib/creative-memory.ts");
  for (const kind of ["concept", "reference", "candidate", "canon", "continuity", "story-change"]) assert.ok(model.includes(`\"${kind}\"`));
  assert.match(model, /readCreativeCandidateStore/);
  assert.match(model, /readVisualCanonBinder/);
  assert.match(model, /readContinuityLockStore/);
  assert.match(model, /readImageToStoryProposalStore/);
});

test("issue #399 derives effective current decisions deterministically", async () => {
  const model = await source("lib/creative-memory.ts");
  assert.match(model, /effectiveCreativeMemory/);
  assert.match(model, /node\.status === "active"/);
  assert.match(model, /nodes\.sort\(\(a, b\) => a\.id\.localeCompare\(b\.id\)\)/);
  assert.match(model, /edges\.sort/);
});

test("issue #399 keeps obsolete decisions inspectable without treating them as active", async () => {
  const [model, view] = await Promise.all([source("lib/creative-memory.ts"), source("app/creative-memory.tsx")]);
  assert.match(model, /historicalCreativeMemory/);
  assert.match(model, /status === "historical"/);
  assert.match(view, /Historical and superseded decisions/);
});

test("issue #399 remains portable through project data and excludes sensitive routing material", async () => {
  const [model, project] = await Promise.all([source("lib/creative-memory.ts"), source("lib/project.ts")]);
  assert.match(project, /extensions\?: Record<string, unknown>/);
  assert.match(model, /creativeMemoryPrivacy/);
  assert.match(model, /credentialsIncluded: false/);
  assert.match(model, /providerConfigurationIncluded: false/);
  assert.match(model, /unrelatedPrivateContentIncluded: false/);
  assert.doesNotMatch(model, /apiKey|password|secret|endpointUrl/i);
});

test("issue #399 exposes target-relevant effective memory to later creative work", async () => {
  const view = await source("app/creative-memory.tsx");
  for (const phrase of ["Creative Memory", "Effective decisions", "Sources:", "portable project data", "provider configuration"]) assert.ok(view.includes(phrase));
});

test("issue #399 remains downstream of canon and image-to-story proposals", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 399/);
  assert.match(registry, /"id": "creative-memory"/);
  assert.match(registry, /"dependsOn": \["visual-canon-binder", "image-to-story-proposals"\]/);
});
