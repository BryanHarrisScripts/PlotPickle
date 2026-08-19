#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verificationCommandFor } from "./full-verification-process.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const plotPickleUrl = "http://127.0.0.1:4173";
const viteCli = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");

export const FULL_VERIFICATION_STAGE_NAMES = [
  "1 of 9 - Agent Skills registry",
  "2 of 9 - Agent Skills architecture boundaries",
  "3 of 9 - LEARN curriculum validation",
  "4 of 9 - Production build",
  "5 of 9 - Ensure Pi local repair model",
  "6 of 9 - Pi repair preflight",
  "7 of 9 - Verify BUZZ live activity",
  "8 of 9 - Exhaustive code-aware UI and UX UAT",
  "9 of 9 - Writer-in-Residence",
];

const EMPTY_INPUT_SCHEMA = { type: "object", required: [], allowed: [], maxBytes: 1_024 };
const RESULT_OUTPUT_SCHEMA = {
  type: "object",
  required: ["status", "exitCode", "detail", "durationMs"],
  allowed: ["status", "exitCode", "detail", "durationMs"],
  maxBytes: 4_096,
};
const STANDARD_NODE = {
  authoritative: true,
  resources: [],
  inputSchema: EMPTY_INPUT_SCHEMA,
  outputSchema: RESULT_OUTPUT_SCHEMA,
};

export const FULL_VERIFICATION_GRAPH = [
  {
    ...STANDARD_NODE,
    id: "agent-skills-registry",
    number: 1,
    name: FULL_VERIFICATION_STAGE_NAMES[0],
    category: "Architecture",
    tool: "node",
    args: ["scripts/agent-skills.mjs", "--self-test"],
    dependencies: [],
  },
  {
    ...STANDARD_NODE,
    id: "agent-skills-architecture",
    number: 2,
    name: FULL_VERIFICATION_STAGE_NAMES[1],
    category: "Architecture",
    tool: "node",
    args: ["--test", "tests/sage-brinewick-agent-skill.test.mjs", "tests/issue-913-agent-skills-migration.test.mjs"],
    dependencies: [],
  },
  {
    ...STANDARD_NODE,
    id: "learn-curriculum",
    number: 3,
    name: FULL_VERIFICATION_STAGE_NAMES[2],
    category: "Curriculum",
    tool: "npm",
    args: ["run", "validate:learn"],
    dependencies: [],
  },
  {
    ...STANDARD_NODE,
    id: "production-build",
    number: 4,
    name: FULL_VERIFICATION_STAGE_NAMES[3],
    category: "Production Build",
    tool: "npm",
    args: ["run", "build"],
    dependencies: [],
    resources: ["workspace-build"],
  },
  {
    ...STANDARD_NODE,
    id: "ensure-pi-model",
    number: 5,
    name: FULL_VERIFICATION_STAGE_NAMES[4],
    category: "Local AI / Pi",
    tool: "node",
    args: ["scripts/ensure-local-repair-model.mjs", "--worker", "pi"],
    dependencies: [],
    resources: ["local-ai-runtime"],
  },
  {
    ...STANDARD_NODE,
    id: "pi-preflight",
    number: 6,
    name: FULL_VERIFICATION_STAGE_NAMES[5],
    category: "Local AI / Pi",
    tool: "node",
    args: ["scripts/run-uat-repair-agent.mjs", "--worker", "pi", "--preflight", "--require-ready"],
    dependencies: [{ id: "ensure-pi-model", require: "success", reason: "Pi preflight requires the local repair model readiness established by stage 5." }],
    resources: ["local-ai-runtime"],
  },
  {
    id: "app-ready",
    authoritative: false,
    name: "PlotPickle local app readiness",
    category: "Infrastructure",
    tool: "app-ready",
    args: [],
    dependencies: [{ id: "production-build", require: "complete", reason: "The verification app server shares build workspace state and waits for the build process to release it, even when the build itself failed." }],
    resources: ["workspace-build"],
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: RESULT_OUTPUT_SCHEMA,
  },
  {
    ...STANDARD_NODE,
    id: "buzz-live",
    number: 7,
    name: FULL_VERIFICATION_STAGE_NAMES[6],
    category: "BUZZ",
    tool: "node",
    args: ["scripts/verify-buzz-live-activity.mjs"],
    dependencies: [{ id: "app-ready", require: "success", reason: "Live BUZZ verification requires a reachable PlotPickle loopback app." }],
  },
  {
    ...STANDARD_NODE,
    id: "exhaustive-uat",
    number: 8,
    name: FULL_VERIFICATION_STAGE_NAMES[7],
    category: "UI / UX UAT",
    tool: "node",
    args: ["scripts/run-exhaustive-ui-uat.mjs"],
    dependencies: [{ id: "app-ready", require: "success", reason: "Rendered UI/UX UAT requires a reachable PlotPickle loopback app." }],
    resources: ["browser-project-state"],
  },
  {
    ...STANDARD_NODE,
    id: "writer-in-residence",
    number: 9,
    name: FULL_VERIFICATION_STAGE_NAMES[8],
    category: "Writer Journey",
    tool: "node",
    args: ["scripts/run-writer-in-residence.mjs"],
    dependencies: [{ id: "app-ready", require: "success", reason: "The Writer-in-Residence journey requires a reachable PlotPickle loopback app." }],
    resources: ["browser-project-state"],
  },
];

