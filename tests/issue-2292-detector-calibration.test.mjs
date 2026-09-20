import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { analyzeVisualContinuity } from "../lib/verification/skin-v1-visual-director.mjs";
import {
  analyzeRenderedSurfaceContract,
} from "../lib/verification/skin-v1/rendered-surface-profile.mjs";
import { loadSkinV1SurfaceContracts } from "../lib/verification/skin-v1/surface-contracts.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function contractById(contracts, id) {
  const contract = contracts.find((entry) => entry.surfaceId === id);
  assert.ok(contract, `missing contract ${id}`);
  return contract;
}

function item(role, identity, overrides = {}) {
  return {
    role,
    identity,
    presentation: {
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: "15px",
      fontWeight: "400",
      lineHeight: "20px",
      color: "rgb(244, 244, 244)",
      backgroundColor: "rgb(18, 18, 18)",
      backgroundImage: "none",
      borderRadius: "0px",
      borderTopWidth: "1px",
      borderRightWidth: "1px",
      borderBottomWidth: "1px",
      borderLeftWidth: "1px",
      borderTopColor: "rgb(239, 239, 239)",
      paddingTop: "8px",
      paddingRight: "12px",
      paddingBottom: "8px",
      paddingLeft: "12px",
      width: "800px",
      height: "34px",
      ...overrides,
    },
  };
}

function dashboardProfile() {
  return {
    surface: "DASHBOARD",
    root: { fontFamily: '"JetBrains Mono", monospace', width: "1000px" },
    tokens: {
      "--pp-skin-radius": "0px",
      "--pp-skin-border-strong": "2px",
    },
    resolvedColors: {
      "--pp-skin-ink": "rgb(244, 244, 244)",
      "--pp-skin-surface-2": "rgb(18, 18, 18)",
      "--pp-skin-line-strong": "rgb(239, 239, 239)",
    },
    items: [
      item("heading", "dashboard-title", { fontSize: "20px" }),
      item("panel", "dashboard-panel", { backgroundImage: "linear-gradient(rgb(24, 24, 24), rgb(18, 18, 18))" }),
      item("control", "dashboard-row", { height: "34px" }),
    ],
  };
}

test("#2292 menu completeness follows the surface that owns visible navigation, not every registered descendant", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const storyboard = contractById(contracts, "storyboard");
  const storyMode = contractById(contracts, "story-mode");
  const library = contractById(contracts, "library");

  assert.deepEqual(storyboard.expected.menu.expectedVisibleLabels, []);
  assert.equal(storyboard.expected.menu.visibilityScope, "inherited-owner");
  assert.deepEqual(storyMode.expected.menu.expectedVisibleLabels, ["Local", "Cloud", "Hybrid"]);
  assert.equal(storyMode.expected.menu.visibilityScope, "owned-direct-children");
  assert.deepEqual(library.expected.menu.expectedVisibleLabels, ["New", "Import", "Load", "Examples", "Presets", "Avery", "Archive"]);
});

test("#2292 nested content grids cannot masquerade as one-column shell geometry", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const libraryImport = contractById(contracts, "library-import");
  const licensing = contractById(contracts, "licensing");

  const nestedImport = analyzeRenderedSurfaceContract(libraryImport, {
    surface: "LIBRARY_IMPORT",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "import-actions", columns: 2, rootDepth: 2, rootWidthRatio: 0.97, rootHeightRatio: 0.41, rect: { width: 1146, height: 96 } },
      grids: [{ identity: "import-actions", columns: 2, rootDepth: 2, rootWidthRatio: 0.97, rootHeightRatio: 0.41, rect: { width: 1146, height: 96 }, template: "386px 718px" }],
      menus: [],
    },
    items: [],
  });
  assert.equal(nestedImport.some((finding) => finding.category === "column-contract"), false);

  const nestedLicensing = analyzeRenderedSurfaceContract(licensing, {
    surface: "LICENSING",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "notice-cards", columns: 3, rootDepth: 2, rootWidthRatio: 0.93, rootHeightRatio: 0.62, rect: { width: 1098, height: 701 } },
      grids: [{ identity: "notice-cards", columns: 3, rootDepth: 2, rootWidthRatio: 0.93, rootHeightRatio: 0.62, rect: { width: 1098, height: 701 }, template: "358px 358px 358px" }],
      menus: [],
    },
    items: [],
  });
  assert.equal(nestedLicensing.some((finding) => finding.category === "column-contract"), false);

  const realShellDrift = analyzeRenderedSurfaceContract(libraryImport, {
    surface: "LIBRARY_IMPORT",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "shell-grid", columns: 2, rootDepth: 1, rootWidthRatio: 0.97, rootHeightRatio: 0.75, rect: { width: 1146, height: 600 } },
      grids: [{ identity: "shell-grid", columns: 2, rootDepth: 1, rootWidthRatio: 0.97, rootHeightRatio: 0.75, rect: { width: 1146, height: 600 }, template: "1fr 1fr" }],
      menus: [],
    },
    items: [],
  });
  assert.ok(realShellDrift.some((finding) => finding.category === "column-contract"));
});

