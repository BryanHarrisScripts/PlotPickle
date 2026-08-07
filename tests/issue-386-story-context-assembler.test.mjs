import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #386 adds a provider-neutral visual story context package", async () => {
  const context = await source("lib/visual-context.ts");
  for (const phrase of [
    "VisualStoryContextPackage",
    "assembleVisualStoryContext",
    "target: VisualStoryContextTarget",
    "project:",
    "story:",
    "world:",
    "concept:",
    "characters:",
    "locations:",
    "references:",
    "continuity:",
    "sources:",
  ]) assert.ok(context.includes(phrase), `Missing context assembler field: ${phrase}`);

  assert.match(context, /credentialsIncluded: false/);
  assert.match(context, /providerConfigurationIncluded: false/);
  assert.match(context, /privateLocalPathsIncluded: false/);
});

test("issue #386 resolves story targets into block scene and mini-block context", async () => {
  const context = await source("lib/visual-context.ts");
  assert.match(context, /function findBlock/);
  assert.match(context, /function findScene/);
  assert.match(context, /function findMiniBlock/);
  assert.match(context, /contextTarget\.kind === "mini-block"/);
  assert.match(context, /block\.scenes\.some\(\(scene\) => scene\.miniBlocks\.some/);
  assert.match(context, /miniBlock: miniBlock \?/);
});

test("issue #386 keeps reference purpose rights and source labels inspectable", async () => {
  const context = await source("lib/visual-context.ts");
  for (const phrase of [
    "purpose: VisualReference",
    "rightsStatus: VisualReference",
    "permittedUse",
    "attribution",
    "sourceLabel",
    "referenceApplies",
    "targetPrecedence",
  ]) assert.ok(context.includes(phrase), `Missing reference context behavior: ${phrase}`);

  assert.doesNotMatch(context, /apiKey|secret|password|providerId|modelId|endpoint/i);
});

test("issue #386 surfaces context preview and registers focused tests", async () => {
  const [page, packageJson, registry] = await Promise.all([
    source("app/page.tsx"),
    source("package.json"),
    source("config/ai-native-visual-writing-programme.json"),
  ]);
  assert.match(page, /assembleVisualStoryContext/);
  assert.match(page, /Context package/);
  assert.match(page, /Provider-neutral context includes story, world, target, references, continuity and source labels/);
  assert.match(page, /Credentials, provider configuration and private local paths are excluded/);
  assert.match(packageJson, /issue-386-story-context-assembler\.test\.mjs/);
  assert.match(packageJson, /test:story-context-assembler/);
  assert.match(registry, /"issue": 386/);
  assert.match(registry, /"id": "story-context-assembler"/);
});
