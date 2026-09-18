import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { WEBMCP_ALLOWED_TARGETS } from "../lib/verification/webmcp-surface-visual-audit.mjs";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";
import { visualBaselineApprovalLines } from "../scripts/run-webmcp-startup-uat.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

const audit = read("lib/verification/webmcp-surface-visual-audit.mjs");
const catalogue = read("lib/verification/webmcp-standard-surface-catalogue.mjs");
const dashboard = read("app/skin-v1/dashboard-bbs-panel.tsx");
const dashboardMenu = read("app/skin-v1/dashboard-menu-registry.ts");
const manifest = JSON.parse(read("tests/visual-baselines/skin-v1/manifest.json"));

test("#1856 keeps the original four-surface conformance audit while #2030/#2124 use the complete reachable catalogue", () => {
  assert.deepEqual(WEBMCP_ALLOWED_TARGETS, [
    "dashboard",
    "community",
    "settings",
    "profile",
  ]);
  assert.match(dashboard, /data-dashboard-menu-item=\{item\.id\}/);
  assert.match(dashboard, /data-settings-secondary-item=\{item\.id\}/);
  assert.match(dashboard, /data-settings-secondary-connected=\{connected \? "true" : "false"\}/);
  assert.match(audit, /section\[aria-label='Settings menu'\]/);
  assert.match(catalogue, /runWebMcpStandardSurfaceCatalogue/u);
});

test("#2124 registers the complete currently reachable Matrix capture tree", () => {
  assert.deepEqual(WEBMCP_STANDARD_SURFACE_TARGETS, [
    "dashboard",
    "community",
    "writers-craft",
    "library",
    "library-new",
    "library-import",
    "library-load",
    "library-examples",
    "library-presets",
    "library-avery",
    "library-archive",
    "story-map",
    "scene-timeline",
    "visual-story",
    "profile",
    "settings",
    "general",
    "story-mode",
    "local-ai",
    "cloud-story-mode",
    "hybrid-story-mode",
    "node",
    "agents",
    "issue-log",
    "licensing",
    "shutdown-node",
    "write",
    "storyboard",
    "previs",
    "pageflow",
  ]);
  assert.equal(Object.keys(manifest.surfaces).length, WEBMCP_STANDARD_SURFACE_TARGETS.length);
  for (const surface of WEBMCP_STANDARD_SURFACE_TARGETS) {
    const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
    const entry = manifest.surfaces[surface];
    assert.ok(entry, `${surface} missing from visual manifest`);
    assert.equal(entry.status, surface === "dashboard" ? "locked" : "candidate");
    assert.equal(entry.selector, contract.rootSelector);
    assert.equal(entry.candidate, contract.candidate);
    assert.equal(entry.baseline, contract.baseline);
    assert.ok(contract.approval.startsWith("#"), `${surface} must retain Human-approval provenance`);
    assert.ok(Array.isArray(contract.navigation), `${surface} must have deterministic navigation metadata`);
    assert.ok(Array.isArray(contract.viewports) && contract.viewports.length >= 1, `${surface} must declare capture viewport requirements`);
  }
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.settings.navigation[0].shortcut, "M");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.profile.navigation[0].shortcut, "I");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["issue-log"].navigation[0].shortcut, "B");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY.licensing.navigation[0].shortcut, "N");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["story-map"].navigation[0].shortcut, "O");
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["visual-story"].navigation[0].shortcut, "S");
  assert.deepEqual(
    WEBMCP_STANDARD_SURFACE_REGISTRY["hybrid-story-mode"].navigation.map((step) => step.selector),
    ["[data-dashboard-menu-item='settings']", "[data-settings-secondary-item='story-mode']", "[data-story-mode-policy='hybrid']"],
  );
  assert.deepEqual(
    WEBMCP_STANDARD_SURFACE_REGISTRY["library-archive"].navigation.map((step) => step.selector),
    ["[data-dashboard-menu-item='library']", "[data-library-nav='archive']"],
  );
  assert.ok(!WEBMCP_STANDARD_SURFACE_TARGETS.includes("advanced"), "Advanced must not return as a fake destination after its content moved into General");
});

test("#2124 classifies every Dashboard destination as captured, non-visual, or currently unwired", () => {
  const dashboardIds = [...dashboardMenu.matchAll(/\{ id: "([^"]+)", shortcut: "[^"]+", label:/gu)].map((match) => match[1]);
  const captured = Object.keys(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured);
  const nonVisual = [...WEBMCP_DASHBOARD_DESTINATION_COVERAGE.nonVisualActions];
  const unwired = [...WEBMCP_DASHBOARD_DESTINATION_COVERAGE.currentlyUnwired];
  const classified = [...captured, ...nonVisual, ...unwired];

  assert.deepEqual([...new Set(classified)].sort(), [...new Set(dashboardIds)].sort());
  assert.equal(classified.length, new Set(classified).size, "Dashboard destinations must have exactly one coverage classification");
  for (const surfaceIds of Object.values(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured)) {
    for (const surface of surfaceIds) assert.ok(WEBMCP_STANDARD_SURFACE_TARGETS.includes(surface), `${surface} must resolve to a registered capture`);
  }
});

test("#2124 startup output exposes all complete-tree captures without automatic approval", () => {
  const output = visualBaselineApprovalLines().join("\n");
  assert.match(output, /^Captured 30 surfaces:/);
  for (const surface of WEBMCP_STANDARD_SURFACE_TARGETS) {
    assert.match(output, new RegExp(`node scripts/lock-skin-visual-baseline\\.mjs ${surface}`, "u"));
  }
  assert.match(output, /library-new \(Library · New\)/u);
  assert.match(output, /story-mode \(Story Mode\)/u);
  assert.match(output, /hybrid-story-mode \(Hybrid Story Mode\)/u);
  assert.match(output, /shutdown-node \(Shut Down Node\)/u);
  assert.match(output, /write \(Write\)/u);
  assert.match(output, /storyboard \(Storyboard\)/u);
  assert.match(output, /previs \(Previs\)/u);
  assert.match(output, /pageflow \(PageFlow\)/u);
  assert.match(output, /none of the screenshots are automatically declared "locked\."/u);
});
