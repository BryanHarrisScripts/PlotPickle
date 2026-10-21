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


/**
 * Probe the SAME physical local model directly using the OpenAI-compatible
 * chat/completions tools protocol. No returned tool call is EVER executed.
 * No prompts, response text, model arguments or private endpoint URLs are logged.
 */
export async function probeLocalModelToolApi({
  runtime, request = fetch,
} = {}) {
  let parsed;
  try {
    parsed = new URL(runtime.baseUrl);
    const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
    if (!["127.0.0.1", "localhost", "::1"].includes(hostname) ||
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username || parsed.password ||
        !runtime.model || typeof runtime.model !== "string")
      return { code: "LOCAL_MODEL_ROUTE_INVALID" };
  } catch {
    return { code: "LOCAL_MODEL_ROUTE_INVALID" };
  }
  const marker = "PLOTPICKLE_TOOL_API_VERIFIED";
  const name = "plotpickle_tool_capability_probe";
  const body = {
    model: runtime.model,
    messages: [
      { role: "system", content: "Invoke the supplied function exactly once. No text answer is needed." },
      { role: "user", content: "Call plotpickle_tool_capability_probe with marker PLOTPICKLE_TOOL_API_VERIFIED." },
    ],
    tools: [{
      type: "function",
      function: {
        name,
        description: "Report a fixed marker only. This function is never executed.",
        parameters: {
          type: "object",
          properties: { marker: { type: "string", enum: [marker] } },
          required: ["marker"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name } },
    stream: false,
    max_tokens: 128,
  };
  let response;
  try {
    response = await request(
      parsed.toString().replace(/\/$/, "") + "/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer plotpickle-local",
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal: AbortSignal.timeout(90_000),
      },
    );
  } catch (error) {
    return { code: error?.name === "TimeoutError"
      ? "LOCAL_MODEL_API_TIMEOUT" : "LOCAL_MODEL_API_UNREACHABLE" };
  }
  if (!response?.ok) {
    return {
      code: "LOCAL_TOOL_REQUEST_REJECTED",
      httpStatus: Number.isInteger(response?.status) ? response.status : null,
    };
  }
  let payload;
  try {
    const declaredSize = Number(response.headers?.get?.("content-length") || 0);
    if (declaredSize > 262144) return { code: "LOCAL_MODEL_API_UNVERIFIABLE" };
    const text = await response.text();
    if (text.length > 262144) return { code: "LOCAL_MODEL_API_UNVERIFIABLE" };
    payload = JSON.parse(text);
  } catch {
    return { code: "LOCAL_MODEL_API_UNVERIFIABLE" };
  }
  const message = payload?.choices?.[0]?.message;
  const finishReason = payload?.choices?.[0]?.finish_reason;
  const calls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  if (calls.length === 0)
    return { code: "LOCAL_MODEL_RETURNED_NO_TOOL_CALL",
      finishReason: typeof finishReason === "string"
        ? ["stop", "tool_calls", "length", "content_filter"].includes(finishReason)
          ? finishReason : "OTHER"
        : "UNKNOWN" };
  if (calls.length !== 1 || calls[0]?.type !== "function" ||
      calls[0]?.function?.name !== name)
    return { code: "LOCAL_MODEL_TOOL_CALL_MISMATCH", toolCallCount: calls.length };
  let args;
  try { args = JSON.parse(calls[0].function.arguments); }
  catch { return { code: "LOCAL_MODEL_TOOL_ARGUMENTS_INVALID" }; }
  if (args?.marker !== marker)
    return { code: "LOCAL_MODEL_TOOL_ARGUMENTS_INVALID" };
  return { code: "LOCAL_MODEL_TOOL_API_VERIFIED", toolCallCount: 1 };
}

export function classifyPiDualRoute(workbench, factory) {
  if (workbench?.code === "PI_NATIVE_WRITE_VERIFIED" &&
      factory?.code === "PI_NATIVE_WRITE_VERIFIED")
    return { state: "TEST_PASSED", code: "PI_NATIVE_DUAL_ROUTE_VERIFIED" };
  if (workbench?.code === "PI_WRITE_TOOL_NOT_OBSERVED" &&
      factory?.code === "PI_WRITE_TOOL_NOT_OBSERVED")
    return { state: "TEST_FAILED", code: "PI_NATIVE_SHARED_NO_WRITE" };
  if (workbench?.code === factory?.code)
    return { state: "TEST_FAILED", code: "PI_NATIVE_SHARED_FAILURE" };
  return { state: "TEST_FAILED", code: "PI_NATIVE_ROUTE_DIFFERENTIAL" };
}

async function runLocalToolApiDiagnostic() {
  if (process.platform !== "win32") return { state: "BLOCKED", code: "WINDOWS_ONLY" };
  if (existsSync(path.join(FACTORY_PRIVATE_ROOT, "service.lock")))
    return { state: "BLOCKED", code: "STOP_FACTORY_FIRST" };
  let runtime;
  try { runtime = await resolvePiLocalRuntime(); }
  catch { return { state: "BLOCKED", code: "LOCAL_MODEL_UNAVAILABLE" }; }
  const api = await probeLocalModelToolApi({ runtime });
  return {
    state: api.code === "LOCAL_MODEL_TOOL_API_VERIFIED" ? "TEST_PASSED" : "TEST_FAILED",
    selectedModel: /^[a-z0-9_./:@+-]{1,120}$/i.test(runtime.model)
      ? runtime.model : "REDACTED",
    runtimeKind: ["explicit", "ollama", "lm-studio", "llama-cpp", "openai-compatible"].includes(runtime.kind)
      ? runtime.kind : "OTHER",
    ...api, toolExecuted: false, issueReserved: false, sourceMutationAuthorized: false,
  };
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
    const outcome = classifyPiDualRoute(direct, factory);
    return Object.freeze({
      ...outcome,
      modelRoute: "LOOPBACK_ONLY", managedPiVersion: managed.version,
      factoryPiDiscovery: legacy.discoveryMethod,
      factoryPiVersion: String(legacy.version || "").match(/\b\d+\.\d+\.\d+\b/)?.[0] || "UNKNOWN",
      workbench: direct, factory,
      modelInvoked: true, sourceMutationAuthorized: false,
      issueReserved: false, automaticMergeEnabled: false,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  if (process.argv.length !== 3 ||
      !["--local-write-once", "--local-tool-api-once"].includes(process.argv[2]))
    throw new Error("Explicit opt-in required.");
  const result = process.argv[2] === "--local-tool-api-once"
    ? await runLocalToolApiDiagnostic() : await runPhysicalPiDiagnostic();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.state !== "TEST_PASSED") process.exitCode = 1;
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(() => {
    process.stdout.write(JSON.stringify({state:"BLOCKED",code:"PI_DIAGNOSTIC_UNVERIFIED"})+"\n");
    process.exitCode=1;
  });
