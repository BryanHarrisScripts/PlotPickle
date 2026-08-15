import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the Curriculum Bridge exposes Foundations objectives, key concepts, active lesson, and completed lessons", async () => {
  const [bridge, contracts, ui] = await Promise.all([
    read("modules/wyrmwood/curriculum-bridge.ts"),
    read("modules/wyrmwood/contracts.ts"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(bridge, /keyConceptsForLesson/);
  assert.match(bridge, /lesson\.definitions\.map/);
  assert.match(bridge, /buildWyrmwoodCurriculumProgress/);
  assert.match(bridge, /completedLessonIds\.filter/);
  assert.match(bridge, /activeLessonId/);
  assert.match(contracts, /interface WyrmwoodCurriculumProgress/);
  assert.match(ui, /LEARN_PROJECT_STORAGE_KEY = "plotpickle\.foundation\.project\.v1"/);
  assert.match(ui, /buildWyrmwoodCurriculumProgress/);
  assert.match(ui, /lessons marked complete/);
  assert.match(ui, /Key concepts:/);
  assert.doesNotMatch(ui, /localStorage\.setItem\(LEARN_PROJECT_STORAGE_KEY/);
});

test("the Curriculum Evaluator is a separate structured local agent and never owns game math", async () => {
  const [runtime, evaluator, playbook] = await Promise.all([
    read("build/mastra-agent-runtime.ts"),
    read("modules/wyrmwood/curriculum-evaluator.ts"),
    read("agents/wyrmwood-curriculum-evaluator.md"),
  ]);

  assert.match(runtime, /"wyrmwood-curriculum-evaluator"/);
  assert.match(runtime, /wyrmwoodCurriculumEvaluatorSchema/);
  assert.match(runtime, /storyLogic: score\(30\)/);
  assert.match(runtime, /lessonApplication: score\(20\)/);
  assert.match(runtime, /establishedElements: score\(15\)/);
  assert.match(runtime, /consequences: score\(15\)/);
  assert.match(runtime, /rivalCounter: score\(10\)/);
  assert.match(runtime, /clarity: score\(10\)/);
  assert.match(evaluator, /fetch\(`\/api\/local-ai\/runtime\/model\/\$\{role\}\/load`/);
  assert.match(evaluator, /await prepareRole\("quality"\)/);
  assert.match(evaluator, /await prepareRole\("fast"\)/);
  assert.match(evaluator, /agentId: "wyrmwood-curriculum-evaluator"/);
  assert.match(evaluator, /Spellscribe response:/);
  assert.match(evaluator, /Do not calculate Spotlight, coins, XP, rank, level, or progression/);
  assert.match(playbook, /deterministic Wyrmwood engine owns all game math and persistence/);
  assert.doesNotMatch(evaluator, /spotlightDeltaForScore|brineForScore|progressionForTotals/);
});

test("the deterministic engine clamps evaluator evidence and calculates Spotlight, Brine, XP, and trope bonuses", async () => {
  const engine = await read("modules/wyrmwood/engine.ts");

  assert.match(engine, /storyLogic: 30/);
  assert.match(engine, /lessonApplication: 20/);
  assert.match(engine, /establishedElements: 15/);
  assert.match(engine, /consequences: 15/);
  assert.match(engine, /rivalCounter: 10/);
  assert.match(engine, /clarity: 10/);
  assert.match(engine, /const score = Object\.values\(dimensions\)\.reduce/);
  assert.match(engine, /const spotlightDelta = spotlightDeltaForScore\(score\)/);
  assert.match(engine, /dimensions\.rivalCounter >= 8/);
  assert.match(engine, /brineForScore\(score\) \+ \(tropeCounterBonus \? 25 : 0\)/);
  assert.match(engine, /const xpGained = score \* 2/);
  assert.match(engine, /if \(score >= 90\) return 20/);
  assert.match(engine, /if \(score >= 75\) return 12/);
  assert.match(engine, /if \(score >= 60\) return 6/);
  assert.match(engine, /if \(score >= 45\) return -4/);
  assert.match(engine, /if \(score >= 30\) return -10/);
  assert.match(engine, /return -18/);
});

test("progression remains deterministic and follows the five Wyrmwood rank bands", async () => {
  const [engine, contracts] = await Promise.all([
    read("modules/wyrmwood/engine.ts"),
    read("modules/wyrmwood/contracts.ts"),
  ]);

  assert.match(contracts, /"Fresh Novice"/);
  assert.match(contracts, /"Junior Spellscribe"/);
  assert.match(contracts, /"Master Untangler"/);
  assert.match(contracts, /"Spicy Arch-Mage"/);
  assert.match(contracts, /"Grand Fermenter"/);
  assert.match(engine, /safeXp >= 50_000/);
  assert.match(engine, /safeXp >= 15_000 && safeBrine >= 10_000/);
  assert.match(engine, /safeXp >= 5_000 && safeBrine >= 2_500/);
  assert.match(engine, /safeXp >= 1_000 && safeBrine >= 500/);
  assert.match(engine, /lifetimeBrineCoinsEarned/);
  assert.match(engine, /rank: after\.rank/);
  assert.match(engine, /level: after\.level/);
});

test("the player loop now waits for curriculum judgment before advancing", async () => {
  const [engine, ui] = await Promise.all([
    read("modules/wyrmwood/engine.ts"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(engine, /roundStatus: "evaluating"/);
  assert.match(engine, /applyWyrmwoodEvaluation/);
  assert.match(engine, /state\.roundStatus !== "resolved" \|\| !state\.lastResolution/);
  assert.match(ui, /evaluateWyrmwoodTurn/);
  assert.match(ui, /applyWyrmwoodEvaluation/);
  assert.match(ui, /Curriculum judgment in progress/);
  assert.match(ui, /Retry curriculum judgment/);
  assert.match(ui, /SPOTLIGHT JUDGMENT · CURRICULUM DEBRIEF/);
});

test("the teaching debrief shows evidence, concept use, rewards, progression, and a route back to LEARN", async () => {
  const ui = await read("modules/wyrmwood/ui/wyrmwood-workspace.tsx");

  assert.match(ui, /WHAT WORKED/);
  assert.match(ui, /WHAT TO SHARPEN/);
  assert.match(ui, /CONCEPT USED/);
  assert.match(ui, /resolution\.teachingDebrief/);
  assert.match(ui, /resolution\.spotlightDelta/);
  assert.match(ui, /resolution\.brineCoinsEarned/);
  assert.match(ui, /resolution\.xpGained/);
  assert.match(ui, /resolution\.rankAfter/);
  assert.match(ui, /Review this material in LEARN/);
  assert.match(ui, /Phase 3 · LIVE/);
});
