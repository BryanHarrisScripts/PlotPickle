import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#447 Plan rail exposes the five approved creative groups", async () => {
  const rail = await source("app/plan-studio-rail-host.tsx");

  for (const group of ["Story", "World & Cast", "Story Engine", "Structure", "Canon & Notes"]) {
    assert.ok(rail.includes(`label: "${group}"`), `Missing Plan group: ${group}`);
  }

  for (const destination of [
    "Simple Start",
    "Project Overview",
    "Story Setup",
    "Concept Canvas",
    "Pitch & Vision",
    "Visual References",
    "World",
    "Characters",
    "Ghost",
    "Catalyst",
    "Foundations",
    "The Pickle",
    "Dialogue",
    "Structure Map",
    "24 Blocks",
    "Storyboard Handoff",
    "Core Model",
    "Notes",
  ]) assert.ok(rail.includes(destination), `Missing existing Plan destination: ${destination}`);
});

test("#447 Plan rail reuses the canonical legacy section routing instead of creating parallel state", async () => {
  const rail = await source("app/plan-studio-rail-host.tsx");

  assert.match(rail, /\.story-rail nav button/);
  assert.match(rail, /button\?\.click\(\)/);
  assert.match(rail, /legacyLabel: "Storyboard"/);
  assert.match(rail, /hiddenLegacyRail\.hidden = true/);
  assert.match(rail, /createPortal/);
  assert.match(rail, /MutationObserver/);
  assert.doesNotMatch(rail, /setActiveSection|setProject|localStorage|sessionStorage/);
});

test("#447 Plan rail is mounted globally but activates only around planner content", async () => {
  const [layout, rail] = await Promise.all([
    source("app/layout.tsx"),
    source("app/plan-studio-rail-host.tsx"),
  ]);

  assert.match(layout, /import PlanStudioRailHost/);
  assert.match(layout, /<PlanStudioRailHost \/>/);
  assert.match(rail, /document\.querySelector<HTMLElement>\("\.planner-content"\)/);
  assert.match(rail, /closest<HTMLElement>\("\.studio-layout"\)/);
});

test("#447 Plan rail keeps Studio styling and story architecture visible", async () => {
  const styles = await source("app/plan-studio-rail-host.module.css");
  const rail = await source("app/plan-studio-rail-host.tsx");

  assert.match(styles, /#0c0c0b/i);
  assert.match(styles, /#cda758/i);
  assert.match(styles, /Georgia/);
  assert.match(rail, /4 Acts/);
  assert.match(rail, /24 Blocks/);
  assert.match(rail, /96 mini-blocks/);
  assert.doesNotMatch(rail, /Ollama|ComfyUI|MiniMax|endpoint|checkpoint|apiKey/i);
});
