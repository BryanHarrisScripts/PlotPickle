import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("schema 1.7 declares every Phase 1 project capability", async () => {
  const schema = JSON.parse(await source("schema/plotpickle-project-v1.7.schema.json"));

  assert.equal(schema.properties.schemaVersion.const, "1.7.0");
  for (const property of ["storyThreads", "rights", "revisions"]) {
    assert.ok(schema.required.includes(property), `Schema 1.7 must require ${property}`);
  }

  assert.equal(schema.$defs.block.properties.scenes.minItems, 1);
  assert.equal(schema.$defs.block.properties.scenes.maxItems, undefined);
  assert.equal(schema.$defs.scene.properties.number.maximum, undefined);

  const elementTypes = schema.$defs.screenplayDraftElement.properties.type.enum;
  for (const elementType of ["section", "synopsis", "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard"]) {
    assert.ok(elementTypes.includes(elementType), `Expanded screenplay type missing: ${elementType}`);
  }

  assert.ok(schema.$defs.character.required.includes("arcMatrix"));
  assert.ok(schema.$defs.rights.required.includes("aiProvenance"));
  assert.ok(schema.$defs.revisionSnapshot.required.includes("contentHash"));
});

test("Phase 1 operations cover migration, dynamic scenes, threads, arcs, provenance and revisions", async () => {
  const operations = await source("lib/project-phase-one.ts");

  for (const exportedOperation of [
    "upgradeProjectToPhaseOne",
    "addSceneToBlock",
    "removeSceneFromBlock",
    "moveSceneInBlock",
    "reorderScenesInBlock",
    "assignMiniBlockToScene",
    "createStoryThread",
    "linkStoryThreadToScene",
    "addThreadMilestone",
    "upsertCharacterArcCheckpoint",
    "addSourceAttribution",
    "addAiProvenance",
    "createRevisionSnapshot",
    "compareRevisionSnapshots",
    "phaseOneCoverage",
  ]) {
    assert.match(operations, new RegExp(`export function ${exportedOperation}\\b`), `Missing operation: ${exportedOperation}`);
  }

  assert.match(operations, /PHASE_ONE_SCHEMA_VERSION = "1\.7\.0"/);
  assert.match(operations, /StoryThreadKind/);
  assert.match(operations, /CharacterArcMatrix/);
  assert.match(operations, /RightsAndProvenance/);
  assert.match(operations, /ExpandedScreenplayDraftElementType/);
  assert.match(operations, /RevisionComparison/);
  assert.match(operations, /locked scene cannot be removed|block\.scenes\[index\]\.locked/);
});

test("Phase 1 documentation explains the migration boundary", async () => {
  const documentation = await source("docs/phase-1-core-schema.md");

  for (const phrase of [
    "Story Threads and subplot tracking",
    "Dynamic scene creation and reordering",
    "Expanded screenplay element types",
    "Character Arc Matrix",
    "Rights, attribution and AI provenance",
    "Revision snapshots and comparison",
    "upgradeProjectToPhaseOne()",
    "Schema 1.7 is the canonical application and export model",
  ]) {
    assert.ok(documentation.includes(phrase), `Phase 1 documentation is missing: ${phrase}`);
  }
});
