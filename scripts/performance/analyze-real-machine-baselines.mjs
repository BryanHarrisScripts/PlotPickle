#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export function summarize(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / finite.length;
  return {
    samples: finite.length,
    min: finite[0],
    max: finite.at(-1),
    mean: Number(mean.toFixed(2)),
    standardDeviation: Number(Math.sqrt(variance).toFixed(2)),
  };
}

const startupFields = [
  "sourceCheckStartedMs",
  "runtimePreparationStartedMs",
  "runtimeReadyMs",
  "agentSkillsCheckStartedMs",
  "agentSkillsReadyMs",
  "viteLaunchStartedMs",
  "viteReadyMs",
  "firstValidHttpResponseMs",
  "firstUsableCoreWorkspaceMs",
  "firstBrowserUsefulWorkspaceMs",
];
const startupModes = new Set(["fresh-runtime", "fresh-optimizer", "warm-persistent-runtime"]);

function summarizeBrowserPass(evidenceList, pass) {
  const labels = new Set(evidenceList.flatMap((entry) => entry.measurements?.browser?.[pass]?.map((item) => item.label) ?? []));
  return Object.fromEntries([...labels].sort().map((label) => [
    label,
    {
      usefulInteractiveMs: summarize(evidenceList.flatMap((entry) => (entry.measurements?.browser?.[pass] ?? []).filter((item) => item.label === label && item.ready).map((item) => item.usefulInteractiveMs))),
      firstContentfulPaintMs: summarize(evidenceList.flatMap((entry) => (entry.measurements?.browser?.[pass] ?? []).filter((item) => item.label === label && item.ready).map((item) => item.firstContentfulPaintMs))),
      interactiveControlCount: summarize(evidenceList.flatMap((entry) => (entry.measurements?.browser?.[pass] ?? []).filter((item) => item.label === label && item.ready).map((item) => item.interactiveControlCount))),
    },
  ]));
}

function summarizeBrowserIdle(evidenceList) {
  const idle = evidenceList.map((entry) => entry.measurements?.browser?.idle).filter(Boolean);
  return {
    reliability: "headless-browser-cdp-idle-window",
    samples: idle.length,
    windowMs: summarize(idle.map((entry) => entry.windowMs)),
    sameOriginRequestCount: summarize(idle.map((entry) => entry.sameOriginRequestCount)),
    apiRequestCount: summarize(idle.map((entry) => entry.apiRequestCount)),
    externalRequestCount: summarize(idle.map((entry) => entry.externalRequestCount)),
    domMutationCount: summarize(idle.map((entry) => entry.domMutationCount)),
    rendererTaskDurationMs: summarize(idle.map((entry) => entry.rendererTaskDurationMs)),
    modelOrAgentWakeups: {
      reliability: "not-observable-from-browser-cdp",
      note: "Process-level model or Agent wakeups remain explicitly unclaimed by browser idle evidence.",
    },
  };
}

function summarizeProcessIdle(evidenceList) {
  const idle = evidenceList
    .map((entry) => entry.measurements?.processIdle)
    .filter((entry) => entry?.reliability === "windows-cim-launcher-owned-process-tree");
  return {
    reliability: "windows-cim-launcher-owned-process-tree",
    samples: idle.length,
    observedWindowMs: summarize(idle.map((entry) => entry.observedWindowMs)),
    cpuTimeDeltaMs: summarize(idle.map((entry) => entry.cpuTimeDeltaMs)),
    workingSetAfterBytes: summarize(idle.map((entry) => entry.workingSetAfterBytes)),
    workingSetDeltaBytes: summarize(idle.map((entry) => entry.workingSetDeltaBytes)),
    activeProcessCount: summarize(idle.map((entry) => entry.activeProcessCount)),
    processCountAfter: summarize(idle.map((entry) => entry.processCountAfter)),
    appearedProcessCount: summarize(idle.map((entry) => entry.appearedProcessCount)),
    disappearedProcessCount: summarize(idle.map((entry) => entry.disappearedProcessCount)),
    explicitAgentOrModelProcessCount: summarize(idle.map((entry) => entry.explicitAgentOrModelProcessCount)),
    observerIncludedInOwnedTree: false,
    wholeMachineCpu: { value: null, reliability: "not-measured-by-launcher-owned-process-tree" },
    gpuUsage: { value: null, reliability: "not-measured-by-windows-cim-process-snapshot" },
  };
}

