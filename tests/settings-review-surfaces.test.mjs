import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Data, Deploy, Repos and Auth are the only yellow Settings review surfaces", async () => {
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
  assert.match(dashboard, /var\(--pp-skin-warning\)/u);
});

test("yellow review surfaces render the existing taxonomy without claiming runtime readiness", async () => {
  const [reviewPanel, taxonomy, footer, footerStyles, dashboard] = await Promise.all([
    read("app/skin-v1/settings-review-system-panel.tsx"),
    read("config/settings-system-taxonomy.json"),
    read("app/skin-v1/menu-feedback-footer.tsx"),
    read("app/skin-v1/menu-feedback-footer.module.css"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  const parsed = JSON.parse(taxonomy);
  for (const id of ["data", "deploy", "repos", "auth"]) {
    const system = parsed.systems.find((entry) => entry.id === id);
    assert.ok(system, `Missing taxonomy system ${id}`);
    assert.ok(system.items.length > 0, `Review surface ${id} has no existing taxonomy items`);
  }

  assert.match(reviewPanel, /settingsTaxonomy\.systems\.find/u);
  assert.match(reviewPanel, /REVIEW SURFACE ONLY/u);
  assert.match(reviewPanel, /THEY DO NOT CLAIM THAT THE UNDERLYING CONFIGURATION OR RUNTIME IS FINISHED/u);
  assert.doesNotMatch(reviewPanel, /fetch\(|POST|PUT|PATCH|DELETE|onClick=/u);

  assert.match(dashboard, /data-skin-menu-connected=\{connected \? "true" : "false"\}/u);
  assert.match(dashboard, /data-skin-menu-indicator="unwired"/u);
  assert.match(footer, /YELLOW = IN REVIEW/u);
  assert.match(footerStyles, /legendSquareReview/u);
  assert.match(footerStyles, /var\(--pp-skin-warning\)/u);
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
