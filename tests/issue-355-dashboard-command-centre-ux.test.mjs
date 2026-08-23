import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #355 preserves the read-only Dashboard boundary", async () => {
  const [dashboard, studio, setup, registryText] = await Promise.all([
    source("app/dashboard-command-centre.tsx"),
    source("app/dashboard-story-library.tsx"),
    source("app/setup-connections-dashboard.tsx"),
    source("config/ui-ux-screen-registry.json"),
  ]);
  const registry = JSON.parse(registryText);
  const surface = `${dashboard}\n${studio}`;

  assert.match(registry.dashboardBoundary, /read-only visual status surface/i);
  assert.doesNotMatch(surface, /<(?:input|select|textarea)\b/i);
  assert.doesNotMatch(surface, /type=["']password["']|name=["']apiKey["']|name=["']endpoint["']/i);
  assert.match(setup, /Open the exact Settings section to make changes/);
});

test("issue #355 retains truthful loading and live-check states in the setup surface", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const contract of [
    "buzzChecking",
    "localServicesChecking",
    "setBuzzChecking(true)",
    "setLocalServicesChecking(true)",
    "Checking live connections…",
    "Current saved status remains visible",
    "aria-busy={checkingConnections}",
  ]) assert.ok(setup.includes(contract), `Setup loading contract is missing: ${contract}`);
});

test("issue #355 supplies semantic Studio Dashboard navigation and story architecture", async () => {
  const [entry, studio] = await Promise.all([
    source("app/dashboard-command-centre.tsx"),
    source("app/dashboard-story-library.tsx"),
  ]);
  assert.match(entry, /<DashboardStoryLibrary/);
  assert.match(studio, /aria-label="PlotPickle Studio Dashboard"/);
  assert.match(studio, /aria-labelledby="story-library-title"/);
  assert.match(studio, /aria-label="Current story context and quick actions"/);
  assert.match(studio, /aria-label="Story overview"/);
  assert.match(studio, /aria-label="PlotPickle workflow"/);
  assert.match(studio, /4 Acts · 24 Blocks · 96 mini-blocks/);
});

test("issue #355 keeps focus and alternate-rendering behaviour available in legacy setup surfaces", async () => {
  const [dashboardCss, setupCss] = await Promise.all([
    source("app/dashboard-command-centre.module.css"),
    source("app/setup-connections-dashboard.module.css"),
  ]);
  const css = `${dashboardCss}\n${setupCss}`;
  assert.match(css, /:focus-visible/);
  assert.match(css, /forced-colors/);
  assert.match(css, /prefers-reduced-motion/);
});

test("issue #355 records Dashboard work and the completed Build audit", async () => {
  const registry = JSON.parse(await source("config/ui-ux-screen-registry.json"));
  const dashboard = registry.screens.find((screen) => screen.id === "dashboard");
  const build = registry.screens.find((screen) => screen.id === "build");
  assert.equal(dashboard.status, "audited");
  assert.equal(build.status, "audited");
});

test("issue #355 Dashboard contracts remain registered in the consolidated Visual gate", async () => {
  const workflow = await source(".github/workflows/visual.yml");
  assert.match(workflow, /name: PlotPickle Visual Gate/);
  assert.match(workflow, /Run deterministic visual contracts/);
  assert.match(workflow, /issue-355-dashboard-command-centre-ux\.test\.mjs/);
  assert.match(workflow, /issue-113-dashboard-command-centre\.test\.mjs/);
  assert.match(workflow, /issue-256-setup-connections-dashboard\.test\.mjs/);
});
