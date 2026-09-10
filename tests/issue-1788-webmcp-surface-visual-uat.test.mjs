import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const dashboard = read("app/skin-v1/dashboard-bbs-panel.tsx");
const skin = read("app/skin-v1-definition.css");
const audit = read("lib/verification/webmcp-surface-visual-audit.mjs");
const manifest = JSON.parse(read("tests/visual-baselines/skin-v1/manifest.json"));
const visualReadiness = read(".github/workflows/visual-readiness.yml");
const packageJson = read("package.json");

test("Dashboard stays the canonical Skin V1 design reference while every bounded surface gets candidate screenshot evidence", () => {
  assert.match(dashboard, /data-skin-reference="dashboard-canonical"/);
  assert.match(dashboard, /data-skin-reference-panel="standard"/);
  assert.match(dashboard, /data-skin-reference-media="primary"/);
  assert.match(dashboard, /data-skin-reference-type="brand"/);
  assert.match(dashboard, /data-skin-reference-type="meta"/);
  assert.match(dashboard, /data-skin-reference-type="muted"/);
  assert.match(dashboard, /data-skin-reference-state=\{selected \? "selected" : "unselected"\}/);
  assert.match(dashboard, /data-skin-reference-state="status"/);

  assert.equal(manifest.designReference, "dashboard");
  assert.deepEqual(Object.keys(manifest.surfaces), [
    "dashboard",
    "community",
    "settings",
    "cloud-story-mode",
    "agents",
    "profile",
    "local-ai",
    "node",
  ]);
  assert.match(audit, /captureSurfaceCandidate/);
  assert.match(audit, /dashboard-canonical\.png/);
  for (const surface of ["community", "settings", "cloud-story-mode", "agents", "profile", "local-ai", "node"]) {
    assert.match(audit, new RegExp(`captureSurfaceCandidate\\(page, manifest, "${surface}"`));
  }
});

test("WebMCP UAT is bounded to read/navigation tools and keeps authority outside the test adapter", () => {
  for (const name of [
    "get_current_surface",
    "list_available_surfaces",
    "open_surface",
    "go_back",
    "inspect_surface_visual_contract",
  ]) assert.match(audit, new RegExp(`"${name}"`));

  for (const forbidden of ["ppf-write", "canon-mutation", "buzz-publication", "credential-read", "provider-invocation"]) {
    assert.match(audit, new RegExp(`"${forbidden}"`));
  }
  assert.match(audit, /document\.modelContext/);
  assert.match(audit, /getTools\(\)/);
  assert.match(audit, /executeTool/);
  assert.match(audit, /data-dashboard-menu-item='write'/);
  assert.match(audit, /page\.keyboard\.press\("W"\)/);
});

test("non-Dashboard surfaces inherit the same rendered Skin V1 contract", () => {
  for (const token of [
    "--pp-skin-canvas",
    "--pp-skin-accent-deep",
    "--pp-skin-accent",
    "--pp-skin-accent-bright",
    "--pp-skin-selected-bg",
    "--pp-skin-selected-ink",
    "--pp-skin-radius",
    "--pp-skin-font-ui",
    "--pp-skin-font-brand",
    "--pp-skin-media-filter",
  ]) {
    assert.match(skin, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(audit, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(audit, /getComputedStyle/);
  for (const surface of ["community", "settings", "cloud-story-mode", "agents", "profile", "local-ai", "node"]) {
    assert.match(audit, new RegExp(`inspectCurrent\\("${surface}"\\)`));
  }
});

test("locked visual baselines stay repository-owned and Visual Readiness remains manual", () => {
  assert.match(audit, /tests\/visual-baselines\/skin-v1\/manifest\.json/);
  assert.match(audit, /compareLockedBaseline/);
  assert.match(audit, /maxChangedPixelRatio/);
  assert.match(visualReadiness, /workflow_dispatch:/);
  assert.doesNotMatch(visualReadiness, /\bpull_request:/);
  assert.match(visualReadiness, /@mcp-b\/webmcp-polyfill@5\.1\.0/);
  assert.match(visualReadiness, /webmcp-surface-visual-audit\.mjs/);
  assert.match(visualReadiness, /\.artifacts\/visual-readiness\/\*\.png/);
  assert.doesNotMatch(packageJson, /@mcp-b\/webmcp-polyfill/);
});
