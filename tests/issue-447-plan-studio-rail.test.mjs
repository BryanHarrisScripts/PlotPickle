import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#447 canonical Plan rail is visually reorganized into the five approved creative groups", async () => {
  const styles = await source("app/plan-studio-phase-c.css");

  for (const group of ["Story", "World & Cast", "Story Engine", "Structure", "Canon & Notes"]) {
    assert.ok(styles.includes(`content: "${group}"`) || styles.includes(`content:"${group}"`), `Missing Plan group: ${group}`);
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
