#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureWriterAppRuntime, stopOwnedWriterApp } from "./writer-app-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function cliValue(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] || "").trim() : "";
}

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(44, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

const baseUrl = cliValue("--base-url") || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173";
let activeChild = null;
let runtime = null;
let shuttingDown = false;

async function stopOwnedRuntime() {
  if (!runtime?.owned) return;
  status("Writer app runtime", "STOP", "Stopping only the temporary PlotPickle server started for this Avery run.");
  await stopOwnedWriterApp(runtime);
  status("Writer app runtime", "STOPPED");
}

async function runJourney() {
  const recovery = pathToFileURL(path.join(repoRoot, "scripts", "writer-in-residence-runtime-recovery.mjs")).href;
  const runner = path.join(repoRoot, "scripts", "run-writer-in-residence-e2e.mjs");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", recovery, runner, ...argv], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    activeChild = child;
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      activeChild = null;
      if (signal) return resolve(signal === "SIGINT" ? 130 : 1);
      resolve(Number(code ?? 1));
    });
  });
}

async function shutdownFromSignal(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (activeChild && activeChild.exitCode === null) activeChild.kill(signal);
  try {
    await stopOwnedRuntime();
  } catch (error) {
    status("Writer app runtime", "WARN", error instanceof Error ? error.message : String(error));
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
}

process.once("SIGINT", () => { void shutdownFromSignal("SIGINT"); });
process.once("SIGTERM", () => { void shutdownFromSignal("SIGTERM"); });

try {
  status("Writer app preflight", "START", baseUrl);
  runtime = await ensureWriterAppRuntime({
    baseUrl,
    repoRoot,
    onStatus: (state, detail) => status("Writer app preflight", state.toUpperCase(), detail),
  });
  status(
    "Writer app preflight",
    "PASS",
    runtime.owned ? "Temporary PlotPickle server is ready and owned by this Writer run." : "Reusing the existing healthy PlotPickle server; it will not be stopped afterward.",
  );
  process.exitCode = await runJourney();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  status("Writer app preflight", "FAIL", message);
  process.exitCode = 1;
} finally {
  try {
    await stopOwnedRuntime();
  } catch (error) {
    status("Writer app runtime", "WARN", error instanceof Error ? error.message : String(error));
  }
}
