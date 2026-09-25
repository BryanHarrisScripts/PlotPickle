import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2251 Story Bible is a read-only projection of existing PlotPickle authorities", async () => {
  const source = await read("core/project/story-bible-projection.ts");

  for (const contract of [
    "currentMarketingReference",
    "buildFoundationPlanLessons",
    "buildWorldPlanLessons",
    "normalizeProjectSourceEvidence",
    "project.structure.blocks",
    "characterTruth",
    "Story Evidence Matrix",
    "Not established yet",
  ]) assert.ok(source.includes(contract), `Missing Story Bible authority contract: ${contract}`);

  assert.match(source, /posterUrl: marketingReference\?\.assetUrl/u);
  assert.match(source, /project\.foundations\.lessons/u);
  assert.match(source, /project\.world\.lessons/u);
  assert.match(source, /claim\.reviewState !== "rejected"/u);
  assert.match(source, /claim\.handling === "writer-reference"/u);
  assert.doesNotMatch(source, /saveActiveLibraryProject|applyStoryCommand|fetch\(|POST|PUT|PATCH/u);
});

test("#2251/#2442 only projects Human-approved Character imagery and never generates it in the Story Bible projection", async () => {
  const source = await read("core/project/story-bible-projection.ts");
  assert.match(source, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
  assert.match(source, /imageUrl: approvedVisualRefs\[0\] \?\? null/u);
  assert.doesNotMatch(source, /generate.*character|character.*generate/iu);
  assert.doesNotMatch(source, /fetch\(|POST|PUT|PATCH/u);
});
