import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("main application exposes Engines as the fourth guided workspace", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.ok(source.includes('type MainTab = "instructions" | "planner" | "visuals" | "engines"'));
  assert.ok(source.includes('{ id: "engines", label: "Engines", description: "Refine the story" }'));
  assert.ok(source.includes('import EngineHub from "./engine-hub"'));
  assert.ok(source.includes('{activeTab === "engines" ? <EngineHub /> : null}'));
  assert.ok(source.includes('<span>Visual Board</span><span>Engines</span>'));
  assert.ok(source.includes("One playhouse. Four connected workspaces."));
});

test("Engines workspace explains every specialist before opening it", async () => {
  const source = await readFile(new URL("../app/engine-hub.tsx", import.meta.url), "utf8");
  for (const title of [
    "Structure Engine",
    "Resonance Engine",
    "Voiceprint Engine",
    "PageFlow Engine",
    "DraftLens Engine",
    "CraftLoop Engine",
  ]) {
    assert.ok(source.includes(title), `Engines workspace is missing ${title}`);
  }
  for (const contract of [
    "Use it when",
    "Works with shared project data",
    "Expected result",
    "One active project",
    "There is no required order.",
  ]) {
    assert.ok(source.includes(contract), `Engines workspace is missing guidance: ${contract}`);
  }
});

test("floating engine stack was removed from the root layout", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.ok(!layout.includes("engineLinkStyle"));
  assert.ok(!layout.includes('aria-label="PlotPickle writing engines"'));
  assert.ok(!layout.includes('href="/structure"'));
});
