import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("Skin V1 Settings exposes a keyboard directory and connects the approved system destinations", async () => {
  const [dashboard, taxonomyText, cloud, agents] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("config/settings-system-taxonomy.json"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/plotpickle-agents-host.tsx"),
  ]);
  const taxonomy = JSON.parse(taxonomyText);

  assert.deepEqual(
    taxonomy.workspace.filter((item) => item.id !== "sitemap").map((item) => item.label),
    ["General", "Appearance & Accessibility", "Project Defaults"],
  );

  // The older taxonomy still carries Local for legacy callers, while Skin V1
  // now presents Local Story Mode and Node Info as explicit Settings-owned destinations.
  assert.ok(taxonomy.systems.some((system) => system.id === "local"));
  assert.match(dashboard, /\.filter\(\(system\) => system\.id !== "local"\)/u);
  assert.match(dashboard, /id: "local-story-mode"[\s\S]*label: "Local Story Mode"/u);
  assert.match(dashboard, /id: "node-info"[\s\S]*label: "Node Info"/u);
  assert.match(dashboard, /system\.id === "cloud" \? "Cloud Story Mode" : system\.label/u);
  for (const label of ["Data", "Deploy", "Repos", "Auth", "Agents", "Open Source"]) assert.match(taxonomyText, new RegExp(`"label": "${label}"`, "u"));

  assert.match(dashboard, /settingsTaxonomy from "\.\.\/\.\.\/config\/settings-system-taxonomy\.json"/u);
  assert.match(dashboard, /LocalAiSkinHost/u);
  assert.match(dashboard, /NodeSkinPanel/u);
  assert.match(dashboard, /CloudStoryModeHost/u);
  assert.match(dashboard, /PlotPickleAgentsHost/u);
  assert.match(dashboard, /localStoryModeOpen/u);
  assert.match(dashboard, /nodeInfoOpen/u);
  assert.match(dashboard, /cloudStoryModeOpen/u);
  assert.match(dashboard, /plotPickleAgentsOpen/u);
  assert.match(dashboard, /CONNECTED_SETTINGS_ITEMS = new Set\(\["local-story-mode", "node-info", "cloud", "agents"\]\)/u);
  assert.match(dashboard, /data-settings-menu="keyboard-directory"/u);
  assert.match(dashboard, /data-settings-shortcut=\{item\.shortcut\}/u);
  assert.doesNotMatch(dashboard, /\sdisabled=\{!connected\}/u);
  assert.match(dashboard, /event\.key === "ArrowDown"/u);
  assert.match(dashboard, /event\.key === "ArrowUp"/u);
  assert.match(dashboard, /event\.key === "Enter" \|\| event\.key === " "/u);

  assert.match(cloud, /CLOUD STORY MODE/u);
  assert.match(cloud, /USER-OWNED PROVIDERS \/ EXPLICIT PAID ROUTES/u);
  assert.match(cloud, /label: "WRITING"/u);
  assert.match(cloud, /label: "IMAGES"/u);
  assert.match(cloud, /label: "VIDEO"/u);
  assert.match(cloud, /label: "AGENTS"/u);
  assert.match(cloud, /label: "GOOGLE GEMINI"/u);
  assert.doesNotMatch(cloud, /Remote Compute|PlannedRemoteCompute|id: "remote"/u);
  assert.doesNotMatch(cloud, /LegacySettingsPanel|\/api\/local-ai\/connection/u);

  assert.match(agents, /DEFAULT COMPUTE/u);
  assert.match(agents, /PER-AGENT OVERRIDES/u);
  assert.match(agents, /BUZZ identity, rooms, presence, keys and BUZZ runtime settings are not configured here/u);
});

test("Local and Cloud Story Modes use modern provider stores without legacy fallback", async () => {
  const [dashboard, local, cloud, provider, authorityRoute, writingStore, mediaStore, migration] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/cloud-provider-setup-panel.tsx"),
    read("app/api/cloud-story-mode/provider/route.ts"),
    read("build/writing-assistant-store.ts"),
    read("build/media-routing-store.ts"),
    read("docs/architecture/SKIN-V1-STORY-MODE-MIGRATION.md"),
  ]);

  assert.match(dashboard, /id: "local-story-mode"[\s\S]*description: "Local writing, images, video and Agent compute on this computer\."/u);
  assert.match(dashboard, /<section aria-label="Local Story Mode setup"/u);
  assert.match(local, /SETTINGS \/ LOCAL STORY MODE/u);
  assert.match(local, /Back to Local Story Mode/u);
  assert.match(local, /THIS COMPUTER \/ NO CLOUD PROVIDER CHARGES/u);

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
    "Open Source stays separate",
  ]) assert.match(migration, new RegExp(decision, "u"));
  assert.match(migration, /Agents is now connected as a separate PlotPickle Agent compute assignment surface/u);
});
