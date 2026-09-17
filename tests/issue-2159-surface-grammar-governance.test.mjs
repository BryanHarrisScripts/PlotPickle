import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WEBMCP_STANDARD_SURFACE_REGISTRY } from "../lib/verification/webmcp-surface-capture-registry.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const canonicalPath = "config/skin-v1-surface-registry.json";
const grammarPath = "config/skin-v1-surface-grammar.json";

function mappedContinuityIds(registry) {
  return new Set(registry.surfaces.flatMap((surface) => surface.continuityIds || []));
}

test("#2159 Phase 0 defines one current Skin V1 Matrix Surface Grammar", async () => {
  const [grammar, tokens, sharedChrome, standardShell] = await Promise.all([
    readJson(grammarPath),
    read("app/skin-v1-definition.css"),
    read("app/skin-v1-bbs-surfaces.css"),
    read("app/skin-v1-standard-surface-shell.css"),
  ]);

  assert.equal(grammar.issue, 2159);
  assert.equal(grammar.contractId, "skin-v1-surface-grammar-v1");
  assert.equal(grammar.experienceContractId, "matrix-experience-surface-v1");
  assert.equal(grammar.designSystem, "skin-v1-matrix");
  assert.equal(grammar.referenceSurface, "dashboard");

  assert.deepEqual(grammar.rules.standardHeader, {
    requiredFor: ["directory", "workspace", "nested"],
    selectors: [
      ".pp-skin-v1-bar",
      ".pp-skin-v1-title[data-skin-v1-standard-header='true']",
    ],
    leftText: "PLOTPICKLE",
    centerRole: "surface-name",
    rightText: "SKIN V1",
    minHeightPx: 42,
    duplicateHeadersAllowed: false,
    sourceIssue: 2032,
  });

  assert.equal(grammar.rules.returnAction.selector, ".pp-skin-v1-return");
  assert.equal(grammar.rules.returnAction.placement, "below-standard-header");
  assert.equal(grammar.rules.returnAction.horizontalAlignment, "right");
  assert.equal(grammar.rules.returnAction.cssJustifyContent, "flex-end");
  assert.equal(grammar.rules.shellMeasure.currentMaxPx, 1180);
  assert.equal(grammar.rules.spacing.unitPx, 4);
  assert.equal(grammar.rules.geometry.currentRadiusPx, 0);
  assert.equal(grammar.rules.controls.currentHeightPx, 34);
  assert.equal(grammar.rules.controls.currentTouchTargetPx, 44);
  assert.equal(grammar.rules.screenshotRole.primaryConsistencyAuthority, false);

  assert.match(tokens, /--pp-skin-space-1:\s*4px;/u);
  assert.match(tokens, /--pp-skin-radius:\s*0px;/u);
  assert.match(tokens, /--pp-skin-control-height:\s*34px;/u);
  assert.match(tokens, /--pp-skin-touch-target:\s*44px;/u);
  assert.match(tokens, /--pp-skin-shell-max:\s*1180px;/u);
  assert.match(sharedChrome, /min-height:\s*42px !important;/u);
  assert.match(sharedChrome, /justify-content:\s*flex-end !important;/u);
  assert.match(standardShell, /width:\s*min\(var\(--pp-skin-shell-max\), calc\(100vw - 40px\)\) !important;/u);
});

