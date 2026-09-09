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
const visualReadiness = read(".github/workflows/visual-readiness.yml");
const packageJson = read("package.json");

test("Dashboard is the sole canonical screenshot reference and exposes Skin V1 samples", () => {
  assert.match(dashboard, /data-skin-reference="dashboard-canonical"/);
  assert.match(dashboard, /data-skin-reference-panel="standard"/);
  assert.match(dashboard, /data-skin-reference-media="primary"/);
  assert.match(dashboard, /data-skin-reference-type="brand"/);
  assert.match(dashboard, /data-skin-reference-type="meta"/);
  assert.match(dashboard, /data-skin-reference-type="muted"/);
  assert.match(dashboard, /data-skin-reference-state=\{selected \? "selected" : "unselected"\}/);
  assert.match(dashboard, /data-skin-reference-state="status"/);

  assert.match(audit, /dashboard-canonical\.png/);
  assert.equal((audit.match(/\.screenshot\(/g) || []).length, 1, "only Dashboard may create screenshot evidence");
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
  assert.match(audit, /surface: "community"/);
  assert.match(audit, /surface: "profile"/);
  assert.match(audit, /surface: "local-ai"/);
  assert.match(audit, /surface: "node"/);
});

test("MCP-B remains pinned to the manual Visual Readiness tool root", () => {
  assert.match(visualReadiness, /workflow_dispatch:/);
  assert.doesNotMatch(visualReadiness, /\bpull_request:/);
  assert.match(visualReadiness, /@mcp-b\/webmcp-polyfill@5\.1\.0/);
  assert.match(visualReadiness, /webmcp-surface-visual-audit\.mjs/);
  assert.match(visualReadiness, /dashboard-canonical\.png/);
  assert.doesNotMatch(packageJson, /@mcp-b\/webmcp-polyfill/);
});
