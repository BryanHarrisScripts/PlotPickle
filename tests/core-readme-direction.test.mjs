import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

test("README describes the current slim PlotPickle product spine", () => {
  assert.match(readme, /Dashboard · Community · Learn · Plan · Wyrmwood · Settings/);
  assert.match(readme, /LEARN → PLAN → GAME \/ Wyrmwood/);
  assert.match(readme, /COMMUNITY \/ BUZZ \+ basic SETTINGS \+ deterministic UAT/);
  assert.match(readme, /broader PlotPickle modules still exist in the repository/i);
  assert.match(readme, /parked off to the side/i);
});

test("README uses the current PlotPickle brand and active workspace glyphs", () => {
  assert.match(readme, /public\/brand\/plotpickle-header-horizontal-transparent\.png/);
  for (const asset of [
    "dashboard.webp",
    "community.svg",
    "learn.webp",
    "plan.webp",
    "game.webp",
    "settings.svg",
  ]) {
    assert.match(readme, new RegExp(`public/assets/workflow-relics/${asset.replace(".", "\\.")}`));
  }
});

test("README shows the current authority architecture", () => {
  assert.match(readme, /```mermaid/);
  assert.match(readme, /PPF\\ncreative authority/);
  assert.match(readme, /Mastra/);
  assert.match(readme, /BUZZ Community Layer/);
  assert.match(readme, /GitHub\\ncode \/ PR \/ merge authority/);
  assert.match(readme, /explicit human approval/);
});

test("README keeps current core agents and BUZZ roles visible", () => {
  for (const name of [
    "Sage Brinewick",
    "Tamsin Hearthquill",
    "Master Oaken-Vague",
    "Rowan Scalequill",
    "Avery North",
    "Luma Glassfern",
    "Bram Gatewick",
    "Orin Ledgerbark",
    "Fen Copperwind",
  ]) {
    assert.match(readme, new RegExp(name));
  }
  assert.match(readme, /Story Rooms are real BUZZ channels/);
  assert.match(readme, /Buzz Desktop/);
  assert.match(readme, /Mastra remains the brain/);
});

test("README no longer presents parked historical modules as the active navigation", () => {
  assert.doesNotMatch(readme, /Dashboard · Learn · Plan · Storyboard · Write · Graphic Novel/);
  assert.doesNotMatch(readme, /Start with \*\*Afterglow: Reflections of Sentience\*\*/);
  assert.doesNotMatch(readme, /Settings → Repository & Collab → Buzz/);
});
