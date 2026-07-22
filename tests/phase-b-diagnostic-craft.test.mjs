import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Phase B provides diagnostic engines for movements, scenes, threads, ledgers, arcs and time", async () => {
  const diagnostics = await source("lib/craft-diagnostics.ts");
  for (const operation of [
    "diagnoseOpeningMove",
    "diagnoseActOneLaunch",
    "diagnoseScenePulse",
    "buildStoryThreadOverlays",
    "buildSetupPayoffReflectionLedger",
    "buildCharacterArcCheckpointViews",
    "buildChronologyPresentationView",
    "diagnoseCraftLayer",
  ]) assert.match(diagnostics, new RegExp(`export function ${operation}\\b`), `Missing ${operation}`);
  for (const phrase of ["Pressure Lock", "Cut Line", "value flip", "Handoff pressure", "downstream promises", "unearned payoff", "chronology order"]) assert.ok(diagnostics.toLowerCase().includes(phrase.toLowerCase()), `Missing diagnostic language: ${phrase}`);
});

test("Opening Move and Act I Launch architecture is ported without a second story model", async () => {
  const launch = await source("docs/architecture/act-one-launch.md");
  const opening = await source("docs/architecture/opening-move.md");
  const pulse = await source("docs/architecture/scene-pulse.md");
  for (const signal of ["Primary Presence", "Revealing Contrast", "Opposing Pressure", "Irreversible Step"]) assert.ok(launch.includes(signal));
  for (const effect of ["Anchor", "Grip", "Compass", "Question", "Imprint", "Echo", "Handoff"]) assert.ok(opening.includes(effect));
  for (const part of ["Scene Identity", "Pressure Lock", "Cut Line", "Character Proof", "Value Flip", "Focus Signal"]) assert.ok(pulse.includes(part));
});

test("the Diagnostic Craft workspace exposes every Phase B view", async () => {
  const workspace = await source("app/craft-diagnostics.tsx");
  const page = await source("app/diagnostics/page.tsx");
  for (const view of ["Opening Move", "Act I Launch", "Story Threads", "Setup", "Reflection", "Character", "Chronology", "Presentation"]) assert.ok(`${workspace}\n${page}`.includes(view), `Missing workspace view: ${view}`);
  assert.match(page, /plotpickle\.project\.v1/);
  assert.match(workspace, /Open full diagnostics/);
});

test("Structure, Writer and DraftLens embed the same diagnostic engine", async () => {
  const structure = await source("app/structure/page.tsx");
  const writer = await source("app/script-workspace.tsx");
  const draftlens = await source("app/draftlens/page.tsx");
  for (const [name, content] of [["Structure", structure], ["Writer", writer], ["DraftLens", draftlens]]) {
    assert.match(content, /CraftDiagnosticSummary/, `${name} is not connected to Phase B diagnostics`);
  }
});

test("the Phase B completion standard remains documented in later releases", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  const documentation = await source("docs/phase-b-diagnostic-craft.md");
  assert.ok(Number(packageJson.version.split(".")[1]) >= 14, "Phase B requires PlotPickle 0.14 or later");
  assert.match(documentation, /what function is weak/);
  assert.match(documentation, /why that function matters/);
  assert.match(documentation, /story movement, scene, thread or character arc/);
});
