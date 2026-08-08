import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function importSource(path) {
  const compiled = stripTypeScriptTypes(await source(path), { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled, "utf8").toString("base64")}`);
}

test("application shell preserves the canonical workspace and project-action registries", async () => {
  const [shell, direction] = await Promise.all([
    source("app/application-shell-header.tsx"),
    importSource("lib/product-direction.ts"),
  ]);

  assert.deepEqual(direction.PRIMARY_WORKFLOW_NAVIGATION.map((item) => item.label), [
    "Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports",
  ]);
  assert.deepEqual(direction.COLLABORATION_NAVIGATION.map((item) => item.label), ["Collab", "Community"]);
  assert.deepEqual(direction.PROJECT_ACTIONS.map((item) => item.label), ["New Project", "Import", "Export", "Load Example"]);
  assert.match(shell, /PRODUCT_NAVIGATION\.filter\(\(item\) => item\.zone === "discovery"\)/);
  assert.match(shell, /PRODUCT_NAVIGATION\.filter\(\(item\) => item\.zone === "production"\)/);
  assert.match(shell, /PRODUCT_NAVIGATION\.filter\(\(item\) => item\.zone === "collaboration"\)/);
  assert.match(shell, /PROJECT_ACTIONS\.map/);
});

test("workspace navigation uses link-like current-page semantics instead of disconnected ARIA tabs", async () => {
  const shell = await source("app/application-shell-header.tsx");

  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shell, /data-workspace-active=\{active \? "true" : "false"\}/);
  assert.doesNotMatch(shell, /<button[\s\S]{0,240}role="tab"/);
  assert.doesNotMatch(shell, /role="tablist"/);
  assert.doesNotMatch(shell, /aria-selected=\{activeTab === id\}/);
  assert.match(shell, /aria-label="Story workflow"/);
  assert.match(shell, /aria-label="Discovery and pre-production"/);
  assert.match(shell, /aria-label="Production and polishing"/);
  assert.match(shell, /aria-label="Collaboration"/);
  assert.match(shell, /aria-label="Support and application configuration"/);
});

test("project actions remain a distinct labelled control group", async () => {
  const shell = await source("app/application-shell-header.tsx");

  assert.match(shell, /className="shell-zone-project-actions" role="group" aria-label="Project actions"/);
  assert.match(shell, /data-project-action=\{action\.id\}/);
  assert.match(shell, /action\.id === "load-afterglow" \? "Load Example" : action\.label/);
  assert.match(shell, /Open the PlotPickle marketing page/);
});

test("shell controls meet touch, focus, overflow and safe-area requirements", async () => {
  const css = await source("app/minimal-navigation.css");

  for (const contract of [
    "--shell-text-muted",
    "--shell-text-active",
    "--shell-accent",
    "--shell-focus-ring",
    "min-width: 44px",
    "min-height: 44px",
    "overscroll-behavior-inline: contain",
    "scroll-padding-inline",
    "env(safe-area-inset-left)",
    "env(safe-area-inset-right)",
    "touch-action: manipulation",
    "outline: 3px solid var(--shell-focus-ring)",
    "@media (prefers-reduced-motion: reduce)",
  ]) assert.ok(css.includes(contract), `Shell CSS is missing: ${contract}`);

  assert.match(css, /overflow-x: auto/);
  assert.match(css, /overflow-y: hidden/);
  assert.match(css, /\.shell-zone-configuration a/);
});

test("packaged Windows smoke compatibility is clipped and excluded from the accessibility tree", async () => {
  const [shell, css] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/minimal-navigation.css"),
  ]);

  assert.match(shell, /className="shell-release-smoke-active"/);
  assert.match(shell, /aria-hidden="true"/);
  assert.match(shell, /data-release-smoke-active-workspace=\{activeTab\}/);
  assert.match(css, /\.shell-release-smoke-active[\s\S]*clip-path: inset\(50%\)/);
});
