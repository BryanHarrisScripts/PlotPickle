import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../lib/verification/webmcp-canonical-surface-registry.mjs";
import { SKIN_V1_SURFACES } from "../lib/verification/skin-v1-surface-registry.mjs";
import {
  buildSurfaceCensusSummary,
  classifyLiveDashboardDestination,
} from "../lib/verification/browser-probes/surface-census.mjs";
import {
  WEBMCP_FULL_QA_ORDER,
  WEBMCP_QA_PROFILE_CONFIG,
} from "../lib/verification/webmcp-qa/profiles.mjs";

const read = (target) => readFile(new URL("../" + target, import.meta.url), "utf8");

test("#2308 makes Surface Census profile 6 and Full QA profile 7", async () => {
  assert.deepEqual(WEBMCP_QA_PROFILE_CONFIG.profiles.map((profile) => profile.id), ["1", "2", "3", "4", "5", "6", "7"]);
  assert.equal(WEBMCP_QA_PROFILE_CONFIG.profiles[5].key, "surface-census");
  assert.equal(WEBMCP_QA_PROFILE_CONFIG.profiles[6].key, "full");
  assert.deepEqual(WEBMCP_FULL_QA_ORDER, ["1", "2", "3", "4", "5", "6"]);

  const [runner, launcher, artifacts] = await Promise.all([
    read("lib/verification/webmcp-qa/runner.mjs"),
    read("Start-PlotPickle.bat"),
    read("lib/verification/webmcp-qa/artifacts.mjs"),
  ]);
  assert.ok(runner.includes("runWebMcpSurfaceCensusProfile"));
  assert.ok(runner.includes('selected.id === "7"'));
  assert.ok(runner.includes("/6 ·"));
  assert.ok(launcher.includes("[6] SURFACE CENSUS"));
  assert.ok(launcher.includes("[7] FULL QA"));
  assert.ok(launcher.includes("choice /C 1234567"));
  assert.ok(artifacts.includes('selectedProfile: "7"'));
  assert.ok(artifacts.includes('orderedProfiles: ["1", "2", "3", "4", "5", "6"]'));
});

test("#2308 reconciles live Dashboard destinations instead of assuming the governed catalogue is complete", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.equal(SKIN_V1_SURFACES.length, 77);
  assert.equal(SKIN_V1_SURFACES.filter((surface) => surface.capturePolicy === "standard").length, 30);
  assert.equal(SKIN_V1_SURFACES.filter((surface) => surface.capturePolicy === "census-only").length, 42);
  assert.equal(SKIN_V1_SURFACES.filter((surface) => surface.capturePolicy === "public-exception").length, 5);

  assert.equal(SKIN_V1_SURFACES.some((surface) => surface.id === "pitch-package"), false);
  assert.ok(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly.includes("pitch-package"));
  assert.equal(classifyLiveDashboardDestination("pitch-package"), "census-only");
  assert.equal(classifyLiveDashboardDestination("pitch-deck"), "currently-unwired");
  assert.equal(classifyLiveDashboardDestination("logout"), "non-visual-action");
  assert.equal(classifyLiveDashboardDestination("settings"), "governed");
  assert.equal(classifyLiveDashboardDestination("unexpected-surface"), "unclassified");
});

test("#2308 separates reconciliation coverage from WebMCP governance coverage", () => {
  const records = [
    { id: "dashboard", source: "canonical-registry", canonicalRegistry: true, capturePolicy: "standard", webmcpGoverned: true, classification: "governed", reachable: true, status: "governed-reachable" },
    { id: "pitch-package", source: "live-dashboard", canonicalRegistry: false, capturePolicy: "census-only", webmcpGoverned: false, classification: "legacy-unclassified", reachable: true, status: "live-unregistered-reachable" },
    { id: "about", source: "canonical-registry", canonicalRegistry: true, capturePolicy: "public-exception", webmcpGoverned: false, classification: "public-exception", reachable: true, status: "public-exception-reachable" },
    { id: "state-only", source: "canonical-registry", canonicalRegistry: true, capturePolicy: "census-only", webmcpGoverned: false, classification: "census-only", reachable: null, status: "declared-state-only" },
  ];
  const dashboard = [
    { id: "pitch-deck", classification: "currently-unwired" },
    { id: "logout", classification: "non-visual-action" },
  ];

  const summary = buildSurfaceCensusSummary(records, dashboard);
  assert.equal(summary.discoveredUserVisibleSurfaces, 4);
  assert.equal(summary.safelyReachableSurfaces, 3);
  assert.deepEqual(summary.missingFromWebMcp, ["pitch-package"]);
  assert.deepEqual(summary.legacyUnclassifiedReachable, ["pitch-package"]);
  assert.deepEqual(summary.skippedUnsafe, ["state-only"]);
  assert.deepEqual(summary.publicExceptions, ["about"]);
  assert.deepEqual(summary.visibleUnwiredDashboardDestinations, ["pitch-deck"]);
  assert.deepEqual(summary.visibleNonVisualDashboardActions, ["logout"]);
  assert.equal(summary.reconciliationCoveragePct, 100);
  assert.equal(summary.governanceCoveragePct, 50);
  assert.equal(summary.coverageComplete, true);
});

test("#2308 census keeps unsafe actions out and records visible Matrix/Skin naming signals", async () => {
  const source = await read("lib/verification/browser-probes/surface-census.mjs");
  assert.ok(source.includes("destructiveActions: false"));
  assert.ok(source.includes("paidGenerationActions: false"));
  assert.ok(source.includes("externalProviderCalls: false"));
  assert.ok(source.includes("shellLabelSignals"));
  assert.ok(source.includes("SAFE_LIVE_EXTRA_IDS"));
  assert.equal(source.includes("data-dashboard-menu-item='logout'"), false);
  assert.equal(source.includes("data-dashboard-menu-item='shutdown'"), false);
});
