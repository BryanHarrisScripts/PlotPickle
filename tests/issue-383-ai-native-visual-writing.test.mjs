import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const expectedLoop = ["concept", "explore", "compare", "direct", "refine", "approve", "reuse"];
const expectedActions = ["Keep", "Change", "Try", "Compare", "Combine", "Approve"];

test("issue #383 defines the AI-native visual writing product contract", async () => {
  const contract = await source("lib/product-direction.ts");
  for (const phrase of [
    "AI-native visual writing and creative direction studio",
    "AI_NATIVE_VISUAL_WRITING",
    "CREATIVE_DIRECTION_LOOP",
    "CREATIVE_DIRECTION_ACTIONS",
    "VISUAL_CANON_CATEGORIES",
    "The writer supplies concepts, references, intention and constraints",
    "Generated and imported possibilities remain candidates",
    "provider, model, endpoint, workflow and billing configuration remain in Settings",
  ]) assert.ok(contract.includes(phrase), `Missing product contract phrase: ${phrase}`);

  for (const stage of expectedLoop) assert.match(contract, new RegExp(`id: "${stage}"`));
  for (const action of expectedActions) assert.match(contract, new RegExp(`"${action}"`));
});

test("issue #383 registers twenty ordered and dependency-safe implementation briefs", async () => {
  const registry = JSON.parse(await source("config/ai-native-visual-writing-programme.json"));
  assert.equal(registry.programmeIssue, 382);
  assert.equal(registry.foundationIssue, 383);
  assert.equal(registry.productCategory, "AI-native visual writing and creative direction studio");
  assert.deepEqual(registry.canonicalLoop, expectedLoop);
  assert.equal(registry.briefs.length, 20);
  assert.deepEqual(registry.briefs.map((brief) => brief.sequence), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.deepEqual(registry.briefs.map((brief) => brief.issue), Array.from({ length: 20 }, (_, index) => index + 383));

  const ids = new Set(registry.briefs.map((brief) => brief.id));
  assert.equal(ids.size, registry.briefs.length);
  const sequenceById = new Map(registry.briefs.map((brief) => [brief.id, brief.sequence]));
  for (const brief of registry.briefs) {
    assert.ok(brief.title && brief.wave, `Brief ${brief.id} is incomplete`);
    for (const dependency of brief.dependsOn) {
      assert.ok(sequenceById.has(dependency), `Brief ${brief.id} has unknown dependency ${dependency}`);
      assert.ok(sequenceById.get(dependency) < brief.sequence, `Brief ${brief.id} depends on a later brief`);
    }
  }
});

test("issue #383 keeps human authority, manual work and consent explicit", async () => {
  const [documentation, registry, readme] = await Promise.all([
    source("docs/AI-NATIVE-VISUAL-WRITING.md"),
    source("config/ai-native-visual-writing-programme.json"),
    source("README.md"),
  ]);
  const combined = `${documentation}\n${registry}\n${readme}`;
  for (const phrase of [
    "Concept -> Explore -> Compare -> Direct -> Refine -> Approve -> Reuse",
    "No generated result becomes canon automatically",
    "No visual analysis changes story text automatically",
    "Paid work requires action-specific confirmation",
    "Manual import and no-AI workflows remain complete product paths",
    "writer remains the author, visual director and final authority",
  ]) assert.ok(combined.includes(phrase), `Missing authority boundary: ${phrase}`);
});

test("issue #383 updates active positioning without erasing the completed core", async () => {
  const [layout, splash, about, welcome, readme] = await Promise.all([
    source("app/layout.tsx"),
    source("app/marketing-splash-base.tsx"),
    source("app/about/page.tsx"),
    source("app/welcome/page.tsx"),
    source("README.md"),
  ]);
  const activeCopy = `${layout}\n${splash}\n${about}\n${welcome}\n${readme}`;
  assert.match(activeCopy, /AI-native visual writing/i);
  assert.match(activeCopy, /writer remains the author|writer control|final authority/i);
  for (const existingCapability of ["24 Blocks", "PPF", "Storyboard", "Graphic Novel"]) {
    assert.ok(activeCopy.includes(existingCapability), `Missing connected capability: ${existingCapability}`);
  }
});

test("issue #383 regression is registered with a focused command", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-383-ai-native-visual-writing\.test\.mjs/);
  assert.equal(
    packageJson.scripts["test:ai-native-visual-writing"],
    "node --test tests/issue-383-ai-native-visual-writing.test.mjs",
  );
});