test("#2292 subordinate four-across card grids remain valid while shell-level four columns are still detected", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const avery = contractById(contracts, "library-avery");
  const previs = contractById(contracts, "previs");

  for (const contract of [avery, previs]) {
    const subordinate = analyzeRenderedSurfaceContract(contract, {
      surface: contract.surfaceId.toUpperCase(),
      geometry: {
        gutters: { left: 130, right: 130 },
        edgeViolations: [],
        overlaps: [],
        primaryGrid: { identity: "four-across-cards", columns: 4, rootDepth: 2, rootWidthRatio: 0.95, rootHeightRatio: 0.43, rect: { width: 1120, height: 465 } },
        grids: [{ identity: "four-across-cards", columns: 4, rootDepth: 2, rootWidthRatio: 0.95, rootHeightRatio: 0.43, rect: { width: 1120, height: 465 }, template: "repeat(4, 1fr)" }],
        menus: [],
      },
      items: [],
    });
    assert.equal(subordinate.some((finding) => finding.category === "undeclared-four-column-shell"), false, contract.surfaceId);
  }

  const shell = analyzeRenderedSurfaceContract(avery, {
    surface: "LIBRARY_AVERY",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "shell-grid", columns: 4, rootDepth: 1, rootWidthRatio: 0.95, rootHeightRatio: 0.43, rect: { width: 1120, height: 465 } },
      grids: [{ identity: "shell-grid", columns: 4, rootDepth: 1, rootWidthRatio: 0.95, rootHeightRatio: 0.43, rect: { width: 1120, height: 465 }, template: "repeat(4, 1fr)" }],
      menus: [],
    },
    items: [],
  });
  assert.ok(shell.some((finding) => finding.category === "undeclared-four-column-shell"));
});

test("#2292 project workspaces do not inherit Dashboard mixed control-density or global padding cadence", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const storyMap = contractById(contracts, "story-map");
  const general = contractById(contracts, "general");

  assert.equal(storyMap.expected.measurement.controlDensityProfile, "semantic-workspace-controls");
  assert.equal(storyMap.expected.measurement.spacingRhythmScope, "semantic-workspace");
  assert.equal(general.expected.measurement.controlDensityProfile, "dashboard-compact-controls");
  assert.equal(general.expected.measurement.spacingRhythmScope, "dashboard-four-pixel");

  const candidate = {
    surface: "STORY_MAP",
    root: { fontFamily: '"JetBrains Mono", monospace', width: "1000px" },
    tokens: {},
    resolvedColors: {},
    items: [
      item("heading", "story-map-title", { fontSize: "20px" }),
      item("control", "story-card", { height: "108px", paddingTop: "9px", paddingRight: "9px", paddingBottom: "9px", paddingLeft: "9px" }),
    ],
  };
  const workspaceFindings = analyzeVisualContinuity(dashboardProfile(), candidate, [], storyMap);
  assert.equal(workspaceFindings.some((finding) => finding.category === "control-density"), false);
  assert.equal(workspaceFindings.some((finding) => finding.category === "spacing-rhythm"), false);

  const standardCandidate = { ...candidate, surface: "GENERAL" };
  const standardFindings = analyzeVisualContinuity(dashboardProfile(), standardCandidate, [], general);
  assert.ok(standardFindings.some((finding) => finding.category === "control-density"));
  assert.ok(standardFindings.some((finding) => finding.category === "spacing-rhythm"));
});

test("#2292 rendered evidence records grid depth and Visual Director settles CSS transitions before capture", async () => {
  const [profileSource, directorSource] = await Promise.all([
    read("lib/verification/skin-v1/rendered-surface-profile.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
  ]);

  assert.match(profileSource, /rootDepth:\s*rootDepth\(node\)/u);
  assert.match(profileSource, /transitionDuration:\s*style\.transitionDuration/u);
  assert.match(directorSource, /async function settleSurfacePresentation/u);
  assert.match(directorSource, /style\.transitionDuration/u);
  assert.match(directorSource, /Math\.min\(cap/u);
  assert.match(directorSource, /await settleSurfacePresentation\(page, contract\.rootSelector\)/u);
});
