import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeVisualContinuity, VISUAL_DIRECTOR_REPORT_PATH } from "../lib/verification/skin-v1-visual-director.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");

function item(role, identity, overrides = {}) {
  return {
    role,
    identity,
    presentation: {
      fontFamily: '"Courier New", monospace',
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
    root: { fontFamily: '"Courier New", monospace', width: "1000px" },
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
      item("panel", "dashboard-panel", { backgroundImage: "linear-gradient(rgb(24, 24, 24), rgb(18, 18, 18))", borderTopWidth: "2px" }),
      item("control", "dashboard-row", { height: "34px" }),
    ],
  };
}

test("Visual Director turns Dashboard differences into concrete blocker and advisory guidance", () => {
  const candidate = {
    surface: "SETTINGS",
    root: { fontFamily: '"Courier New", monospace', width: "600px" },
    tokens: {},
    resolvedColors: {},
    items: [
      item("heading", "settings-title", { fontFamily: "Georgia", fontSize: "28px", paddingLeft: "18px" }),
      item("panel", "settings-panel", { borderTopWidth: "5px", borderRightWidth: "5px", borderBottomWidth: "5px", borderLeftWidth: "5px" }),
      item("control", "general", { height: "70px", backgroundColor: "rgb(1, 2, 3)" }),
    ],
  };

  const findings = analyzeVisualContinuity(dashboardProfile(), candidate);
  assert.ok(findings.some((finding) => finding.severity === "blocker" && finding.category === "typography" && finding.identity === "settings-title"));
  assert.ok(findings.some((finding) => finding.severity === "blocker" && finding.category === "border-treatment" && finding.identity === "settings-panel"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "palette"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "spacing-rhythm"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "hierarchy"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "layout-measure"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "control-density"));
  for (const finding of findings) {
    assert.ok(finding.guidance.length > 20);
    assert.ok(finding.expected.length > 0);
    assert.ok(finding.property.length > 0);
  }
});

test("Visual Director does not compare a surface to its own historical screenshot", () => {
  const source = read("lib/verification/skin-v1-visual-director.mjs");
  assert.match(source, /canonicalReference: "dashboard"/);
  assert.match(source, /historical screenshot is regression evidence only/);
  assert.equal(VISUAL_DIRECTOR_REPORT_PATH, ".artifacts/visual-readiness/visual-director-report.json");
});

test("Visual QA and Developer Workbench require Dashboard-vs-target guidance for Skin UI work", () => {
  const visualQa = read(".agents/skills/visual-qa/SKILL.md");
  const developerInstructions = read("Utilities/DeveloperWorkbench/pi-review-instructions.mjs");
  const workflow = read(".github/workflows/visual-readiness.yml");

  assert.match(visualQa, /Dashboard.*canonical.*visual authority/is);
  assert.match(visualQa, /Dashboard.*target/is);
  assert.match(visualQa, /historical.*baseline/is);
  assert.match(visualQa, /visual-director-report\.json/);
  assert.match(developerInstructions, /skin[-_/ ]?v?1|dashboard|surface/i);
  assert.match(workflow, /skin-v1-visual-director\.mjs/);
  assert.match(workflow, /visual-director-report\.json/);
  assert.match(workflow, /issue-1883-dashboard-visual-director\.test\.mjs/);
});
