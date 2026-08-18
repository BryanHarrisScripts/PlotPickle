import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runPortabilityEvals, summarizePortabilityEvals } from "../scripts/run-agent-portability-evals.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("run telemetry correlates profile, graph node, context, model, tool, verification and approval activity under one run ID", async () => {
  const source = await read("lib/run-observability.ts");
  for (const field of [
    "runId", "parentRunId", "graphNodeId", "profileId", "skillUris", "capabilityRole", "provider", "runtime", "model",
    "contextPacketId", "connectorId", "verificationRef", "writerApprovalState", "attemptNumber", "latencyMs",
  ]) assert.match(source, new RegExp(`${field}:`), `missing telemetry correlation field ${field}`);
  assert.match(source, /MAX_EVENTS = 500/);
  assert.match(source, /recordRunTelemetryEvent/);
  assert.match(source, /summarizeRunTelemetry/);
  assert.doesNotMatch(source, /chainOfThought|hiddenReasoning|fullPrompt|privatePrompt/);
});

test("token context and cloud cost accounting distinguish exact estimated and unknown values", async () => {
  const source = await read("lib/run-observability.ts");
  const gateway = await read("build/responsibility-run-gateway.ts");
  assert.match(source, /RunCostConfidence = "exact" \| "estimated" \| "unknown"/);
  assert.match(source, /inputTokens/);
  assert.match(source, /outputTokens/);
  assert.match(source, /contextCharacters/);
  assert.match(source, /cloudCostUsd/);
  assert.match(source, /tokenUsageKnown/);
  assert.match(gateway, /telemetryUsageDelta/);
  assert.match(gateway, /recordResponsibilityUsage\(run, telemetryUsageDelta\(event\)/);
  assert.match(gateway, /recordResponsibilityToolCall/);
});

test("runtime health is explicit and local failure cannot silently authorize paid cloud", async () => {
  const source = await read("lib/run-observability.ts");
  for (const state of ["healthy", "unavailable", "timeout", "rate-limited", "circuit-open", "recovering"]) assert.match(source, new RegExp(`"${state}"`));
  assert.match(source, /runtimeRouteAllowed/);
  assert.match(source, /requestedRoute === "cloud\/BYOK" && \(!input\.cloudExplicitlyEnabled \|\| input\.cloudBudgetUsd <= 0\)/);
  assert.match(source, /paid-cloud-not-explicitly-enabled/);
  assert.match(source, /runtime-circuit-open/);
});

test("Responsibility Run API persists telemetry separately and exposes a plain-language summary", async () => {
  const gateway = await read("build/responsibility-run-gateway.ts");
  const ui = await read("app/responsibility-run-activity.tsx");
  assert.match(gateway, /telemetryRoot/);
  assert.match(gateway, /readTelemetry/);
  assert.match(gateway, /saveTelemetry/);
  assert.match(gateway, /action === "telemetry"/);
  assert.match(gateway, /telemetrySummary: ledger \? summarizeRunTelemetry\(ledger\) : null/);
  assert.match(ui, /Run summary:/);
  assert.match(ui, /plainLanguage/);
  assert.match(ui, /Run ID \{run\.runId\}/);
  assert.match(ui, /measured tokens/);
});

test("model portability evals cover Sage PLAN graph schema and a fresh verifier with model-independent acceptance", () => {
  const results = runPortabilityEvals();
  assert.equal(results.length, 8);
  assert.ok(results.every((result) => result.passed), JSON.stringify(results.filter((result) => !result.passed)));
  assert.deepEqual(new Set(results.map((result) => result.caseId)), new Set([
    "sage-grounded-answer",
    "plan-bounded-proposal",
    "graph-structured-node",
    "fresh-verifier-rejects-known-bad",
  ]));
  assert.equal(new Set(results.map((result) => result.model)).size, 2);
  const summary = summarizePortabilityEvals(results);
  assert.equal(summary.length, 2);
  assert.ok(summary.every((route) => route.passed === 4 && route.failed === 0));
});

test("portability harness uses deterministic acceptance rules rather than model self-grading", async () => {
  const source = await read("scripts/run-agent-portability-evals.mjs");
  assert.match(source, /grounded !== true/);
  assert.match(source, /proposalOnly !== true/);
  assert.match(source, /graph output contains undeclared fields/);
  assert.match(source, /workerSelfAssessmentAuthority !== "none"/);
  assert.match(source, /known-bad finding was not rejected/);
  assert.doesNotMatch(source, /judgeModel|selfGrade|askModelToScore/);
});
