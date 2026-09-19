import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadSkinV1SurfaceContracts } from "../lib/verification/skin-v1/surface-contracts.mjs";
import { analyzeRenderedSurfaceContract } from "../lib/verification/skin-v1/rendered-surface-profile.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));

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


test("#2272 defines one JetBrains Mono semantic typography system and complete presentation roles", async () => {
  const [composition, grammar, css, dashboard, { contracts }] = await Promise.all([
    json("config/skin-v1-surface-composition-reference.json"),
    json("config/skin-v1-surface-grammar.json"),
    read("app/skin-v1-definition.css"),
    read("app/skin-v1-dashboard-reference.css"),
    loadSkinV1SurfaceContracts(),
  ]);

  assert.match(composition.typography.uiFont.stack, /JetBrains Mono/u);
  assert.equal(composition.typography.brandFont.stack, composition.typography.uiFont.stack);
  assert.equal(composition.typography.rules.singleFontFamily, true);
  assert.equal(composition.typography.rules.productBrandUsesUiFamily, true);
  assert.match(css, /--pp-skin-font-brand:\s*var\(--pp-skin-font-ui\);/u);
  assert.match(dashboard, /font-family:\s*var\(--pp-skin-font-ui\) !important/u);
  assert.match(dashboard, /font-weight:\s*var\(--pp-skin-weight-bold\) !important/u);
  assert.doesNotMatch(dashboard, /font-weight:\s*900/u);

  for (const role of ["display", "h1", "h2", "h3", "h4", "h5", "h6", "body", "menu", "control", "detail", "note", "status", "keycap"]) {
    assert.ok(composition.typography.semanticRoles[role], role);
    assert.equal(composition.typography.semanticRoles[role].fontToken, "--pp-skin-font-ui", role);
  }

  assert.equal(composition.bordersAndFrames.onePixel.px, 1);
  assert.equal(composition.bordersAndFrames.twoPixel.px, 2);
  assert.equal(composition.bordersAndFrames.threePixelEmphasis.px, 3);
  assert.equal(composition.bordersAndFrames.threePixelEmphasis.structuralShellAllowed, false);
  assert.equal(composition.bordersAndFrames.threePixelEmphasis.fullFrameAllowed, false);
  assert.equal(grammar.borderPolicy.threePixelStructuralFramesAllowed, false);

  for (const role of ["outerFrame", "insetFrame", "primaryPanel", "secondaryPanel", "workingSurface", "pillDefault", "pillSelected", "highlight", "premium"]) {
    assert.ok(composition.palette.semanticRoles[role], role);
  }
  assert.equal(composition.interactionStates.premium.mayReplaceOuterShell, false);
  assert.equal(composition.interactionStates.premium.mayIntroduceNewFont, false);
  assert.equal(composition.interactionStates.premium.mayIntroduceGlowOrGlass, false);

  const profile = contractById(contracts, "profile");
  assert.equal(profile.expected.typography.singleFontFamily, true);
  assert.ok(profile.expected.typography.semanticRoles.h1);
  assert.ok(profile.expected.presentation.frameRoles["premium-emphasis-edge"]);
  assert.ok(profile.expected.presentation.colourRoles.premium);
  assert.equal(profile.expected.presentation.premiumProfile.emphasisPlacement, "edge-only");
});

test("#2272 distinguishes font-family drift from semantic typography hierarchy drift", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const contract = contractById(contracts, "profile");
  const findings = analyzeRenderedSurfaceContract(contract, {
    surface: "PROFILE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [],
    },
    items: [
      {
        typographyRole: "h1",
        typographyRoleSource: "semantic-heading",
        identity: "profile-heading",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "34px",
          fontWeight: "400",
          textTransform: "none",
        },
      },
      {
        typographyRole: "body",
        typographyRoleSource: "html-fallback",
        identity: "profile-body",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "15px",
          fontWeight: "400",
          textTransform: "none",
        },
      },
    ],
  });

  assert.equal(findings.some((item) => item.category === "typography-contract"), false);
  assert.ok(findings.some((item) => item.category === "typography-role-size" && item.identity === "profile-heading"));
  assert.ok(findings.some((item) => item.category === "typography-role-weight" && item.identity === "profile-heading"));
  assert.equal(findings.some((item) => item.category === "typography-role-size" && item.identity === "profile-body"), false);

  const wrongFamily = analyzeRenderedSurfaceContract(contract, {
    surface: "PROFILE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [],
    },
    items: [{
      typographyRole: "h2",
      identity: "rogue-heading",
      presentation: {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        fontWeight: "700",
        textTransform: "none",
      },
    }],
  });
  const family = wrongFamily.find((item) => item.category === "typography-contract");
  assert.ok(family);
  assert.equal(family.proposedSeverity, "blocker");
});


