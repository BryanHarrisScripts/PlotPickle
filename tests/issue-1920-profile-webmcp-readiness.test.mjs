import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1920 verification follows the direct User Profile surface", async () => {
  const [webmcp, director, manifestSource, profile] = await Promise.all([
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("tests/visual-baselines/skin-v1/manifest.json"),
    read("app/skin-v1/profile-skin-panel.tsx"),
  ]);
  const manifest = JSON.parse(manifestSource);
  const directProfile = "section[aria-label='User Profile'].pp-skin-v1-profile-surface";

  assert.match(profile, /className="pp-skin-v1-profile-surface" aria-label="User Profile"/u);
  assert.ok(webmcp.includes(`selector: "${directProfile}"`));
  assert.ok(webmcp.includes(`document.querySelector("${directProfile}")`));
  assert.ok(director.includes(`profile: "${directProfile}"`));
  assert.equal(manifest.surfaces.profile.selector, directProfile);

  for (const source of [webmcp, director, manifestSource]) {
    assert.doesNotMatch(source, /section\[aria-label=['"]Profile menu['"]\]/u);
  }
});

test("#1920 WebMCP and Visual Director keep Local Story Mode and Node under Settings", async () => {
  const [webmcp, director, dashboard] = await Promise.all([
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(dashboard, /CONNECTED_SETTINGS_ITEMS = new Set\(\["local-story-mode", "node-info", "cloud", "agents"\]\)/u);

  assert.match(webmcp, /normalized === "local-ai"[\s\S]*currentSurface\(\) !== "SETTINGS"[\s\S]*data-settings-secondary-item='local-story-mode'/u);
  assert.match(webmcp, /normalized === "node"[\s\S]*currentSurface\(\) !== "SETTINGS"[\s\S]*data-settings-secondary-item='node-info'/u);
  assert.match(webmcp, /settingsAvailable\.settings\.some\(\(item\) => item\.id === "local-story-mode" && item\.connected\)/u);
  assert.match(webmcp, /settingsAvailable\.settings\.some\(\(item\) => item\.id === "node-info" && item\.connected\)/u);

  assert.match(director, /\["local-ai", "node"\][\s\S]*data-dashboard-menu-item='settings'[\s\S]*data-settings-secondary-item='\$\{surface === "local-ai" \? "local-story-mode" : "node-info"\}'/u);
  assert.doesNotMatch(director, /\["local-ai", "node"\][\s\S]*data-dashboard-menu-item='profile'/u);
});

test("#1920 live WebMCP traversal returns from direct Profile before opening Settings-owned surfaces", async () => {
  const webmcp = await read("lib/verification/webmcp-surface-visual-audit.mjs");
  const profileCapture = webmcp.indexOf('captureSurfaceCandidate(page, manifest, "profile", failures)');
  const localOpen = webmcp.indexOf('executeTool(page, "open_surface", { surface: "local-ai" })');
  const nodeOpen = webmcp.indexOf('executeTool(page, "open_surface", { surface: "node" })');

  assert.ok(profileCapture >= 0 && localOpen > profileCapture && nodeOpen > localOpen);
  const betweenProfileAndLocal = webmcp.slice(profileCapture, localOpen);
  assert.match(betweenProfileAndLocal, /open_surface", \{ surface: "settings" \}/u);
  assert.match(betweenProfileAndLocal, /waitForSurfaceReady\(page, "settings"\)/u);

  const betweenLocalAndNode = webmcp.slice(localOpen, nodeOpen);
  assert.match(betweenLocalAndNode, /waitForSurfaceReady\(page, "settings"\)/u);
});
