import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("missing top-level workspaces receive the shared two-card introduction", async () => {
  const host = await source("app/workspace-intro-host.tsx");
  const intro = await source("app/workspace-intro.tsx");
  const css = await source("app/workspace-intro.module.css");

  for (const workspace of ["Screenplay", "Visual Board", "Settings"]) {
    assert.ok(host.includes(workspace), `Missing introduction for ${workspace}`);
  }
  assert.ok(!host.includes('"Story Planner":'), "Story Planner already owns a project overview introduction and should not receive a duplicate");
  assert.match(intro, /primaryCard/);
  assert.match(intro, /sideCard/);
  assert.match(css, /grid-template-columns: minmax\(0, 1\.25fr\) minmax\(270px, 0\.52fr\)/);
  assert.match(css, /@media \(max-width: 1000px\)/);
});

test("workspace introductions can be collapsed without losing the explanation", async () => {
  const intro = await source("app/workspace-intro.tsx");
  const css = await source("app/workspace-intro.module.css");

  assert.match(intro, /Hide overview/);
  assert.match(intro, /Show overview/);
  assert.match(intro, /aria-expanded/);
  assert.match(intro, /plotpickle\.workspace-intro\.collapsed/);
  assert.match(intro, /localStorage/);
  assert.match(css, /\.collapsed/);
});

test("workspace introductions follow the selected primary navigation tab", async () => {
  const layout = await source("app/layout.tsx");
  const host = await source("app/workspace-intro-host.tsx");

  assert.match(layout, /<WorkspaceIntroHost \/>/);
  assert.match(host, /main\.workspace/);
  assert.match(host, /aria-selected="true"/);
  assert.match(host, /MutationObserver/);
  assert.match(host, /nextContainer\.prepend\(host\)/);
  assert.match(host, /visual-studio-layout/);
  assert.match(host, /embedded=\{activeLabel === "Visual Board"\}/);
  assert.match(host, /createPortal/);
});

test("existing introductions remain the source of truth for the other workspaces", async () => {
  const instructionsAndPlanner = await source("app/page.tsx");
  const learning = await source("app/learning-studio.tsx");
  const planner = await source("app/project-overview.tsx");
  const engines = await source("app/engine-hub.tsx");

  assert.match(instructionsAndPlanner, /guide-hero/);
  assert.match(learning, /The complete PlotPickle screenwriting course/);
  assert.match(planner, /Plan · Story Architecture/);
  assert.match(planner, /The whole story stays visible\./);
  assert.match(engines, /Choose the right engine for the next story problem/);
});
