import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #388 captures Keep Change and Try as directing language", async () => {
  const model = await source("lib/creative-direction.ts");
  for (const phrase of [
    "KeepChangeTryDirection",
    "keep: string",
    "change: string",
    "try: string",
    "buildProviderNeutralCreativeRequest",
    "sourceCandidateId: sourceCandidate.id",
  ]) assert.ok(model.includes(phrase), `Missing direction contract: ${phrase}`);
});

test("issue #388 carries kept qualities and specific creative dimensions into the next request", async () => {
  const model = await source("lib/creative-direction.ts");
  for (const dimension of ["subject", "composition", "mood", "action", "colour", "camera", "continuity"]) {
    assert.ok(model.includes(`\"${dimension}\"`), `Missing direction dimension: ${dimension}`);
  }
  assert.match(model, /keep: lines\(direction\.keep\)/);
  assert.match(model, /change: lines\(direction\.change\)/);
  assert.match(model, /try: lines\(direction\.try\)/);
  assert.match(model, /dimensions: \{ \.\.\.direction\.notes \}/);
});

test("issue #388 keeps advanced prompt optional and hidden by default", async () => {
  const [model, controls] = await Promise.all([
    source("lib/creative-direction.ts"),
    source("app/creative-direction-controls.tsx"),
  ]);
  assert.match(model, /visibleByDefault: false/);
  assert.match(controls, /Advanced prompt/);
  assert.match(controls, /showAdvanced/);
  assert.match(controls, /Normal directing does not require model, endpoint or workflow knowledge/);
});

test("issue #388 exposes writer-facing Keep Change Try controls without provider configuration", async () => {
  const controls = await source("app/creative-direction-controls.tsx");
  for (const label of [">Keep<", ">Change<", ">Try<", "Direct specific qualities", "Create next candidate"]) {
    assert.ok(controls.includes(label), `Missing writer-facing control: ${label}`);
  }
  assert.doesNotMatch(controls, /providerId|modelId|endpointUrl|workflowId|apiKey|secret/i);
});

test("issue #388 remains downstream of candidate history and story context", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 388/);
  assert.match(registry, /"id": "creative-direction-controls"/);
  assert.match(registry, /"dependsOn": \["story-context-assembler", "exploration-candidates"\]/);
});
