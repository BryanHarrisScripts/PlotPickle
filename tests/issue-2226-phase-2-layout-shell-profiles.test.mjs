import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalSurface, canonicalWebMcpSurfaceIds } from "../lib/verification/skin-v1-surface-registry.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2226 Phase 2 defines only census-proven shell-level layout archetypes", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  assert.equal(grammar.profileContract.issue, 2226);
  assert.equal(grammar.profileContract.phase, 2);
  assert.equal(grammar.profileContract.shellLevelFourColumnArchetype, false);
  assert.deepEqual(Object.keys(grammar.layoutArchetypes), [
    "one-column",
    "two-column",
    "three-column",
    "directory-grid",
    "editor-inspector",
    "timeline-workspace",
    "canvas-visual-workspace",
    "settings-directory",
  ]);
  assert.equal(Object.keys(grammar.layoutArchetypes).some((id) => id.includes("four-column")), false);
});

test("#2226 Phase 2 gives every governed standard surface a valid layout and format profile", async () => {
  const [grammar, registry] = await Promise.all([
    readJson("config/skin-v1-surface-grammar.json"),
    readJson("config/skin-v1-surface-registry.json"),
  ]);
  const standard = registry.surfaces.filter((surface) => surface.capturePolicy === "standard");
  assert.equal(standard.length, 30);
  assert.deepEqual(standard.map((surface) => surface.webmcpId).sort(), [...canonicalWebMcpSurfaceIds()].sort());

  for (const surface of standard) {
    const profile = surface.formatProfile;
    assert.ok(profile, surface.id + " must declare formatProfile");
    assert.ok(grammar.layoutArchetypes[profile.layout], surface.id + " layout profile must resolve");
    assert.ok(grammar.shellProfiles[profile.shell], surface.id + " shell profile must resolve");
    assert.ok(grammar.frameProfiles[profile.frame], surface.id + " frame profile must resolve");
    assert.ok(grammar.selectedStateProfiles[profile.selectedState], surface.id + " selected-state profile must resolve");
    assert.ok(grammar.typographyProfiles[profile.typography], surface.id + " typography profile must resolve");

    const shell = grammar.shellProfiles[profile.shell];
    assert.ok(grammar.headerProfiles[shell.header], surface.id + " header profile must resolve");
    assert.ok(grammar.footerProfiles[shell.footer], surface.id + " footer profile must resolve");
    assert.ok(grammar.returnProfiles[shell.return], surface.id + " return profile must resolve");
    assert.ok(grammar.bodyMeasureProfiles[shell.bodyMeasure], surface.id + " body-measure profile must resolve");
  }
});

test("#2226 Phase 2 preserves current reference authority while making standard return and measure rules explicit", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  const dashboard = canonicalSurface("dashboard");
  assert.equal(dashboard.formatProfile.shell, "dashboard-reference");
  assert.equal(grammar.bodyMeasureProfiles["dashboard-reference-current"].explicitHumanApprovalRequiredToChange, true);
  assert.ok([
    "deferred-to-phase-3-human-approval",
    "human-approved-phase-3",
  ].includes(grammar.profileContract.dashboardMeasureDecision));

  for (const id of canonicalWebMcpSurfaceIds().filter((id) => id !== "dashboard")) {
    const surface = canonicalSurface(id);
    const shell = grammar.shellProfiles[surface.formatProfile.shell];
    const returnProfile = grammar.returnProfiles[shell.return];
    assert.equal(returnProfile.required, true, id + " must require a return action");
    assert.equal(returnProfile.horizontalAlignment, "right", id + " return must be upper-right aligned");
    assert.equal(returnProfile.placement, "below-standard-header", id + " return must sit under the standard header");
    assert.equal(grammar.bodyMeasureProfiles[shell.bodyMeasure].maxPx, 1180, id + " must use the declared current shell measure");
  }
});

test("#2226 Phase 2 codifies solid 1px/2px frames and only evidence-backed non-solid semantics", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  assert.equal(grammar.frameProfiles["solid-standard"].outerBorderToken, "--pp-skin-border-strong");
  assert.equal(grammar.frameProfiles["solid-standard"].innerBorderToken, "--pp-skin-border-thin");
  assert.equal(grammar.frameProfiles["layered-inset"].sourceEvidence, "Profile");
  assert.deepEqual(grammar.borderPolicy.structuralStyles, ["solid"]);
  assert.equal(grammar.borderPolicy.dottedStructuralBordersAllowed, false);
  assert.equal(grammar.borderPolicy.dashedStructuralBordersAllowed, false);
  assert.deepEqual(grammar.semanticBorderExceptions, [{
    id: "disabled-control-dashed",
    selector: ".pp-skin-v1-panel button:disabled",
    borderStyle: "dashed",
    semanticState: "disabled/unavailable",
    source: "app/skin-v1.css",
    structuralFrameException: false,
  }]);
});

test("#2226 Phase 2 declares the preferred dark/green selected state and Skin V1 typography authority", async () => {
  const grammar = await readJson("config/skin-v1-surface-grammar.json");
  const selected = grammar.selectedStateProfiles["canonical-dark-accent"];
  assert.equal(selected.backgroundToken, "--pp-skin-accent-deep");
  assert.equal(selected.borderWidthToken, "--pp-skin-border-thin");
  assert.equal(selected.borderColorToken, "--pp-skin-accent-bright");
  assert.equal(selected.textToken, "--pp-skin-ink");
  assert.equal(selected.starkWhiteFillAllowed, false);

  for (const profile of Object.values(grammar.typographyProfiles)) {
    assert.equal(profile.fontToken, "--pp-skin-font-ui");
    assert.equal(profile.localFontFamilyAllowed, false);
  }
  assert.equal(grammar.typographyProfiles["project-workspace"].projectAwareTitleAllowed, true);
  assert.equal(grammar.typographyProfiles["project-workspace"].hardCodedProjectNameAllowed, false);
});

test("#2226 Phase 2 maps the Human-reviewed family evidence without changing product authority", () => {
  assert.equal(canonicalSurface("profile").formatProfile.layout, "two-column");
  assert.equal(canonicalSurface("profile").formatProfile.frame, "layered-inset");
  assert.equal(canonicalSurface("scene-timeline").formatProfile.layout, "timeline-workspace");
  assert.equal(canonicalSurface("scene-timeline").formatProfile.shell, "production-nested");
  assert.equal(canonicalSurface("visual-story").formatProfile.shell, "production-nested");
  assert.equal(canonicalSurface("write").formatProfile.layout, "editor-inspector");
  assert.equal(canonicalSurface("pageflow").formatProfile.shell, "diagnostic");
  assert.equal(canonicalSurface("library-load").formatProfile.layout, "directory-grid");
  assert.equal(canonicalSurface("local-ai").formatProfile.selectedState, "canonical-dark-accent");
  assert.equal(canonicalSurface("issue-log").formatProfile.shell, "standard-restrained");
});