test("#2159 canonical Surface Registry owns the current census and maps all 26 WebMCP standard surfaces", async () => {
  const registry = await readJson(canonicalPath);
  const ids = registry.surfaces.map((surface) => surface.id);
  const unique = new Set(ids);

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.designSystem, "skin-v1-matrix");
  assert.equal(registry.referenceSurface, "dashboard");
  assert.equal(registry.grammar, grammarPath);
  assert.equal(unique.size, ids.length, "canonical surface ids must be unique");

  const byId = new Map(registry.surfaces.map((surface) => [surface.id, surface]));
  assert.equal(byId.get("dashboard")?.surfaceClass, "reference");
  assert.equal(byId.get("dashboard")?.governance, "reference");

  for (const surface of registry.surfaces) {
    assert.ok(registry.surfaceClasses.includes(surface.surfaceClass), `${surface.id} has unknown surface class`);
    assert.ok(registry.capturePolicies.includes(surface.capturePolicy), `${surface.id} has unknown capture policy`);
    assert.ok(registry.governanceStates.includes(surface.governance), `${surface.id} has unknown governance state`);
    if (surface.parent) assert.ok(byId.has(surface.parent), `${surface.id} has unknown parent ${surface.parent}`);
  }

  const standard = registry.surfaces.filter((surface) => surface.capturePolicy === "standard");
  assert.equal(standard.length, 26, "Phase 0 must preserve the current 26-surface WebMCP standard set");
  const canonicalWebmcpIds = new Set(standard.map((surface) => surface.webmcpId));
  assert.deepEqual(
    [...canonicalWebmcpIds].sort(),
    Object.keys(WEBMCP_STANDARD_SURFACE_REGISTRY).sort(),
    "WebMCP cannot silently gain or lose a standard surface without the canonical census changing",
  );
});

test("#2159 maps every existing UI Continuity route into the canonical census while retiring its stale visual vocabulary", async () => {
  const [registry, legacyContinuity] = await Promise.all([
    readJson(canonicalPath),
    readJson("config/ui-continuity-agent-registry.json"),
  ]);

  assert.equal(legacyContinuity.designSystem, "matte-black-teal-orange", "compatibility fixture changed; Phase 1 should remove this authority rather than bless it");
  assert.equal(registry.compatibilitySources.uiContinuity.authority, "compatibility-until-phase-1");
  assert.equal(registry.compatibilitySources.uiContinuity.path, "config/ui-continuity-agent-registry.json");
  assert.notEqual(registry.designSystem, legacyContinuity.designSystem);

  const mapped = mappedContinuityIds(registry);
  const missing = legacyContinuity.screens.map((screen) => screen.id).filter((id) => !mapped.has(id));
  assert.deepEqual(missing, [], `legacy UI Continuity has unmapped current screens: ${missing.join(", ")}`);
});

test("#2159 explicitly prevents the older bronze/jade screen-maturity registry from becoming current Skin V1 visual authority", async () => {
  const [registry, legacyExperience] = await Promise.all([
    readJson(canonicalPath),
    readJson("app/_components/plotpickle-system/screen-registry.json"),
  ]);

  assert.equal(legacyExperience.designSystem, "bronze-jade-rune");
  assert.equal(registry.compatibilitySources.experienceV2.path, "app/_components/plotpickle-system/screen-registry.json");
  assert.equal(registry.compatibilitySources.experienceV2.authority, "legacy-screen-maturity-only");
  assert.equal(registry.compatibilitySources.experienceV2.currentVisualAuthority, false);
  assert.equal(registry.designSystem, "skin-v1-matrix");
});

test("#2159 census includes the meaningful nested Community states Human review said were missing", async () => {
  const registry = await readJson(canonicalPath);
  const byId = new Map(registry.surfaces.map((surface) => [surface.id, surface]));
  const communityChildren = [
    "community-great-hall",
    "community-story-council",
    "community-wyrmwood-ring",
    "community-marquee",
    "community-story-rooms-directory",
    "community-direct-message",
    "community-private-story-room",
    "community-connected-studios",
    "community-my-presence",
    "community-agents",
  ];

  for (const id of communityChildren) {
    const surface = byId.get(id);
    assert.ok(surface, `${id} missing from canonical census`);
    assert.equal(surface.capturePolicy, "census-only");
    assert.equal(surface.governance, "census");
    assert.ok(surface.evidence, `${id} needs source evidence rather than an invented capture selector`);
  }
  assert.equal(byId.get("community-my-presence")?.parent, "community-connected-studios");
  assert.equal(byId.get("community-direct-message")?.dynamicInstance, true);
});
