import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #390 builds traceable remix recipes from multiple candidates", async () => {
  const model = await source("lib/creative-remix.ts");
  for (const phrase of [
    "CreativeRemixRecipe",
    "RemixQuality",
    "sourceCandidateId",
    "quality",
    "note",
    "sourceCandidateIds",
    "derivedFromCandidateIds",
  ]) assert.ok(model.includes(phrase), `Missing remix traceability: ${phrase}`);
});

test("issue #390 provides a safe flattened direction for providers without structured remix support", async () => {
  const model = await source("lib/creative-remix.ts");
  assert.match(model, /buildFlattenedRemixDirection/);
  assert.match(model, /flattenedDirection/);
  assert.match(model, /Overall direction:/);
  assert.doesNotMatch(model, /providerId|modelId|endpointUrl|workflowId|apiKey|secret/i);
});

test("issue #390 keeps combined output in the ordinary candidate lineage", async () => {
  const model = await source("lib/creative-remix.ts");
  assert.match(model, /createRemixCandidateLineage/);
  assert.match(model, /parentCandidateId: request\.sourceCandidateId/);
  assert.match(model, /derivedFromCandidateIds: \[\.\.\.request\.remix\.sourceCandidateIds\]/);
  assert.doesNotMatch(model, /canonStatus:\s*"approved"|approveCanon|setCanon/i);
});

test("issue #390 exposes writer-facing Combine and Remix controls", async () => {
  const controls = await source("app/creative-remix-controls.tsx");
  for (const phrase of [
    "Combine and Remix",
    "Add quality",
    "Source candidate",
    "Quality to reuse",
    "Overall direction",
    "Create combined candidate",
    "face",
    "composition",
    "mood",
  ]) assert.ok(controls.includes(phrase), `Missing remix control: ${phrase}`);
  assert.match(controls, /result stays a candidate until you explicitly approve it later/);
});

test("issue #390 remains downstream of creative direction and candidate comparison", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 390/);
  assert.match(registry, /"id": "combine-remix"/);
  assert.match(registry, /"dependsOn": \["creative-direction-controls", "candidate-comparison"\]/);
});
