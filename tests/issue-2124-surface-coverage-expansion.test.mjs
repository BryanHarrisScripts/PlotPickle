import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-surface-capture-registry.mjs";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#2124 expands WebMCP through reachable nested Matrix directories", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.deepEqual(
    WEBMCP_STANDARD_SURFACE_REGISTRY["library-new"].navigation.map((step) => step.selector),
    ["[data-dashboard-menu-item='library']", "[data-library-nav='new']"],
  );
  assert.deepEqual(
    WEBMCP_STANDARD_SURFACE_REGISTRY["hybrid-story-mode"].navigation.map((step) => step.selector),
    ["[data-dashboard-menu-item='settings']", "[data-settings-secondary-item='story-mode']", "[data-story-mode-policy='hybrid']"],
  );
  assert.equal(WEBMCP_STANDARD_SURFACE_REGISTRY["shutdown-node"].navigation[0].selector, "[data-dashboard-menu-item='shutdown']");
});

test("#2124 coverage contract distinguishes real captures, wired census surfaces, actions and unwired placeholders", () => {
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly, ["story-bible", "production"]);
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.nonVisualActions, ["logout"]);
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.currentlyUnwired, ["edit", "feedback", "refine", "reports", "wyrmwood", "story"]);
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.library.includes("library-archive"));
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.settings.includes("story-mode"));
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.settings.includes("hybrid-story-mode"));
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.write, ["write"]);
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.previs, ["previs"]);
  assert.deepEqual(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.timeline, ["scene-timeline"]);
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured.storyboard.includes("storyboard"));
});

test("#2124 Visual Director consumes the same complete surface registry", async () => {
  const director = await read("lib/verification/skin-v1-visual-director.mjs");
  assert.match(director, /WEBMCP_STANDARD_SURFACE_TARGETS/u);
  assert.match(director, /WEBMCP_STANDARD_SURFACE_REGISTRY/u);
  assert.match(director, /for \(const surface of SURFACES\.slice\(1\)\)/u);
  assert.match(director, /for \(const step of contract\.navigation\) await visibleClick/u);
  assert.match(director, /surfaces: SURFACES\.length - 1/u);
});
