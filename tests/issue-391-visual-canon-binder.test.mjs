import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #391 defines portable visual canon categories and statuses", async () => {
  const model = await source("lib/visual-canon.ts");
  for (const phrase of [
    '"character-identity"',
    '"location"',
    '"prop"',
    '"wardrobe"',
    '"palette"',
    '"style"',
    '"composition"',
    '"proposed" | "approved" | "superseded" | "rejected"',
    'const EXTENSION_KEY = "visualCanon"',
  ]) assert.ok(model.includes(phrase), `Missing visual canon contract: ${phrase}`);
});

test("issue #391 requires explicit human approval before an item is canon", async () => {
  const model = await source("lib/visual-canon.ts");
  assert.match(model, /proposeVisualCanonItem/);
  assert.match(model, /status: "proposed"/);
  assert.match(model, /approveVisualCanonItem/);
  assert.match(model, /status: "approved" as const/);
  assert.match(model, /approvedVisualCanon/);
  assert.match(model, /item\.status === "approved"/);
});

test("issue #391 preserves superseded history and decision records", async () => {
  const model = await source("lib/visual-canon.ts");
  assert.match(model, /supersedeVisualCanonItem/);
  assert.match(model, /supersededByItemId: replacementItemId/);
  assert.match(model, /supersedesItemId: priorItemId/);
  assert.match(model, /decisions: \[\.\.\.item\.decisions, decision\("supersede"/);
  assert.match(model, /decidedBy/);
  assert.match(model, /createdAt/);
});

test("issue #391 exposes a writer-readable binder with explicit approval controls", async () => {
  const view = await source("app/visual-canon-binder.tsx");
  for (const phrase of [
    "Visual Canon Binder",
    "Approve the visual facts that define this storyworld",
    "Approve as canon",
    "Reject",
    "Decision history",
    "Proposed",
    "Approved",
    "Superseded",
    "Rejected",
  ]) assert.ok(view.includes(phrase), `Missing binder UI: ${phrase}`);
  assert.doesNotMatch(view, /providerId|modelId|endpointUrl|workflowId|apiKey|secret/i);
});

test("issue #391 remains portable and AI-independent", async () => {
  const [model, project, registry] = await Promise.all([
    source("lib/visual-canon.ts"),
    source("lib/project.ts"),
    source("config/ai-native-visual-writing-programme.json"),
  ]);
  assert.match(project, /extensions\?: Record<string, unknown>/);
  assert.match(model, /project\.extensions/);
  assert.match(registry, /"issue": 391/);
  assert.match(registry, /"id": "visual-canon-binder"/);
  assert.doesNotMatch(model, /openai|ollama|comfyui|minimax|h3/i);
});
