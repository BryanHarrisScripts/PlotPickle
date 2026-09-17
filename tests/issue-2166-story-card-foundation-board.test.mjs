import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function runtime(path) {
  const source = await read(path);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runtimeModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: runtimeModule,
    exports: runtimeModule.exports,
    require: () => ({}),
  });
  return { source, exports: runtimeModule.exports };
}

test("#2166 keeps one deterministic 24/96 address topology with empty planning notes", async () => {
  const structure = await runtime("core/project/story-structure-v2.ts");
  const project = structure.exports.createEmptyStoryStructureV2();

  assert.equal(project.blocks.length, 24);
  assert.equal(project.blocks.flatMap((block) => block.miniBlocks).length, 96);
  assert.equal(project.blocks[0].id, "block-01");
  assert.equal(project.blocks[23].id, "block-24");
  assert.equal(project.blocks[0].note, "");
  assert.equal(project.blocks[0].planningLockedAt, null);
  assert.ok(project.blocks.every((block) => block.miniBlocks.every((mini) => mini.note === "")));
  assert.match(structure.source, /readonly note: string;/u);
  assert.match(structure.source, /readonly planningLockedAt: string \| null;/u);
});

test("#2166 reorders planning content while structural Block and Mini-Block identities stay fixed", async () => {
  const structureRuntime = await runtime("core/project/story-structure-v2.ts");
  const boardRuntime = await runtime("modules/plan/story-card-board.ts");
  const board = boardRuntime.exports;
  let structure = structureRuntime.exports.createEmptyStoryStructureV2();

  structure = board.updateStoryCard(structure, 1, { title: "Opening disturbance", note: "The ordinary pattern breaks." });
  structure = board.updateStoryCardMini(structure, 1, 1, { title: "First signal", note: "Audience notices the mismatch." });
  structure = board.updateStoryCard(structure, 2, { title: "Immediate response", note: "The protagonist tests the easy answer." });

  const addressSnapshot = structure.blocks.map((block) => ({
    id: block.id,
    number: block.number,
    actNumber: block.actNumber,
    sequenceNumber: block.sequenceNumber,
    minis: block.miniBlocks.map((mini) => ({
      id: mini.id,
      number: mini.number,
      blockNumber: mini.blockNumber,
      ordinal: mini.ordinal,
    })),
  }));
  const stageSnapshot = structure.blocks.map((block) => block.miniBlocks.map((mini) => JSON.stringify(mini.stages)));

  const moved = board.moveStoryCardContent(structure, 1, 2);

  assert.notStrictEqual(moved, structure);
  assert.equal(moved.blocks[0].title, "Immediate response");
  assert.equal(moved.blocks[1].title, "Opening disturbance");
  assert.equal(moved.blocks[1].note, "The ordinary pattern breaks.");
  assert.equal(moved.blocks[1].miniBlocks[0].title, "First signal");
  assert.equal(moved.blocks[1].miniBlocks[0].note, "Audience notices the mismatch.");
  assert.deepEqual(JSON.parse(JSON.stringify(moved.blocks.map((block) => ({
    id: block.id,
    number: block.number,
    actNumber: block.actNumber,
    sequenceNumber: block.sequenceNumber,
    minis: block.miniBlocks.map((mini) => ({
      id: mini.id,
      number: mini.number,
      blockNumber: mini.blockNumber,
      ordinal: mini.ordinal,
    })),
  })))), addressSnapshot);
  assert.deepEqual(
    moved.blocks.map((block) => block.miniBlocks.map((mini) => JSON.stringify(mini.stages))),
    stageSnapshot,
  );
});

test("#2166 locks planning explicitly and blocks edits or moves until Human unlock", async () => {
  const structureRuntime = await runtime("core/project/story-structure-v2.ts");
  const boardRuntime = await runtime("modules/plan/story-card-board.ts");
  const board = boardRuntime.exports;
  let structure = structureRuntime.exports.createEmptyStoryStructureV2();
  structure = board.updateStoryCard(structure, 2, { title: "Accepted arrangement" });

  const locked = board.setStoryCardPlanningLock(structure, 2, true, "2026-09-17T22:00:00.000Z");
  assert.equal(locked.blocks[1].planningLockedAt, "2026-09-17T22:00:00.000Z");
  assert.strictEqual(board.updateStoryCard(locked, 2, { title: "Silent overwrite" }), locked);
  assert.strictEqual(board.updateStoryCardMini(locked, 2, 1, { note: "Silent overwrite" }), locked);
  assert.strictEqual(board.moveStoryCardContent(locked, 2, 3), locked);

  const unlocked = board.setStoryCardPlanningLock(locked, 2, false, "2026-09-17T22:05:00.000Z");
  assert.equal(unlocked.blocks[1].planningLockedAt, null);
  assert.notStrictEqual(board.updateStoryCard(unlocked, 2, { title: "Human-authorized revision" }), unlocked);
  assert.deepEqual([...board.storyCardAffectedRefs([17, 2, 17])], [
    "ppf:structure:block-2",
    "ppf:structure:block-17",
  ]);
});

test("#2166 mounts one Post-it-style board in Outline with pointer and keyboard movement", async () => {
  const [surface, board, css] = await Promise.all([
    read("app/skin-v1/matrix-story-map-surface.tsx"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);

  assert.match(surface, /<StoryCardFoundationBoard project=\{project\} onProjectChange=\{setProject\} \/>/u);
  assert.ok(
    surface.indexOf("<StoryCardFoundationBoard") < surface.indexOf("<ProgressiveStoryMap"),
    "Story Cards should be the earliest writer-facing planning projection in Outline",
  );
  assert.match(board, /data-story-card-foundation-board="24x96"/u);
  assert.match(board, /draggable=\{!locked\}/u);
  assert.match(board, /application\/x-plotpickle-story-card/u);
  assert.match(board, /Alt\+Left \/ Alt\+Right/u);
  assert.match(board, /event\.altKey/u);
  assert.match(board, /Move earlier/u);
  assert.match(board, /Move later/u);
  assert.match(board, /Unlock to revise/u);
  assert.match(board, /markImportedScreenplayProjectionStale/u);
  assert.match(board, /storyCardAffectedRefs\(staleBlockNumbers\)/u);
  assert.match(css, /grid-template-columns: repeat\(6, minmax\(210px, 1fr\)\)/u);
  assert.match(css, /pp-skin-v1-story-card-act-stack/u);
});

test("#2166 projects observed rich/Afterglow Block identities into the same cards without manufacturing completion", async () => {
  const [importer, reference, board] = await Promise.all([
    read("modules/library/import/rich-ppf-to-library-project.ts"),
    read("modules/library/reference/afterglow-v9-foundations.ts"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
  ]);

  assert.match(importer, /function importedStoryStructure\(project: PlotPickleProject\): StoryStructureV2/u);
  assert.match(importer, /title: sourceBlock\.title\?\.trim\(\) \|\| slot\.title/u);
  assert.match(importer, /note: \(sourceBlock\.purpose \|\| sourceBlock\.summary \|\| ""\)/u);
  assert.match(importer, /title: sourceMini\.label\?\.trim\(\) \|\| mini\.title/u);
  assert.match(importer, /structure: importedStoryStructure\(project\)/u);
  assert.match(reference, /createRichAfterglowProject/u);
  assert.doesNotMatch(importer, /stages:\s*\{\s*plan:/u);
  assert.doesNotMatch(board, /\/api\/|generate\/image|createScene|createBeat|createShot|createFrame/u);
  assert.match(board, /Empty cards stay empty/u);
});
