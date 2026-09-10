import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const source = await read("lib/experience/surface-registry.ts");
const registry = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const intent = (surfaceId) => ({ type: "OpenSurface", intentId: "navigation-1", surfaceId, baseRevision: null });

test("Community navigation requires authentication and leaves unmigrated surfaces blocked", () => {
  for (const authenticated of [false, true]) {
    const context = { authenticated };
    assert.equal(registry.executeOpenSurfaceIntent(intent("COMMUNITY"), context).outcome, authenticated ? "accepted" : "rejected");
    assert.equal(registry.executeOpenSurfaceIntent(intent("DASHBOARD"), context).outcome, authenticated ? "accepted" : "rejected");
    assert.equal(registry.executeOpenSurfaceIntent(intent("SETTINGS"), context).outcome, "rejected");
    assert.equal(registry.deriveExperienceSurfaceTopology(context).defaultSurface, authenticated ? "DASHBOARD" : "LOGON");
  }
  assert.equal(registry.executeOpenSurfaceIntent(intent("UNKNOWN"), { authenticated: true }).reason, "UNKNOWN_SURFACE");
  assert.deepEqual(registry.deriveExperienceSurfaceTopology({ authenticated: true }).activeSurfaces, ["DASHBOARD", "COMMUNITY"]);
});

test("Skin V1 activates the existing Community host without importing BUZZ transport", async () => {
  const [skin, dashboard, host, compatibilityCss, communityCss, layout] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/_components/community/community-skin-host.tsx"),
    read("app/skin-v1.css"),
    read("app/community-monochrome-skin.css"),
    read("app/layout.tsx"),
  ]);
  assert.match(skin, /onActivate=\{activateDashboardItem\}/u);
  assert.match(dashboard, /onClick=\{\(\) => activateItem\(index\)\}/u);
  assert.match(dashboard, /function activateItem\(index: number\)[\s\S]*items\[index\]\?\.id === "settings"[\s\S]*setSettingsMenuOpen\(true\)[\s\S]*onActivate\(index\)/u);
  assert.match(skin, /id === "community"\) openSurface\("COMMUNITY"\)/u);
  assert.match(skin, /onClick=\{\(\) => openSurface\("DASHBOARD"\)\}/u);
  assert.match(skin, /result.outcome === "accepted"/u);
  assert.match(skin, /returnButtonRef.current\?\.focus\(\)/u);
  assert.match(skin, /dashboardMenuRefs.current\[dashboardSelection\]\?\.focus\(\)/u);
  assert.doesNotMatch(skin, /local-buzz|authenticatedProfileFetch|skin=legacy/u);
  assert.match(host, /<CommunityWorkspace onOpenSettings=/u);
  assert.match(host, /Community identity setup/u);

  assert.match(compatibilityCss, /\.pp-skin-v1-community\s*\{/u);
  assert.match(communityCss, /filter:\s*none\s*!important/u);
  assert.match(communityCss, /--community-teal:\s*var\(--pp-skin-accent-bright\)/u);
  assert.match(communityCss, /--community-orange:\s*var\(--pp-skin-accent\)/u);
  assert.doesNotMatch(communityCss, /filter:\s*grayscale\(1\)\s*saturate\(0\)/u);
  assert.match(layout, /community-monochrome-skin.css/u);
});

test("Skin V1 Settings keeps all named systems keyboard-visible and connects Cloud Story Mode plus Agents", async () => {
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
  assert.ok(taxonomy.systems.some((system) => system.id === "local"));
  assert.match(dashboard, /\.filter\(\(system\) => system\.id !== "local"\)/u);
  assert.match(dashboard, /system\.id === "cloud" \? "Cloud Story Mode" : system\.label/u);
  assert.match(dashboard, /new Set\(\["community", "settings", "profile"\]\)/u);
  assert.match(dashboard, /data-settings-menu="keyboard-directory"/u);
  assert.match(dashboard, /CONNECTED_SETTINGS_ITEMS = new Set\(\["cloud", "agents"\]\)/u);
  assert.match(dashboard, /setCloudStoryModeOpen\(true\)/u);
  assert.match(dashboard, /setPlotPickleAgentsOpen\(true\)/u);
  assert.doesNotMatch(dashboard, /disabled=\{!connected\}/u);
  assert.match(cloud, /data-skin-v1-cloud-story-mode="true"/u);
  assert.match(cloud, /label: "AGENTS"/u);
  assert.match(agents, /data-skin-v1-plotpickle-agents="true"/u);
  assert.doesNotMatch(cloud, /LegacySettingsPanel|settings-panel-legacy/u);
});
