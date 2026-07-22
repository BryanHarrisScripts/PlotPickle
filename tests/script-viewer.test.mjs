import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("full screenplay remains part of the canonical local project", async () => {
  const project = await source("lib/project.ts");
  const schema = JSON.parse(await source("schema/plotpickle-project.schema.json"));
  assert.match(project, /type ScreenplayDocument/);
  assert.match(project, /screenplay: ScreenplayDocument/);
  assert.match(project, /sourceText: string/);
  assert.match(project, /createBlankScreenplay/);
  assert.match(project, /normalizeScreenplay/);
  assert.ok(schema.required.includes("screenplay"));
  assert.equal(schema.properties.screenplay.$ref, "#/$defs/screenplay");
  for (const field of ["analysisStatus", "analyzedAt", "suggestedFields", "draftElements"]) {
    assert.ok(schema.$defs.screenplay.required.includes(field), `Screenplay schema is missing ${field}`);
  }
});

test("viewer reads common screenplay formats and colour-codes screenplay grammar", async () => {
  const parser = await source("lib/screenplay.ts");
  const viewer = await source("app/script-viewer.tsx");
  for (const format of ["plain-text", "fountain", "final-draft"]) assert.match(parser, new RegExp(format));
  for (const element of ["scene-heading", "action", "character", "parenthetical", "dialogue", "transition"]) assert.match(parser, new RegExp(element));
  assert.match(viewer, /Full Script Viewer/);
  assert.match(viewer, /Guided reading/);
  assert.match(viewer, /Scene navigator/);
  assert.match(viewer, /estimated from script position/i);
});

test("guided reading connects passages to existing story knowledge", async () => {
  const viewer = await source("app/script-viewer.tsx");
  for (const field of ["block.purpose", "block.goal", "block.conflict", "block.choice", "block.consequence", "block.audienceExpectation", "block.pickleTurn", "development.ghost"]) {
    assert.ok(viewer.includes(field), `Guided viewer is missing ${field}`);
  }
  assert.match(viewer, /Open the full Block/);
});

test("top Import and Script Viewer use one screenplay ingestion pipeline", async () => {
  const page = await source("app/page.tsx");
  const viewer = await source("app/script-viewer.tsx");
  const importer = await source("lib/screenplay-import.ts");

  assert.match(page, /createProjectFromScreenplay/);
  assert.match(page, /replaceWithImportedScreenplay/);
  assert.match(page, /onImport={replaceWithImportedScreenplay}/);
  assert.match(page, /\.txt,\.fountain,\.spmd,\.fdx/);
  assert.match(viewer, /onImport\(next\)/);
  assert.match(importer, /export function createProjectFromScreenplay/);
  assert.match(importer, /createBlankProject\(\)/);
});

test("screenplay import replaces example data and populates the shared framework as suggestions", async () => {
  const importer = await source("lib/screenplay-import.ts");
  for (const contract of [
    "makeCharacters",
    "makeLocations",
    "populateBlock",
    "analysisStatus: \"suggested\"",
    "suggestedFields",
    "storyboardDirection",
    "development.ghost",
    "development.catalyst",
    "development.foundations",
    "development.pickle",
    "structure:",
    "markScreenplayAnalysisReviewed",
  ]) {
    assert.ok(importer.includes(contract), `Unified screenplay import is missing ${contract}`);
  }
});