test("#2272 Phase 1B ignores fallback typography classifications but keeps governed semantic roles", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const contract = contractById(contracts, "profile");
  const findings = analyzeRenderedSurfaceContract(contract, {
    surface: "PROFILE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [],
    },
    items: [
      {
        typographyRole: "body",
        typographyRoleSource: "html-fallback",
        identity: "compact-metadata-paragraph",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "11px",
          fontWeight: "700",
          textTransform: "none",
        },
      },
      {
        typographyRole: "control",
        typographyRoleSource: "html-fallback",
        identity: "ordinary-button",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "13px",
          fontWeight: "400",
          textTransform: "none",
        },
      },
      {
        typographyRole: "body",
        typographyRoleSource: "html-fallback",
        identity: "screenplay-editor",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "15px",
          fontWeight: "400",
          textTransform: "none",
        },
      },
      {
        typographyRole: "h2",
        typographyRoleSource: "semantic-heading",
        identity: "real-h2",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "16px",
          fontWeight: "400",
          textTransform: "none",
        },
      },
      {
        typographyRole: "menu",
        typographyRoleSource: "context",
        identity: "governed-tab",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "11px",
          fontWeight: "700",
          textTransform: "none",
        },
      },
      {
        typographyRole: "note",
        typographyRoleSource: "explicit",
        identity: "explicit-helper-note",
        presentation: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "15px",
          fontWeight: "400",
          textTransform: "none",
        },
      },
    ],
  });

  assert.equal(findings.some((item) => item.identity === "compact-metadata-paragraph" && item.category.startsWith("typography-role-")), false);
  assert.equal(findings.some((item) => item.identity === "ordinary-button" && item.category.startsWith("typography-role-")), false);
  assert.equal(findings.some((item) => item.identity === "screenplay-editor" && item.category.startsWith("typography-role-")), false);
  assert.ok(findings.some((item) => item.identity === "real-h2" && item.category === "typography-role-size"));
  assert.ok(findings.some((item) => item.identity === "governed-tab" && item.category === "typography-role-size"));
  assert.ok(findings.some((item) => item.identity === "explicit-helper-note" && item.category === "typography-role-size"));
});

test("#2272 Phase 1B keeps font-family drift blocking regardless of typography role confidence", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const contract = contractById(contracts, "profile");
  const findings = analyzeRenderedSurfaceContract(contract, {
    surface: "PROFILE",
    geometry: {
      gutters: { left: 130, right: 130 },
      edgeViolations: [],
      overlaps: [],
      grids: [],
      primaryGrid: null,
      menus: [],
    },
    items: [{
      typographyRole: "body",
      typographyRoleSource: "html-fallback",
      identity: "fallback-with-rogue-family",
      presentation: {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontWeight: "400",
        textTransform: "none",
      },
    }],
  });
  const family = findings.find((item) => item.category === "typography-contract");
  assert.ok(family);
  assert.equal(family.proposedSeverity, "blocker");
});

test("#2272 Phase 1B leaves confirmed geometry findings untouched", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const findings = analyzeRenderedSurfaceContract(contractById(contracts, "profile"), {
    surface: "PROFILE",
    geometry: {
      gutters: { left: 113, right: 147 },
      edgeViolations: [{ identity: "profile-body", edge: "right", pixels: 17 }],
      overlaps: [{ first: "header", second: "body", width: 26, height: 44 }],
      grids: [],
      primaryGrid: null,
      menus: [],
    },
    items: [],
  });
  assert.ok(findings.some((item) => item.category === "gutter-asymmetry"));
  assert.ok(findings.some((item) => item.category === "frame-overlap" && item.actual === "17px outside root"));
  assert.ok(findings.some((item) => item.category === "structural-overlap" && item.actual === "26px × 44px"));
});


test("#2272 Phase 2 geometry collection ignores intentionally clipped mounted chrome", async () => {
  const source = await read("lib/verification/skin-v1/rendered-surface-profile.mjs");
  assert.match(source, /const intentionallyClipped = clipPath === "inset\(50%\)"/u);
  assert.match(source, /clip === "rect\(0px,0px,0px,0px\)"/u);
  assert.match(source, /&& !intentionallyClipped/u);
  assert.match(source, /node\.getClientRects\(\)\.length > 0/u);
});
