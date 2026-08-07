import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #384 adds a normalized Concept Canvas to the project model", async () => {
  const project = await source("lib/project.ts");
  for (const field of [
    "conceptCanvas",
    "conceptText",
    "emotionalPurpose",
    "audienceExperience",
    "desiredVisualImpact",
    "mustKeepConstraints",
    "openExploration",
    "targetKind",
    "targetId",
    "targetLabel",
    "updatedAt",
  ]) assert.ok(project.includes(field), `Missing Concept Canvas model field: ${field}`);

  assert.match(project, /targetKind: "project"/);
  assert.match(project, /targetLabel: "Whole project"/);
  assert.match(project, /function normalizeConceptCanvas/);
  assert.match(project, /conceptCanvasTargetKinds/);
  assert.match(project, /conceptCanvas: normalizeConceptCanvas\(development\.conceptCanvas, defaults\.conceptCanvas\)/);
});

test("issue #384 exposes Concept Canvas as a Plan foundation section", async () => {
  const page = await source("app/page.tsx");
  for (const phrase of [
    'id: "concept"',
    'code: "CC"',
    'label: "Concept Canvas"',
    "Start with the creative seed.",
    "Concept seed",
    "Emotional purpose",
    "Audience experience",
    "Desired visual impact",
    "Must-keep constraints",
    "Open exploration",
  ]) assert.ok(page.includes(phrase), `Missing Concept Canvas UI phrase: ${phrase}`);
});

test("issue #384 attaches concepts to story targets without provider fields", async () => {
  const page = await source("app/page.tsx");
  for (const target of [
    '"project"',
    '"character"',
    '"location"',
    '"block"',
    '"mini-block"',
    '"scene"',
  ]) assert.ok(page.includes(target), `Missing Concept Canvas target kind: ${target}`);

  assert.match(page, /Provider, model, workflow and billing settings stay out of the canvas/);
  assert.match(page, /Start exploration/);
  assert.doesNotMatch(page, /conceptCanvas[\s\S]{0,1600}api\/local-ai|conceptCanvas[\s\S]{0,1600}providerId|conceptCanvas[\s\S]{0,1600}modelId/);
});

test("issue #384 is registered as the next focused AI-native slice", async () => {
  const [registry, packageJson] = await Promise.all([
    source("config/ai-native-visual-writing-programme.json"),
    source("package.json"),
  ]);
  assert.match(registry, /"issue": 384/);
  assert.match(registry, /"id": "concept-canvas"/);
  assert.match(packageJson, /issue-384-concept-canvas\.test\.mjs/);
});
