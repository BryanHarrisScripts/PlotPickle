import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import type { ViteDevServer } from "vite";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { acceptsDsddLoopbackRequest, readDsddRequestBody } from "../dsdd/dsdd-session-gateway";

export const OPENPENCIL_MCP_API = "/api/openpencil/mcp";
export const OPENPENCIL_MCP_HOST = "127.0.0.1";
export const OPENPENCIL_MCP_PORT = 7600;
export const OPENPENCIL_MCP_ENDPOINT = `http://${OPENPENCIL_MCP_HOST}:${OPENPENCIL_MCP_PORT}/mcp`;

export type OpenPencilConnectionState = "disconnected" | "connecting" | "ready" | "unavailable" | "failed";

export type OpenPencilConnectionStatus = Readonly<{
  state: OpenPencilConnectionState;
  endpoint: string;
  installed: boolean;
  workspaceConfigured: boolean;
  owned: boolean;
  message: string;
}>;

export type OpenPencilLaunch = Readonly<{
  executable: string;
  args: readonly string[];
  source: "override" | "npm-global" | "path";
}>;

type PathInfo = Readonly<{ isDirectory(): boolean }>;

type OpenPencilDependencies = Readonly<{
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  exists: (value: string) => boolean;
  statPath: (value: string) => Promise<PathInfo>;
  spawnProcess: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;
  portReady: () => Promise<boolean>;
  wait: (milliseconds: number) => Promise<void>;
  nodeExecutable: string;
}>;

function defaultDependencies(overrides: Partial<OpenPencilDependencies> = {}): OpenPencilDependencies {
  return {
    platform: overrides.platform || process.platform,
    env: overrides.env || process.env,
    exists: overrides.exists || existsSync,
    statPath: overrides.statPath || stat,
    spawnProcess: overrides.spawnProcess || ((command, args, options) => spawn(command, [...args], options)),
    portReady: overrides.portReady || probeOpenPencilMcpPort,
    wait: overrides.wait || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))),
    nodeExecutable: overrides.nodeExecutable || process.execPath,
  };
}

function pathEntries(value: string, platform: NodeJS.Platform) {
  return value.split(platform === "win32" ? ";" : ":").map((entry) => entry.trim()).filter(Boolean);
}

function executableCandidates(command: string, dependencies: OpenPencilDependencies) {
  const directories = pathEntries(String(dependencies.env.PATH || dependencies.env.Path || ""), dependencies.platform);
  if (dependencies.platform !== "win32") return directories.map((directory) => path.join(directory, command));
  return directories.flatMap((directory) => [
    path.join(directory, `${command}.cmd`),
    path.join(directory, `${command}.exe`),
    path.join(directory, command),
  ]);
}

export function resolveOpenPencilHttpLaunch(overrides: Partial<OpenPencilDependencies> = {}): OpenPencilLaunch | null {
  const dependencies = defaultDependencies(overrides);
  const override = String(dependencies.env.PLOTPICKLE_OPENPENCIL_MCP_ENTRYPOINT || "").trim();
  if (override) {
    if (!path.isAbsolute(override) || !dependencies.exists(override) || !/\.(?:mjs|js)$/iu.test(override)) return null;
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([override]), source: "override" });
  }

  const located = executableCandidates("openpencil-mcp-http", dependencies).find((candidate) => dependencies.exists(candidate));
  if (!located) return null;

  if (dependencies.platform === "win32" && located.toLowerCase().endsWith(".cmd")) {
    const entrypoint = path.join(path.dirname(located), "node_modules", "@open-pencil", "mcp", "dist", "index.mjs");
    if (!dependencies.exists(entrypoint)) return null;
    return Object.freeze({ executable: dependencies.nodeExecutable, args: Object.freeze([entrypoint]), source: "npm-global" });
  }

  return Object.freeze({ executable: located, args: Object.freeze([]), source: "path" });
}

export async function probeOpenPencilMcpPort(timeoutMs = 250): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: OPENPENCIL_MCP_HOST, port: OPENPENCIL_MCP_PORT });
    const finish = (ready: boolean) => {
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

async function normalizeWorkspaceRoot(workspaceRoot: unknown, dependencies: OpenPencilDependencies) {
  const value = typeof workspaceRoot === "string" ? workspaceRoot.trim() : "";
  if (!value || !path.isAbsolute(value)) throw new Error("OPENPENCIL_WORKSPACE_REQUIRED");
  let info: PathInfo;
  try {
    info = await dependencies.statPath(value);
  } catch {
    throw new Error("OPENPENCIL_WORKSPACE_UNAVAILABLE");
  }
  if (!info.isDirectory()) throw new Error("OPENPENCIL_WORKSPACE_UNAVAILABLE");
  return path.resolve(value);
}

function publicErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (code === "OPENPENCIL_WORKSPACE_REQUIRED") return "Choose an absolute local design workspace before connecting OpenPencil.";
  if (code === "OPENPENCIL_WORKSPACE_UNAVAILABLE") return "The selected OpenPencil design workspace is unavailable.";
  if (code === "OPENPENCIL_PORT_IN_USE") return "OpenPencil MCP port 7600 is already in use by a process PlotPickle does not own.";
  if (code === "OPENPENCIL_ALREADY_CONNECTED_OTHER_ROOT") return "Disconnect OpenPencil before changing its design workspace.";
  if (code === "OPENPENCIL_START_TIMEOUT") return "OpenPencil MCP did not become ready on localhost.";
  return "OpenPencil MCP could not be connected.";
}

