import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { analyzeBaselines, summarize } from "../scripts/performance/analyze-real-machine-baselines.mjs";
import {
  classifyMeasuredWork,
  measuredWorkDefinitions,
  validateWorkClassification,
} from "../scripts/performance/contracts/classify-measured-work.mjs";
import { browserRoutes, findPerformanceBrowser } from "../scripts/performance/measure-browser-responsiveness.mjs";
import { measureStoryWorkflowContract } from "../scripts/performance/measure-story-workflow-contract.mjs";
import { isolatedBenchmarkEnvironment, observeStartupOutput, optimizerCachePath } from "../scripts/performance/run-windows-startup-benchmark.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1411 benchmark runner preserves authoritative Windows and no-fake-budget boundaries", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  assert.match(source, /process\.platform !== "win32"/);
  assert.match(source, /authoritative benchmark must run on Windows/);
  assert.match(source, /Hard thresholds are intentionally absent until repeated real-machine baseline samples establish variance/);
  assert.match(source, /deterministic workflow planning and targeted re-evaluation evidence/);
});

test("#1411 benchmark identifies canonical modes and core workspace routes", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const mode of ["warm-persistent-runtime", "fresh-optimizer", "fresh-runtime", "story-workflow-local", "buzz-enabled-story-council"]) assert.ok(source.includes(mode));
  for (const route of ["/library", "/?workspace=learn", "/?workspace=plan", "/?workspace=build", "/story-decisions", "/story-workbench"]) assert.ok(source.includes(route));
  assert.doesNotMatch(source, /\["plan", "\/plan"\]|\["build", "\/build"\]/);
});

test("#1411 evidence records reproducibility identity and process memory reliability", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const field of ["plotpickleVersion", "commit", "afterglowFixture", "ppfStartingRevision", "curriculumIdentity", "buzzMode", "optionalIntegrations", "process-only"]) assert.ok(source.includes(field));
  assert.match(source, /process\.env\.PLOTPICKLE_COMMIT \|\| process\.env\.GITHUB_SHA/);
});

test("#1411 deterministic Afterglow workflow comparison proves targeted re-evaluation stays bounded", () => {
  const evidence = measureStoryWorkflowContract();
  assert.equal(evidence.status, "captured-deterministic-contract");
  assert.equal(evidence.paidCloudRequired, false);
  assert.ok(evidence.fullAudit.workItemCount > evidence.targetedReevaluation.workItemCount);
  assert.equal(evidence.targetedReevaluation.preservedUnaffected, true);
  assert.equal(evidence.comparison.targetedIsBounded, true);
});

test("#1411 workflow benchmark stays explicit about deterministic planning limits", async () => {
  const source = await read("scripts/performance/measure-story-workflow-contract.mjs");
  assert.match(source, /Live model latency, retries and network transport remain separate real-machine measurements/);
  assert.match(source, /affectedStoryWorkItemIds/);
  assert.match(source, /requeueAffectedStoryWorkItems/);
});

test("#1616 classifies every significant measured activity without changing runtime authority", () => {
  const classification = classifyMeasuredWork({
    environment: { buzzMode: "disabled", optionalIntegrations: [] },
    measurements: { startup: { browserSuppressed: true, optionalCompanionMaintenanceSuppressed: true }, browser: {}, processIdle: {} },
    workflow: { status: "captured-deterministic-contract" },
  });
  assert.equal(classification.validation.complete, true);
  assert.deepEqual(classification.validation.unclassifiedObservedWork, []);
  assert.equal(classification.authority, "classification-evidence-only");
  assert.equal(classification.changesRuntimeBehavior, false);
  assert.deepEqual([...new Set(measuredWorkDefinitions.map((item) => item.category))].sort(), [
    "developer-diagnostic-only",
    "optional-integration",
    "required-before-core-readiness",
    "required-deferrable-after-readiness",
    "workflow-triggered",
  ]);
  assert.deepEqual(validateWorkClassification(), []);
  assert.ok(classification.items.every((item) => item.evidenceRefs.length > 0 && item.rationale));
  assert.equal(classification.items.find((item) => item.id === "optional-companion-maintenance")?.activeInSample, false);
  assert.equal(classification.items.find((item) => item.id === "managed-browser-opening")?.activeInSample, false);
  assert.equal(classification.items.find((item) => item.id === "manual-developer-agents-and-uat")?.activeInSample, false);
  assert.equal(classification.items.find((item) => item.id === "targeted-story-reevaluation")?.activeInSample, true);
});

