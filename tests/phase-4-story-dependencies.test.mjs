import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engine = await readFile(new URL("../lib/story-dependencies.ts", import.meta.url), "utf8");
const folder = await readFile(new URL("../lib/project-folder.ts", import.meta.url), "utf8");
const modules = await readFile(new URL("../lib/project-modules.ts", import.meta.url), "utf8");

test("Phase 4 builds a typed story knowledge graph", () => {
  assert.match(engine, /StoryNodeKind/);
  assert.match(engine, /buildStoryDependencies/);
  assert.match(engine, /reverseIndex/);
  assert.match(engine, /impactForNode/);
  assert.match(engine, /appears-in/);
  assert.match(engine, /written-as/);
  assert.match(engine, /covered-by/);
});

test("Phase 4 detects broken references and unresolved threads", () => {
  assert.match(engine, /broken-reference/);
  assert.match(engine, /unresolved-thread/);
  assert.match(engine, /missing-character/);
  assert.match(engine, /missing-location/);
});

test("Phase 4 produces deterministic story health checks", () => {
  for (const check of ["catalyst", "ghost", "empty-blocks", "unused-characters", "orphan-frames"]) {
    assert.match(engine, new RegExp(`id: "${check}"`));
  }
  assert.match(engine, /score = Math\.max/);
});

test("dependency artifacts are written into the modular project", () => {
  for (const file of ["dependencies/graph.json", "dependencies/references.json", "dependencies/reverse-index.json", "dependencies/conflicts.json", "dependencies/health.json", "reports/story-health.json"]) {
    assert.match(folder, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(folder, /PROJECT_FOLDER_VERSION = "2\.2\.0"/);
  assert.match(modules, /plotpickle\.story-dependencies/);
});

test("Phase 2 and Phase 3 project folders remain readable", () => {
  assert.match(folder, /"2\.0\.0", "2\.1\.0", PROJECT_FOLDER_VERSION/);
});
