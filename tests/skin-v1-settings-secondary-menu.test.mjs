import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Skin V1 keeps the Settings directory incremental and opens only Cloud Story Mode", async () => {
  const [dashboard, taxonomyText, cloud] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("config/settings-system-taxonomy.json"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
  ]);
  const taxonomy = JSON.parse(taxonomyText);

  assert.deepEqual(
    taxonomy.workspace.filter((item) => item.id !== "sitemap").map((item) => item.label),
    ["General", "Appearance & Accessibility", "Project Defaults"],
  );

  // The older taxonomy still carries Local so legacy Settings callers do not
  // break while Skin V1 migrates one surface at a time. The new directory must
  // not expose that obsolete bin.
  assert.ok(taxonomy.systems.some((system) => system.id === "local"));
  assert.match(dashboard, /\.filter\(\(system\) => system\.id !== "local"\)/u);
  assert.match(dashboard, /system\.id === "cloud" \? "Cloud Story Mode" : system\.label/u);
  for (const label of ["Data", "Deploy", "Repos", "Auth", "Agents", "Open Source"]) assert.match(taxonomyText, new RegExp(`"label": "${label}"`, "u"));

  assert.match(dashboard, /settingsTaxonomy from "\.\.\/\.\.\/config\/settings-system-taxonomy\.json"/u);
  assert.match(dashboard, /CloudStoryModeHost/u);
  assert.match(dashboard, /cloudStoryModeOpen/u);
  assert.match(dashboard, /item\.id === "cloud"/u);
  assert.match(dashboard, /disabled=\{!connected\}/u);
  assert.match(dashboard, /setCloudStoryModeOpen\(true\)/u);
  assert.match(dashboard, /data-settings-menu="secondary-only"/u);
  assert.match(dashboard, /CLOUD STORY MODE CONNECTED \/ OTHER SETTINGS SUBMENUS ARE NOT CONNECTED YET/u);

  assert.match(cloud, /CLOUD STORY MODE/u);
  assert.match(cloud, /USER-OWNED PROVIDERS \/ EXPLICIT PAID ROUTES/u);
  assert.match(cloud, /label: "WRITING"/u);
  assert.match(cloud, /label: "IMAGES"/u);
  assert.match(cloud, /label: "VIDEO"/u);
  assert.match(cloud, /<AiRoutingPanel capability="text" locality="cloud"/u);
  assert.match(cloud, /<AiRoutingPanel capability="image" locality="cloud"/u);
  assert.match(cloud, /<AiRoutingPanel capability="video" locality="cloud"/u);
  assert.doesNotMatch(cloud, /LegacySettingsPanel|\/api\/local-ai\/connection/u);
});
