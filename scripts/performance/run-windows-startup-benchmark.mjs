#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { measureBrowserResponsiveness } from "./measure-browser-responsiveness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const value = (flag, fallback = "") => {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};
const mode = value("--mode", "fresh-runtime");
const output = path.resolve(value("--output", path.join(repoRoot, ".artifacts", "performance", `windows-${Date.now()}.json`)));
const baseUrl = "http://127.0.0.1:4173";
const timeoutMs = Number(value("--timeout-ms", "600000"));
const allowNonWindows = argv.includes("--allow-non-windows");

if (!Number.isFinite(timeoutMs) || timeoutMs < 30_000 || timeoutMs > 900_000) {
  throw new Error("#1411 launcher timeout must be between 30000 and 900000 ms.");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const elapsed = (started) => Number((performance.now() - started).toFixed(2));
const clean = (text) => String(text).replace(/\x1b\[[0-9;]*m/g, "");

export function isolatedBenchmarkEnvironment(environment = process.env) {
  const isolated = {
    ...environment,
    CI: "true",
    PLOTPICKLE_PERFORMANCE_BENCHMARK: "1",
    PLOTPICKLE_STARTUP_CONTRACT: environment.PLOTPICKLE_STARTUP_CONTRACT || "plotpickle-startup-v4-benchmark",
    WRANGLER_SEND_METRICS: "false",
  };
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_KEY", "CLOUDFLARE_EMAIL"]) {
    delete isolated[name];
  }
  return isolated;
}

export function observeStartupOutput(phases, text, nowMs) {
  const line = clean(text);
  const mark = (field, pattern) => {
    if (phases[field] == null && pattern.test(line)) phases[field] = nowMs;
  };
  mark("sourceCheckStartedMs", /\[UPDATE CHECK\]/);
  mark("runtimePreparationStartedMs", /\[STEP 1 OF 3\]/);
  mark("runtimeReadyMs", /Persistent runtime /);
  mark("agentSkillsCheckStartedMs", /\[AGENT SKILLS CHECK\]/);
  mark("agentSkillsReadyMs", /Agent Skills are registered and verified/);
  mark("viteLaunchStartedMs", /\[STEP 3 OF 3\]/);
  mark("viteReadyMs", /Local:\s+http:\/\/127\.0\.0\.1:4173/);
  return phases;
}

export function optimizerCachePath(root = repoRoot) {
  return path.join(root, "node_modules", ".vite");
}

async function prepareBenchmarkMode() {
  if (mode === "fresh-optimizer") {
    await rm(optimizerCachePath(), { recursive: true, force: true });
  }
}

async function waitForPlotPickle(started, child, outputTail) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`PlotPickle launcher exited ${child.exitCode} before readiness. ${outputTail().slice(-2000)}`);
    }
    try {
      const response = await fetch(baseUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(3_000),
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
      const body = await response.text();
      if (response.ok && /PlotPickle/i.test(body) && /plotpickle-startup-v4/i.test(body)) {
        return { elapsedMs: elapsed(started), status: response.status };
      }
    } catch {}
    await sleep(250);
  }
  throw new Error(`PlotPickle launcher did not become ready within ${timeoutMs} ms. ${outputTail().slice(-2000)}`);
}

async function stopOwnedLauncher(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
    return;
  }
  child.kill("SIGTERM");
}

async function runEvidence() {
  if (process.platform !== "win32" && !allowNonWindows) {
    throw new Error("#1411 real launcher benchmark must run on Windows.");
  }
  await prepareBenchmarkMode();
  const child = spawn(process.platform === "win32" ? "cmd.exe" : "bash", process.platform === "win32"
    ? ["/d", "/s", "/c", "Start-PlotPickle.bat"]
    : ["-lc", "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173 --strictPort"], {
    cwd: repoRoot,
    env: isolatedBenchmarkEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const started = performance.now();
  const startedAtEpochMs = Date.now();
  const phases = {
    launcherStartedMs: 0,
    sourceCheckStartedMs: null,
    runtimePreparationStartedMs: null,
    runtimeReadyMs: null,
    agentSkillsCheckStartedMs: null,
    agentSkillsReadyMs: null,
    viteLaunchStartedMs: null,
    viteReadyMs: null,
    firstValidHttpResponseMs: null,
    firstUsableCoreWorkspaceMs: null,
  };
  const chunks = [];
  const capture = (chunk) => {
    const text = String(chunk);
    chunks.push(text);
    if (chunks.length > 300) chunks.shift();
    observeStartupOutput(phases, text, elapsed(started));
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);

  try {
    const ready = await waitForPlotPickle(started, child, () => clean(chunks.join("")));
    phases.firstValidHttpResponseMs = ready.elapsedMs;
    const dashboard = await fetch(`${baseUrl}/?workspace=dashboard`, { signal: AbortSignal.timeout(10_000) });
    await dashboard.arrayBuffer();
    if (!dashboard.ok) throw new Error(`Dashboard readiness returned HTTP ${dashboard.status}.`);
    phases.firstUsableCoreWorkspaceMs = elapsed(started);

    await new Promise((resolve, reject) => {
      const benchmark = spawn(process.execPath, [
        path.join(repoRoot, "scripts", "performance", "run-real-machine-benchmark.mjs"),
        "--mode", mode,
        "--base-url", baseUrl,
        "--output", output,
        ...(allowNonWindows ? ["--allow-non-windows"] : []),
      ], { cwd: repoRoot, env: process.env, stdio: "inherit", windowsHide: true });
      benchmark.once("error", reject);
      benchmark.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Performance evidence runner exited ${code}.`)));
    });

    const evidence = JSON.parse(await readFile(output, "utf8"));
    const browser = allowNonWindows ? null : await measureBrowserResponsiveness({ baseUrl });
    if (browser) {
      phases.firstBrowserUsefulWorkspaceMs = browser.firstUsefulWorkspaceAtEpochMs - startedAtEpochMs;
      delete browser.firstUsefulWorkspaceAtEpochMs;
      evidence.measurements.browser = browser;
    }
    evidence.measurements.startup = {
      reliability: "real-launcher-http-contract",
      launcher: "Start-PlotPickle.bat",
      browserSuppressed: true,
      optionalCompanionMaintenanceSuppressed: true,
      ...phases,
    };
    evidence.result.startupHealthy = phases.firstUsableCoreWorkspaceMs != null;
    await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    process.stdout.write(`Authoritative Windows startup evidence written to ${output}\n`);
  } finally {
    await stopOwnedLauncher(child);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runEvidence().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
