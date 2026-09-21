import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CURRENT_MATRIX_SURFACE_LIFECYCLE,
  isCurrentMatrixSupplementalGoverned,
  lifecycleForSurface,
} from "../lib/verification/current-matrix-surface-lifecycle.mjs";
import { SKIN_V1_SURFACES } from "../lib/verification/skin-v1-surface-registry.mjs";
import { WEBMCP_STANDARD_SURFACE_TARGETS } from "../lib/verification/webmcp-canonical-surface-registry.mjs";
import { buildSurfaceCensusSummary } from "../lib/verification/browser-probes/surface-census.mjs";

const read = (relative) => readFile(new URL("../" + relative, import.meta.url), "utf8");

test("#2310 separates migration inventory from current Matrix governance", () => {
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.length, 30);
  assert.equal(SKIN_V1_SURFACES.length, 80);
  assert.equal(SKIN_V1_SURFACES.filter((surface) => surface.capturePolicy === "census-only").length, 45);
  assert.equal(CURRENT_MATRIX_SURFACE_LIFECYCLE.censusOnlyDefaultLifecycle, "in-transit");
  assert.deepEqual(CURRENT_MATRIX_SURFACE_LIFECYCLE.activeGovernedAdditional, [
    "discovery",
    "story-bible",
    "production",
    "pitch-package",
  ]);
  for (const id of CURRENT_MATRIX_SURFACE_LIFECYCLE.activeGovernedAdditional) {
    assert.equal(isCurrentMatrixSupplementalGoverned(id), true);
  }
  assert.equal(isCurrentMatrixSupplementalGoverned("edit"), false);
});

test("#2310 activation changes an in-transit screen into a governance obligation", () => {
  assert.equal(lifecycleForSurface({
    surfaceId: "edit",
    capturePolicy: "census-only",
    standardGoverned: false,
    currentNavigationReachable: false,
  }), "in-transit");
  assert.equal(lifecycleForSurface({
    surfaceId: "edit",
    capturePolicy: "census-only",
    standardGoverned: false,
    currentNavigationReachable: true,
  }), "active-missing-governance");
});

test("#2310 Package is canonical Matrix inventory without expanding Standard", async () => {
  const pitch = SKIN_V1_SURFACES.find((surface) => surface.id === "pitch-package");
  assert.ok(pitch);
  assert.equal(pitch.capturePolicy, "census-only");
  assert.equal(pitch.orchestrated, true);
  assert.equal(pitch.runtimeRoute, "/pitch-review?scope=pitch&return=dashboard");
  assert.equal(pitch.runtimeSelector, "main[data-pitch-package-workspace='canonical']");
  assert.equal(WEBMCP_STANDARD_SURFACE_TARGETS.includes("pitch-package"), false);

  const page = await read("app/pitch-review/page.tsx");
  assert.ok(page.includes('data-pitch-package-workspace="canonical"'));
  assert.ok(page.includes('data-skin-v1-local-chrome="return-navigation"'));
});

test("#2310 user-facing shared chrome says Matrix", async () => {
  const [client, orchestrator, runtime] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("app/skin-v1-runtime.tsx"),
  ]);
  assert.equal(client.includes("<span>SKIN V1</span>"), false);
  assert.equal(orchestrator.includes("<span>SKIN V1</span>"), false);
  assert.ok(client.includes("<span>MATRIX</span>"));
  assert.ok(orchestrator.includes("<span>MATRIX</span>"));
  assert.ok(runtime.includes('const SKIN_V1 = "skin-v1"'));
});

test("#2310 census does not penalize reachable in-transit inventory", () => {
  const records = [
    {
      id: "dashboard", canonicalRegistry: true, source: "canonical-registry",
      capturePolicy: "standard", webmcpGoverned: true, currentNavigationExpected: true,
      currentMatrixGoverned: true, lifecycle: "active-governed", classification: "governed",
      reachable: true, status: "governed-reachable",
    },
    {
      id: "discovery", canonicalRegistry: true, source: "canonical-registry",
      capturePolicy: "census-only", webmcpGoverned: false, currentNavigationExpected: true,
      currentMatrixGoverned: true, lifecycle: "active-governed", classification: "governed",
      reachable: true, status: "census-only-reachable",
    },
    {
      id: "edit", canonicalRegistry: true, source: "canonical-registry",
      capturePolicy: "census-only", webmcpGoverned: false, currentNavigationExpected: false,
      currentMatrixGoverned: false, lifecycle: "in-transit", classification: "in-transit",
      reachable: true, status: "census-only-reachable",
    },
    {
      id: "about", canonicalRegistry: true, source: "canonical-registry",
      capturePolicy: "public-exception", webmcpGoverned: false, currentNavigationExpected: false,
      currentMatrixGoverned: false, lifecycle: "public-exception", classification: "public-exception",
      reachable: true, status: "public-exception-reachable",
    },
  ];
  const summary = buildSurfaceCensusSummary(records, []);
  assert.equal(summary.inventoriedSurfaces, 4);
  assert.equal(summary.currentNavigationSurfaces, 2);
  assert.equal(summary.activeGovernedSurfaces, 2);
  assert.deepEqual(summary.activeMissingGovernance, []);
  assert.deepEqual(summary.inTransitSurfaces, ["edit"]);
  assert.equal(summary.inventoryReconciliationCoveragePct, 100);
  assert.equal(summary.currentNavigationReconciliationCoveragePct, 100);
  assert.equal(summary.governanceCoveragePct, 100);
  assert.equal(summary.coverageComplete, true);
});

test("#2310 census isolates route probes and catches newly connected ungoverned screens", async () => {
  const source = await read("lib/verification/browser-probes/surface-census.mjs");
  assert.ok(source.includes("const probePage = await context.newPage()"));
  assert.ok(source.includes("await probePage.close()"));
  const summary = buildSurfaceCensusSummary([{
    id: "edit", canonicalRegistry: true, source: "canonical-registry",
    capturePolicy: "census-only", webmcpGoverned: false, currentNavigationExpected: true,
    currentMatrixGoverned: false, lifecycle: "active-missing-governance",
    classification: "active-missing-governance", reachable: true, status: "census-only-reachable",
  }], []);
  assert.deepEqual(summary.activeMissingGovernance, ["edit"]);
  assert.equal(summary.governanceCoveragePct, 0);
  assert.equal(summary.coverageComplete, false);
});
