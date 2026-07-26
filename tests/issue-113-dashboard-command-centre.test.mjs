import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #113 reuses canonical project, progress, storage and settings sources", async () => {
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

test("issue #113 dashboard presents connections, workflow, attention and project snapshot", async () => {
  const dashboard = await source("app/dashboard-command-centre.tsx");
  for (const phrase of [
    "Five-second readiness check",
    "Connections",
    "Workflow progress",
    "Attention required",
    "Project snapshot",
    "GitHub",
    "AI provider",
    "Plugins",
    "Storage and backup",
    "Collaboration",
    "Learn",
    "Plan",
    "Build",
    "Write",
    "Storyboard",
    "Refine",
    "Estimated pages",
    "Canonical / branch state",
  ]) assert.ok(dashboard.includes(phrase), `Dashboard UI is missing: ${phrase}`);
  assert.match(dashboard, /toneMeta/);
  assert.match(dashboard, /aria-label/);
  assert.doesNotMatch(dashboard, />New Project<|>Import<|>Export<|>Load Afterglow</);
});

test("issue #113 moves project actions to the persistent shell and replaces the legacy Dashboard", async () => {
  const [page, shell] = await Promise.all([
    source("app/page.tsx"),
    source("app/application-shell-header.tsx"),
  ]);
  assert.match(page, /<ApplicationShellHeader/);
  assert.match(page, /<DashboardCommandCentre/);
  assert.doesNotMatch(page, /className="dashboard-actions"/);
  assert.doesNotMatch(page, /const dashboardStatuses/);
  assert.match(shell, /PROJECT_ACTIONS\.map/);
  for (const action of ["New Project", "Import", "Export", "Load Afterglow"]) assert.ok(shell.includes(action) || (await source("lib/product-direction.ts")).includes(action));
});

test("issue #113 Dashboard links can request the exact Settings subsection", async () => {
  const [dashboard, settings] = await Promise.all([
    source("app/dashboard-command-centre.tsx"),
    source("app/settings-panel.tsx"),
  ]);
  assert.match(dashboard, /plotpickle\.settings\.section/);
  assert.match(dashboard, /plotpickle:settings-section/);
  assert.match(settings, /plotpickle\.settings\.section/);
  assert.match(settings, /plotpickle:settings-section/);
});

test("issue #113 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-113-dashboard-command-centre\.test\.mjs/);
  assert.equal(packageJson.scripts["test:dashboard-command-centre"], "node --test tests/issue-113-dashboard-command-centre.test.mjs");
});