test("#1616 classification rejects missing categories and duplicate work identities", () => {
  const invalid = [
    { ...measuredWorkDefinitions[0] },
    { ...measuredWorkDefinitions[0] },
  ];
  const errors = validateWorkClassification(invalid);
  assert.ok(errors.some((error) => error.includes("duplicated")));
  assert.ok(errors.some((error) => error.includes("No work is classified")));
});

test("#1411 baseline analyzer requires repeated authoritative Windows samples before ratification", () => {
  const sample = (elapsedMs, mode = "warm-persistent-runtime") => ({
    benchmarkIssue: 1411,
    authoritative: true,
    environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "exact-head", plotpickleVersion: "1.0.0", afterglowFixture: "afterglow-v9", curriculumIdentity: "curriculum-a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] },
    mode,
    measurements: {
      navigation: [{ label: "dashboard", ok: true, elapsedMs }],
      memory: { rssAfterBytes: 1000 + elapsedMs },
      startup: { viteReadyMs: elapsedMs * 2, firstUsableCoreWorkspaceMs: elapsedMs * 3 },
      browser: {
        firstAccess: [{ label: "dashboard", ready: true, usefulInteractiveMs: elapsedMs * 4, firstContentfulPaintMs: elapsedMs, interactiveControlCount: 10 }],
        repeatedAccess: [{ label: "dashboard", ready: true, usefulInteractiveMs: elapsedMs * 2, firstContentfulPaintMs: elapsedMs / 2, interactiveControlCount: 10 }],
      },
    },
    result: { harnessHealthy: true, startupHealthy: true },
  });
  const two = analyzeBaselines([sample(100), sample(120)]);
  assert.equal(two.readyForBudgetRatification, false);
  const three = analyzeBaselines([sample(100), sample(120), sample(110)]);
  assert.equal(three.readyForBudgetRatification, true);
  assert.deepEqual(three.readyModes, ["warm-persistent-runtime"]);
  assert.equal(three.modes["warm-persistent-runtime"].identityStable, true);
  assert.equal(three.modes["warm-persistent-runtime"].navigation.dashboard.samples, 3);
  assert.equal(three.modes["warm-persistent-runtime"].startup.viteReadyMs.samples, 3);
  assert.equal(three.modes["warm-persistent-runtime"].startup.firstUsableCoreWorkspaceMs.mean, 330);
  assert.equal(three.modes["warm-persistent-runtime"].browser.firstAccess.dashboard.usefulInteractiveMs.mean, 440);
  assert.equal(three.modes["warm-persistent-runtime"].browser.repeatedAccess.dashboard.usefulInteractiveMs.mean, 220);
});

test("#1411 baseline analyzer rejects mixed workload identity and ignores non-authoritative evidence", () => {
  const base = { benchmarkIssue: 1411, authoritative: true, mode: "warm-persistent-runtime", environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "exact-head", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] }, measurements: { navigation: [], memory: {} }, result: { harnessHealthy: true, startupHealthy: true } };
  const mixed = analyzeBaselines([base, base, { ...base, environment: { ...base.environment, curriculumIdentity: "b" } }, { ...base, authoritative: false }]);
  assert.equal(mixed.authoritativeSampleCount, 3);
  assert.equal(mixed.modes["warm-persistent-runtime"].identityStable, false);
  assert.equal(mixed.readyForBudgetRatification, false);
  assert.deepEqual(summarize([10, 20, 30]), { samples: 3, min: 10, max: 30, mean: 20, standardDeviation: 8.16 });
});

