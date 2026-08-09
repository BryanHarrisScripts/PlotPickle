import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #534 makes the complete library the default Learn experience", async () => {
  const [page, studio] = await Promise.all([source("app/page.tsx"), source("app/learning-studio.tsx")]);
  assert.match(page, /useState<LearnSection>\("library"\)/);
  assert.match(studio, /useState<ViewMode>\("library"\)/);
  assert.match(studio, /All \{courseModules\.length\} full learning modules/);
  assert.match(studio, /Choose Your Workflow/);
  assert.match(studio, /Start with the PlotPickle Core Curriculum: guided path/);
});

test("issue #534 groups and counts all 81 preserved modules", async () => {
  const studio = await source("app/learning-studio.tsx");
  const groups = [
    ["Screenwriting Foundations", "learningModules"],
    ["Visual Writing & PlotPickle", "visualWritingModules"],
    ["The 24 Blocks Method", "twentyFourBlocksLessons"],
    ["AI-Assisted Revision", "aiRevisionLessons"],
    ["Characters in Motion", "characterMotionLessons"],
    ["Dialogue in Motion", "dialogueLessons"],
    ["Story Craft Essentials", "storyCraftLessons"],
    ["Working Together", "workingTogetherLessons"],
    ["Collaboration, Formats & Ownership", "collaborationOwnershipLessons"],
  ];
  for (const [title, modules] of groups) {
    assert.ok(studio.includes(`title: "${title}"`), `Missing collection title: ${title}`);
    assert.ok(studio.includes(`modules: ${modules}`), `Missing collection source: ${modules}`);
  }
  assert.match(studio, /Complete Learning Library: \$\{courseModules\.length\} modules/);
  assert.match(studio, /aria-expanded=\{expanded\}/);
  assert.match(studio, /Expand all collections/);
  assert.match(studio, /Collapse all collections/);
});

test("issue #534 routes legacy Read & Learn links to the grouped library", async () => {
  const [router, workspaceRouter, studio, core] = await Promise.all([source("app/learn-entry-router.tsx"), source("app/collaboration-workspace-router.tsx"), source("app/learning-studio.tsx"), source("app/core-curriculum/page.tsx")]);
  assert.match(router, /destination\.searchParams\.set\("workspace", "learn"\)/);
  assert.match(router, /destination\.searchParams\.set\("view", "library"\)/);
  assert.match(router, /destination\.searchParams\.set\("collection", legacyView\)/);
  assert.match(router, /key === "lesson"/);
  assert.match(studio, /params\.get\("module"\) \?\? params\.get\("lesson"\)/);
  assert.match(studio, /params\.get\("collection"\)/);
  assert.ok((core.match(/href="\/\?workspace=learn&view=library"/g) ?? []).length >= 3, "Core Curriculum must return visibly to the grouped library.");
  assert.match(workspaceRouter, /url\.pathname === "\/" && url\.searchParams\.has\("workspace"\)/);
});

test("issue #534 UAT discovers Learn through visible controls without direct lesson or Core URLs", async () => {
  const uat = await source("scripts/run-creative-writer-uat.mjs");
  assert.match(uat, /Collapse all collections/);
  assert.match(uat, /Expand all collections/);
  assert.match(uat, /fillByLabel\("Search screenwriting lessons", "The Pitch"\)/);
  assert.match(uat, /clickVisible\("Choose Your Workflow"\)/);
  assert.match(uat, /clickVisible\("Core Curriculum"\)/);
  assert.doesNotMatch(uat, /workspace=learn&view=workflow/);
  assert.doesNotMatch(uat, /workspace=learn&view=library&module=pitch/);
  assert.doesNotMatch(uat, /new URL\("\/core-curriculum"/);
});
