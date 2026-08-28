#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { measureStoryWorkflowContract } from "./measure-story-workflow-contract.mjs";

const args = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const hasFlag = (name) => args.includes(name);

const mode = getArg("--mode", "warm-persistent-runtime");
const baseUrl = getArg("--base-url", "http://127.0.0.1:3000").replace(/\/$/, "");
const output = getArg("--output", path.join(".artifacts", "performance", `plotpickle-performance-${Date.now()}.json`));
const allowNonWindows = hasFlag("--allow-non-windows");

const supportedModes = new Set([
  "warm-persistent-runtime",
  "fresh-optimizer",
  "fresh-runtime",
  "story-workflow-local",
  "buzz-enabled-story-council",
]);

if (!supportedModes.has(mode)) {
  throw new Error(`Unsupported benchmark mode: ${mode}`);
}
if (process.platform !== "win32" && !allowNonWindows) {
  throw new Error("#1411 authoritative benchmark must run on Windows. Pass --allow-non-windows only for non-authoritative harness validation.");
}

const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
const gitSha = process.env.GITHUB_SHA || process.env.PLOTPICKLE_COMMIT || null;
const startedAt = new Date().toISOString();
const memoryBefore = process.memoryUsage();

const routes = [
  ["dashboard", "/"],
  ["library", "/library"],
  ["learn", "/learn"],
  ["plan", "/plan"],
  ["build", "/build"],
  ["story-decisions", "/story-decisions"],
  ["story-workbench", "/story-workbench"],
];

async function measureRequest(label, pathname) {
  const start = performance.now();
  let response;
  let error = null;
  try {
    response = await fetch(`${baseUrl}${pathname}`, {
      redirect: "manual",
      headers: { "x-plotpickle-benchmark": "1411" },
    });
    await response.arrayBuffer();
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }
  const elapsedMs = Number((performance.now() - start).toFixed(2));
  return {
    label,
    path: pathname,
    elapsedMs,
    status: response?.status ?? null,
    ok: Boolean(response?.ok),
    error,
  };
}

const navigation = [];
for (const [label, pathname] of routes) {
  navigation.push(await measureRequest(label, pathname));
}

const workflowMode = mode === "story-workflow-local" || mode === "buzz-enabled-story-council";
const workflow = workflowMode
  ? measureStoryWorkflowContract({
      projectId: "afterglow-v9",
      baseRevision: Number(process.env.PLOTPICKLE_PPF_START_REVISION || 9),
      changedRefs: ["ppf:foundations:ren-motivation"],
    })
  : {
      status: "not-requested-for-mode",
      note: "Use story-workflow-local or buzz-enabled-story-council mode to capture deterministic workflow planning and targeted re-evaluation evidence.",
    };

const memoryAfter = process.memoryUsage();
const failedRoutes = navigation.filter((entry) => !entry.ok);
const evidence = {
  schemaVersion: 2,
  benchmarkIssue: 1411,
  authoritative: process.platform === "win32" && !allowNonWindows,
  mode,
  startedAt,
  finishedAt: new Date().toISOString(),
  environment: {
    plotpickleVersion: packageJson.version,
    commit: gitSha,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    cpuModel: os.cpus()[0]?.model ?? null,
    cpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    freeMemoryBytes: os.freemem(),
    afterglowFixture: process.env.PLOTPICKLE_AFTERGLOW_FIXTURE || "afterglow-v9",
    ppfStartingRevision: process.env.PLOTPICKLE_PPF_START_REVISION || null,
    curriculumIdentity: process.env.PLOTPICKLE_CURRICULUM_IDENTITY || null,
    buzzMode: process.env.PLOTPICKLE_BUZZ_MODE || "disabled-or-unspecified",
    optionalIntegrations: (process.env.PLOTPICKLE_OPTIONAL_INTEGRATIONS || "").split(",").filter(Boolean),
  },
  measurements: {
    navigation,
    memory: {
      reliability: "process-only",
      rssBeforeBytes: memoryBefore.rss,
      rssAfterBytes: memoryAfter.rss,
      heapUsedBeforeBytes: memoryBefore.heapUsed,
      heapUsedAfterBytes: memoryAfter.heapUsed,
    },
  },
  workflow,
  budgets: {
    status: "unratified",
    note: "Hard thresholds are intentionally absent until repeated real-machine baseline samples establish variance.",
  },
  result: {
    routeFailures: failedRoutes.length,
    harnessHealthy: failedRoutes.length === 0,
    workflowBounded: workflow.status !== "captured-deterministic-contract" || workflow.comparison.targetedIsBounded,
  },
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(`Performance evidence written to ${output}`);
if (failedRoutes.length > 0) {
  console.error(`Benchmark route failures: ${failedRoutes.map((entry) => `${entry.label}:${entry.status ?? entry.error}`).join(", ")}`);
  process.exitCode = 1;
}
if (workflow.status === "captured-deterministic-contract" && !workflow.comparison.targetedIsBounded) {
  console.error("Targeted Story Workflow re-evaluation was not bounded relative to the deterministic full audit.");
  process.exitCode = 1;
}