test("#1411 analyzer never combines fresh, optimizer and warm startup samples", () => {
  const sample = (mode, elapsedMs) => ({
    benchmarkIssue: 1411,
    authoritative: true,
    mode,
    environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "exact-head", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] },
    measurements: { navigation: [{ label: "dashboard", ok: true, elapsedMs }], startup: { firstUsableCoreWorkspaceMs: elapsedMs }, memory: {} },
    result: { harnessHealthy: true, startupHealthy: true },
  });
  const report = analyzeBaselines([
    sample("fresh-runtime", 30000),
    sample("fresh-optimizer", 15000),
    sample("warm-persistent-runtime", 8000),
  ]);
  assert.equal(report.modeSeparationEnforced, true);
  assert.deepEqual(report.analyzedModes, ["fresh-optimizer", "fresh-runtime", "warm-persistent-runtime"]);
  assert.equal(report.modes["fresh-runtime"].startup.firstUsableCoreWorkspaceMs.mean, 30000);
  assert.equal(report.modes["fresh-optimizer"].startup.firstUsableCoreWorkspaceMs.mean, 15000);
  assert.equal(report.modes["warm-persistent-runtime"].startup.firstUsableCoreWorkspaceMs.mean, 8000);
  assert.equal(report.readyForBudgetRatification, false);
});

test("#1411 analyzer excludes wrong-runtime and unhealthy samples from ratification", () => {
  const base = {
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "warm-persistent-runtime",
    environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "exact-head", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] },
    measurements: { navigation: [{ label: "dashboard", ok: true, elapsedMs: 10 }], startup: { firstUsableCoreWorkspaceMs: 20 }, memory: {} },
    result: { harnessHealthy: true, startupHealthy: true },
  };
  const report = analyzeBaselines([
    base,
    { ...base, environment: { ...base.environment, node: "v22.13.0" } },
    { ...base, result: { harnessHealthy: false, startupHealthy: false } },
  ]);
  assert.equal(report.authoritativeSampleCount, 2);
  assert.equal(report.rejectedEvidenceCount, 1);
  assert.equal(report.modes["warm-persistent-runtime"].healthySampleCount, 1);
  assert.equal(report.readyForBudgetRatification, false);
});

test("#1411 real launcher phases are timestamped from truthful Windows startup output", () => {
  const phases = {
    sourceCheckStartedMs: null,
    runtimePreparationStartedMs: null,
    runtimeReadyMs: null,
    agentSkillsCheckStartedMs: null,
    agentSkillsReadyMs: null,
    viteLaunchStartedMs: null,
    viteReadyMs: null,
  };
  observeStartupOutput(phases, "[UPDATE CHECK] Checking source", 10);
  observeStartupOutput(phases, "[STEP 1 OF 3] Preparing runtime", 20);
  observeStartupOutput(phases, "[OK] Persistent runtime C:\\PlotPickle", 30);
  observeStartupOutput(phases, "[AGENT SKILLS CHECK] Verifying", 40);
  observeStartupOutput(phases, "[READY] PlotPickle Agent Skills are registered and verified.", 50);
  observeStartupOutput(phases, "[STEP 3 OF 3] Starting", 60);
  observeStartupOutput(phases, "Local: http://127.0.0.1:4173/", 70);
  assert.deepEqual(phases, {
    sourceCheckStartedMs: 10,
    runtimePreparationStartedMs: 20,
    runtimeReadyMs: 30,
    agentSkillsCheckStartedMs: 40,
    agentSkillsReadyMs: 50,
    viteLaunchStartedMs: 60,
    viteReadyMs: 70,
  });
});