function analyzeMode(mode, evidenceList) {
  const healthy = evidenceList.filter((entry) =>
    entry.result?.harnessHealthy === true &&
    (!startupModes.has(mode) || entry.result?.startupHealthy === true)
  );
  const identities = new Set(healthy.map((entry) => JSON.stringify({
    version: entry.environment?.plotpickleVersion ?? null,
    commit: entry.environment?.commit ?? null,
    node: entry.environment?.node ?? null,
    arch: entry.environment?.arch ?? null,
    fixture: entry.environment?.afterglowFixture ?? null,
    curriculum: entry.environment?.curriculumIdentity ?? null,
    ppfRevision: entry.environment?.ppfStartingRevision ?? null,
    buzzMode: entry.environment?.buzzMode ?? null,
    optionalIntegrations: entry.environment?.optionalIntegrations ?? [],
  })));
  const identityStable = identities.size <= 1;
  const routeLabels = new Set(healthy.flatMap((entry) => entry.measurements?.navigation?.map((item) => item.label) ?? []));
  const navigation = Object.fromEntries([...routeLabels].sort().map((label) => [
    label,
    summarize(healthy.flatMap((entry) => (entry.measurements?.navigation ?? []).filter((item) => item.label === label && item.ok).map((item) => item.elapsedMs))),
  ]));
  const startup = Object.fromEntries(startupFields.map((field) => [
    field,
    summarize(healthy.map((entry) => entry.measurements?.startup?.[field])),
  ]));
  const memoryRss = summarize(healthy.map((entry) => entry.measurements?.memory?.rssAfterBytes));
  const browser = {
    reliability: "headless-browser-cdp-useful-interactive-contract",
    firstAccess: summarizeBrowserPass(healthy, "firstAccess"),
    repeatedAccess: summarizeBrowserPass(healthy, "repeatedAccess"),
    idle: summarizeBrowserIdle(healthy),
  };
  const processIdle = summarizeProcessIdle(healthy);
  const readyForBudgetRatification = healthy.length >= 3 && identityStable;
  return {
    mode,
    authoritativeSampleCount: evidenceList.length,
    healthySampleCount: healthy.length,
    identityStable,
    readyForBudgetRatification,
    startup,
    navigation,
    browser,
    processIdle,
    memoryRss,
  };
}

export function analyzeBaselines(evidenceList) {
  const authoritative = evidenceList.filter((entry) =>
    entry?.benchmarkIssue === 1411 &&
    entry?.authoritative === true &&
    entry?.environment?.platform === "win32" &&
    entry?.environment?.arch === "x64" &&
    entry?.environment?.node === "v24.19.0"
  );
  const grouped = Map.groupBy(authoritative, (entry) => entry.mode ?? "unknown");
  const modes = Object.fromEntries([...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([mode, entries]) => [
    mode,
    analyzeMode(mode, entries),
  ]));
  const analyzedModes = Object.keys(modes);
  const readyModes = analyzedModes.filter((mode) => modes[mode].readyForBudgetRatification);
  return {
    schemaVersion: 2,
    benchmarkIssue: 1411,
    authoritativeSampleCount: authoritative.length,
    rejectedEvidenceCount: evidenceList.length - authoritative.length,
    modeSeparationEnforced: true,
    analyzedModes,
    readyModes,
    modes,
    readyForBudgetRatification: analyzedModes.length > 0 && readyModes.length === analyzedModes.length,
    budgetGuidance: readyModes.length > 0
      ? `Human review may ratify tolerances only for these independently repeated modes: ${readyModes.join(", ")}. This analyzer does not invent them.`
      : "Keep budgets unratified until at least three authoritative Windows samples share one workload identity within the same startup mode.",
  };
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const inputs = args.filter((arg, index) => arg !== "--output" && index !== outputIndex + 1);
  if (inputs.length === 0) throw new Error("Pass one or more #1411 benchmark evidence JSON files.");
  const evidence = await Promise.all(inputs.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  const report = analyzeBaselines(evidence);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) await writeFile(path.resolve(output), json, "utf8");
  else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1]).replaceAll("\\", "/")}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
