import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";

export const OPENPENCIL_MCP_HOST = "127.0.0.1";
export const OPENPENCIL_MCP_PORT = 7600;
export const OPENPENCIL_MCP_ENDPOINT = `http://${OPENPENCIL_MCP_HOST}:${OPENPENCIL_MCP_PORT}/mcp`;
export const OPENPENCIL_MCP_VERSION = "0.15.1";

function defaultDependencies(overrides = {}) {
  return {
    platform: overrides.platform || process.platform,
    env: overrides.env || process.env,
    exists: overrides.exists || existsSync,
    statPath: overrides.statPath || stat,
    spawnProcess: overrides.spawnProcess || ((command, args, options) => spawn(command, [...args], options)),
    portReady: overrides.portReady || probeOpenPencilMcpPort,
    wait: overrides.wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    nodeExecutable: overrides.nodeExecutable || process.execPath,
    repositoryRoot: overrides.repositoryRoot || process.cwd(),
  };
}

function pathEntries(value, platform) {
  return value.split(platform === "win32" ? ";" : ":").map((entry) => entry.trim()).filter(Boolean);
}

function platformPath(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

function executableCandidates(command, dependencies) {
  const pathApi = platformPath(dependencies.platform);
  const directories = pathEntries(String(dependencies.env.PATH || dependencies.env.Path || ""), dependencies.platform);
  if (dependencies.platform !== "win32") return directories.map((directory) => pathApi.join(directory, command));
  return directories.flatMap((directory) => [
    pathApi.join(directory, `${command}.cmd`),
    pathApi.join(directory, `${command}.exe`),
    pathApi.join(directory, command),
  ]);
}

function managedOpenPencilEntrypoint(dependencies) {
  if (dependencies.platform !== "win32") return "";
  const localAppData = String(dependencies.env.LOCALAPPDATA || "").trim();
  if (!localAppData) return "";
  const pathApi = platformPath(dependencies.platform);
  return pathApi.join(
    localAppData,
    "PlotPickle",
    "tools",
    "openpencil",
    "node_modules",
    "@open-pencil",
    "mcp",
    "dist",
    "index.mjs",
  );
}

function recommendedOpenPencilWorkspace(dependencies) {
  const pathApi = platformPath(dependencies.platform);
  return pathApi.resolve(dependencies.repositoryRoot, "designs", "openpencil");
}

export function resolveOpenPencilHttpLaunch(overrides = {}) {
  const dependencies = defaultDependencies(overrides);
  const pathApi = platformPath(dependencies.platform);
  const override = String(dependencies.env.PLOTPICKLE_OPENPENCIL_MCP_ENTRYPOINT || "").trim();
  if (override) {
    if (!pathApi.isAbsolute(override) || !dependencies.exists(override) || !/\.(?:mjs|js)$/iu.test(override)) return null;
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([override]), source: "override" });
  }

  const managed = managedOpenPencilEntrypoint(dependencies);
  if (managed && dependencies.exists(managed)) {
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([managed]), source: "plotpickle-managed" });
  }

  const located = executableCandidates("openpencil-mcp-http", dependencies).find((candidate) => dependencies.exists(candidate));
  if (!located) return null;

  if (dependencies.platform === "win32" && located.toLowerCase().endsWith(".cmd")) {
    const entrypoint = pathApi.join(pathApi.dirname(located), "node_modules", "@open-pencil", "mcp", "dist", "index.mjs");
    if (!dependencies.exists(entrypoint)) return null;
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([entrypoint]), source: "npm-global" });
  }

  return Object.freeze({ executable: located, args: Object.freeze([]), source: "path" });
}

export async function probeOpenPencilMcpPort(timeoutMs = 250) {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: OPENPENCIL_MCP_HOST, port: OPENPENCIL_MCP_PORT });
    const finish = (ready) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function normalizeWorkspaceRoot(workspaceRoot, dependencies) {
  const value = typeof workspaceRoot === "string" ? workspaceRoot.trim() : "";
  const pathApi = platformPath(dependencies.platform);
  if (!value || !pathApi.isAbsolute(value)) throw new Error("OPENPENCIL_WORKSPACE_REQUIRED");
  const info = await dependencies.statPath(value).then(
    (result) => result,
    () => null,
  );
  if (!info?.isDirectory()) throw new Error("OPENPENCIL_WORKSPACE_UNAVAILABLE");
  return pathApi.resolve(value);
}

export function publicOpenPencilMcpError(error) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "OPENPENCIL_WORKSPACE_REQUIRED") return "Choose an absolute local design workspace before connecting OpenPencil.";
  if (code === "OPENPENCIL_WORKSPACE_UNAVAILABLE") return "The selected OpenPencil design workspace is unavailable.";
  if (code === "OPENPENCIL_PORT_IN_USE") return "OpenPencil MCP port 7600 is already in use by a process PlotPickle does not own.";
  if (code === "OPENPENCIL_ALREADY_CONNECTED_OTHER_ROOT") return "Disconnect OpenPencil before changing its design workspace.";
  if (code === "OPENPENCIL_START_TIMEOUT") return "OpenPencil MCP did not become ready on localhost.";
  return "OpenPencil MCP could not be connected.";
}

