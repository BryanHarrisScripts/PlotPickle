import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #394 begins from location and world context", async () => {
  const model = await source("lib/world-look-development.ts");
  assert.match(model, /buildWorldLookBrief/);
  assert.match(model, /project\.world\.locations\.find/);
  assert.match(model, /assembleVisualStoryContext\(project, \{ kind: "location"/);
  for (const field of ["period", "cultures", "technology", "rules", "history", "visualLanguage"]) assert.ok(model.includes(field));
});

test("issue #394 covers required environmental visual dimensions", async () => {
  const model = await source("lib/world-look-development.ts");
  for (const dimension of ["period", "architecture", "geography", "culture", "technology", "weather", "light", "palette"]) {
    assert.ok(model.includes(`\"${dimension}\"`), `Missing world look dimension: ${dimension}`);
  }
});

test("issue #394 attaches references and approved canon to location context", async () => {
  const model = await source("lib/world-look-development.ts");
  assert.match(model, /locationReferences/);
  assert.match(model, /reference\.targetKind === "location"/);
  assert.match(model, /approvedVisualCanon/);
  assert.match(model, /locationCanon/);
  assert.match(model, /reusableLocationVisualLanguage/);
});

test("issue #394 keeps visual discoveries as proposals instead of rewriting world text", async () => {
  const model = await source("lib/world-look-development.ts");
  assert.match(model, /worldVisualProposal/);
  assert.match(model, /proposalOnly: true/);
  assert.match(model, /worldTextMutated: false/);
  assert.doesNotMatch(model, /project\.world\.[a-zA-Z]+\s*=/);
});

test("issue #394 supports local cloud and no-AI world look use", async () => {
  const [model, view] = await Promise.all([
    source("lib/world-look-development.ts"),
    source("app/world-look-development.tsx"),
  ]);
  assert.match(model, /manualReferenceOnlyReady: true/);
  assert.match(view, /manual references remain a complete path/i);
  assert.match(view, /local, cloud and no-AI paths/);
  assert.match(view, /later scene generation, Storyboard and Graphic Novel/);
  assert.doesNotMatch(model, /providerId|modelId|endpointUrl|workflowId|apiKey|secret/i);
});

test("issue #394 remains downstream of direction canon and continuity", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 394/);
  assert.match(registry, /"id": "world-look-development"/);
  assert.match(registry, /"dependsOn": \["creative-direction-controls", "visual-canon-binder", "continuity-locks"\]/);
});
