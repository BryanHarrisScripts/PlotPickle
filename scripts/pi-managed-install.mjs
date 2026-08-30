#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import {
  PI_CODING_AGENT_PACKAGE,
  PI_MINIMUM_NODE_VERSION,
  resolveActiveNpmCommand,
  runPortableCommand,
} from "./pi-worker-runtime.mjs";

export const PLOTPICKLE_MANAGED_PI_VERSION = "0.84.4";
export const PLOTPICKLE_MANAGED_PI_PACKAGE = `${PI_CODING_AGENT_PACKAGE}@${PLOTPICKLE_MANAGED_PI_VERSION}`;

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

function normalizedPiVersion(value) {
  const match = String(value || "").trim().match(/\b(\d+\.\d+\.\d+)\b/u);
  return match?.[1] || "";
}

export function managedPiRoot({ platform = process.platform, env = process.env } = {}) {
  const base = env.LOCALAPPDATA || (platform === "win32"
    ? path.win32.join(env.USERPROFILE || os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share"));
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  return pathApi.join(base, "PlotPickle", "developer-agent", "pi-cli");
}

export function managedPiCommand({ platform = process.platform, env = process.env, root } = {}) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const toolRoot = root || managedPiRoot({ platform, env });
  return platform === "win32"
    ? pathApi.join(toolRoot, "pi.cmd")
    : pathApi.join(toolRoot, "bin", "pi");
}

export async function probeManagedPi(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const root = options.root || managedPiRoot({ platform, env });
  const command = options.command || managedPiCommand({ platform, env, root });
  const expectedVersion = options.expectedVersion || PLOTPICKLE_MANAGED_PI_VERSION;
  const fileExists = options.existsSync || existsSync;
  const run = options.runPortableCommand || runPortableCommand;
  if (!fileExists(command)) {
    return { ready: false, root, command, version: "", expectedVersion, state: "not-installed" };
  }
  try {
    const result = await run(command, ["--version"], { timeout: 15_000 });
    const rawVersion = String(result.stdout || result.stderr || "").trim();
    const version = normalizedPiVersion(rawVersion);
    if (!version) {
      return {
        ready: false,
        root,
        command,
        version: "",
        expectedVersion,
        state: "invalid-managed-install",
        detail: `PlotPickle-managed Pi returned an unrecognized version string: ${rawVersion || "<empty>"}`,
      };
    }
    if (version !== expectedVersion) {
      return {
        ready: false,
        root,
        command,
        version,
        expectedVersion,
        state: "version-mismatch",
        detail: `PlotPickle-managed Pi must be exactly ${expectedVersion}; found ${version}.`,
      };
    }
    return { ready: true, root, command, version, expectedVersion, state: "ready" };
  } catch (error) {
    return {
      ready: false,
      root,
      command,
      version: "",
      expectedVersion,
      state: "invalid-managed-install",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureManagedPiInstalled(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const run = options.runPortableCommand || runPortableCommand;
  const root = options.root || managedPiRoot({ platform, env });
  const expectedVersion = options.expectedVersion || PLOTPICKLE_MANAGED_PI_VERSION;
  const packageSpec = options.packageSpec || `${PI_CODING_AGENT_PACKAGE}@${expectedVersion}`;
  const fileExists = options.existsSync || existsSync;
  if (!versionAtLeast(options.nodeVersion || process.versions.node, PI_MINIMUM_NODE_VERSION)) {
    throw new Error(`Pi requires Node.js ${PI_MINIMUM_NODE_VERSION} or newer for PlotPickle. Found ${options.nodeVersion || process.versions.node}.`);
  }

  const existing = await probeManagedPi({
    platform,
    env,
    root,
    expectedVersion,
    existsSync: fileExists,
    runPortableCommand: run,
  });
  if (existing.ready) return { ...existing, installed: false };
  if (options.allowInstall === false || env.PLOTPICKLE_PI_AUTO_INSTALL === "0") {
    const mismatch = existing.state === "version-mismatch"
      ? ` Expected ${expectedVersion}; found ${existing.version}.`
      : "";
    throw new Error(`PlotPickle-managed Pi ${expectedVersion} is not ready and automatic installation is disabled.${mismatch}`);
  }

  await mkdir(root, { recursive: true, mode: 0o700 });
  options.onStatus?.("INSTALLING", `${packageSpec} in PlotPickle's private developer-tool directory`);

  const npmCommand = options.npmCommand || resolveActiveNpmCommand({
    platform,
    nodeExecutable: options.nodeExecutable || process.execPath,
    existsSync: fileExists,
    commandOnPath: options.commandOnPath,
  });

  // npm's global mode with an explicit private prefix places the Windows wrapper
  // directly at <prefix>\pi.cmd without touching %APPDATA%\npm or the user's PATH.
  await run(npmCommand, [
    "install",
    "-g",
    "--prefix", root,
    "--ignore-scripts",
    packageSpec,
  ], {
    timeout: 15 * 60_000,
    env,
  });

  const installed = await probeManagedPi({
    platform,
    env,
    root,
    expectedVersion,
    existsSync: fileExists,
    runPortableCommand: run,
  });
  if (!installed.ready) {
    throw new Error(`PlotPickle-managed Pi ${expectedVersion} installation completed but the private executable failed validation. ${installed.detail || installed.state}`);
  }
  options.onStatus?.("READY", `${installed.version} · PlotPickle-managed`);
  return { ...installed, installed: true };
}