function unavailableStatus(dependencies) {
  return Object.freeze({
    state: "unavailable",
    endpoint: OPENPENCIL_MCP_ENDPOINT,
    installed: false,
    workspaceConfigured: false,
    owned: false,
    recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
    message: `OpenPencil MCP ${OPENPENCIL_MCP_VERSION} is not ready yet. PlotPickle prepares the reviewed package after core startup; wait briefly and choose Check status.`,
  });
}

export function createOpenPencilMcpController(overrides = {}) {
  const dependencies = defaultDependencies(overrides);
  let child = null;
  let workspaceRoot = null;
  let lastFailure = "";

  async function status() {
    const launch = resolveOpenPencilHttpLaunch(dependencies);
    if (child && child.exitCode === null && child.signalCode === null) {
      const ready = await dependencies.portReady();
      return Object.freeze({
        state: ready ? "ready" : "connecting",
        endpoint: OPENPENCIL_MCP_ENDPOINT,
        installed: true,
        workspaceConfigured: Boolean(workspaceRoot),
        owned: true,
        recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
        message: ready ? "OpenPencil MCP is connected locally and scoped to the selected design workspace." : "OpenPencil MCP is starting locally.",
      });
    }
    if (await dependencies.portReady()) {
      return Object.freeze({
        state: "failed",
        endpoint: OPENPENCIL_MCP_ENDPOINT,
        installed: Boolean(launch),
        workspaceConfigured: false,
        owned: false,
        recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
        message: "Port 7600 is active, but PlotPickle does not own that process. Disconnect it before connecting OpenPencil through Command.",
      });
    }
    if (!launch) return unavailableStatus(dependencies);
    return Object.freeze({
      state: lastFailure ? "failed" : "disconnected",
      endpoint: OPENPENCIL_MCP_ENDPOINT,
      installed: true,
      workspaceConfigured: false,
      owned: false,
      recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
      message: lastFailure || "OpenPencil MCP is installed but disconnected. Connect the repository design workspace when you are ready.",
    });
  }

  async function connect(input = {}) {
    const requestedRoot = await normalizeWorkspaceRoot(input.workspaceRoot, dependencies);
    if (child && child.exitCode === null && child.signalCode === null) {
      if (workspaceRoot !== requestedRoot) throw new Error("OPENPENCIL_ALREADY_CONNECTED_OTHER_ROOT");
      return await status();
    }
    if (await dependencies.portReady()) throw new Error("OPENPENCIL_PORT_IN_USE");

    const launch = resolveOpenPencilHttpLaunch(dependencies);
    if (!launch) return unavailableStatus(dependencies);

    lastFailure = "";
    const launched = dependencies.spawnProcess(launch.executable, launch.args, {
      cwd: requestedRoot,
      env: { ...dependencies.env, OPENPENCIL_MCP_ROOT: requestedRoot },
      stdio: "ignore",
      windowsHide: true,
      shell: false,
    });
    child = launched;
    workspaceRoot = requestedRoot;

    launched.once("error", (error) => {
      if (child === launched) {
        lastFailure = error.message;
        child = null;
        workspaceRoot = null;
      }
    });
    launched.once("exit", (code, signal) => {
      if (child === launched) {
        if (code !== 0 && signal === null) lastFailure = `OpenPencil MCP exited with code ${String(code)}.`;
        child = null;
        workspaceRoot = null;
      }
    });

    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await dependencies.portReady()) {
        return Object.freeze({
          state: "ready",
          endpoint: OPENPENCIL_MCP_ENDPOINT,
          installed: true,
          workspaceConfigured: true,
          owned: true,
          recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
          message: "OpenPencil MCP is connected locally and scoped to the selected design workspace.",
        });
      }
      if (child !== launched || launched.exitCode !== null || launched.signalCode !== null) break;
      await dependencies.wait(100);
    }

    if (child === launched) {
      launched.kill();
      child = null;
      workspaceRoot = null;
    }
    lastFailure ||= "OpenPencil MCP did not become ready before the local connection timeout.";
    throw new Error("OPENPENCIL_START_TIMEOUT");
  }

  async function disconnect() {
    const owned = child;
    if (!owned) {
      return Object.freeze({
        state: "disconnected",
        endpoint: OPENPENCIL_MCP_ENDPOINT,
        installed: Boolean(resolveOpenPencilHttpLaunch(dependencies)),
        workspaceConfigured: false,
        owned: false,
        recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
        message: "OpenPencil MCP is already disconnected from PlotPickle.",
      });
    }

    child = null;
    workspaceRoot = null;
    lastFailure = "";
    owned.kill();

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!(await dependencies.portReady())) break;
      await dependencies.wait(100);
    }

    return Object.freeze({
      state: "disconnected",
      endpoint: OPENPENCIL_MCP_ENDPOINT,
      installed: true,
      workspaceConfigured: false,
      owned: false,
      recommendedWorkspace: recommendedOpenPencilWorkspace(dependencies),
      message: "PlotPickle disconnected its OpenPencil MCP process. The startup-managed MCP package remains installed.",
    });
  }

  return Object.freeze({ status, connect, disconnect });
}