test("#1411 Windows workflow separates fresh startup from repeated warm samples", async () => {
  const [workflow, launcher] = await Promise.all([
    read(".github/workflows/windows-performance-baseline.yml"),
    read("Start-PlotPickle.bat"),
  ]);
  assert.match(workflow, /node-version: "24\.19\.0"/);
  assert.match(workflow, /--mode fresh-runtime/);
  assert.match(workflow, /--mode fresh-optimizer/);
  assert.match(workflow, /--mode warm-persistent-runtime/);
  assert.match(workflow, /analyze-real-machine-baselines\.mjs/);
  assert.match(workflow, /profile:/);
  assert.match(workflow, /startup-baseline/);
  assert.match(workflow, /story-workflow-local/);
  assert.match(workflow, /--mode story-workflow-local/);
  assert.match(workflow, /story-workflow-local-baseline-analysis\.json/);
  assert.match(workflow, /PLOTPICKLE_BUZZ_MODE: disabled/);
  assert.match(workflow, /PLOTPICKLE_OPTIONAL_INTEGRATIONS: ""/);
  assert.match(workflow, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  assert.equal(workflow.split("startsWith(github.head_ref, 'baseline/1411-')").length - 1, 2);
  assert.equal(workflow.split('$samples = if ("${{ github.event_name }}" -eq "pull_request") { 3 } else { [int]"${{ inputs.sample_count }}" }').length - 1, 2);
  assert.match(workflow, /if: github\.event_name == 'pull_request' \|\| inputs\.profile == 'startup-baseline'/);
  assert.match(workflow, /2\.\.\$samples \| ForEach-Object \{\s+\$file = "\.artifacts\/performance\/fresh-runtime-\$_\.json"/);
  assert.match(workflow, /1\.\.\$samples \| ForEach-Object \{\s+\$file = "\.artifacts\/performance\/fresh-optimizer-\$_\.json"/);
  assert.match(launcher, /PLOTPICKLE_PERFORMANCE_BENCHMARK/);
  assert.match(launcher, /browser launch and optional companion maintenance are suppressed/);
});

test("#1618 analyzer aggregates repeated bounded local Story Workflow evidence separately", () => {
  const sample = (fullElapsedMs, targetedElapsedMs) => ({
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "story-workflow-local",
    environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "workflow-head", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] },
    measurements: { navigation: [], memory: {} },
    workflow: {
      status: "captured-deterministic-contract",
      paidCloudRequired: false,
      workload: "afterglow-v9-bounded-story-workflow",
      baseRevision: 9,
      changedRefs: ["ppf:foundations:ren-motivation"],
      providerRoute: "deterministic-local-contract",
      fullAudit: { elapsedMs: fullElapsedMs, workItemCount: 4, specialistCount: 3, contextBytes: 4000 },
      targetedReevaluation: { elapsedMs: targetedElapsedMs, workItemCount: 2, specialistCount: 2, contextBytes: 2000, preservedUnaffected: true },
      comparison: { workItemRatio: 0.5, specialistRatio: 0.6667, contextByteRatio: 0.5, targetedIsBounded: true },
    },
    result: { harnessHealthy: true, workflowBounded: true },
  });
  const report = analyzeBaselines([sample(12, 4), sample(10, 3), sample(11, 5)]);
  const mode = report.modes["story-workflow-local"];
  assert.equal(mode.readyForBudgetRatification, true);
  assert.equal(mode.workflow.samples, 3);
  assert.equal(mode.workflow.fullAudit.elapsedMs.mean, 11);
  assert.equal(mode.workflow.targetedReevaluation.elapsedMs.mean, 4);
  assert.equal(mode.workflow.targetedReevaluation.preservedUnaffectedSamples, 3);
  assert.equal(mode.workflow.comparison.boundedSamples, 3);
  assert.equal(mode.workflow.comparison.workItemRatio.mean, 0.5);
  assert.equal(mode.workflow.paidCloudRequired, false);
});

test("#1618 analyzer rejects unbounded or paid workflow samples from ratification", () => {
  const base = {
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "story-workflow-local",
    environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "workflow-head", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] },
    measurements: { navigation: [], memory: {} },
    workflow: { status: "captured-deterministic-contract", paidCloudRequired: false, workload: "afterglow-v9-bounded-story-workflow", baseRevision: 9, changedRefs: ["ppf:foundations:ren-motivation"], providerRoute: "deterministic-local-contract", fullAudit: {}, targetedReevaluation: {}, comparison: { targetedIsBounded: true } },
    result: { harnessHealthy: true, workflowBounded: true },
  };
  const report = analyzeBaselines([
    base,
    { ...base, result: { harnessHealthy: true, workflowBounded: false } },
    { ...base, workflow: { ...base.workflow, paidCloudRequired: true } },
  ]);
  assert.equal(report.modes["story-workflow-local"].healthySampleCount, 1);
  assert.equal(report.modes["story-workflow-local"].readyForBudgetRatification, false);
});

