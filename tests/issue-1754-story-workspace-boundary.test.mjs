import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1754 Story Workspace selection is headless and skin-neutral", async () => {
  const [useCase, adapter, contract, docs] = await Promise.all([
    read("lib/experience/story-workspace-use-case.ts"),
    read("adapters/experience/browser-story-workspace-gateway.ts"),
    read("core/contracts/experience.ts"),
    read("docs/architecture/HEADLESS-EXPERIENCE-BOUNDARY.md"),
  ]);

  assert.match(contract, /type: "SelectBlock"/u);
  assert.match(contract, /type: "SelectMiniBlock"/u);

  assert.match(useCase, /StoryWorkspaceGateway/u);
  assert.match(useCase, /projectStoryWorkspaceViewModel/u);
  assert.match(useCase, /executeSelectBlockIntent/u);
  assert.match(useCase, /executeSelectMiniBlockIntent/u);
  assert.match(useCase, /AUTHOR_SELECTED_MINI_BLOCK/u);
  assert.match(useCase, /STORY_POSITION_LOCKED/u);
  assert.match(useCase, /SELECTION_REBASED_TO_CURRENT_REVISION/u);
  assert.doesNotMatch(useCase, /react|window\.|document\.|URLSearchParams|fetch\(|localStorage|sessionStorage/i);

  assert.match(adapter, /deriveProgressiveStoryMap/u);
  assert.match(adapter, /loadFoundationProject/u);
  assert.match(adapter, /hydratedStoryMapContext/u);
  assert.match(adapter, /persistStoryMapContext/u);
  assert.doesNotMatch(adapter, /saveFoundationProject|applyStoryCommand/u);

  assert.match(docs, /Legacy Skin/u);
  assert.match(docs, /Skin V1/u);
  assert.match(docs, /SelectBlock \/ SelectMiniBlock/u);
  assert.match(docs, /outcome: rebased/u);
});

test("#1754 existing 24\/96 projection is reused instead of duplicated", async () => {
  const [adapter, existingProjection] = await Promise.all([
    read("adapters/experience/browser-story-workspace-gateway.ts"),
    read("modules/build/progressive-story-map.ts"),
  ]);

  assert.match(adapter, /from "\.\.\/\.\.\/modules\/build\/progressive-story-map"/u);
  assert.match(existingProjection, /Array\.from\(\{ length: 24 \}/u);
  assert.match(existingProjection, /MINI_LABELS/u);
  assert.match(existingProjection, /acceptedMiniBlockCount/u);
});
