import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Wyrmwood is an isolated PlotPickle plugin workspace", async () => {
  const [manifest, contract, engine, page] = await Promise.all([
    read("modules/wyrmwood/manifest.ts"),
    read("core/contracts/module.ts"),
    read("modules/wyrmwood/engine.ts"),
    read("app/page.tsx"),
  ]);

  assert.match(contract, /"wyrmwood"/);
  assert.match(contract, /"wyrmwood\.play"/);
  assert.match(contract, /"wyrmwood\.progress"/);
  assert.match(manifest, /id: "wyrmwood"/);
  assert.match(manifest, /route: "\/\?workspace=wyrmwood"/);
  assert.match(manifest, /owns: \["wyrmwood"\]/);
  assert.match(manifest, /dependencies: \["learn"\]/);
  assert.match(engine, /plotpickle\.wyrmwood\.v1/);
  assert.doesNotMatch(engine, /plotpickle\.foundation\.project\.v1/);
  assert.match(page, /requested === "wyrmwood"/);
  assert.match(page, /<WyrmwoodWorkspace/);
});

test("the first Wyrmwood campaign is generated from LEARN Foundations", async () => {
  const [bridge, ui] = await Promise.all([
    read("modules/wyrmwood/curriculum-bridge.ts"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(bridge, /id: "fundamentals"/);
  assert.match(bridge, /curriculumTopic: "foundations"/);
  assert.match(bridge, /lesson\.topic === WYRMWOOD_FIRST_CAMPAIGN\.curriculumTopic/);
  assert.match(bridge, /lesson\.objectives\.slice\(0, 3\)/);
  assert.match(bridge, /lessonReminder: lesson\.overview/);
  assert.match(bridge, /Reward grounded cause-and-effect/);
  assert.match(ui, /built directly from LEARN → Foundations/);
  assert.match(ui, /WHAT LEARN TAUGHT YOU/);
  assert.match(ui, /trial\.learningTargets/);
});

test("GAME remains isolated while sharing the global PlotPickle navigation shell", async () => {
  const [page, shell, ui] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(page, /<PlotPickleWorkspaceShell activeWorkspace="wyrmwood"/);
  assert.match(shell, /id: "wyrmwood", relic: "\/assets\/workflow-relics\/game\.webp", label: "Wyrmwood", detail: "Game", selectable: true/);
  assert.match(shell, /data-plotpickle-global-nav="v1"/);
  assert.doesNotMatch(page, /WyrmwoodPluginEntry/);
  assert.match(ui, /Spellscribe response · practical logic only/);
  assert.match(ui, /150 words/);
  assert.match(ui, /directWyrmwoodTurn/);
  assert.match(ui, /WYRMWOOD_RIVALS/);
  assert.doesNotMatch(ui, /applyStoryCommand|PPFProject|FOUNDATION_PROJECT_STORAGE_KEY/);
});

test("Wyrmwood state starts deterministic and cannot mutate the story project", async () => {
  const [engine, ui] = await Promise.all([
    read("modules/wyrmwood/engine.ts"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(engine, /WYRMWOOD_STARTING_SPOTLIGHT = 60/);
  assert.match(engine, /spotlight: WYRMWOOD_STARTING_SPOTLIGHT/);
  assert.match(engine, /brineCoins: 0/);
  assert.match(engine, /xp: 0/);
  assert.match(engine, /clampNumber\(state\.spotlight \+ spotlightDelta, 0, 100/);
  assert.match(ui, /LEARN_PROJECT_STORAGE_KEY = "plotpickle\.foundation\.project\.v1"/);
  assert.match(ui, /localStorage\.getItem\(LEARN_PROJECT_STORAGE_KEY\)/);
  assert.doesNotMatch(ui, /localStorage\.setItem\(LEARN_PROJECT_STORAGE_KEY/);
  assert.doesNotMatch(ui, /applyStoryCommand|PPFProject|FOUNDATION_PROJECT_STORAGE_KEY/);
});
