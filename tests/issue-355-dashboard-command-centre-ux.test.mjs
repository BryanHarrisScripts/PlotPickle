import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #355 preserves the read-only Dashboard boundary", async () => {
  const [dashboard, setup, registryText] = await Promise.all([
    source("app/dashboard-command-centre.tsx"),
    source("app/setup-connections-dashboard.tsx"),
    source("config/ui-ux-screen-registry.json"),
  ]);
  const registry = JSON.parse(registryText);
  const surface = `${dashboard}\n${setup}`;

  assert.match(registry.dashboardBoundary, /read-only visual status surface/i);
  assert.doesNotMatch(surface, /<(?:input|select|textarea)\b/i);
  assert.doesNotMatch(surface, /type=["']password["']|name=["']apiKey["']|name=["']endpoint["']/i);
  assert.match(setup, /Open the exact Settings section to make changes/);
  assert.match(setup, /onOpenSettings\(row\.settingsSection!\)/);
  assert.match(setup, /aria-label={`Open \$\{row\.label\} settings`}/);
});

test("issue #355 exposes truthful loading and live-check states", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const contract of [
    "buzzChecking",
    "localServicesChecking",
    "setBuzzChecking(true)",
    "setLocalServicesChecking(true)",
    "Checking live connections…",
    "Current saved status remains visible",
    "aria-busy={checkingConnections}",
    'state: localServicesChecking ? "checking" : "disconnected"',
    'status: buzzStatus',
  ]) assert.ok(setup.includes(contract), `Dashboard loading contract is missing: ${contract}`);
  assert.match(setup, /finally \{\s*setBuzzChecking\(false\)/);
  assert.match(setup, /finally \{\s*setLocalServicesChecking\(false\)/);
  assert.match(setup, /role="status" aria-live="polite" aria-atomic="true"/);
});

test("issue #355 supplies semantic navigation, status and workflow progress", async () => {
  const dashboard = await source("app/dashboard-command-centre.tsx");
  assert.match(dashboard, /<nav className=\{styles\.subnav\} aria-labelledby="dashboard-sections-title">/);
  assert.match(dashboard, /<h2 id="dashboard-sections-title">Command centre<\/h2>/);
  assert.match(dashboard, /role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(dashboard, /role="progressbar"/);
  assert.match(dashboard, /aria-valuemin=\{0\}/);
  assert.match(dashboard, /aria-valuemax=\{100\}/);
  assert.match(dashboard, /aria-valuenow=\{workflow\.completion\}/);
  assert.match(dashboard, /aria-valuetext={`\$\{workflow\.completion\}% complete`}/);
  assert.match(dashboard, /<i aria-hidden="true" style=\{\{ width:/);
});

test("issue #355 keeps focus, responsive and alternate-rendering behaviour visible", async () => {
  const [dashboardCss, setupCss] = await Promise.all([
    source("app/dashboard-command-centre.module.css"),
    source("app/setup-connections-dashboard.module.css"),
  ]);
  const css = `${dashboardCss}\n${setupCss}`;
  assert.match(dashboardCss, /min-height:44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:3px solid #4e9f99/);
  assert.match(css, /scroll-margin-top:100px/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
  assert.match(setupCss, /dashboardSummary\[aria-busy="true"\]/);
});

test("issue #355 records Dashboard work and the completed Build audit", async () => {
  const registry = JSON.parse(await source("config/ui-ux-screen-registry.json"));
  const dashboard = registry.screens.find((screen) => screen.id === "dashboard");
  const build = registry.screens.find((screen) => screen.id === "build");
  assert.deepEqual(
    { status: dashboard.status, issue: dashboard.issue, pullRequest: dashboard.pullRequest },
    { status: "audited", issue: 355, pullRequest: 356 },
  );
  assert.deepEqual(
    { status: build.status, issue: build.issue, pullRequest: build.pullRequest },
    { status: "audited", issue: 351, pullRequest: 352 },
  );
});

test("issue #355 documents and enforces the focused Dashboard audit", async () => {
  const [doc, workflow] = await Promise.all([
    source("docs/DASHBOARD-COMMAND-CENTRE-UX.md"),
    source(".github/workflows/ui-ux-dashboard-command-centre.yml"),
  ]);
  for (const phrase of [
    "read-only status and navigation surface",
    "Checking live connections",
    "semantic progress bar",
    "No second Dashboard data store was added",
  ]) assert.ok(doc.includes(phrase), `Dashboard audit documentation is missing: ${phrase}`);
  assert.match(workflow, /name: UI\/UX Dashboard command centre/);
  assert.match(workflow, /Dashboard command-centre contract/);
  assert.match(workflow, /issue-355-dashboard-command-centre-ux\.test\.mjs/);
  assert.match(workflow, /issue-113-dashboard-command-centre\.test\.mjs/);
  assert.match(workflow, /issue-256-setup-connections-dashboard\.test\.mjs/);
});
