import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function structureModule() {
  const typescript = await source("core/project/story-structure-v2.ts");
  const compiled = ts.transpileModule(typescript, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function acceptStage(stage, stamp) {
  stage.content = `${stage.content || "Accepted creative material"}`;
  stage.state = "accepted";
  stage.updatedAt = stamp;
  stage.acceptedAt = stamp;
}

test("#1742 creates exactly 24 Blocks, 96 mini-blocks, and four locked Acts", async () => {
  const contract = await structureModule();
  const structure = contract.createEmptyStoryStructureV2();

  assert.equal(contract.STORY_ACT_COUNT, 4);
  assert.deepEqual(contract.STORY_WORKFLOW_STAGES, ["plan", "build", "storyboard"]);
  assert.equal(structure.blocks.length, 24);
  assert.equal(structure.blocks.flatMap((block) => block.miniBlocks).length, 96);
  assert.deepEqual(structure.blocks.map((block) => block.number), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.deepEqual(structure.blocks.map((block) => block.actNumber), [
    1, 1, 1, 1, 1, 1,
    2, 2, 2, 2, 2, 2,
    3, 3, 3, 3, 3, 3,
    4, 4, 4, 4, 4, 4,
  ]);
  assert.deepEqual(structure.blocks[0].miniBlocks.map((mini) => mini.number), [1, 2, 3, 4]);
  assert.deepEqual(structure.blocks[23].miniBlocks.map((mini) => mini.number), [93, 94, 95, 96]);

  for (const mini of structure.blocks[0].miniBlocks) {
    assert.equal(mini.stages.plan.state, "available");
    assert.equal(mini.stages.build.state, "locked");
    assert.equal(mini.stages.storyboard.state, "locked");
    assert.equal("write" in mini.stages, false);
  }
  assert.ok(structure.blocks[1].miniBlocks.every((mini) => mini.stages.plan.state === "locked"));
});

test("#1742 runs PLAN to BUILD to STORYBOARD before mini-block acceptance", async () => {
  const contract = await structureModule();
  const sourceStructure = structuredClone(contract.createEmptyStoryStructureV2());
  const stamp = "2026-09-07T21:00:00.000Z";
  const first = sourceStructure.blocks[0].miniBlocks[0];

  first.stages.plan.content = "The opening movement establishes the story pressure.";
  first.stages.plan.state = "ready";
  let normalized = contract.normalizeStoryStructureV2(sourceStructure);
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.plan.state, "ready");
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.build.state, "locked");

  acceptStage(first.stages.plan, stamp);
  normalized = contract.normalizeStoryStructureV2(sourceStructure);
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.plan.state, "accepted");
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.build.state, "available");
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.storyboard.state, "locked");

  acceptStage(first.stages.build, stamp);
  normalized = contract.normalizeStoryStructureV2(sourceStructure);
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.build.state, "accepted");
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.storyboard.state, "available");
  assert.equal(normalized.blocks[1].miniBlocks[0].stages.plan.state, "locked");
});

test("#1742 unlocks the next Block only when all four mini-block storyboards are accepted", async () => {
  const contract = await structureModule();
  const sourceStructure = structuredClone(contract.createEmptyStoryStructureV2());
  const stamp = "2026-09-07T21:00:00.000Z";

  for (const mini of sourceStructure.blocks[0].miniBlocks) {
    for (const stageName of ["plan", "build", "storyboard"]) {
      acceptStage(mini.stages[stageName], stamp);
    }
  }

  const normalized = contract.normalizeStoryStructureV2(sourceStructure);
  assert.equal(contract.storyBlockState(normalized.blocks[0]), "accepted");
  assert.ok(normalized.blocks[1].miniBlocks.every((mini) => mini.stages.plan.state === "available"));
});

test("#1742 repairs malformed 24/96 structure without inventing accepted canon", async () => {
  const contract = await structureModule();
  const malformed = {
    version: 999,
    activeBlockNumber: 24,
    activeMiniBlockNumber: 96,
    activeStage: "write",
    blocks: [{
      title: "Opening",
      miniBlocks: [{
        title: "Hook",
        stages: {
          plan: { state: "accepted", content: "Has content but no acceptance timestamp" },
        },
      }],
    }],
  };

  const normalized = contract.normalizeStoryStructureV2(malformed);
  assert.equal(normalized.version, 1);
  assert.equal(normalized.blocks.length, 24);
  assert.equal(normalized.blocks.flatMap((block) => block.miniBlocks).length, 96);
  assert.equal(normalized.activeBlockNumber, 1);
  assert.equal(normalized.activeMiniBlockNumber, 1);
  assert.equal(normalized.activeStage, "plan");
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.plan.state, "incomplete");
  assert.equal(normalized.blocks[0].miniBlocks[0].stages.plan.acceptedAt, null);
  assert.equal(normalized.blocks[1].miniBlocks[0].stages.plan.state, "locked");
});

test("#1742 profile Project Library owns and preserves the V2 structure migration bridge", async () => {
  const library = await source("core/storage/project-library-browser.ts");

  assert.match(library, /readonly structure: StoryStructureV2/u);
  assert.match(library, /structure: createEmptyStoryStructureV2\(\)/u);
  assert.match(library, /normalizeStoryStructureV2\(source\.structure\)/u);
  assert.match(library, /initialized\.activeProject\?\.id === project\.id[\s\S]*initialized\.activeProject\.structure/u);
  assert.doesNotMatch(library, /plotpickle\.project\.v1/u);
});
