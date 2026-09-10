import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { visualViolations, WEBMCP_SURFACE_READINESS } from "../lib/verification/webmcp-surface-visual-audit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const dashboard = read("app/skin-v1/dashboard-bbs-panel.tsx");
const nodePanel = read("app/skin-v1/node-skin-panel.tsx");
const settingsDirectory = read("app/skin-v1-settings-directory.css");
const layout = read("app/layout.tsx");
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
  for (const entry of Object.values(manifest.surfaces)) assert.equal(entry.status, "candidate");
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

test("all eight visual surfaces have explicit loaded-state contracts before inspection or capture", () => {
  assert.deepEqual(Object.keys(WEBMCP_SURFACE_READINESS), [
    "dashboard",
    "community",
    "settings",
    "cloud-story-mode",
    "agents",
    "profile",
    "local-ai",
    "node",
  ]);
  assert.match(WEBMCP_SURFACE_READINESS.community.selector, /\.pp-skin-v1-community/);
  assert.match(WEBMCP_SURFACE_READINESS["local-ai"].selector, /data-skin-v1-local-ai='true'/);
  assert.match(WEBMCP_SURFACE_READINESS.agents.selector, /data-skin-v1-plotpickle-agents='true'/);
  assert.match(WEBMCP_SURFACE_READINESS.node.selector, /data-node-readiness='ready'/);
  assert.match(nodePanel, /data-node-readiness=\{nodeReadiness\}/);
  assert.match(nodePanel, /node && profile && topology \? "ready" : "loading"/);
  assert.match(audit, /await waitForSurfaceReady\(page, surface\);[\s\S]*inspect_surface_visual_contract/u);
  assert.match(audit, /source: "surface-readiness"/);
});

test("Settings consumes Dashboard directory geometry instead of the legacy three-column row grid", () => {
  assert.match(layout, /import "\.\/skin-v1-settings-directory\.css"/);
  assert.match(settingsDirectory, /\[aria-label="Settings menu"\][\s\S]*width: 100% !important/u);
  assert.match(settingsDirectory, /\.pp-skin-v1-menu-item\.pp-skin-v1-dashboard-row[\s\S]*display: block !important/u);
  assert.match(settingsDirectory, /\.pp-skin-v1-menu\.pp-skin-v1-dashboard-menu[\s\S]*var\(--pp-skin-menu-max\)/u);
  assert.match(settingsDirectory, /\.pp-skin-v1-menu-item\.pp-skin-v1-dashboard-row\.is-selected[\s\S]*var\(--pp-skin-accent-deep\)/u);
});

test("pathologically wrapped Dashboard-style directory rows are deterministic UI-conformance failures", () => {
  const homeFamily = '"Courier New", "Lucida Console", monospace';
  const violations = visualViolations({
    surface: "SETTINGS",
    home: { fontFamily: homeFamily },
    tokens: { "--pp-skin-radius": "0px", "--pp-skin-control-height": "34px" },
    inventory: [{
      semanticRole: "control",
      stableIdentity: "general",
      computedPresentation: {
        tag: "button",
        inputType: "",
        directoryRow: true,
        fontFamily: homeFamily,
        borderRadius: "0px",
        height: "180px",
      },
    }],
  });
  const rowFailure = violations.find((entry) => entry.property === "rowHeight");
  assert.ok(rowFailure);
  assert.equal(rowFailure.stableIdentity, "general");
  assert.equal(rowFailure.source, "layout:directory-row");
  assert.equal(rowFailure.actual, "180px");
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