const TERMINAL = new Set(["PASS", "FAIL", "BLOCKED"]);
let managedVerificationApp = null;
let managedVerificationAppTail = "";

function boundedParallelism(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(4, Math.floor(parsed))) : 3;
}

function cleanDetail(value, limit = 1200) {
  return String(value || "")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\/(?:home|Users)\/[^/\s]+/g, "~")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-limit);
}

function jsonBytes(value) {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8"); } catch { return Number.MAX_SAFE_INTEGER; }
}

function validateSchema(schema) {
  if (!schema || schema.type !== "object" || !Array.isArray(schema.required) || !Array.isArray(schema.allowed)) return false;
  if (!Number.isFinite(Number(schema.maxBytes)) || Number(schema.maxBytes) < 1) return false;
  return schema.required.every((key) => schema.allowed.includes(key));
}

export function validateFullVerificationGraph(graph = FULL_VERIFICATION_GRAPH) {
  const errors = [];
  const ids = new Set();
  for (const node of graph) {
    if (!node?.id || ids.has(node.id)) errors.push(`Graph node ID is missing or duplicated: ${node?.id || "<empty>"}.`);
    ids.add(node?.id);
    if (!node?.name || !node?.category || !["node", "npm", "app-ready"].includes(node?.tool)) errors.push(`Graph node ${node?.id || "<empty>"} has an invalid bounded job contract.`);
    if (!validateSchema(node?.inputSchema) || !validateSchema(node?.outputSchema)) errors.push(`Graph node ${node?.id || "<empty>"} is missing a valid typed input/output schema.`);
    for (const dependency of node?.dependencies || []) {
      if (!dependency?.id || !["success", "complete"].includes(dependency?.require) || !String(dependency?.reason || "").trim()) errors.push(`Graph node ${node?.id || "<empty>"} has an invalid dependency edge.`);
    }
  }
  for (const node of graph) for (const dependency of node.dependencies || []) if (!ids.has(dependency.id)) errors.push(`Graph node ${node.id} depends on missing node ${dependency.id}.`);
  const authoritative = graph.filter((node) => node.authoritative).sort((a, b) => a.number - b.number);
  if (authoritative.length !== 9 || authoritative.some((node, index) => node.name !== FULL_VERIFICATION_STAGE_NAMES[index])) errors.push("The graph must preserve exactly nine canonical authoritative Full Verification stages.");
  return errors;
}

export function validateVerificationNodeResult(node, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Node result must be an object." };
  const schema = node.outputSchema;
  const keys = Object.keys(value);
  if (schema.required.some((key) => !Object.hasOwn(value, key))) return { ok: false, error: "Node result is missing a required field." };
  if (keys.some((key) => !schema.allowed.includes(key))) return { ok: false, error: "Node result contains an undeclared field." };
  if (jsonBytes(value) > schema.maxBytes) return { ok: false, error: "Node result exceeds its byte budget." };
  if (!new Set(["PASS", "FAIL"]).has(value.status)) return { ok: false, error: "Node result status must be PASS or FAIL." };
  if (!Number.isFinite(Number(value.exitCode)) || !Number.isFinite(Number(value.durationMs))) return { ok: false, error: "Node result exitCode and durationMs must be numeric." };
  return { ok: true, error: "" };
}

function commandFor(node) {
  return verificationCommandFor(node);
}

