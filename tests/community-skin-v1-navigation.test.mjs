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
  const [skin, host, css, layout] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"), read("app/_components/community/community-skin-host.tsx"),
    read("app/skin-v1.css"), read("app/layout.tsx"),
  ]);
  assert.match(skin, /onClick=\{\(\) => activateDashboardItem\(index\)\}/u);
  assert.match(skin, /id === "community"\) openSurface\("COMMUNITY"\)/u);
  assert.match(skin, /onClick=\{\(\) => openSurface\("DASHBOARD"\)\}/u);
  assert.match(skin, /result.outcome === "accepted"/u);
  assert.match(skin, /returnButtonRef.current\?\.focus\(\)/u);
  assert.match(skin, /dashboardMenuRefs.current\[dashboardSelection\]\?\.focus\(\)/u);
  assert.doesNotMatch(skin, /local-buzz|authenticatedProfileFetch|skin=legacy/u);
  assert.match(host, /<CommunityWorkspace onOpenSettings=/u);
  assert.match(host, /Community identity setup/u);
  assert.match(css, /\.pp-skin-v1-community\s*\{[^}]*filter: grayscale\(1\)/u);
  assert.match(layout, /community-monochrome-skin.css/u);
});
