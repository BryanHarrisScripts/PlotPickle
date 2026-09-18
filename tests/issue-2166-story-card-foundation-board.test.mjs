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

  const addressSnapshot = JSON.stringify(structure.blocks.map((block) => ({
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
  })));
  const stageSnapshot = JSON.stringify(structure.blocks.map((block) => block.miniBlocks.map((mini) => mini.stages)));

  const moved = board.moveStoryCardContent(structure, 1, 2);

  assert.notStrictEqual(moved, structure);
  assert.equal(moved.blocks[0].title, "Immediate response");
  assert.equal(moved.blocks[1].title, "Opening disturbance");
  assert.equal(moved.blocks[1].note, "The ordinary pattern breaks.");
  assert.equal(moved.blocks[1].miniBlocks[0].title, "First signal");
  assert.equal(moved.blocks[1].miniBlocks[0].note, "Audience notices the mismatch.");
  assert.equal(JSON.stringify(moved.blocks.map((block) => ({
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
  }))), addressSnapshot);
  assert.equal(
    JSON.stringify(moved.blocks.map((block) => block.miniBlocks.map((mini) => mini.stages))),
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

test("#2166 reports mapped source density without claiming authored 24-Block boundaries", async () => {
  const boardRuntime = await runtime("modules/plan/story-card-board.ts");
  const board = boardRuntime.exports;
  const passages = [
    { text: "one two three", blockNumber: 1, miniBlockNumber: 1, sceneNumber: 1 },
    { text: "four five", blockNumber: 1, miniBlockNumber: 2, sceneNumber: 1 },
    { text: "six seven eight nine", blockNumber: 1, miniBlockNumber: 4, sceneNumber: 2 },
    { text: "ten", blockNumber: 2, miniBlockNumber: 1, sceneNumber: 3 },
  ];
  const coverage = board.storyCardSourceCoverage(passages, 1);
  assert.equal(coverage.passageCount, 3);
  assert.equal(coverage.sceneCount, 2);
  assert.equal(coverage.wordCount, 9);
  assert.equal(coverage.sourceSharePercent, 75);
  assert.equal(coverage.miniBlocksWithEvidence, 3);
  assert.equal(JSON.stringify(coverage.miniPassageCounts), JSON.stringify([1, 1, 0, 1]));
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
  assert.match(board, /MAPPED SCREENPLAY EVIDENCE/u);
  assert.match(board, /sourceSectionMarkers/u);
  assert.match(board, /Source section\{sectionMarkers\.length === 1 \? "" : "s"\} starting here/u);
  assert.match(board, /coverage\.passageCount/u);
  assert.match(board, /coverage\.sceneCount/u);
  assert.match(board, /coverage\.wordCount/u);
  assert.match(board, /coverage\.sourceSharePercent/u);
  assert.match(board, /Screenplay evidence metrics describe mapped source density, not authored Block boundaries/u);
  assert.match(board, /function actLocalBlockNumber\(blockNumber: number\)/u);
  assert.match(board, /Four Acts, six Blocks per Act/u);
  assert.match(board, /ACT \{block\.actNumber\} · BLOCK \{actLocalBlockNumber\(block\.number\)\}/u);
  assert.match(board, /PPF Block \{String\(block\.number\)\.padStart\(2, "0"\)\}/u);
  assert.match(board, /draggable=\{!locked\}/u);
  assert.match(board, /application\/x-plotpickle-story-card/u);
  assert.match(board, /Alt\+Left \/ Alt\+Right/u);
  assert.match(board, /event\.altKey/u);
  assert.match(board, /Move earlier/u);
  assert.match(board, /Move later/u);
  assert.match(board, /Unlock to revise/u);
  assert.match(board, /planCreativeRevisionPropagation/u);
  assert.match(board, /markCreativeRevisionDependentsStale/u);
  assert.match(board, /kind: "planning-lock"/u);
  assert.match(board, /No story content changed merely because the lock changed/u);
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
  assert.match(importer, /function importedSectionMarkers\(project: PlotPickleProject\)/u);
  assert.match(importer, /filter\(\(element\) => element\.type === "section"\)/u);
  assert.match(importer, /sectionMarkers: importedSectionMarkers\(project\)/u);
  assert.match(importer, /title: sourceBlock\.title\?\.trim\(\) \|\| slot\.title/u);
  assert.match(importer, /note: \(sourceBlock\.purpose \|\| sourceBlock\.summary \|\| ""\)/u);
  assert.match(importer, /title: sourceMini\.label\?\.trim\(\) \|\| mini\.title/u);
  assert.match(importer, /structure: importedStoryStructure\(project\)/u);
  assert.match(reference, /createRichAfterglowProject/u);
  const [afterglowScreenplay, reconciliation] = await Promise.all([
    read("data/afterglow-screenplay.ts"),
    read("data/afterglow-reconciliation.ts"),
  ]);
  assert.match(afterglowScreenplay, /projectionMethod: "page-progress-normalized-to-24-block-grid"/u);
  assert.match(afterglowScreenplay, /authoredBlockCount: "not-asserted"/u);
  assert.match(afterglowScreenplay, /trustworthyLegacyStoryboardBlocks: 21/u);
  assert.match(reconciliation, /Afterglow v8 — Historical Complete Rewrite/u);
  assert.match(reconciliation, /Earlier 86-page complete rewrite/u);
  assert.match(reconciliation, /21 explicit titled source sections/u);
  assert.match(reconciliation, /Most Complete 2023 Baseline/u);
  assert.match(reconciliation, /without asserting 24 authored source Blocks/u);
  assert.match(reconciliation, /afterglowSourceUsePolicy/u);
  assert.match(reconciliation, /review-as-later-proposal/u);
  assert.match(reconciliation, /gap-recovery-and-structural-comparison/u);
  assert.match(reconciliation, /v10-later-partial/u);
  assert.doesNotMatch(importer, /stages:\s*\{\s*plan:/u);
  assert.doesNotMatch(board, /\/api\/|generate\/image|createScene|createBeat|createShot|createFrame/u);
  assert.match(board, /Empty cards stay empty/u);
});
