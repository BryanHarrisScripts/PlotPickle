import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const foundationTitles = [
  "The Pitch",
  "Pitch Components and Project Positioning",
  "The Anatomy of a Screenplay",
  "Loglines That Carry the Movie",
  "Crafting and Testing Loglines",
  "Why PlotPickle Works in Layers",
  "Screenplay Essentials: Structure, Dialogue and Visuals",
  "Story Essentials: Theme, Plot, Character and Stakes",
  "The Screenwriting Essentials Roadmap",
  "Pacing and Tone: Storytelling Dynamics",
  "Build the Story Experience",
];

test("Foundations is an eleven-step deep learning path rather than reference summaries", async () => {
  const [deep, promoted, catalog] = await Promise.all([
    read("adapters/curriculum/foundation-deep-learning.ts"),
    read("adapters/curriculum/foundation-reference-lessons.ts"),
    read("adapters/curriculum/current-catalog.ts"),
  ]);

  for (const title of foundationTitles) assert.match(deep, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(deep, /Build this for PLAN/);
  assert.match(deep, /A screenplay is a system, not a pile of categories/);
  assert.match(deep, /A development logline must carry the middle/);
  assert.match(deep, /Theme becomes dramatic when credible answers collide/);
  assert.match(deep, /Pacing is rhythm, not speed/);
  assert.match(deep, /A Foundation is a decision system for the rest of the project/);
  assert.match(deep, /\.\.\.lesson\.sections/);
  assert.match(promoted, /sourceContentToSections/);
  assert.match(catalog, /buildDeepFoundationCurriculum/);
  assert.match(catalog, /number !== index \+ 1/);
});

test("PLAN exposes one saved builder step for each Foundations lesson", async () => {
  const [contract, project, commands, reducer, plan] = await Promise.all([
    read("core/contracts/foundation-builder.ts"),
    read("core/project/project.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
    read("modules/plan/ui/foundations-plan-workspace.tsx"),
  ]);

  for (const field of [
    "storyPromise",
    "pitchPositioning",
    "screenplayAnatomy",
    "primaryLogline",
    "loglineTests",
    "storyLayers",
    "structureDialogueVisuals",
    "themeCharacterStakes",
    "craftRoadmap",
    "pacingTone",
    "foundationsBrief",
  ]) assert.match(contract, new RegExp(field));

  assert.match(project, /readonly foundations: FoundationBuilderState/);
  assert.match(project, /normalizeFoundationProject/);
  assert.match(commands, /foundations\.field\.update/);
  assert.match(reducer, /case "foundations\.field\.update"/);
  assert.match(plan, /plotpickle\.foundation\.project\.v1/);
  assert.match(plan, /FOUNDATION_BUILDER_STEPS/);
  assert.match(plan, /applyStoryCommand/);
  assert.match(plan, /Learning → application/);
  assert.match(plan, /same canonical PlotPickle project used by LEARN/);
});

test("Apply what you have learned opens the modular PLAN Foundations screen", async () => {
  const [page, handoff, layout] = await Promise.all([
    read("app/page.tsx"),
    read("app/learn-plan-handoff.tsx"),
    read("app/layout.tsx"),
  ]);

  assert.match(page, /FoundationsPlanWorkspace/);
  assert.match(page, /workspace.*=== "plan"/s);
  assert.match(handoff, /Apply what you have learned in Foundations/);
  assert.match(handoff, /\/\?workspace=plan&section=foundations/);
  assert.match(handoff, /Open PLAN/);
  assert.match(layout, /<LearnPlanHandoff \/>/);
});
