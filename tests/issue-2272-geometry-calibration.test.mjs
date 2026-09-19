import assert from "node:assert/strict";
import test from "node:test";
import { loadSkinV1SurfaceContracts } from "../lib/verification/skin-v1/surface-contracts.mjs";
import { analyzeRenderedSurfaceContract } from "../lib/verification/skin-v1/rendered-surface-profile.mjs";

function contractById(contracts, id) {
  const contract = contracts.find((entry) => entry.surfaceId === id);
  assert.ok(contract, `missing contract ${id}`);
  return contract;
}

test("#2272 calibrates keyboard-prefixed and descriptive menu labels without hiding real missing destinations", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();

  const library = analyzeRenderedSurfaceContract(contractById(contracts, "library"), {
    surface: "LIBRARY",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [{
        identity: "Library menu",
        items: [
          { label: "[N] NEW" },
          { label: "[I] IMPORT" },
          { label: "[L] LOAD (1)" },
          { label: "[E] EXAMPLES" },
          { label: "[P] PRESETS" },
          { label: "[A] AVERY" },
          { label: "[R] ARCHIVE (0)" },
        ],
      }],
    },
    items: [],
  });
  assert.equal(library.some((item) => item.category === "menu-completeness"), false);

  const storyMode = analyzeRenderedSurfaceContract(contractById(contracts, "story-mode"), {
    surface: "STORY_MODE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [{
        identity: "Story Mode directory",
        items: [
          { label: "[L] LOCAL - Local-first Story compute and generation" },
          { label: "[C] CLOUD - Explicit cloud Story connections" },
          { label: "[H] HYBRID - Route across Local and Cloud capabilities" },
        ],
      }],
    },
    items: [],
  });
  assert.equal(storyMode.some((item) => item.category === "menu-completeness"), false);
});

test("#2272 prefers a matching semantic workspace grid and ignores shallow subordinate four-across groups", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();

  const pageflow = analyzeRenderedSurfaceContract(contractById(contracts, "pageflow"), {
    surface: "PAGEFLOW",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "context-grid", columns: 4, rootWidthRatio: 1, rootHeightRatio: 0.06, rect: { width: 1180, height: 176 } },
      grids: [{ identity: "context-grid", columns: 4, rootWidthRatio: 1, rootHeightRatio: 0.06, rect: { width: 1180, height: 176 }, template: "repeat(4, 1fr)" }],
      menus: [],
    },
    items: [],
  });
  assert.equal(pageflow.some((item) => item.category === "column-contract"), false);
  assert.equal(pageflow.some((item) => item.category === "undeclared-four-column-shell"), false);

  const write = analyzeRenderedSurfaceContract(contractById(contracts, "write"), {
    surface: "WRITE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "outer", columns: 1, rootWidthRatio: 1, rootHeightRatio: 1, rect: { width: 1180, height: 1100 } },
      grids: [
        { identity: "outer", columns: 1, rootWidthRatio: 1, rootHeightRatio: 1, rect: { width: 1180, height: 1100 } },
        { identity: "editor-inspector", columns: 2, rootWidthRatio: 0.97, rootHeightRatio: 0.72, rect: { width: 1146, height: 792 } },
      ],
      menus: [],
    },
    items: [],
  });
  assert.equal(write.some((item) => item.category === "column-contract"), false);

  const scene = analyzeRenderedSurfaceContract(contractById(contracts, "scene-timeline"), {
    surface: "SCENE_WORKSPACE",
    geometry: {
      gutters: { left: 112, right: 148 },
      edgeViolations: [],
      overlaps: [],
      primaryGrid: { identity: "outer", columns: 1, rootWidthRatio: 1, rootHeightRatio: 1, rect: { width: 1180, height: 1306 } },
      grids: [
        { identity: "outer", columns: 1, rootWidthRatio: 1, rootHeightRatio: 1, rect: { width: 1180, height: 1306 } },
        { identity: "workspace", columns: 3, rootWidthRatio: 0.97, rootHeightRatio: 0.42, rect: { width: 1146, height: 548 } },
      ],
      menus: [],
    },
    items: [],
  });
  assert.equal(scene.some((item) => item.category === "column-contract"), false);
  assert.ok(scene.some((item) => item.category === "gutter-asymmetry"));
});

test("#2272 calibration never suppresses confirmed frame escapes", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const findings = analyzeRenderedSurfaceContract(contractById(contracts, "profile"), {
    surface: "PROFILE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [{ identity: "profile-body", edge: "right", pixels: 17 }],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [],
    },
    items: [],
  });
  const frame = findings.find((item) => item.category === "frame-overlap");
  assert.ok(frame);
  assert.equal(frame.actual, "17px outside root");
  assert.equal(frame.proposedSeverity, "blocker");
});
