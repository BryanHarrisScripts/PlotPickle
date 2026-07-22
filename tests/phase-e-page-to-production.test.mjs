import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("PlotPickle 0.17 exposes the complete page-to-production workspace", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const workspace = await source("app/preproduction-workspace.tsx");
  const page = await source("app/production/page.tsx");
  assert.equal(packageJson.version, "0.17.0");
  for (const phrase of ["Shot Designer", "Sonic Bible", "Animatic", "Production Breakdowns", "shooting schedule", "Distribution and Marketing Planner"]) {
    assert.ok(`${workspace}\n${page}`.includes(phrase), `Missing Phase E workspace: ${phrase}`);
  }
  assert.match(page, /plotpickle\.project\.v1/);
});

test("shots, cues, breakdowns and schedules retain stable project links", async () => {
  const engine = await source("lib/preproduction.ts");
  const project = await source("lib/project.ts");
  for (const operation of ["createShotFromFrame", "createSonicCue", "buildShotCoverage", "buildAnimaticTimeline", "generateProductionBreakdowns", "generateProductionSchedule", "productionCoverage"]) {
    assert.match(engine, new RegExp(`export function ${operation}\\b`), `Missing ${operation}`);
  }
  for (const field of ["sceneId", "frameId", "screenplayElementIds", "keyframeSrc", "cueIn", "cueOut", "breakdowns", "schedule", "distribution"]) {
    assert.ok(`${engine}\n${project}`.includes(field), `Missing stable production field: ${field}`);
  }
});

test("the canonical schema and revision snapshots include production planning", async () => {
  const project = await source("lib/project.ts");
  const phaseOne = await source("lib/project-phase-one.ts");
  const schema = JSON.parse(await source("schema/plotpickle-project.schema.json"));
  assert.ok(schema.required.includes("production"));
  assert.equal(schema.properties.production.$ref, "#/$defs/productionWorkspace");
  assert.match(project, /production: ProductionWorkspace/);
  assert.match(project, /normalizeProductionWorkspace/);
  assert.match(phaseOne, /production: project\.production/);
});

test("Afterglow Blocks 22 through 24 contain twelve replacement keyframes", async () => {
  const storyboard = await source("data/afterglow-storyboard.ts");
  assert.match(storyboard, /bundledStoryboardBlocks = 24/);
  assert.match(storyboard, /replacementBlocks: \[22, 23, 24\]/);
  assert.match(storyboard, /images: bundledStoryboardBlocks \* 4/);
  for (const block of [22, 23, 24]) {
    for (const mini of [1, 2, 3, 4]) {
      const asset = await source(`public/afterglow/storyboard/block-${String(block).padStart(2, "0")}-mini-${mini}.svg`);
      assert.match(asset, /<svg/);
      assert.match(asset, new RegExp(`Block ${block}\\.${mini}`));
    }
  }
});

test("Phase E documentation states the continuous-plan completion contract", async () => {
  const documentation = await source("docs/phase-e-page-to-production.md");
  for (const phrase of ["continuous pre-production plan", "all 96 mini-block positions", "rights or clearance status", "CC BY-SA 4.0 replacement concept keyframes", "same canonical project"]) {
    assert.ok(documentation.includes(phrase), `Missing completion language: ${phrase}`);
  }
});
