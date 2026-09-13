import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Settings consolidates reviewed technical bins into one yellow Advanced destination", async () => {
  const [dashboard, reviewPanel] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/settings-review-system-panel.tsx"),
  ]);

  assert.match(reviewPanel, /export type ReviewSettingsSystemId = "advanced"/u);
  assert.match(reviewPanel, /REVIEW_SETTINGS_SYSTEM_IDS = \["advanced"\]/u);
  assert.match(dashboard, /advanced: "V"/u);
  assert.match(dashboard, /id: "advanced"[\s\S]*label: "Advanced"/u);
  assert.match(dashboard, /isReviewSettingsSystemId\(item\.id\)/u);
  assert.match(dashboard, /data-dashboard-status="review"/u);
  assert.match(dashboard, /data-settings-review-indicator="review"/u);
  assert.match(dashboard, /borderColor: "var\(--pp-skin-warning\)"/u);
  assert.match(dashboard, /background: "var\(--pp-skin-warning\)"/u);

  for (const retired of ["id: \"data\"", "id: \"deploy\"", "id: \"repos\"", "id: \"auth\"", "id: \"open-source\""]) {
    assert.doesNotMatch(dashboard, new RegExp(retired, "u"));
  }
});

test("Advanced keeps only useful survivors from DATA DEPLOY REPOS and AUTH", async () => {
  const reviewPanel = await read("app/skin-v1/settings-review-system-panel.tsx");

  for (const label of [
    "Project Data &amp; Recovery",
    "Tools &amp; MCP",
    "PlotPickle Source",
    "Technical Diagnostics",
  ]) assert.match(reviewPanel, new RegExp(label.replace(/[&]/g, "\\&"), "u"));

  assert.match(reviewPanel, /Project Files &amp; Backups/u);
  assert.match(reviewPanel, /Example Project Recovery/u);
  assert.match(reviewPanel, /preserve the pristine Afterglow example/u);
  assert.match(reviewPanel, /Make My Own Copy/u);
  assert.match(reviewPanel, /Project Search/u);
  assert.match(reviewPanel, /Media &amp; Preview Cache/u);
  assert.match(reviewPanel, /MCP server definitions/u);
  assert.match(reviewPanel, /MCP client-host/u);
  assert.match(reviewPanel, /Open PlotPickle source repository/u);
  assert.match(reviewPanel, /Build\/runtime compatibility/u);
  assert.match(reviewPanel, /Credential-storage protection/u);
  assert.match(reviewPanel, /Provider API keys stay in Local Story Mode or Cloud Story Mode/u);
  assert.match(reviewPanel, /DEPLOY does not expose an ordinary Settings control/u);
});

test("Advanced keeps technical details subordinate and protects Human project canon", async () => {
  const reviewPanel = await read("app/skin-v1/settings-review-system-panel.tsx");

  assert.match(reviewPanel, /Original project files, Human-created story material and user-owned assets are never disposable cache/u);
  assert.match(reviewPanel, /Open diagnostics details/u);
  for (const diagnostic of ["Drizzle ORM", "Drizzle Kit", "Embeddings", "vector stores", "Chroma", "edge-hosting evidence"]) {
    assert.match(reviewPanel, new RegExp(diagnostic.replace(/[/.]/g, "\\$&"), "u"));
  }
  assert.doesNotMatch(reviewPanel, /Clear Cache|Rebuild Index|Delete Cache/u);
  assert.doesNotMatch(reviewPanel, /pp-skin-warning/u);
  assert.doesNotMatch(reviewPanel, /IN REVIEW/u);
});

test("opened Advanced surface stays monochrome while review state remains navigation-only", async () => {
  const [dashboard, reviewPanel, reviewStyles] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/settings-review-system-panel.tsx"),
    read("app/skin-v1/settings-review-system-panel.module.css"),
  ]);

  assert.match(reviewPanel, /settings-review-system-panel\.module\.css/u);
  assert.doesNotMatch(reviewStyles, /pp-skin-warning/u);
  assert.doesNotMatch(dashboard, /settingsReviewSystem\.toUpperCase\(\)\} · IN REVIEW/u);
  assert.match(dashboard, /<h1>\{settingsReviewSystem\.toUpperCase\(\)\}<\/h1>/u);
});

test("Advanced shortcut selects first and Enter opens the active review surface", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  assert.match(dashboard, /advanced: "V"/u);
  assert.match(dashboard, /selectSettingsItem\(shortcutIndex\)/u);
  assert.match(dashboard, /if \(!isReviewSettingsSystemId\(shortcutItem\.id\)\) activateSettingsItem\(shortcutIndex\)/u);
  assert.match(dashboard, /event\.key === "Enter" \|\| event\.key === " "/u);
  assert.match(dashboard, /activateSettingsItem\(index\)/u);
  assert.match(dashboard, /if \(settingsMenuOpen && settingsReviewSystem\)/u);
  assert.match(dashboard, /event\.key === "Escape"[\s\S]*setSettingsReviewSystem\(null\)/u);
  assert.match(dashboard, />Back to Settings<\/button>/u);
});

test("Open Source leaves Settings and becomes a connected Dashboard licensing destination", async () => {
  const [skin, dashboard, legal, ownershipText] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/legal/page.tsx"),
    read("config/verification/ownership-map.json"),
  ]);
  const ownership = JSON.parse(ownershipText);
  const productIdentity = ownership.rules.find((rule) => rule.id === "product-identity-surfaces");

  assert.match(skin, /id: "profile"[\s\S]*id: "open-source"[\s\S]*id: "learn"/u);
  assert.match(skin, /id: "open-source", shortcut: "N", label: "Open Source"/u);
  assert.match(skin, /item\.id === "open-source"[\s\S]*location\.assign\("\/legal"\)/u);
  assert.match(dashboard, /CONNECTED_DASHBOARD_ITEMS = new Set\(\["community", "settings", "profile", "open-source", "logout", "learn"\]\)/u);
  assert.match(legal, /GNU Affero General Public License/u);
  assert.match(legal, /Creative Commons Attribution-ShareAlike 4\.0 International/u);
  assert.match(legal, /href="\/" className=\{styles\.backLink\}>← Back to Dashboard/u);
  assert.ok(productIdentity, "product identity ownership rule must exist");
  assert.equal(productIdentity.ownerLayer, "experience-skins");
  assert.ok(productIdentity.include.includes("app/legal/**"), "legal/licensing surface must be mapped to Experience ownership");
});
