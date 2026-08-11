import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #113 retains canonical dashboard model sources for downstream reporting", async () => {
  const model = await source("lib/dashboard-command-centre.ts");
  for (const contract of [
    "completionFor",
    "projectSectionProgress",
    "sectionHasAlert",
    "deriveDashboardStorageStatus",
    "PlotPickleSettings",
    "project.review.threads",
    "project.collaboration",
    "project.screenplay.draftElements",
    "project.blocks.flatMap",
  ]) assert.ok(model.includes(contract), `Dashboard model is missing canonical source: ${contract}`);
  assert.doesNotMatch(model, /apiKey|secretValue|accessToken/);
});

test("issue #113 dashboard entry now presents the #444 story-first Studio Dashboard", async () => {
  const [entry, studio] = await Promise.all([
    source("app/dashboard-command-centre.tsx"),
    source("app/dashboard-story-library.tsx"),
  ]);
  assert.match(entry, /<DashboardStoryLibrary/);
  assert.doesNotMatch(entry, /Five-second readiness check|ComputeHubDashboard|SetupConnectionsDashboard/);
  for (const phrase of [
    "PlotPickle Studio",
    "Your stories.",
    "Available stories",
    "Load Afterglow",
    "4 Acts · 24 Blocks · 96 mini-blocks",
    "Learn",
    "Plan",
    "Storyboard",
    "Write",
    "Edit",
    "Graphic Novel",
    "Build",
    "Feedback",
    "Refine",
  ]) assert.ok(studio.includes(phrase), `Studio Dashboard is missing: ${phrase}`);
});

test("issue #113 preserves project actions for later Studio phases while Learn remains the only visible entry", async () => {
  const [page, shell, direction] = await Promise.all([
    source("app/page.tsx"),
    source("app/application-shell-header.tsx"),
    source("lib/product-direction.ts"),
  ]);
  assert.match(page, /<ApplicationShellHeader/);
  assert.match(page, /<DashboardCommandCentre/);
  assert.doesNotMatch(page, /className="dashboard-actions"/);
  assert.match(shell, /data-studio-project-actions=\{PROJECT_ACTIONS\.length\}/);
  assert.doesNotMatch(shell, /PROJECT_ACTIONS\.map/);
  assert.match(shell, /const studioLearn = PRODUCT_NAVIGATION\.find/);
  for (const action of ["New Project", "Import", "Export", "Load Example"]) assert.ok(shell.includes(action) || direction.includes(action));
});

test("issue #113 keeps Settings configuration outside the story-first Dashboard", async () => {
  const [dashboard, settings] = await Promise.all([
    source("app/dashboard-story-library.tsx"),
    source("app/settings-panel.tsx"),
  ]);
  assert.match(dashboard, /openWorkspace\("settings"\)/);
  assert.doesNotMatch(dashboard, /apiKey|endpoint|Ollama|ComfyUI|MiniMax/i);
  assert.match(settings, /plotpickle\.settings\.section/);
  assert.match(settings, /plotpickle:settings-section/);
});

test("issue #113 dashboard progress tolerates legacy projects missing Concept Canvas data", async () => {
  const progress = await source("lib/project-progress.ts");
  assert.match(progress, /createBlankDevelopment/);
  assert.match(progress, /developmentWithDefaults/);
  assert.match(progress, /development\.conceptCanvas\.conceptText/);
  assert.doesNotMatch(progress, /project\.development\.conceptCanvas\.conceptText/);
  assert.match(progress, /development\.visualReferences/);
  assert.match(progress, /const notes = developmentWithDefaults\(project\)\.notes/);
});

test("issue #113 Project Overview tolerates legacy projects missing Concept Canvas and nested scene arrays", async () => {
  const overview = await source("app/project-overview.tsx");
  assert.match(overview, /createBlankDevelopment/);
  assert.match(overview, /project\.development\?\.conceptCanvas \?\?/);
  assert.match(overview, /conceptCanvas\.desiredVisualImpact\?\.trim\(\) \?\? ""/);
  assert.doesNotMatch(overview, /project\.development\.conceptCanvas\.desiredVisualImpact/);
  assert.match(overview, /block\.scenes \?\? \[\]/);
  assert.match(overview, /scene\.miniBlocks \?\? \[\]/);
});

test("issue #113 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-113-dashboard-command-centre\.test\.mjs/);
  assert.equal(packageJson.scripts["test:dashboard-command-centre"], "node --test tests/issue-113-dashboard-command-centre.test.mjs");
});
