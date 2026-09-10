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

test("Local and Cloud Story Modes use modern provider stores without legacy fallback", async () => {
  const [skin, local, cloud, provider, authorityRoute, writingStore, mediaStore, migration] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/cloud-provider-setup-panel.tsx"),
    read("app/api/cloud-story-mode/provider/route.ts"),
    read("build/writing-assistant-store.ts"),
    read("build/media-routing-store.ts"),
    read("docs/architecture/SKIN-V1-STORY-MODE-MIGRATION.md"),
  ]);

  assert.match(skin, /label: "LOCAL STORY MODE", description: "LOCAL WRITING \/ IMAGES \/ VIDEO"/u);
  assert.match(skin, /aria-label="Local Story Mode setup"/u);
  assert.match(local, /PROFILE \/ LOCAL STORY MODE/u);
  assert.match(local, /BACK TO LOCAL STORY MODE/u);
  assert.match(local, /Local Story Mode defaults to local, hardware-aware AI/u);

  for (const source of [cloud, provider, authorityRoute]) assert.doesNotMatch(source, /LegacySettingsPanel|settings-panel-legacy|\/api\/local-ai\/connection/u);
  assert.match(provider, /\/api\/cloud-story-mode\/provider/u);
  assert.match(provider, /\/api\/writing-assistant\/test/u);
  assert.match(provider, /\/api\/media-routing\/test\/image/u);
  assert.match(provider, /X-PlotPickle-CSRF/u);
  assert.match(provider, /may incur provider charges/u);
  assert.match(authorityRoute, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(authorityRoute, /writeAssistantStore/u);
  assert.match(authorityRoute, /writeMediaRoutingStore/u);
  assert.match(authorityRoute, /No paid provider request was run and no route was activated/u);

  assert.match(writingStore, /migration input only/u);
  assert.match(writingStore, /imported && !store\.profiles\[imported\.provider\]/u);
  assert.match(mediaStore, /migration input only/u);
  assert.match(mediaStore, /imported && !next\.profiles\[imported\.provider\]/u);

  for (const decision of [
    "Data stays separate",
    "Deploy stays separate",
    "Repos stays separate",
    "Auth stays separate",
    "Agents stays separate",
    "Open Source stays separate",
  ]) assert.match(migration, new RegExp(decision, "u"));
  assert.match(migration, /Only one new Settings system is opened at a time/u);
});
