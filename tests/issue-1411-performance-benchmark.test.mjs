import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { analyzeBaselines, summarize } from "../scripts/performance/analyze-real-machine-baselines.mjs";
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
  assert.match(workflow, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
  assert.match(launcher, /PLOTPICKLE_PERFORMANCE_BENCHMARK/);
  assert.match(launcher, /browser launch and optional companion maintenance are suppressed/);
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