function writeChunk(prefix, stream, chunk) {
  const text = String(chunk || "");
  if (!text) return;
  const lines = text.split(/(?<=\n)/);
  for (const line of lines) if (line) stream.write(`[${prefix}] ${line}`);
}

export async function executeCommandNode(node, options = {}) {
  const { command, args } = commandFor(node);
  const started = Date.now();
  let tail = "";
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const capture = (chunk, stream) => {
      const text = String(chunk || "");
      tail = `${tail}${text}`.slice(-12_000);
      if (options.echo !== false) writeChunk(node.id, stream, text);
    };
    child.stdout?.on("data", (chunk) => capture(chunk, process.stdout));
    child.stderr?.on("data", (chunk) => capture(chunk, process.stderr));
    child.on("error", (error) => resolve({ status: "FAIL", exitCode: 1, detail: cleanDetail(error.message), durationMs: Date.now() - started }));
    child.on("close", (code) => {
      const exitCode = Number.isFinite(Number(code)) ? Number(code) : 1;
      resolve({
        status: exitCode === 0 ? "PASS" : "FAIL",
        exitCode,
        detail: exitCode === 0 ? "" : cleanDetail(tail) || `Process exited with code ${exitCode}.`,
        durationMs: Date.now() - started,
      });
    });
  });
}

async function plotPickleReady() {
  try {
    const response = await fetch(plotPickleUrl, { signal: AbortSignal.timeout(3_000) });
    const body = await response.text();
    return response.ok && /PlotPickle/i.test(body);
  } catch {
    return false;
  }
}

function captureManagedAppOutput(chunk, stream, echo) {
  const text = String(chunk || "");
  if (!text) return;
  managedVerificationAppTail = `${managedVerificationAppTail}${text}`.slice(-12_000);
  if (echo !== false) writeChunk("app-ready", stream, text);
}

async function waitForManagedAppClose(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (closed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      resolve(closed);
    };
    const onClose = () => finish(true);
    const timer = setTimeout(() => finish(child.exitCode !== null || child.signalCode !== null), timeoutMs);
    child.once("close", onClose);
  });
}

export async function stopManagedPlotPickleVerificationServer() {
  const child = managedVerificationApp;
  managedVerificationApp = null;
  managedVerificationAppTail = "";
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve();
      };
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        shell: false,
        stdio: "ignore",
      });
      timer = setTimeout(() => {
        try { killer.kill(); } catch {}
        finish();
      }, 5_000);
      killer.once("error", finish);
      killer.once("close", finish);
    });
    if (!(await waitForManagedAppClose(child, 3_000))) {
      try { child.kill(); } catch {}
      await waitForManagedAppClose(child, 2_000);
    }
    return;
  }

  try { child.kill("SIGTERM"); } catch {}
  if (await waitForManagedAppClose(child, 3_000)) return;
  try { child.kill("SIGKILL"); } catch {}
  await waitForManagedAppClose(child, 2_000);
}

