#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ensureWriterAppRuntime, stopOwnedWriterApp } from "./writer-app-runtime.mjs";
import { endpointRuntimeEnvironment, managedEndpointEvidence } from "./local-endpoint-runtime.mjs";
import { resolveLocalEndpointTarget } from "./local-endpoint-target.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function cliValue(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? String(argv[index + 1] || "").trim() : "";
}

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(44, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

const requestedBaseUrl = cliValue("--base-url") || process.env.PLOTPICKLE_ACCEPTANCE_URL || "";
const writerJobId = process.env.PLOTPICKLE_LOCAL_ENDPOINT_JOB || `writer-${randomUUID().replaceAll("-", "").slice(0, 20)}`;
let activeChild = null;
let runtime = null;
let shuttingDown = false;

function managedEnvironment() {
  return runtime?.source === "local-endpoint-registry-direct"
    ? endpointRuntimeEnvironment(runtime)
    : {};
}

async function stopOwnedRuntime() {
  if (!runtime?.owned) return;
  status("Writer app runtime", "STOP", "Stopping only the temporary PlotPickle server started for this Avery run.");
  await stopOwnedWriterApp(runtime);
  status("Writer app runtime", "STOPPED");
}

async function runJourney() {
  const recovery = pathToFileURL(path.join(repoRoot, "scripts", "writer-in-residence-runtime-recovery.mjs")).href;
  const runner = path.join(repoRoot, "scripts", "run-writer-in-residence-e2e.mjs");
  const endpointEvidence = runtime?.source === "local-endpoint-registry-direct"
    ? JSON.stringify(managedEndpointEvidence(runtime))
    : process.env.PLOTPICKLE_LOCAL_ENDPOINT_EVIDENCE || "";
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", recovery, runner, ...argv], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...managedEnvironment(),
        PLOTPICKLE_WRITER_RUNTIME_SOURCE: runtime?.source || "unknown",
        ...(endpointEvidence ? { PLOTPICKLE_LOCAL_ENDPOINT_EVIDENCE: endpointEvidence } : {}),
      },
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

async function assertEndpointStillCurrent() {
  const target = await resolveLocalEndpointTarget({
    args: argv,
    env: { ...process.env, ...managedEnvironment() },
  });
  await target.assertCurrent();
  if (target.evidence) {
    status("Writer endpoint generation", "PASS", `${target.evidence.endpointId} generation ${target.evidence.generation}`);
  }
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
  status("Writer app preflight", "START", requestedBaseUrl || "managed local endpoint");
  runtime = await ensureWriterAppRuntime({
    ...(requestedBaseUrl ? { baseUrl: requestedBaseUrl } : {}),
    repoRoot,
    managedEndpoint: !requestedBaseUrl,
    jobId: writerJobId,
    onStatus: (state, detail) => status("Writer app preflight", state.toUpperCase(), detail),
  });
  status(
    "Writer app preflight",
    "PASS",
    runtime.source === "local-endpoint-registry-direct"
      ? `Exact managed endpoint ${runtime.record.endpointId} generation ${runtime.record.generation} is ready.`
      : runtime.owned
        ? "Temporary PlotPickle server is ready and owned by this Writer run."
        : "Reusing the explicitly selected healthy PlotPickle server; it will not be stopped afterward.",
  );
  const journeyExit = await runJourney();
  await assertEndpointStillCurrent();
  process.exitCode = journeyExit;
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
