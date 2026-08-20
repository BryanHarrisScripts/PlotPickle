#!/usr/bin/env node

import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { approvedCodingModel, rankApprovedCodingModel } from "./developer-repair-model-policy.mjs";

const exec = promisify(execFile);

export const PI_CODING_AGENT_PACKAGE = "@earendil-works/pi-coding-agent";
export const PI_MINIMUM_NODE_VERSION = "22.19.0";

const PI_RUNTIME_CANDIDATES = [
  { kind: "lm-studio", label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
  { kind: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
  { kind: "llama.cpp", label: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1" },
  { kind: "openai-compatible", label: "OpenAI-compatible", baseUrl: "http://127.0.0.1:8000/v1" },
];

function versionTuple(value) {
  return String(value || "").split(".").slice(0, 3).map((item) => Number(item) || 0);
}

function versionAtLeast(actual, minimum) {
  const left = versionTuple(actual);
  const right = versionTuple(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function windowsCliCommand(command, commandArgs) {
  return [command, ...commandArgs].map((value) => {
    const text = String(value);
    if (/[\r\n\0"&|<>^%!]/u.test(text)) {
      throw new Error(`Pi worker CLI argument contains unsupported Windows command-shell characters: ${text}`);
    }
    return `"${text}"`;
  }).join(" ");
}

export async function runPortableCommand(command, commandArgs = [], options = {}) {
  const common = {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true,
    shell: false,
    timeout: options.timeout || 0,
    maxBuffer: options.maxBuffer || 32 * 1024 * 1024,
    encoding: "utf8",
  };
  if (process.platform === "win32") {
    const result = await exec(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", windowsCliCommand(command, commandArgs)], common);
    return { stdout: String(result.stdout || "").trim(), stderr: String(result.stderr || "").trim() };
  }
  const result = await exec(command, commandArgs, common);
  return { stdout: String(result.stdout || "").trim(), stderr: String(result.stderr || "").trim() };
}

function portableCommandSync(command, commandArgs = [], options = {}) {
  const common = {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true,
    shell: false,
    timeout: options.timeout || 15_000,
    maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
    encoding: "utf8",
  };
  const result = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", windowsCliCommand(command, commandArgs)], common)
    : spawnSync(command, commandArgs, common);
  return {
    status: Number.isInteger(result.status) ? result.status : -1,
    stdout: String(result.stdout || "").trim(),
    stderr: String(result.stderr || "").trim(),
    error: result.error || null,
  };
}

function firstExisting(paths) {
  return paths.find((candidate) => Boolean(candidate) && existsSync(candidate)) || "";
}

function commandOnPath(name) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  const result = spawnSync(locator, [name], {
    windowsHide: true,
    shell: false,
    timeout: 5_000,
    encoding: "utf8",
  });
  if (result.error) throw new Error(`Pi command discovery could not run ${locator}: ${result.error.message}`, { cause: result.error });
  if (result.status === 1) return "";
  if (result.status !== 0) {
    throw new Error(`Pi command discovery ${locator} ${name} failed with exit ${result.status}: ${String(result.stderr || "").trim()}`);
  }
  return String(result.stdout || "").split(/\r?\n/).map((item) => item.trim()).find(Boolean) || "";
}

function npmGlobalPrefix() {
  const result = portableCommandSync("npm", ["prefix", "-g"]);
  if (result.error) throw new Error(`Pi npm-prefix discovery failed: ${result.error.message}`, { cause: result.error });
  if (result.status !== 0) throw new Error(`Pi npm-prefix discovery failed with exit ${result.status}: ${result.stderr || "no npm error detail"}`);
  if (!result.stdout) throw new Error("Pi npm-prefix discovery returned an empty global prefix.");
  return result.stdout;
}

export async function resolvePiCommand() {
  const explicit = String(process.env.PLOTPICKLE_PI_COMMAND || "").trim();
  if (explicit) {
    if (path.isAbsolute(explicit)) {
      if (firstExisting([explicit])) return explicit;
    } else {
      const located = commandOnPath(explicit);
      if (located) return located;
    }
  }

  const fromPath = commandOnPath("pi");
  if (fromPath) return fromPath;

  const prefix = npmGlobalPrefix();
  const candidates = process.platform === "win32"
    ? [path.join(prefix, "pi.cmd"), path.join(prefix, "pi.exe"), path.join(prefix, "pi")]
    : [path.join(prefix, "bin", "pi")];
  return firstExisting(candidates);
}

async function piVersion(piCommand) {
  const result = await runPortableCommand(piCommand, ["--version"], { timeout: 15_000 });
  return result.stdout || result.stderr || "unknown";
}

export async function ensurePiInstalled(options = {}) {
  if (!versionAtLeast(process.versions.node, PI_MINIMUM_NODE_VERSION)) {
    throw new Error(`Pi requires Node.js ${PI_MINIMUM_NODE_VERSION} or newer for PlotPickle. Found ${process.versions.node}.`);
  }

  let command = await resolvePiCommand();
  let installed = false;
  if (!command) {
    const allowInstall = options.allowInstall !== false && process.env.PLOTPICKLE_PI_AUTO_INSTALL !== "0";
    if (!allowInstall) {
      throw new Error(`Pi is required but not installed. Automatic installation is disabled; install ${PI_CODING_AGENT_PACKAGE} or set PLOTPICKLE_PI_AUTO_INSTALL=1.`);
    }
    options.onStatus?.("INSTALLING", `${PI_CODING_AGENT_PACKAGE} via npm`);
    await runPortableCommand("npm", ["install", "-g", "--ignore-scripts", PI_CODING_AGENT_PACKAGE], { timeout: 15 * 60_000 });
    command = await resolvePiCommand();
    installed = true;
  }
  if (!command) throw new Error("Pi installation completed but PlotPickle could not resolve the Pi executable from PATH or npm's global prefix.");

  const version = await piVersion(command);
  options.onStatus?.("READY", `${version}${installed ? " · installed now" : ""}`);
  return { command, version, installed };
}

export function resolveGitBash() {
  if (process.platform !== "win32") return commandOnPath("bash");
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  const git = commandOnPath("git");
  if (git) {
    const gitRoot = path.dirname(path.dirname(git));
    candidates.unshift(path.join(gitRoot, "bin", "bash.exe"), path.join(gitRoot, "usr", "bin", "bash.exe"));
  }
  return firstExisting([...new Set(candidates)]);
}

function normalizeEndpoint(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  return /\/v1$/i.test(raw) ? raw : `${raw}/v1`;
}

async function probeRuntimeModels(endpoint) {
  const baseUrl = normalizeEndpoint(endpoint.baseUrl);
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) return { endpoint, baseUrl, models: [], error: `HTTP ${response.status}` };
  const body = await response.json();
  const models = Array.isArray(body?.data)
    ? body.data.flatMap((item) => typeof item?.id === "string" ? [item.id] : [])
    : [];
  return { endpoint, baseUrl, models, error: "" };
}

export async function resolvePiLocalRuntime() {
  const preferredEndpoint = normalizeEndpoint(process.env.PLOTPICKLE_REPAIR_ENDPOINT || "");
  const preferredModel = String(process.env.PLOTPICKLE_REPAIR_MODEL || "").trim();
  if (preferredEndpoint && preferredModel) {
    if (!approvedCodingModel(preferredModel)) throw new Error(`Configured Pi repair model is not approved for local coding: ${preferredModel}`);
    return { kind: "explicit", label: "Explicit local runtime", baseUrl: preferredEndpoint, model: preferredModel };
  }

  const endpoints = preferredEndpoint
    ? [{ kind: "openai-compatible", label: "Configured local runtime", baseUrl: preferredEndpoint }]
    : PI_RUNTIME_CANDIDATES;
  const probes = await Promise.allSettled(endpoints.map((endpoint) => probeRuntimeModels(endpoint)));
  const candidates = [];
  const diagnostics = [];
  probes.forEach((probe, index) => {
    const endpoint = endpoints[index];
    if (probe.status === "rejected") {
      diagnostics.push(`${endpoint.label}: ${probe.reason instanceof Error ? probe.reason.message : String(probe.reason)}`);
      return;
    }
    if (probe.value.error) diagnostics.push(`${endpoint.label}: ${probe.value.error}`);
    for (const model of probe.value.models.filter(approvedCodingModel)) {
      candidates.push({ ...endpoint, baseUrl: probe.value.baseUrl, model });
    }
  });
  if (!candidates.length) {
    throw new Error([
      "Pi is installed but no approved local coding model is available through LM Studio, Ollama, llama.cpp, or the configured OpenAI-compatible loopback endpoint.",
      diagnostics.length ? `Runtime probes: ${diagnostics.join(" | ")}` : "Runtime probes returned no approved coding models.",
    ].join("\n"));
  }
  if (preferredModel) {
    const exact = candidates.find((item) => item.model.toLowerCase() === preferredModel.toLowerCase());
    if (exact) return exact;
  }
  candidates.sort((a, b) => rankApprovedCodingModel(a.model) - rankApprovedCodingModel(b.model));
  return candidates[0];
}

function localRoot() {
  if (process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;
  return process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share");
}

export function piAgentDirectory(purpose = "repair") {
  return path.join(localRoot(), "PlotPickle", "developer-agent", `pi-${purpose}`);
}

function requireLoopbackEndpoint(baseUrl) {
  const raw = String(baseUrl || "");
  if (!URL.canParse(raw)) throw new Error(`Pi local runtime URL is invalid: ${baseUrl}`);
  const parsed = new URL(raw);
  const host = parsed.hostname.toLowerCase();
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) {
    throw new Error(`Pi local runtime must stay on loopback; refusing provider endpoint ${baseUrl}.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

export async function configurePiLocalRuntime(runtime, options = {}) {
  if (!runtime?.model || !runtime?.baseUrl) throw new Error("Pi local runtime requires a resolved model and base URL.");
  const agentDir = piAgentDirectory(options.purpose || "repair");
  await mkdir(agentDir, { recursive: true });
  const shellPath = resolveGitBash();
  const baseUrl = requireLoopbackEndpoint(runtime.baseUrl);
  const settings = {
    defaultProvider: "plotpickle-local",
    defaultModel: runtime.model,
    defaultThinkingLevel: "off",
    enableInstallTelemetry: false,
    quietStartup: true,
    ...(shellPath ? { shellPath } : {}),
  };
  const models = {
    providers: {
      "plotpickle-local": {
        baseUrl,
        api: "openai-completions",
        apiKey: "plotpickle-local",
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
        },
        models: [{
          id: runtime.model,
          name: `PlotPickle Local — ${runtime.model}`,
          reasoning: false,
          input: ["text"],
          contextWindow: 131072,
          maxTokens: 16384,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        }],
      },
    },
  };
  await Promise.all([
    writeFile(path.join(agentDir, "settings.json"), `${JSON.stringify(settings, null, 2)}\n`, "utf8"),
    writeFile(path.join(agentDir, "models.json"), `${JSON.stringify(models, null, 2)}\n`, "utf8"),
  ]);
  return { agentDir, shellPath, baseUrl };
}

export function piLocalEnvironment(agentDir) {
  return {
    PI_CODING_AGENT_DIR: agentDir,
    PI_OFFLINE: "1",
    PI_SKIP_VERSION_CHECK: "1",
    PI_TELEMETRY: "0",
  };
}

const QUIET_RESOURCE_FLAGS = [
  "--no-extensions",
  "--no-skills",
  "--no-prompt-templates",
  "--no-themes",
];

export async function runPiSmoke({ command, runtime, purpose = "repair", timeout = 120_000 }) {
  const configured = await configurePiLocalRuntime(runtime, { purpose });
  const marker = "PLOTPICKLE_PI_READY";
  const result = await runPortableCommand(command, [
    "-p",
    "--no-session",
    "--no-tools",
    ...QUIET_RESOURCE_FLAGS,
    "--provider", "plotpickle-local",
    "--model", runtime.model,
    `Reply with exactly ${marker}.`,
  ], {
    timeout,
    env: piLocalEnvironment(configured.agentDir),
  });
  if (!result.stdout.includes(marker)) {
    throw new Error(`Pi launched but did not complete the local-model readiness probe. Output: ${result.stdout.slice(-500) || result.stderr.slice(-500) || "<empty>"}`);
  }
  return { ...configured, marker, output: result.stdout };
}

export async function runPiReadOnly({ command, runtime, prompt, cwd, purpose = "code-review", timeout = 10 * 60_000 }) {
  const configured = await configurePiLocalRuntime(runtime, { purpose });
  return runPortableCommand(command, [
    "-p",
    "--no-session",
    "--tools", "read,grep,find,ls",
    ...QUIET_RESOURCE_FLAGS,
    "--provider", "plotpickle-local",
    "--model", runtime.model,
    prompt,
  ], {
    cwd,
    timeout,
    env: piLocalEnvironment(configured.agentDir),
    maxBuffer: 64 * 1024 * 1024,
  });
}
