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

test("Settings exposes Sitemap as a first-class destination", async () => {
  const [panel, taxonomyText] = await Promise.all([
    source("app/settings-panel.tsx"),
    source("config/settings-system-taxonomy.json"),
  ]);
  const taxonomy = JSON.parse(taxonomyText);
  const sitemap = taxonomy.workspace.find((item) => item.id === "sitemap");

  assert.deepEqual(sitemap, {
    id: "sitemap",
    label: "Sitemap",
    helpTerm: "Sitemap",
    description: "Open every story, collaboration and configuration destination from one map.",
    status: "installed",
    target: "sitemap",
  });
  assert.match(panel, /type PlayhouseView = [^;]*"sitemap"/);
  assert.match(panel, />Sitemap<\/button>/);
  assert.match(panel, /playhouseView === "sitemap"/);
  assert.match(panel, /<SettingsSitemap/);
  assert.match(panel, /plotpickle:navigate-workspace/);
});

test("the Sitemap derives story and collaboration destinations from canonical registries", async () => {
  const [sitemap, direction, support] = await Promise.all([
    source("app/settings-sitemap.tsx"),
    importSource("lib/product-direction.ts"),
    importSource("lib/support-navigation.ts"),
  ]);

  assert.equal(direction.PRIMARY_WORKFLOW_NAVIGATION.length, 10);
  assert.deepEqual(direction.PRIMARY_WORKFLOW_NAVIGATION.map((item) => item.label), [
    "Dashboard", "Learn", "Plan", "Storyboard", "Write", "Graphic Novel", "Build", "Feedback", "Refine", "Reports",
  ]);
  assert.deepEqual(direction.COLLABORATION_NAVIGATION.map((item) => item.label), ["Collab", "Community"]);
  assert.deepEqual(support.SUPPORT_NAVIGATION.map((item) => item.label), ["Suggest / Report"]);
  assert.match(sitemap, /PRIMARY_WORKFLOW_NAVIGATION\.map/);
  assert.match(sitemap, /COLLABORATION_NAVIGATION\.map/);
  assert.match(sitemap, /SUPPORT_NAVIGATION\.map/);
  assert.match(sitemap, /Story workflow/);
  assert.match(sitemap, /Collaboration and product feedback/);
  assert.match(sitemap, /Configuration/);
});

test("every configured Settings item is openable from the map", async () => {
  const [sitemap, taxonomyText] = await Promise.all([
    source("app/settings-sitemap.tsx"),
    source("config/settings-system-taxonomy.json"),
  ]);
  const taxonomy = JSON.parse(taxonomyText);
  const allItems = [
    ...taxonomy.workspace,
    ...taxonomy.systems.flatMap((system) => system.items),
  ];

  assert.ok(allItems.length > 20);
  assert.equal(new Set(allItems.map((item) => item.id)).size, allItems.length);
  assert.match(sitemap, /taxonomy\.workspace\.map/);
  assert.match(sitemap, /taxonomy\.systems\.flatMap/);
  assert.match(sitemap, /onOpenSettingsItem\(item\.id\)/);
  assert.match(sitemap, /Open Settings overview/);
});

test("the Sitemap reports optional integration state without exposing credentials", async () => {
  const sitemap = await source("app/settings-sitemap.tsx");
  for (const boundary of [
    'item.target === "github"',
    'item.target === "ai"',
    'item.target === "google"',
    'item.target === "plugins"',
    'item.target === "buzz"',
    'connections.items[connectionId]',
    "GitHub access required",
  ]) assert.ok(sitemap.includes(boundary), `Sitemap is missing integration boundary: ${boundary}`);
  assert.doesNotMatch(sitemap, /apiKey|accessToken|refreshToken|clientSecret|credentialValue/);
});

test("the Sitemap layout is responsive and the focused test is registered", async () => {
  const [css, packageText] = await Promise.all([
    source("app/settings-sitemap.module.css"),
    source("package.json"),
  ]);
  const packageJson = JSON.parse(packageText);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1100px\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(packageJson.scripts.test, /issue-298-settings-sitemap\.test\.mjs/);
  assert.equal(packageJson.scripts["test:settings-sitemap"], "node --test tests/issue-298-settings-sitemap.test.mjs");
});
