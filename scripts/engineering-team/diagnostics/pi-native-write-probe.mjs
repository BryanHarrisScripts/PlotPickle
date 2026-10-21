#!/usr/bin/env node
/**
 * #3159: opt-in, one-shot physical Windows Pi write-tool diagnostic.
 * Writes only a disposable file under os.tmpdir(), never a source checkout,
 * job ledger, GitHub issue, story PPF, or queue config. Never calls cloud.
 * Emits sanitized status codes, NOT model text, paths, prompts or tool args.
 */
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { probeManagedPi } from "../../pi-managed-install.mjs";
import { resolveManagedPiCliEntry, runManagedPiProcess }
  from "../../../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs";
import {
  resolvePiExecutable, resolvePiLocalRuntime, configurePiLocalRuntime,
  piLocalEnvironment, piDeveloperEnvironment, piDeveloperRouteProjection,
  piDeveloperVirtualArgs, runPortableCommand,
} from "../../pi-worker-runtime.mjs";
import { summarizeFactoryPiWriteEvents }
  from "../windows/autonomous-issue-coder.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const FACTORY_PRIVATE_ROOT = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
  "PlotPickle", "engineering-team", "autonomous-queue");
const NAME = "fixture.txt";
const EXPECTED = "PLOTPICKLE_NATIVE_LOCAL_PI_WRITE_VERIFIED";
const TIMEOUT_MS = 240_000;
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const ARGS = [
  "--mode", "json", "-p", "--no-session",
  "--tools", "read,grep,find,ls,write,edit",
];
const QUIET = ["--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files"];
const PROMPT = [
  "Use the write tool to create a file named fixture.txt in the current working directory.",
  "Its content must be exactly PLOTPICKLE_NATIVE_LOCAL_PI_WRITE_VERIFIED with no trailing newline.",
  "Use a relative path. Do not access any other directory or file.",
  "No shell, networking, dependencies, or source changes. Do not merely say you wrote the file.",
].join(" ");

export function classifyNativePiWrite({ stdout, fileContents } = {}) {
  const events = summarizeFactoryPiWriteEvents(stdout);
  const counts = {
    writeStarted: events.writeStarted, writeSucceeded: events.writeSucceeded,
    writeFailed: events.writeFailed,
  };
  if (!events.valid || !events.settled ||
      events.writeStarted !== events.writeSucceeded + events.writeFailed)
    return Object.freeze({ code: "PI_WRITE_EVENTS_UNVERIFIED", ...counts });
  if (!events.writeStarted)
    return Object.freeze({ code: "PI_WRITE_TOOL_NOT_OBSERVED", ...counts });
  if (!events.writeSucceeded)
    return Object.freeze({ code: "PI_WRITE_TOOL_FAILED", ...counts });
  if (events.writeStarted !== 1 || events.writeSucceeded !== 1 || events.writeFailed !== 0)
    return Object.freeze({ code: "PI_UNEXPECTED_WRITE_ACTIVITY", ...counts });
  if (fileContents !== EXPECTED)
    return Object.freeze({ code: "PI_WRITTEN_BYTES_MISMATCH", ...counts });
  return Object.freeze({ code: "PI_NATIVE_WRITE_VERIFIED", ...counts });
}

async function resultFor({ cwd, invoke }) {
  let output;
  try { output = await invoke(); }
  catch (error) {
    return { code: error?.code === "ETIMEDOUT" ? "PI_EXECUTION_TIMEOUT" : "PI_EXECUTION_FAILED" };
  }
  let fileContents;
  try { fileContents = await readFile(path.join(cwd, NAME), "utf8"); }
  catch { fileContents = null; }
  return classifyNativePiWrite({ stdout: output.stdout, fileContents });
}

async function runPhysicalPiDiagnostic() {
  if (process.platform !== "win32")
    return { state: "BLOCKED", code: "WINDOWS_ONLY" };
  if (existsSync(path.join(FACTORY_PRIVATE_ROOT, "service.lock")))
    return { state: "BLOCKED", code: "STOP_FACTORY_FIRST" };

  // No installation is permitted by this diagnostic. A missing managed Pi is
  // a separate remediation, not consent to download packages on the host.
  const managed = await probeManagedPi();
  if (!managed.ready)
    return { state: "BLOCKED", code: "WORKBENCH_MANAGED_PI_NOT_READY" };
  const legacy = await resolvePiExecutable();
  if (!legacy.ready)
    return { state: "BLOCKED", code: "FACTORY_PI_EXECUTABLE_NOT_READY" };
  let runtime;
  try { runtime = await resolvePiLocalRuntime(); }
  catch { return { state: "BLOCKED", code: "LOCAL_MODEL_UNAVAILABLE" }; }

  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-physical-pi-"));
  try {
    const [directDir, factoryDir] = ["workbench-direct", "factory-virtual"].map(n => path.join(directory, n));
    await Promise.all([mkdir(directDir), mkdir(factoryDir)]);
    // configurePiLocalRuntime rejects every non-loopback inference endpoint.
    let configured;
    try { configured = await configurePiLocalRuntime(runtime, { purpose: "factory-native-write-probe" }); }
    catch { return { state: "BLOCKED", code: "LOCAL_MODEL_ROUTE_INVALID" }; }
    const cli = await resolveManagedPiCliEntry(managed);
    const direct = await resultFor({
      cwd: directDir,
      invoke: () => runManagedPiProcess([
        cli, ...ARGS, ...QUIET, "--no-extensions",
        "--provider", "plotpickle-local", "--model", runtime.model, PROMPT,
      ], {
        cwd: directDir, timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          ...piLocalEnvironment(configured.agentDir),
          PLOTPICKLE_PI_ALLOW_CLOUD: "0", PLOTPICKLE_PI_ROUTE: "local",
        },
      }),
    });
    const projection = piDeveloperRouteProjection(runtime, { localOnly: true });
    const factory = await resultFor({
      cwd: factoryDir,
      invoke: () => runPortableCommand(legacy.executable, [
        ...ARGS, ...piDeveloperVirtualArgs(REPO_ROOT), PROMPT,
      ], {
        cwd: factoryDir, timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          ...piDeveloperEnvironment(configured.agentDir, projection),
          PLOTPICKLE_PI_ALLOW_CLOUD: "0", PLOTPICKLE_PI_ROUTE: "local",
        },
      }),
    });
    const passed = direct.code === "PI_NATIVE_WRITE_VERIFIED" &&
      factory.code === "PI_NATIVE_WRITE_VERIFIED";
    return Object.freeze({
      state: passed ? "TEST_PASSED" : "TEST_FAILED",
      code: passed ? "PI_NATIVE_DUAL_ROUTE_VERIFIED" : "PI_NATIVE_ROUTE_DIFFERENTIAL",
      modelRoute: "LOOPBACK_ONLY", managedPiVersion: managed.version,
      factoryPiDiscovery: legacy.discoveryMethod,
      factoryPiVersion: String(legacy.version || "").match(/\\b\\d+\\.\\d+\\.\\d+\\b/)?.[0] || "UNKNOWN",
      workbench: direct, factory,
      modelInvoked: true, sourceMutationAuthorized: false,
      issueReserved: false, automaticMergeEnabled: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--local-write-once")
    throw new Error("Explicit opt-in required: --local-write-once");
  const result = await runPhysicalPiDiagnostic();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.state !== "TEST_PASSED") process.exitCode = 1;
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(() => {
    process.stdout.write(JSON.stringify({state:"BLOCKED",code:"PI_DIAGNOSTIC_UNVERIFIED"})+"\n");
    process.exitCode=1;
  });
