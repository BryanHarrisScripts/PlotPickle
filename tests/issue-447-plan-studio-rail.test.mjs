import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#447 canonical Plan rail is visually reorganized into the five approved creative groups", async () => {
  const styles = await source("app/plan-studio-phase-c.css");

  for (const group of ["Story", "World & Cast", "Story Engine", "Structure", "Canon & Notes"]) {
    assert.match(styles, new RegExp(`content:\\s*\"${group.replace(/[&]/g, "\\&")}\"`), `Missing Plan group: ${group}`);
  }

  assert.match(styles, /\.story-rail-group\s*\{[\s\S]*display:\s*contents/i);
  assert.match(styles, /button:nth-of-type\(12\)\s*\{\s*order:\s*17/);
  assert.match(styles, /One canon\. Five creative areas\./);
});

test("#447 removes the hidden duplicate Plan routing rail", async () => {
  const rail = await source("app/plan-studio-rail-host.tsx");

  assert.match(rail, /\.story-rail nav button/);
  assert.match(rail, /MutationObserver/);
  assert.doesNotMatch(rail, /createPortal|portalTarget|hiddenLegacyRail|\.hidden\s*=\s*true/);
  assert.doesNotMatch(rail, /setActiveSection|setProject|localStorage|sessionStorage/);
  assert.match(rail, /return null/);
});

test("#447 keeps safe Plan section and Block deep links on canonical controls", async () => {
  const rail = await source("app/plan-studio-rail-host.tsx");

  for (const id of ["storySetup", "characters", "foundations", "blocks", "coreModel"]) {
    assert.ok(rail.includes(`id: "${id}"`), `Missing deep-link id: ${id}`);
  }
  assert.match(rail, /get\("section"\)/);
  assert.match(rail, /queryNumber\("block", 1, 24\)/);
  assert.match(rail, /\.block-card/);
  assert.match(rail, /aria-pressed/);
});

test("#447 Plan overview carries Block, mini-block and scene context into Storyboard and Write", async () => {
  const overview = await source("app/project-overview.tsx");

  assert.match(overview, /openStoryMoment\("storyboard", currentBlock\.number, mini, scene\?\.id\)/);
  assert.match(overview, /openStoryMoment\("write", currentBlock\.number, mini, scene\?\.id\)/);
  assert.match(overview, /searchParams\.set\("block"/);
  assert.match(overview, /searchParams\.set\("mini"/);
  assert.match(overview, /searchParams\.set\("scene"/);
  assert.match(overview, /visualSection/);
  assert.match(overview, /Choose a beat and PlotPickle carries the same Block, mini-block and scene identity/);
});

test("#447 Write deep links land on the requested canonical Block and mini-block", async () => {
  const rail = await source("app/plan-studio-rail-host.tsx");

  assert.match(rail, /workspace\) !== \"write\"/);
  assert.match(rail, /nav\[aria-label=\"Screenplay blocks\"\] button/);
  assert.match(rail, /screenplayMode\?\.click\(\)/);
  assert.match(rail, /miniPrefix = `\$\{block\}\.\$\{mini\}`/);
  assert.match(rail, /miniButton\.click\(\)/);
});

test("#447 Plan rail bridge stays provider-neutral", async () => {
  const rail = await source("app/plan-studio-rail-host.tsx");
  assert.doesNotMatch(rail, /Ollama|ComfyUI|MiniMax|endpoint|checkpoint|apiKey/i);
});
