import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalWebMcpSurfaceIds } from "../lib/verification/skin-v1-surface-registry.mjs";
import {
  SKIN_V1_GEOMETRY_ARTIFACT_ROOT,
  SKIN_V1_GEOMETRY_REPORT_MARKDOWN_PATH,
  analyzeRenderedGeometry,
} from "../lib/verification/skin-v1-rendered-surface-profile.mjs";
import {
  buildSurfaceContractMatrix,
  renderSurfaceContractMatrix,
} from "../scripts/generate-skin-v1-surface-contract-matrix.mjs";

const read = (path) => readFile(new URL(\`../\${path}\`, import.meta.url), "utf8");
const json = async (path) => JSON.parse(await read(path));

test("#2270 extends the existing four-layer Skin V1 contract instead of creating a fifth authority", async () => {
  const [anatomy, spec, matrix] = await Promise.all([
    json("config/skin-v1-surface-anatomy-contract.json"),
    json("config/skin-v1-spec-sheet-contract.json"),
    buildSurfaceContractMatrix(),
  ]);
  assert.equal(anatomy.fourLayerModel.length, 4);
  assert.equal(anatomy.renderedMeasurementSemantics.issue, 2270);
  assert.equal(anatomy.renderedMeasurementSemantics.authorityBoundary.mayCreateFifthSpecificationLayer, false);
  assert.equal(anatomy.renderedMeasurementSemantics.authorityBoundary.mayCreateIndependentGeometryGate, false);
  assert.equal(anatomy.renderedMeasurementSemantics.authorityBoundary.verdictOwner, "Visual Director");
  assert.equal(spec.requiredOutputs.renderedGeometryContract.issue, 2270);
  assert.equal(spec.requiredOutputs.renderedGeometryContract.required, true);
  assert.equal(matrix.policies.renderedGeometryVerdictOwner, "Visual Director");
  assert.equal(matrix.policies.fourColumnShellAllowed, false);
});

test("#2270 generated Surface Contract Matrix covers exactly the standard WebMCP surface inventory", async () => {
  const matrix = await buildSurfaceContractMatrix();
  const ids = canonicalWebMcpSurfaceIds();
  assert.equal(matrix.rows.length, ids.length);
  assert.deepEqual(matrix.rows.map((row) => row.id).sort(), [...ids].sort());
  assert.equal(matrix.rows.length, 30);
  const markdown = renderSurfaceContractMatrix(matrix);
  assert.match(markdown, /Generated projection of the existing Skin V1 four-layer specification stack/u);
  assert.match(markdown, /Four-column shell: prohibited/u);
});

test("#2270 rendered geometry analyzer reports frame overflow, extra shell columns and page overflow with exact deltas", () => {
  const findings = analyzeRenderedGeometry({
    surface: "PROFILE",
    layout: { horizontalOverflowPx: 18 },
    geometry: {
      rootOverflow: [{ identity: "right-panel", edge: "right", pixels: 12 }],
      siblingOverlaps: [{ left: "menu", right: "content", width: 8, height: 24 }],
      shellColumns: { count: 3 },
      footerCount: 0,
    },
  }, {
    formatProfile: { layout: "two-column" },
    footer: { required: true },
  });
  assert.ok(findings.some((item) => item.category === "horizontal-overflow" && item.severity === "blocker"));
  assert.ok(findings.some((item) => item.category === "frame-overflow" && item.actual === "12px"));
  assert.ok(findings.some((item) => item.category === "structural-overlap" && item.actual === "8×24px"));
  assert.ok(findings.some((item) => item.category === "column-contract" && item.expected === "2"));
  assert.ok(findings.some((item) => item.category === "missing-footer"));
});

test("#2270 keeps browser execution and verdicts in the existing Broker + Visual Director path", async () => {
  const [visualDirector, helper, startup] = await Promise.all([
    read("lib/verification/skin-v1-visual-director.mjs"),
    read("lib/verification/skin-v1-rendered-surface-profile.mjs"),
    read("scripts/run-webmcp-startup-uat.mjs"),
  ]);
  assert.match(visualDirector, /createBrowserVerificationSession/u);
  assert.match(visualDirector, /collectRenderedSurfaceProfile/u);
  assert.match(visualDirector, /analyzeRenderedGeometry/u);
  assert.match(visualDirector, /diagnostic-observe-before-enforce/u);
  assert.doesNotMatch(helper, /chromium\.launch|firefox\.launch|webkit\.launch/u);
  assert.match(helper, /getBoundingClientRect/u);
  assert.match(helper, /siblingOverlaps/u);
  assert.match(helper, /shellColumns/u);
  assert.match(helper, /menus/u);
  assert.match(startup, /F12 geometry diagnostics/u);
  assert.equal(SKIN_V1_GEOMETRY_ARTIFACT_ROOT, ".artifacts/browser-diagnostics/skin-v1-visual-director/geometry");
  assert.equal(SKIN_V1_GEOMETRY_REPORT_MARKDOWN_PATH, ".artifacts/browser-diagnostics/skin-v1-visual-director/geometry/surface-contract-report.md");
});

test("#2270 committed matrix remains a generated projection and names the existing authorities", async () => {
  const committed = await read("docs/architecture/skin-v1-surface-contract-matrix.md");
  assert.match(committed, /This file is not an independent design authority/u);
  for (const authority of [
    "app/skin-v1-definition.css",
    "config/skin-v1-surface-composition-reference.json",
    "config/skin-v1-surface-anatomy-contract.json",
    "config/skin-v1-surface-declarations/",
    "config/skin-v1-surface-registry.json",
    "config/skin-v1-surface-grammar.json",
    "config/skin-v1-spec-sheet-contract.json",
  ]) {
    const escaped = authority.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    assert.match(committed, new RegExp(escaped, "u"));
  }
});
