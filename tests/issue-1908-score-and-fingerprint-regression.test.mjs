import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ts from "typescript";

const root = new URL("..", import.meta.url);
const sourceFile = (path) => readFile(new URL(path, root), "utf8");

async function compileWithStoryStructure(path) {
  const [typescript, structureTypescript] = await Promise.all([
    sourceFile(path),
    sourceFile("core/project/story-structure-v2.ts"),
  ]);
  let compiled = ts.transpileModule(typescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const structureCompiled = ts.transpileModule(structureTypescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const structureUrl = `data:text/javascript;base64,${Buffer.from(structureCompiled).toString("base64")}`;
  compiled = compiled.replace(/from\s+["']\.\/story-structure-v2["']/gu, `from "${structureUrl}"`);
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}-${Math.random()}`);
}

async function structureModule() {
  const typescript = await sourceFile("core/project/story-structure-v2.ts");
  const compiled = ts.transpileModule(typescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function fingerprintPayload(source) {
  return JSON.stringify(source.blocks.map((block) => ({
    blockId: block.blockId,
    blockOrdinal: block.blockOrdinal,
    segments: block.segments.map((segment) => ({ id: segment.id, text: segment.text })),
  })));
}

function readerSource() {
  return {
    projectId: "project-1908",
    blocks: Array.from({ length: 24 }, (_, index) => ({
      blockId: `block-${String(index + 1).padStart(2, "0")}`,
      blockOrdinal: index + 1,
      segments: [{ id: `segment-${String(index + 1).padStart(2, "0")}-01`, text: `Original Block ${index + 1}` }],
    })),
  };
}

test("#1908 PlotPickle Score output is identical before and after adding reader evidence for the same story source", async () => {
  const [score, structureContract] = await Promise.all([
    compileWithStoryStructure("core/project/plotpickle-score.ts"),
    structureModule(),
  ]);
  const structure = structureContract.createEmptyStoryStructureV2();

  for (let index = 0; index < 12; index += 1) {
    const block = structure.blocks[Math.floor(index / 4)];
    const mini = block.miniBlocks[index % 4];
    mini.stages.plan.content = `Distinct story evidence ${index + 1} establishes action choice consequence pressure and progression.`;
  }

  const sourceEvidence = {};
  const before = score.calculatePlotPickleScore({ structure, sourceEvidence });
  const readerEvidence = {
    runs: [{
      runId: "reader-run-1908",
      readerProfileId: "skeptical-reader",
      sourceDraftFingerprint: "sha256:reader-source",
      blockEvidence: [{ blockId: "block-01", attentionTrace: [1, 0, -1], readingDecision: "continue" }],
    }],
  };
  const after = score.calculatePlotPickleScore({
    structure,
    sourceEvidence: { ...sourceEvidence, readerSimulationEvidence: readerEvidence },
    readerSimulationEvidence: readerEvidence,
  });

  assert.notEqual(before.displayScore, "NR", "The fixture must exercise an actual numeric PlotPickle Score.");
  assert.deepEqual(after, before);
});

test("#1908 revised Block content changes the source fingerprint while preserving canonical Block identity", async () => {
  const harness = await compileWithStoryStructure("core/project/reader-simulation-harness.ts");
  const beforeSource = readerSource();
  const afterSource = structuredClone(beforeSource);
  afterSource.blocks[5].segments[0].text = "Revised Block 6 with a materially different scene turn.";

  const before = await harness.fingerprintReaderSource(fingerprintPayload(beforeSource));
  const after = await harness.fingerprintReaderSource(fingerprintPayload(afterSource));

  assert.match(before, /^sha256:[a-f0-9]{64}$/u);
  assert.match(after, /^sha256:[a-f0-9]{64}$/u);
  assert.notEqual(after, before);
  assert.equal(beforeSource.blocks[5].blockId, "block-06");
  assert.equal(afterSource.blocks[5].blockId, "block-06");
  assert.deepEqual(
    afterSource.blocks.map((block) => block.blockId),
    beforeSource.blocks.map((block) => block.blockId),
  );
});