export async function ensurePlotPickleReady(options = {}) {
  const started = Date.now();
  if (await plotPickleReady()) {
    return { status: "PASS", exitCode: 0, detail: "PlotPickle was already reachable.", durationMs: Date.now() - started };
  }

  try {
    await access(viteCli);
  } catch {
    return {
      status: "FAIL",
      exitCode: 1,
      detail: "The verified Vite runtime is unavailable. Production dependencies must be ready before browser verification can start.",
      durationMs: Date.now() - started,
    };
  }

  managedVerificationAppTail = "";
  let child;
  try {
    child = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PLOTPICKLE_STARTUP_CONTRACT: "plotpickle-full-verification",
        VITE_CONFIG_NATIVE_IGNORE_WARNING: "true",
      },
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    managedVerificationApp = child;
  } catch (error) {
    return { status: "FAIL", exitCode: 1, detail: cleanDetail(error instanceof Error ? error.message : String(error)), durationMs: Date.now() - started };
  }

  child.stdout?.on("data", (chunk) => captureManagedAppOutput(chunk, process.stdout, options.echo));
  child.stderr?.on("data", (chunk) => captureManagedAppOutput(chunk, process.stderr, options.echo));

  const waitSeconds = Math.max(30, Math.min(900, Number(options.startupWaitSeconds) || 240));
  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    if (await plotPickleReady()) {
      return {
        status: "PASS",
        exitCode: 0,
        detail: "Full Verification started its managed PlotPickle server on the loopback application URL.",
        durationMs: Date.now() - started,
      };
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      const code = Number.isFinite(Number(child.exitCode)) ? Number(child.exitCode) : 1;
      const evidence = cleanDetail(managedVerificationAppTail, 700);
      return {
        status: "FAIL",
        exitCode: code || 1,
        detail: `The managed verification app server exited before becoming ready${evidence ? `: ${evidence}` : ` (exit ${code})`}.`,
        durationMs: Date.now() - started,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return { status: "FAIL", exitCode: 1, detail: `PlotPickle did not become reachable within ${waitSeconds} seconds.`, durationMs: Date.now() - started };
}

export function createVerificationGraphState(graph = FULL_VERIFICATION_GRAPH) {
  return new Map(graph.map((node) => [node.id, {
    id: node.id,
    status: "QUEUED",
    exitCode: null,
    detail: "",
    durationMs: 0,
    startedAt: "",
    completedAt: "",
  }]));
}

function dependencyReady(dependency, state) {
  const upstream = state.get(dependency.id);
  if (!upstream) return false;
  if (dependency.require === "complete") return TERMINAL.has(upstream.status);
  return upstream.status === "PASS";
}

function dependencyBlocks(dependency, state) {
  const upstream = state.get(dependency.id);
  if (!upstream || dependency.require === "complete") return false;
  return TERMINAL.has(upstream.status) && upstream.status !== "PASS";
}

function runningResources(graph, state) {
  const resources = new Set();
  for (const node of graph) {
    if (state.get(node.id)?.status !== "RUNNING") continue;
    for (const resource of node.resources || []) resources.add(resource);
  }
  return resources;
}

export function readyVerificationNodeIds(graph, state, maxParallelism = 3) {
  const runningCount = [...state.values()].filter((item) => item.status === "RUNNING").length;
  let slots = Math.max(0, boundedParallelism(maxParallelism) - runningCount);
  if (!slots) return [];
  const busy = runningResources(graph, state);
  const selected = [];
  const selectedResources = new Set();
  for (const node of graph) {
    const item = state.get(node.id);
    if (!item || item.status !== "QUEUED") continue;
    if ((node.dependencies || []).some((dependency) => !dependencyReady(dependency, state))) continue;
    if ((node.resources || []).some((resource) => busy.has(resource) || selectedResources.has(resource))) continue;
    selected.push(node.id);
    for (const resource of node.resources || []) selectedResources.add(resource);
    slots -= 1;
    if (!slots) break;
  }
  return selected;
}

function blockFailedDependencies(graph, state, now = new Date().toISOString()) {
  for (const node of graph) {
    const item = state.get(node.id);
    if (!item || item.status !== "QUEUED") continue;
    const failed = (node.dependencies || []).find((dependency) => dependencyBlocks(dependency, state));
    if (!failed) continue;
    const upstream = state.get(failed.id);
    state.set(node.id, {
      ...item,
      status: "BLOCKED",
      exitCode: 1,
      detail: `Dependency ${failed.id} finished ${upstream?.status || "without success"}.`,
      completedAt: now,
    });
  }
}

export async function runVerificationGraph(options = {}) {
  const graph = options.graph || FULL_VERIFICATION_GRAPH;
  const definitionErrors = validateFullVerificationGraph(graph);
  if (definitionErrors.length) throw new Error(`Full Verification graph is invalid: ${definitionErrors.join(" | ")}`);
  const state = createVerificationGraphState(graph);
  const maxParallelism = boundedParallelism(options.maxParallelism ?? process.env.PLOTPICKLE_FULL_CHECK_PARALLELISM ?? 3);
  const active = new Map();
  const timeline = [];
  let maxParallelObserved = 0;

  const execute = options.execute || (async (node) => {
    if (node.tool === "app-ready") return ensurePlotPickleReady({ startupWaitSeconds: options.startupWaitSeconds, echo: options.echo !== false });
    return executeCommandNode(node, { cwd: options.cwd || repoRoot, echo: options.echo !== false });
  });

  try {
    while ([...state.values()].some((item) => !TERMINAL.has(item.status))) {
      blockFailedDependencies(graph, state);

      let startedAny = false;
      for (const nodeId of readyVerificationNodeIds(graph, state, maxParallelism)) {
        const node = graph.find((candidate) => candidate.id === nodeId);
        const current = state.get(nodeId);
        const startedAt = new Date().toISOString();
        state.set(nodeId, { ...current, status: "RUNNING", startedAt });
        timeline.push({ nodeId, event: "start", at: startedAt });
        if (options.echo !== false) process.stdout.write(`START  ${node.name}\n`);
        const promise = Promise.resolve(execute(node)).then((rawResult) => {
          const checked = validateVerificationNodeResult(node, rawResult);
          const result = checked.ok ? rawResult : { status: "FAIL", exitCode: 1, detail: `Node result contract failed: ${checked.error}`, durationMs: 0 };
          const completedAt = new Date().toISOString();
          const status = result.status;
          state.set(nodeId, {
            ...state.get(nodeId),
            status,
            exitCode: status === "PASS" ? 0 : Number(result.exitCode) || 1,
            detail: cleanDetail(result.detail || ""),
            durationMs: Math.max(0, Number(result.durationMs) || 0),
            completedAt,
          });
          timeline.push({ nodeId, event: "complete", status, at: completedAt });
          if (options.echo !== false) process.stdout.write(`${status}  ${node.name}${status === "FAIL" ? ` - ${cleanDetail(result.detail || "failed", 300)}` : ""}\n`);
          return nodeId;
        }).catch((error) => {
          const completedAt = new Date().toISOString();
          state.set(nodeId, { ...state.get(nodeId), status: "FAIL", exitCode: 1, detail: cleanDetail(error instanceof Error ? error.message : String(error)), completedAt });
          timeline.push({ nodeId, event: "complete", status: "FAIL", at: completedAt });
          return nodeId;
        }).finally(() => active.delete(nodeId));
        active.set(nodeId, promise);
        startedAny = true;
        maxParallelObserved = Math.max(maxParallelObserved, active.size);
      }

      if (active.size) {
        await Promise.race([...active.values()]);
        continue;
      }

      blockFailedDependencies(graph, state);
      const unresolved = graph.filter((node) => state.get(node.id)?.status === "QUEUED");
      if (!unresolved.length) break;
      if (!startedAny) {
        const now = new Date().toISOString();
        for (const node of unresolved) state.set(node.id, { ...state.get(node.id), status: "BLOCKED", exitCode: 1, detail: "No valid dependency/resource route remained.", completedAt: now });
        break;
      }
    }

    if (active.size) await Promise.all([...active.values()]);
    blockFailedDependencies(graph, state);

    const stages = graph.filter((node) => node.authoritative).sort((a, b) => a.number - b.number).map((node) => {
      const item = state.get(node.id);
      return {
        Step: node.name,
        Category: node.category,
        Status: item?.status === "PASS" ? "PASS" : item?.status === "BLOCKED" ? "BLOCKED" : "FAIL",
        ExitCode: item?.status === "PASS" ? 0 : Number(item?.exitCode) || 1,
        Detail: item?.detail || "",
        NodeId: node.id,
        DurationMs: item?.durationMs || 0,
      };
    });
    const nodes = graph.map((node) => ({ ...state.get(node.id), authoritative: Boolean(node.authoritative), resources: node.resources || [], dependencies: node.dependencies || [] }));
    return {
      schemaVersion: 1,
      graphId: `full-verification-${Date.now()}`,
      topology: "host-owned-responsibility-graph-adapter",
      maxParallelism,
      maxParallelObserved,
      stages,
      nodes,
      timeline,
      deterministicResult: stages.every((stage) => stage.Status === "PASS") ? "PASS" : "FAIL",
    };
  } finally {
    await stopManagedPlotPickleVerificationServer();
  }
}

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

async function main() {
  const resultFile = argument("--result-file");
  if (!resultFile) throw new Error("--result-file is required.");
  const startupWaitSeconds = Number(argument("--startup-wait-seconds", "240"));
  const maxParallelism = Number(argument("--max-parallelism", process.env.PLOTPICKLE_FULL_CHECK_PARALLELISM || "3"));
  process.stdout.write(`Full Verification graph ............ START  max parallelism ${boundedParallelism(maxParallelism)}\n`);
  const result = await runVerificationGraph({ startupWaitSeconds, maxParallelism, echo: true });
  await mkdir(path.dirname(path.resolve(resultFile)), { recursive: true });
  await writeFile(path.resolve(resultFile), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`Full Verification graph ............ ${result.deterministicResult}  peak parallel nodes ${result.maxParallelObserved}\n`);
  process.exitCode = result.deterministicResult === "PASS" ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(cleanDetail(error instanceof Error ? error.stack || error.message : String(error), 1800));
    process.exitCode = 1;
  });
}
