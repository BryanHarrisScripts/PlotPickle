import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadSkinV1SurfaceContracts,
  renderSkinV1SurfaceContractMatrix,
} from "../lib/verification/skin-v1/surface-contracts.mjs";
import { analyzeRenderedSurfaceContract } from "../lib/verification/skin-v1/rendered-surface-profile.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2270 resolves one Surface Contract per standard WebMCP surface without adding a fifth authority", async () => {
  const [{ contracts, sources }, anatomy] = await Promise.all([
    loadSkinV1SurfaceContracts(),
    readJson("config/skin-v1-surface-anatomy-contract.json"),
  ]);
  const standard = sources.registry.surfaces.filter((surface) => surface.capturePolicy === "standard");

  assert.equal(contracts.length, 30);
  assert.equal(contracts.length, standard.length);
  assert.deepEqual(anatomy.fourLayerModel.map((layer) => layer.id), [
    "tokens",
    "components-and-composition",
    "surface-anatomy",
    "surface-declaration",
  ]);
  assert.equal(anatomy.renderedMeasurementPolicy.createsFifthSpecificationLayer, false);
  assert.equal(anatomy.renderedMeasurementPolicy.browserExecutionOwner, "Browser Verification Broker (#2246)");
  assert.equal(anatomy.renderedMeasurementPolicy.renderedVerdictOwner, "Visual Director");
  assert.equal(anatomy.renderedMeasurementPolicy.continuityVerdictOwner, "UI Continuity");

  for (const contract of contracts) {
    assert.ok(contract.runtimeSelector, contract.surfaceId);
    assert.ok(contract.formatProfile.layout, contract.surfaceId);
    assert.ok(contract.formatProfile.shell, contract.surfaceId);
    assert.ok(contract.expected.frame.profile, contract.surfaceId);
    assert.equal(contract.expected.measurement.geometryMayDefineSemantics, false, contract.surfaceId);
    assert.equal(contract.expected.measurement.pageLevelHorizontalOverflowAllowed, false, contract.surfaceId);
    assert.equal(contract.expected.measurement.enforcementMode, "advisory-census", contract.surfaceId);
  }
});

test("#2270 generated Surface Contract Matrix is a projection of existing profiles", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const matrix = renderSkinV1SurfaceContractMatrix(contracts);
  const checkedIn = await read("docs/architecture/skin-v1-surface-contract-matrix.md");

  assert.match(matrix, /Generated projection of the existing Skin V1 four-layer specification stack/u);
  assert.match(matrix, /\| Dashboard \| dashboard-reference \| layered-inset \(2px \+ 1px inset\)/u);
  assert.match(matrix, /\| Library \| library-family .* horizontal/u);
  assert.match(matrix, /Shut Down Node/u);
  assert.match(matrix, /Four-column subordinate card\/metric groups remain valid/u);
  assert.match(checkedIn, /Skin V1 Surface Contract Matrix/u);
  assert.match(checkedIn, /not a fifth design authority/u);
});

test("#2270 measurement analysis detects frame, overflow, column, menu and typography drift", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const profileContract = contracts.find((contract) => contract.surfaceId === "profile");
  assert.ok(profileContract);

  const profile = {
    surface: "PROFILE",
    items: [{
      role: "heading",
      identity: "profile-title",
      presentation: { fontFamily: "Arial, sans-serif" },
    }],
    geometry: {
      pageHorizontalOverflowPx: 24,
      gutters: { left: 20, right: 62 },
      edgeViolations: [{ identity: "profile-body", edge: "right", pixels: 18 }],
      overlaps: [{ first: "profile-body", second: "footer", width: 24, height: 8, area: 192 }],
      primaryGrid: {
        identity: "profile-grid",
        columns: 3,
        template: "300px 300px 300px",
        rootWidthRatio: 0.9,
        rootHeightRatio: 0.7,
      },
      grids: [{
        identity: "profile-grid",
        columns: 4,
        template: "repeat(4, 1fr)",
        rootWidthRatio: 0.9,
        rootHeightRatio: 0.7,
      }],
      menus: [],
    },
  };

  const findings = analyzeRenderedSurfaceContract(profileContract, profile);
  for (const category of [
    "horizontal-overflow",
    "gutter-asymmetry",
    "frame-overlap",
    "structural-overlap",
    "column-contract",
    "undeclared-four-column-shell",
    "typography-contract",
  ]) assert.ok(findings.some((finding) => finding.category === category), category);

  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.proposedSeverity === "blocker" && finding.category === "frame-overlap"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.proposedSeverity === "blocker" && finding.category === "column-contract"));

  const blockingContract = structuredClone(profileContract);
  blockingContract.expected.measurement.enforcementMode = "blocking";
  const blockingFindings = analyzeRenderedSurfaceContract(blockingContract, profile);
  assert.ok(blockingFindings.some((finding) => finding.severity === "blocker" && finding.category === "frame-overlap"));
  assert.ok(blockingFindings.some((finding) => finding.severity === "blocker" && finding.category === "column-contract"));
});

test("#2270 Library and Dashboard contracts project registered child menus including Shutdown Node", async () => {
  const { contracts } = await loadSkinV1SurfaceContracts();
  const library = contracts.find((contract) => contract.surfaceId === "library");
  const dashboard = contracts.find((contract) => contract.surfaceId === "dashboard");

  assert.equal(library.expected.menu.orientation, "horizontal");
  assert.ok(library.expected.menu.expectedVisibleLabels.includes("New"));
  assert.ok(dashboard.expected.menu.expectedVisibleLabels.includes("Shut Down Node"));
});

test("#2270 extends the existing Visual Director and Browser Verification Broker path", async () => {
  const [visualDirector, renderedProfile, visualOutput, broker, specSheet] = await Promise.all([
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("lib/verification/skin-v1/rendered-surface-profile.mjs"),
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("lib/verification/browser-verification-broker.mjs"),
    readJson("config/skin-v1-spec-sheet-contract.json"),
  ]);

  assert.match(visualDirector, /collectRenderedSurfaceProfile/u);
  assert.match(visualDirector, /analyzeRenderedSurfaceContract/u);
  assert.match(visualDirector, /createBrowserVerificationSession/u);
  assert.doesNotMatch(visualDirector, /chromium\.launch\(/u);
  assert.match(renderedProfile, /getBoundingClientRect/u);
  assert.match(renderedProfile, /RENDERED_GEOMETRY_ARTIFACT_ROOT/u);
  assert.match(visualOutput, /Surface Contract Matrix/u);
  assert.match(visualOutput, /Rendered geometry JSON \+ viewport screenshots/u);
  assert.match(broker, /bounded-evaluate/u);
  assert.equal(specSheet.requiredOutputs.shellAndGutterMeasurementsRequired, true);
  assert.equal(specSheet.requiredOutputs.menuContractRequired, true);
  assert.equal(specSheet.requiredOutputs.overlapPolicyRequired, true);
});
