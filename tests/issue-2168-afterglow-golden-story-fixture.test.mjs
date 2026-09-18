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

test("#2168 normalizes one deterministic 24/96 evidence matrix without inventing coverage", async () => {
  const matrixRuntime = await runtime("core/contracts/story-evidence-matrix.ts");
  const normalized = matrixRuntime.exports.normalizeStoryEvidenceMatrix({
    fixtureId: "test-fixture",
    canonicalGrid: "24x96",
    sourcePolicy: "Human review owns structural findings.",
    sources: [],
    sourceSections: [],
    blocks: [{
      blockNumber: 1,
      title: "Observed opening",
      responsibility: "Orient the audience.",
      passageCount: 2,
      sceneCount: 1,
      wordCount: 25,
      sourceSharePercent: 4,
      miniBlocks: [
        { blockNumber: 1, miniBlockNumber: 1, passageIds: ["p1"], sceneNumbers: [1], hasObservedEvidence: true },
      ],
      sourceMappings: [],
      structuralFinding: { state: "unresolved", reason: "Human review required.", reviewedAt: null },
    }],
  });

  assert.equal(normalized.blocks.length, 24);
  assert.equal(normalized.blocks.flatMap((block) => block.miniBlocks).length, 96);
  assert.equal(normalized.blocks[0].miniBlocks[0].hasObservedEvidence, true);
  assert.equal(normalized.blocks[0].miniBlocks[1].hasObservedEvidence, false);
  assert.equal(normalized.blocks[1].passageCount, 0);
  assert.equal(normalized.blocks[1].structuralFinding.state, "unresolved");
});

test("#2168 structural findings are explicit Human review states, not inferred density scores", async () => {
  const matrixRuntime = await runtime("core/contracts/story-evidence-matrix.ts");
  const base = matrixRuntime.exports.normalizeStoryEvidenceMatrix({
    fixtureId: "review-fixture",
    sources: [],
    sourceSections: [],
    blocks: [],
  });
  const reviewed = matrixRuntime.exports.reviewStoryEvidenceBlock(
    base,
    12,
    "condensed-shared",
    "One reviewed movement carries two canonical responsibilities.",
    "2026-09-18T00:00:00.000Z",
  );
  assert.equal(reviewed.blocks[11].structuralFinding.state, "condensed-shared");
  assert.equal(reviewed.blocks[11].structuralFinding.reason, "One reviewed movement carries two canonical responsibilities.");
  assert.equal(reviewed.blocks[11].structuralFinding.reviewedAt, "2026-09-18T00:00:00.000Z");
  assert.equal(reviewed.blocks[10].structuralFinding.state, "unresolved");
});

test("#2168 golden fixture preserves v8/v9/v10 topology and mapping-method boundaries", async () => {
  const [fixture, reconciliation, screenplay, curriculum] = await Promise.all([
    read("modules/library/reference/afterglow-golden-story-fixture.ts"),
    read("data/afterglow-reconciliation.ts"),
    read("data/afterglow-screenplay.ts"),
    read("adapters/curriculum/current-catalog.ts"),
  ]);

  assert.match(fixture, /AFTERGLOW_GOLDEN_STORY_FIXTURE_ID = "afterglow-v8-v9-v10-24x96-evidence-matrix"/u);
  assert.match(fixture, /sections\.length !== 20/u);
  assert.match(fixture, /sourceId: "v9"/u);
  assert.match(fixture, /sourceRole: "baseline"/u);
  assert.match(fixture, /mappingMethod: "page-progress-fallback"/u);
  assert.match(fixture, /blockNumber <= 8/u);
  assert.match(fixture, /sourceId: "v10"/u);
  assert.match(fixture, /sourceRole: "later-partial"/u);
  assert.match(fixture, /sourceId: "v8"/u);
  assert.match(fixture, /sourceRole: "historical-comparison"/u);
  assert.match(fixture, /candidateOnly: true/u);
  assert.match(fixture, /does not claim that v8 contains 24 explicit authored Block markers/u);
  assert.match(fixture, /density does not establish/u);
  assert.match(fixture, /Human semantic review is required/u);

  assert.match(reconciliation, /21 explicit titled source sections/u);
  assert.match(reconciliation, /coveredBlocks: \[1, 2, 3, 4, 5, 6, 7, 8\]/u);
  assert.match(screenplay, /projectionMethod: "page-progress-normalized-to-24-block-grid"/u);
  assert.match(screenplay, /authoredBlockCount: "not-asserted"/u);
  assert.match(curriculum, /export const legacyStoryBeatPattern = \[/u);
  assert.match(curriculum, /Block 12 — Choice, plan, raised stakes, question and action/u);
  assert.match(curriculum, /Block 24 — Final reflections and closing image/u);
});

test("#2168 attaches the golden matrix to the packaged Afterglow PPF and keeps it normalized", async () => {
  const [reference, evidence] = await Promise.all([
    read("modules/library/reference/afterglow-v9-foundations.ts"),
    read("core/contracts/imported-screenplay-evidence/index.ts"),
  ]);

  assert.match(reference, /createAfterglowGoldenStoryMatrix/u);
  assert.match(reference, /storyMatrix = imported\.sourceEvidence\.screenplay/u);
  assert.match(reference, /storyMatrix,/u);
  assert.match(evidence, /readonly storyMatrix\?: StoryEvidenceMatrix \| null/u);
  assert.match(evidence, /normalizeStoryEvidenceMatrix\(source\.storyMatrix\)/u);
  assert.match(evidence, /storyMatrix,/u);
});

test("#2168 Story Cards expose responsibility, provenance and review without auto-rewriting the screenplay", async () => {
  const [board, css] = await Promise.all([
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);

  assert.match(board, /const storyMatrix = normalizedSourceEvidence\.storyMatrix/u);
  assert.match(board, /Structural responsibility/u);
  assert.match(board, /Human structural finding/u);
  assert.match(board, /Covered/u);
  assert.match(board, /Condensed \/ Shared/u);
  assert.match(board, /Gap \/ Underdeveloped/u);
  assert.match(board, /Source density and curriculum guidance do not decide this finding/u);
  assert.match(board, /reviewStoryEvidenceBlock/u);
  assert.match(board, /No screenplay text or comparison source was changed/u);
  assert.doesNotMatch(board, /generate.*screenplay|rewrite.*screenplay|auto.*repair/iu);
  assert.match(css, /pp-skin-v1-story-card-structural-review/u);
  assert.match(css, /pp-skin-v1-story-card-source-map/u);
});
