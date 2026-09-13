import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Settings review destinations keep their yellow navigation marker", async () => {
  const [dashboard, reviewPanel] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/settings-review-system-panel.tsx"),
  ]);

  assert.match(reviewPanel, /\["data", "deploy", "repos", "auth"\]/u);
  assert.match(reviewPanel, /export type ReviewSettingsSystemId = "data" \| "deploy" \| "repos" \| "auth"/u);
  assert.match(dashboard, /isReviewSettingsSystemId\(item\.id\)/u);
  assert.match(dashboard, /setSettingsReviewSystem\(item\.id\)/u);
  assert.match(dashboard, /<SettingsReviewSystemPanel systemId=\{settingsReviewSystem\}/u);
  assert.match(dashboard, /data-settings-review=\{review \? "true" : "false"\}/u);
  assert.match(dashboard, /data-dashboard-status="review"/u);
  assert.match(dashboard, /data-settings-review-indicator="review"/u);
  assert.match(dashboard, /borderColor: "var\(--pp-skin-warning\)"/u);
  assert.match(dashboard, /background: "var\(--pp-skin-warning\)"/u);
});

test("DATA uses human language and keeps technical implementation detail behind diagnostics", async () => {
  const reviewPanel = await read("app/skin-v1/settings-review-system-panel.tsx");

  for (const label of [
    "Project Files & Backups",
    "Project Search",
    "Media & Preview Cache",
    "Advanced Data Diagnostics",
  ]) assert.match(reviewPanel, new RegExp(label.replace(/[&]/g, "\\&"), "u"));

  assert.match(reviewPanel, /private search index/u);
  assert.match(reviewPanel, /Canonical project files and user-owned project assets are not disposable cache/u);
  assert.match(reviewPanel, /Open diagnostics details/u);
  assert.match(reviewPanel, /Database migrations are automatic product maintenance/u);

  for (const diagnostic of ["Drizzle ORM", "Drizzle Kit", "Embeddings", "vector stores", "Chroma", "executor/index diagnostics"]) {
    assert.match(reviewPanel, new RegExp(diagnostic.replace(/[/.]/g, "\\$&"), "u"));
  }

  assert.doesNotMatch(reviewPanel, /reviewBadge/u);
  assert.doesNotMatch(reviewPanel, /pp-skin-warning/u);
  assert.doesNotMatch(reviewPanel, /IN REVIEW/u);
});

test("review surfaces remain read-only while showing existing non-DATA taxonomy", async () => {
  const [reviewPanel, taxonomy, dashboard] = await Promise.all([
    read("app/skin-v1/settings-review-system-panel.tsx"),
    read("config/settings-system-taxonomy.json"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  const parsed = JSON.parse(taxonomy);
  for (const id of ["deploy", "repos", "auth"]) {
    const system = parsed.systems.find((entry) => entry.id === id);
    assert.ok(system, `Missing taxonomy system ${id}`);
    assert.ok(system.items.length > 0, `Review surface ${id} has no existing taxonomy items`);
  }

  assert.match(reviewPanel, /settingsTaxonomy\.systems\.find/u);
  assert.doesNotMatch(reviewPanel, /fetch\(|POST|PUT|PATCH|DELETE|onClick=/u);
  assert.match(dashboard, /data-skin-menu-connected=\{connected \? "true" : "false"\}/u);
});

test("review shortcuts select first, then Enter opens the read-only surface", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  for (const [id, shortcut] of [["data", "D"], ["deploy", "E"], ["repos", "R"], ["auth", "U"]]) {
    assert.match(dashboard, new RegExp(`${id}: "${shortcut}"`, "u"));
  }

  assert.match(dashboard, /selectSettingsItem\(shortcutIndex\)/u);
  assert.match(dashboard, /if \(!isReviewSettingsSystemId\(shortcutItem\.id\)\) activateSettingsItem\(shortcutIndex\)/u);
  assert.match(dashboard, /event\.key === "Enter" \|\| event\.key === " "/u);
  assert.match(dashboard, /activateSettingsItem\(index\)/u);
  assert.match(dashboard, /if \(settingsMenuOpen && settingsReviewSystem\)/u);
  assert.match(dashboard, /event\.key === "Escape"[\s\S]*setSettingsReviewSystem\(null\)/u);
  assert.match(dashboard, />Back to Settings<\/button>/u);
});
