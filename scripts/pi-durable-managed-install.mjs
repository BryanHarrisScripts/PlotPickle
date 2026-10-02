#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { PI_MINIMUM_NODE_VERSION, resolveActiveNpmCommand, runPortableCommand } from "./pi-worker-runtime.mjs";

export const PLOTPICKLE_PI_DURABLE_VERSION = "1.0.0";
export const PLOTPICKLE_PI_DURABLE_PACKAGE = `@earendil-works/pi-durable@${PLOTPICKLE_PI_DURABLE_VERSION}`;

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

export function managedPiDurableRoot({ home, platform = process.platform, env = process.env } = {}) {
  if (home) return path.resolve(home, "runtimes", `pi-durable-${PLOTPICKLE_PI_DURABLE_VERSION}`);
  const base = env.LOCALAPPDATA || (platform === "win32"
    ? path.win32.join(env.USERPROFILE || os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share"));
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  return pathApi.join(base, "PlotPickle", "runtimes", `pi-durable-${PLOTPICKLE_PI_DURABLE_VERSION}`);
}

export function managedPiDurableManifest(root) {
  return path.join(root, "node_modules", "@earendil-works", "pi-durable", "package.json");
}

export async function probeManagedPiDurable(options = {}) {
  const root = options.root || managedPiDurableRoot(options);
  const manifestPath = managedPiDurableManifest(root);
  const expectedVersion = options.expectedVersion || PLOTPICKLE_PI_DURABLE_VERSION;
  const fileExists = options.existsSync || existsSync;
  if (!fileExists(manifestPath)) {
    return { ready: false, root, manifestPath, version: "", expectedVersion, state: "not-installed" };
  }
  try {
    const manifest = JSON.parse(await (options.readFile || readFile)(manifestPath, "utf8"));
    const version = String(manifest.version || "");
    if (version !== expectedVersion) {
      return {
        ready: false,
        root,
        manifestPath,
        version,
        expectedVersion,
        state: "version-mismatch",
        detail: `PlotPickle-managed Pi Durable must be exactly ${expectedVersion}; found ${version || "unknown"}.`,
      };
    }
    return { ready: true, root, manifestPath, version, expectedVersion, state: "ready" };
  } catch (error) {
    return {
      ready: false,
      root,
      manifestPath,
      version: "",
      expectedVersion,
      state: "invalid-managed-install",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureManagedPiDurableInstalled(options = {}) {
  const nodeVersion = options.nodeVersion || process.versions.node;
  if (!versionAtLeast(nodeVersion, PI_MINIMUM_NODE_VERSION)) {
    throw new Error(`Pi Durable requires Node.js ${PI_MINIMUM_NODE_VERSION} or newer. Found ${nodeVersion}.`);
  }

  const root = options.root || managedPiDurableRoot(options);
  const expectedVersion = options.expectedVersion || PLOTPICKLE_PI_DURABLE_VERSION;
  const packageSpec = options.packageSpec || `@earendil-works/pi-durable@${expectedVersion}`;
  const existing = await probeManagedPiDurable({ ...options, root, expectedVersion });
  if (existing.ready) return { ...existing, installed: false };

  const env = options.env || process.env;
  if (options.allowInstall === false || env.PLOTPICKLE_PI_DURABLE_AUTO_INSTALL === "0") {
    throw new Error(`PlotPickle-managed Pi Durable ${expectedVersion} is not ready and automatic installation is disabled.`);
  }

  await (options.mkdir || mkdir)(root, { recursive: true, mode: 0o700 });
  await (options.writeFile || writeFile)(path.join(root, "package.json"), JSON.stringify({
    name: "plotpickle-managed-pi-durable",
    private: true,
    type: "module",
    dependencies: { "@earendil-works/pi-durable": expectedVersion },
  }, null, 2) + "\n", "utf8");

  const npmCommand = options.npmCommand || resolveActiveNpmCommand({
    platform: options.platform || process.platform,
    nodeExecutable: options.nodeExecutable || process.execPath,
    existsSync: options.existsSync || existsSync,
    commandOnPath: options.commandOnPath,
  });
  const run = options.runPortableCommand || runPortableCommand;
  options.onStatus?.("INSTALLING", `${packageSpec} in PlotPickle's private runtime directory`);
  await run(npmCommand, [
    "install",
    "--prefix", root,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    "--save-exact",
    packageSpec,
  ], { timeout: 15 * 60_000, env });

  const installed = await probeManagedPiDurable({ ...options, root, expectedVersion });
  if (!installed.ready) {
    throw new Error(`Pi Durable installation completed but validation failed: ${installed.detail || installed.state}`);
  }
  options.onStatus?.("READY", `${installed.version} · PlotPickle-managed`);
  return { ...installed, installed: true };
}