test("#1618 analyzer rejects mixed workflow identity and mislabeled optional activity", () => {
  const sample = {
    benchmarkIssue: 1411,
    authoritative: true,
    mode: "story-workflow-local",
    environment: { platform: "win32", arch: "x64", node: "v24.19.0", commit: "workflow-head", plotpickleVersion: "1", afterglowFixture: "afterglow-v9", curriculumIdentity: "a", ppfStartingRevision: "9", buzzMode: "disabled", optionalIntegrations: [] },
    measurements: { navigation: [], memory: {} },
    workflow: { status: "captured-deterministic-contract", paidCloudRequired: false, workload: "afterglow-v9-bounded-story-workflow", baseRevision: 9, changedRefs: ["ppf:foundations:ren-motivation"], providerRoute: "deterministic-local-contract", fullAudit: {}, targetedReevaluation: {}, comparison: { targetedIsBounded: true } },
    result: { harnessHealthy: true, workflowBounded: true },
  };
  const report = analyzeBaselines([
    sample,
    { ...sample, workflow: { ...sample.workflow, changedRefs: ["ppf:structure:block-17"] } },
    { ...sample, environment: { ...sample.environment, buzzMode: "enabled", optionalIntegrations: ["buzz"] } },
  ]);
  const mode = report.modes["story-workflow-local"];
  assert.equal(mode.healthySampleCount, 2);
  assert.equal(mode.identityStable, false);
  assert.equal(mode.readyForBudgetRatification, false);
});

test("#1411 fresh-optimizer mode clears only the bounded Vite optimizer cache", async () => {
  assert.equal(optimizerCachePath("benchmark-root"), path.join("benchmark-root", "node_modules", ".vite"));
  const source = await read("scripts/performance/run-windows-startup-benchmark.mjs");
  assert.match(source, /mode === "fresh-optimizer"/);
  assert.match(source, /rm\(optimizerCachePath\(\), \{ recursive: true, force: true \}\)/);
});

test("#1411 browser evidence uses canonical current routes and reports truthful headless reliability", async () => {
  assert.deepEqual(browserRoutes.map(({ label, path: routePath }) => [label, routePath]), [
    ["dashboard", "/?workspace=dashboard"],
    ["library", "/library"],
    ["learn", "/?workspace=learn"],
    ["plan", "/?workspace=plan"],
    ["build", "/?workspace=build"],
    ["storyboard", "/storyboard"],
    ["story-decisions", "/story-decisions"],
    ["story-workbench", "/story-workbench"],
  ]);
  assert.equal(findPerformanceBrowser({ CHROME_PATH: "C:\\Browser\\chrome.exe" }, (candidate) => candidate === "C:\\Browser\\chrome.exe"), "C:\\Browser\\chrome.exe");
  const source = await read("scripts/performance/measure-browser-responsiveness.mjs");
  assert.match(source, /headless-browser-cdp-useful-interactive-contract/);
  assert.match(source, /managedLauncherBrowser: false/);
  assert.match(source, /firstAccess/);
  assert.match(source, /repeatedAccess/);
  assert.match(source, /interactiveControlCount/);
  assert.match(source, /firstContentfulPaintMs/);
});

test("#1411 benchmark startup disables remote telemetry and strips Cloudflare credentials", () => {
  const environment = isolatedBenchmarkEnvironment({
    PATH: "test-path",
    CLOUDFLARE_API_TOKEN: "must-not-leave-harness",
    CLOUDFLARE_ACCOUNT_ID: "must-not-leave-harness",
  });
  assert.equal(environment.PATH, "test-path");
  assert.equal(environment.WRANGLER_SEND_METRICS, "false");
  assert.equal(environment.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(environment.CLOUDFLARE_ACCOUNT_ID, undefined);
});
