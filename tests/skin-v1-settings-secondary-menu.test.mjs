import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Skin V1 opens the canonical Settings directory but does not wire tertiary settings screens", async () => {
  const [dashboard, taxonomyText] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("config/settings-system-taxonomy.json"),
  ]);
  const taxonomy = JSON.parse(taxonomyText);

  assert.deepEqual(
    taxonomy.workspace.filter((item) => item.id !== "sitemap").map((item) => item.label),
    ["General", "Appearance & Accessibility", "Project Defaults"],
  );
  assert.deepEqual(
    taxonomy.systems.map((system) => system.label),
    ["Local", "Cloud", "Data", "Deploy", "Repos", "Auth", "Agents", "Open Source"],
  );

  assert.match(dashboard, /settingsTaxonomy from "\.\.\/\.\.\/config\/settings-system-taxonomy\.json"/u);
  assert.match(dashboard, /new Set\(\["community", "settings", "profile"\]\)/u);
  assert.match(dashboard, /item\.id !== "sitemap"/u);
  assert.match(dashboard, /settingsTaxonomy\.systems\.map/u);
  assert.match(dashboard, /items\[index\]\?\.id === "settings"[\s\S]*setSettingsMenuOpen\(true\)/u);
  assert.match(dashboard, /data-settings-menu="secondary-only"/u);
  assert.match(dashboard, /SETTINGS DIRECTORY ONLY \/ SUBMENUS ARE NOT CONNECTED YET/u);
  assert.match(dashboard, /ENTER: OPEN COMMUNITY \/ SETTINGS \/ PROFILE/u);

  const secondaryRows = dashboard.slice(
    dashboard.indexOf("{SETTINGS_MENU.map"),
    dashboard.indexOf('id="settings-menu-status"'),
  );
  assert.match(secondaryRows, /disabled/u);
  assert.match(secondaryRows, /data-settings-secondary-item=\{item\.id\}/u);
  assert.doesNotMatch(secondaryRows, /onClick=/u);
});
