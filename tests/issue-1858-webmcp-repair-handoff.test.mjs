import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildVisualConformanceFinding,
  buildWebMcpRuntimeFinding,
  findingsFromWebMcpError,
  visualConformanceFingerprint,
} from "../lib/verification/webmcp-uat-findings.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const sampleViolation = {
  surface: "SETTINGS",
  semanticRole: "pill",
  stableIdentity: "agent-provider-openai",
  property: "borderRadius",
  actual: "6px",
  expected: "0px",
  source: "--pp-skin-radius",
};

test("#1858 converts deterministic visual drift into the existing UAT finding shape", () => {
  const finding = buildVisualConformanceFinding(sampleViolation);
  assert.equal(finding.schemaVersion, 1);
  assert.equal(finding.area, "ui-conformance");
  assert.equal(finding.severity, "blocker");
  assert.equal(finding.fingerprint, "ui-conformance.settings.pill.agent-provider-openai.borderradius");
  assert.deepEqual(finding.evidence, sampleViolation);
  assert.match(finding.title, /Skin V1 conformance: SETTINGS borderRadius/u);
  assert.match(finding.message, /rendered borderRadius as 6px; expected 0px/u);
});

test("#1858 fingerprint is stable when the rendered actual value changes", () => {
  const first = visualConformanceFingerprint(sampleViolation);
  const second = visualConformanceFingerprint({ ...sampleViolation, actual: "12px", expected: "0px" });
  assert.equal(first, second);
});

test("#1858 repair telemetry rejects arbitrary rendered labels and deduplicates identical defects", () => {
  const unsafe = buildVisualConformanceFinding({
    ...sampleViolation,
    stableIdentity: "My Secret Story Title",
  });
  assert.equal(unsafe.evidence.stableIdentity, "pill-anonymous");
  assert.doesNotMatch(JSON.stringify(unsafe), /My Secret Story Title/u);

  const error = new Error([
    "WebMCP Surface Visual UAT failed:",
    `- UI-CONFORMANCE ${JSON.stringify(sampleViolation)}`,
    `- UI-CONFORMANCE ${JSON.stringify({ ...sampleViolation, actual: "9px" })}`,
  ].join("\n"));
  const findings = findingsFromWebMcpError(error);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].fingerprint, visualConformanceFingerprint(sampleViolation));
});

test("#1858 malformed or non-conformance failures never copy arbitrary failure text into repair evidence", () => {
  assert.deepEqual(findingsFromWebMcpError(new Error("Writer secret: Afterglow")), []);
  const fallback = buildWebMcpRuntimeFinding();
  assert.equal(fallback.fingerprint, "ui-conformance.webmcp.runtime-or-navigation");
  assert.doesNotMatch(JSON.stringify(fallback), /Afterglow/u);
});

test("#1858 WebMCP runner reuses the existing reporter and semantic Pi/Cline repair path", async () => {
  const [runner, reporter, semanticRepair, developerStack, audit] = await Promise.all([
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("scripts/report-uat-findings.mjs"),
    read("scripts/run-semantic-uat-repair.mjs"),
    read("config/developer-agent-stack.json"),
    read("lib/verification/webmcp-surface-visual-audit.mjs"),
  ]);
  const stack = JSON.parse(developerStack);

  assert.match(runner, /WEBMCP_UAT_FINDINGS/u);
  assert.match(runner, /writeWebMcpFindingsReport/u);
  assert.match(runner, /findingsFromWebMcpError/u);
  assert.match(runner, /scripts\/report-uat-findings\.mjs/u);
  assert.match(runner, /scripts\/run-semantic-uat-repair\.mjs/u);
  assert.match(runner, /--github-report/u);
  assert.match(runner, /--repair/u);
  assert.match(runner, /--repair-worker/u);
  assert.match(runner, /new Set\(\["pi", "cline"\]\)/u);
  assert.match(runner, /running WebMCP session remains FAIL until the repaired build is independently rerun/u);

  assert.match(reporter, /local Pi or Cline Developer Repair Worker/u);
  assert.match(reporter, /worker self-report is never PASS evidence/u);
  assert.doesNotMatch(reporter, /local Qwen3\.8-27B UAT Repair Agent reproduces/u);
  assert.match(semanticRepair, /run-uat-repair-agent\.mjs/u);
  assert.match(semanticRepair, /Deterministic validation remains authoritative/u);

  assert.deepEqual(stack.repair.selectableWorkers, ["pi", "cline"]);
  assert.equal(stack.repair.defaultWorker, "pi");
  assert.equal(stack.repair.localOnly, true);
  assert.equal(stack.repair.cloudFallback, false);
  assert.match(audit, /WEBMCP_FORBIDDEN_CAPABILITIES/u);
});

test("#1858 finding adapter has no GitHub, provider, file-mutation or repair authority", async () => {
  const adapter = await read("lib/verification/webmcp-uat-findings.mjs");
  assert.doesNotMatch(adapter, /\bgh\s*\(/u);
  assert.doesNotMatch(adapter, /github\.com/u);
  assert.doesNotMatch(adapter, /child_process/u);
  assert.doesNotMatch(adapter, /writeFile|unlink|rm\(/u);
  assert.doesNotMatch(adapter, /provider-invocation|fetch\(/u);
});
