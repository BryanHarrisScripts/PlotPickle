#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const PI_CODING_AGENT_PACKAGE = "@earendil-works/pi-coding-agent";
export const PI_MINIMUM_NODE_VERSION = "22.19.0";

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

async function firstExisting(paths) {
  for (const candidate of paths) {
    if (!candidate) continue;
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  return "";
}

async function commandOnPath(name) {
  const locator = process.platform === "win32" ? "where.exe" : "which";
  try {
    const result = await exec(locator, [name], { windowsHide: true, shell: false, timeout: 5_000, encoding: "utf8" });
    const first = String(result.stdout || "").split(/\r?\n/).map((item) => item.trim()).find(Boolean);
    return first || "";
  } catch {
    return "";
  }
}

async function npmGlobalPrefix() {
  try {
    return (await runPortableCommand("npm", ["prefix", "-g"], { timeout: 15_000 })).stdout;
  } catch {
    return "";
  }
}

export async function resolvePiCommand() {
  const explicit = String(process.env.PLOTPICKLE_PI_COMMAND || "").trim();
  if (explicit) {
    if (path.isAbsolute(explicit)) {
      if (await firstExisting([explicit])) return explicit;
    } else {
      const located = await commandOnPath(explicit);
      if (located) return located;
    }
  }

  const fromPath = await commandOnPath("pi");
  if (fromPath) return fromPath;

  const prefix = await npmGlobalPrefix();
  if (!prefix) return "";
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

export async function resolveGitBash() {
  if (process.platform !== "win32") return commandOnPath("bash");
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ];
  const git = await commandOnPath("git");
  if (git) {
    const gitRoot = path.dirname(path.dirname(git));
    candidates.unshift(path.join(gitRoot, "bin", "bash.exe"), path.join(gitRoot, "usr", "bin", "bash.exe"));
  }
  return firstExisting([...new Set(candidates)]);
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
  let parsed;
  try {
    parsed = new URL(String(baseUrl || ""));
  } catch {
    throw new Error(`Pi local runtime URL is invalid: ${baseUrl}`);
  }
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
  const shellPath = await resolveGitBash();
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