function unavailableStatus(): OpenPencilConnectionStatus {
  return Object.freeze({
    state: "unavailable",
    endpoint: OPENPENCIL_MCP_ENDPOINT,
    installed: false,
    workspaceConfigured: false,
    owned: false,
    message: "OpenPencil MCP is not installed. Install @open-pencil/mcp yourself with npm install -g @open-pencil/mcp, then retry from Command.",
  });
}

export function createOpenPencilMcpController(overrides: Partial<OpenPencilDependencies> = {}) {
  const dependencies = defaultDependencies(overrides);
  let child: ChildProcess | null = null;
  let workspaceRoot: string | null = null;
  let lastFailure = "";

  async function status(): Promise<OpenPencilConnectionStatus> {
    const launch = resolveOpenPencilHttpLaunch(dependencies);
    if (child && child.exitCode === null && child.signalCode === null) {
      const ready = await dependencies.portReady();
      return Object.freeze({
        state: ready ? "ready" : "connecting",
        endpoint: OPENPENCIL_MCP_ENDPOINT,
        installed: true,
        workspaceConfigured: Boolean(workspaceRoot),
        owned: true,
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
        message: "Port 7600 is active, but PlotPickle does not own that process. Disconnect it before connecting OpenPencil through Command.",
      });
    }
    if (!launch) return unavailableStatus();
    return Object.freeze({
      state: lastFailure ? "failed" : "disconnected",
      endpoint: OPENPENCIL_MCP_ENDPOINT,
      installed: true,
      workspaceConfigured: false,
      owned: false,
      message: lastFailure || "OpenPencil MCP is installed but disconnected. Use Command to connect an explicit local design workspace.",
    });
  }

  async function connect(input: { workspaceRoot?: unknown }): Promise<OpenPencilConnectionStatus> {
    const requestedRoot = await normalizeWorkspaceRoot(input.workspaceRoot, dependencies);
    if (child && child.exitCode === null && child.signalCode === null) {
      if (workspaceRoot !== requestedRoot) throw new Error("OPENPENCIL_ALREADY_CONNECTED_OTHER_ROOT");
      return await status();
    }
    if (await dependencies.portReady()) throw new Error("OPENPENCIL_PORT_IN_USE");

    const launch = resolveOpenPencilHttpLaunch(dependencies);
    if (!launch) return unavailableStatus();

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

  async function disconnect(): Promise<OpenPencilConnectionStatus> {
    const owned = child;
    if (!owned) {
      return Object.freeze({
        state: "disconnected",
        endpoint: OPENPENCIL_MCP_ENDPOINT,
        installed: Boolean(resolveOpenPencilHttpLaunch(dependencies)),
        workspaceConfigured: false,
        owned: false,
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
      message: "PlotPickle disconnected its OpenPencil MCP process. OpenPencil itself was not uninstalled.",
    });
  }

  return Object.freeze({ status, connect, disconnect });
}

export type OpenPencilMcpController = ReturnType<typeof createOpenPencilMcpController>;

export function registerOpenPencilMcpGateway(server: ViteDevServer, controller: OpenPencilMcpController = createOpenPencilMcpController()) {
  server.httpServer?.once("close", () => { void controller.disconnect(); });
  server.middlewares.use((request, response, next) => {
    if (request.url?.split("?", 1)[0] !== OPENPENCIL_MCP_API) { next(); return; }

    const reply = (statusCode: number, body: unknown) => {
      response.statusCode = statusCode;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.end(JSON.stringify(body));
    };

    if (!currentProfileRequestContext() || !acceptsDsddLoopbackRequest(request, OPENPENCIL_MCP_API)) {
      reply(403, { ok: false, message: "Unlock the local PlotPickle profile before using OpenPencil." });
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        reply(200, { ok: true, status: await controller.status() });
        return;
      }
      if (request.method === "POST") {
        const body = await readDsddRequestBody(request, 16_384);
        reply(200, { ok: true, status: await controller.connect({ workspaceRoot: body.workspaceRoot }) });
        return;
      }
      if (request.method === "DELETE") {
        reply(200, { ok: true, status: await controller.disconnect() });
        return;
      }
      reply(405, { ok: false, message: "Method not allowed." });
    })().catch((error) => reply(400, { ok: false, message: publicErrorMessage(error) }));
  });
}
