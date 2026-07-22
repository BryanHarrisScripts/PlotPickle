import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("schema 1.7 is the canonical released schema", async () => {
  const canonical = JSON.parse(await source("schema/plotpickle-project.schema.json"));
  const phase = JSON.parse(await source("schema/plotpickle-project-v1.7.schema.json"));
  assert.equal(canonical.properties.schemaVersion.const, "1.7.0");
  assert.deepEqual(canonical, phase);
});

test("blank, imported and Afterglow projects use the Phase A model", async () => {
  const project = await source("lib/project.ts");
  const afterglow = await source("data/afterglow.ts");
  assert.match(project, /schemaVersion: "1\.7\.0"/);
  assert.match(project, /"1\.6\.0", "1\.7\.0"/);
  assert.match(project, /storyThreads: \[\]/);
  assert.match(project, /rights: createBlankRightsAndProvenance/);
  assert.match(project, /revisions: \[\]/);
  assert.match(afterglow, /createBlankArcMatrix\(character\)/);
});

test("all Phase A interfaces are connected", async () => {
  const studio = await source("app/core-model-studio.tsx");
  const page = await source("app/page.tsx");
  const writer = await source("app/script-workspace.tsx");
  const structure = await source("app/structure/page.tsx");
  const settings = await source("app/settings-panel.tsx");
  const reports = await source("app/settings-project-tools.tsx");
  for (const phrase of ["Story Threads", "Arc Matrix", "Rights & Provenance", "Revisions", "Capture revision snapshot", "AI provenance"]) assert.ok(studio.includes(phrase), phrase);
  assert.match(page, /activeSection === "coreModel"/);
  assert.match(writer, /Dual dialogue/);
  assert.match(writer, /Story Threads/);
  assert.match(structure, /Selected scene threads/);
  assert.match(settings, /Core Model/);
  assert.match(reports, /Revision snapshots/);
});

test("expanded screenplay elements export through Fountain and FDX", async () => {
  const project = await source("lib/project.ts");
  const draft = await source("lib/screenplay-draft.ts");
  for (const type of ["section", "synopsis", "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard"]) {
    assert.ok(project.includes(`| "${type}"`), type);
    assert.ok(draft.includes(type), type);
  }
});
