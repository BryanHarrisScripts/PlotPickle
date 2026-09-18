import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeVisualContinuity, derivePeerCorpus, VISUAL_DIRECTOR_REPORT_PATH } from "../lib/verification/skin-v1-visual-director.mjs";

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

test("#2224 Visual Director uses governed peers for structural outliers and blocks broken rendered media", () => {
  const peers = [
    { surface: "GENERAL", root: { height: "900px" }, layout: { largestVerticalGap: 44, shellLandmarks: 2 } },
    { surface: "STORY_MAP", root: { height: "980px" }, layout: { largestVerticalGap: 64, shellLandmarks: 3 } },
    { surface: "WRITE", root: { height: "1040px" }, layout: { largestVerticalGap: 72, shellLandmarks: 2 } },
  ];
  const candidate = {
    surface: "STORYBOARD",
    root: { fontFamily: '"Courier New", monospace', width: "1000px", height: "3600px" },
    tokens: {},
    resolvedColors: {},
    layout: { viewportHeight: 1100, largestVerticalGap: 820, shellLandmarks: 11 },
    media: {
      broken: [{ identity: "afterglow-frame-17-1", detail: "image failed: /missing-frame.webp" }],
    },
    items: [
      item("heading", "storyboard-title", { fontSize: "20px" }),
      item("panel", "storyboard-panel", { backgroundImage: "linear-gradient(rgb(24, 24, 24), rgb(18, 18, 18))" }),
      item("control", "storyboard-control", { height: "34px" }),
    ],
  };

  const corpus = derivePeerCorpus(peers);
  assert.equal(corpus.surfaces, 3);
  assert.equal(corpus.largestVerticalGapMedian, 64);
  assert.equal(corpus.rootHeightMedian, 980);

  const findings = analyzeVisualContinuity(dashboardProfile(), candidate, peers);
  assert.ok(findings.some((finding) => finding.severity === "blocker" && finding.category === "broken-media" && finding.identity === "afterglow-frame-17-1"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "structural-dead-space"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "structural-height"));
  assert.ok(findings.some((finding) => finding.severity === "advisory" && finding.category === "shell-density"));
});


test("Visual Director does not compare a surface to its own historical screenshot", () => {
  const source = read("lib/verification/skin-v1-visual-director.mjs");
  assert.match(source, /canonicalReference: "dashboard"/);
  assert.match(source, /historical screenshot is regression evidence only/);
  assert.match(source, /peerCorpus: derivePeerCorpus/);
  assert.match(source, /Governed peer surfaces provide supplemental structural norms/);
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
  assert.match(visualQa, /dead\/unused regions|broken or unloaded media|duplicated application shells/i);
  assert.match(visualQa, /governed WebMCP surface set.*supplemental peer evidence/is);
  assert.match(developerInstructions, /skin[-_/ ]?v?1|dashboard|surface/i);
  assert.match(workflow, /skin-v1-visual-director\.mjs/);
  assert.match(workflow, /visual-director-report\.json/);
  assert.match(workflow, /issue-1883-dashboard-visual-director\.test\.mjs/);
});
