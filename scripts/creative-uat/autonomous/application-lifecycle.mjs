import { spawn as spawnChild } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function boundedLog(value, maximum = 12_000) {
  const text = String(value ?? "");
  return text.length <= maximum ? text : text.slice(-maximum);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function processIdentity(generation, child, startedAt) {
  return `${generation}:${Number(child?.pid || 0)}:${startedAt}`;
}

async function endpointResponds(fetchImpl, url, timeoutMs) {
  return fetchImpl(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  }).then(
    (response) => response.ok,
    (error) => {
      const name = String(error?.name || "");
      if (name === "AbortError" || name === "TimeoutError" || error instanceof TypeError) return false;
      throw error;
    },
  );
}

export function resolveManagedPlotPickleTarget(baseUrl) {
  const target = new URL(baseUrl);
  if (target.protocol !== "http:") throw new Error("Managed PlotPickle lifecycle requires a local http:// target.");
  if (!LOOPBACK_HOSTS.has(target.hostname)) throw new Error("Managed PlotPickle lifecycle is limited to loopback hosts.");
  const port = Number(target.port || 80);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Managed PlotPickle lifecycle requires a valid local port.");
  const host = target.hostname === "localhost" ? "127.0.0.1" : target.hostname.replace(/^\[(.*)\]$/, "$1");
  return { target, host, port };
}

export function createManagedPlotPickleLifecycle(options = {}) {
  const repoRoot = path.resolve(String(options.repoRoot || "."));
  const baseUrl = String(options.baseUrl || "http://127.0.0.1:4173");
  const { target, host, port } = resolveManagedPlotPickleTarget(baseUrl);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const spawnProcess = options.spawnProcess || spawnChild;
  const startupTimeoutMs = Number(options.startupTimeoutMs || 120_000);
  const shutdownTimeoutMs = Number(options.shutdownTimeoutMs || 15_000);
  const probeTimeoutMs = Number(options.probeTimeoutMs || 2_000);
  const command = options.command || process.execPath;
  const viteEntry = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
  const managesVite = !Array.isArray(options.args);
  const args = Array.isArray(options.args)
    ? [...options.args]
    : [viteEntry, "--host", host, "--port", String(port), "--strictPort"];
  if (managesVite && !existsSync(viteEntry)) {
    throw new Error(`Managed PlotPickle lifecycle requires the local Vite entry: ${viteEntry}`);
  }
  const readinessTarget = new URL(String(options.readinessPath || (managesVite ? "/@vite/client" : target.pathname || "/")), target.origin);
  if (readinessTarget.origin !== target.origin) {
    throw new Error("Managed PlotPickle readiness probe must stay on the same loopback origin.");
  }

  let active = null;
  let generation = 0;
  let output = "";

  function append(label, chunk) {
    output = boundedLog(`${output}[${label}] ${chunk.toString()}`);
  }

  async function waitForReady(record) {
    const started = Date.now();
    while (Date.now() - started < startupTimeoutMs) {
      if (record.exited) {
        throw new Error(`PlotPickle application process exited before readiness (code ${record.exitCode ?? "unknown"}, signal ${record.exitSignal ?? "none"}). ${boundedLog(output, 2_000)}`);
      }
      if (await endpointResponds(fetchImpl, readinessTarget.href, probeTimeoutMs)) return;
      await delay(150);
    }
    throw new Error(`PlotPickle application process did not become ready within ${startupTimeoutMs}ms. ${boundedLog(output, 2_000)}`);
  }

  async function waitForUnavailable() {
    const started = Date.now();
    while (Date.now() - started < shutdownTimeoutMs) {
      if (!(await endpointResponds(fetchImpl, readinessTarget.href, Math.min(probeTimeoutMs, 750)))) return true;
      await delay(100);
    }
    return false;
  }

  async function start() {
    if (active && !active.exited) throw new Error("PlotPickle application process is already running under this lifecycle owner.");
    generation += 1;
    output = "";
    const startedAt = Date.now();
    const child = spawnProcess(command, args, {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        ...options.env,
        FORCE_COLOR: "0",
        NODE_ENV: options.nodeEnv || "development",
        WRANGLER_WRITE_LOGS: "false",
        WRANGLER_LOG_PATH: ".wrangler/logs",
        MINIFLARE_REGISTRY_PATH: ".wrangler/registry",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const record = {
      child,
      generation,
      startedAt,
      pid: Number(child.pid || 0),
      processIdentity: processIdentity(generation, child, startedAt),
      exited: false,
      exitCode: null,
      exitSignal: null,
    };
    active = record;
    child.stdout?.on("data", (chunk) => append("stdout", chunk));
    child.stderr?.on("data", (chunk) => append("stderr", chunk));
    child.once("error", (error) => append("process-error", `${error.stack || error.message}\n`));
    child.once("exit", (code, signal) => {
      record.exited = true;
      record.exitCode = code;
      record.exitSignal = signal;
    });
    await waitForReady(record);
    return {
      started: true,
      generation: record.generation,
      pid: record.pid,
      processIdentity: record.processIdentity,
      endpoint: target.origin,
      readinessEndpoint: readinessTarget.pathname,
    };
  }

  async function stop() {
    if (!active) return { stopped: true, endpointUnavailable: !(await endpointResponds(fetchImpl, readinessTarget.href, probeTimeoutMs)), exitCode: null, exitSignal: null };
    const record = active;
    if (!record.exited) record.child.kill("SIGTERM");
    const stopStarted = Date.now();
    while (!record.exited && Date.now() - stopStarted < shutdownTimeoutMs) await delay(50);
    if (!record.exited) {
      record.child.kill("SIGKILL");
      const killStarted = Date.now();
      while (!record.exited && Date.now() - killStarted < 2_000) await delay(50);
    }
    const endpointUnavailable = await waitForUnavailable();
    active = null;
    return {
      stopped: record.exited,
      endpointUnavailable,
      exitCode: record.exitCode,
      exitSignal: record.exitSignal,
      generation: record.generation,
      pid: record.pid,
      processIdentity: record.processIdentity,
    };
  }

  async function restart() {
    if (!active || active.exited) throw new Error("PlotPickle application process must be running before restart.");
    const before = {
      generation: active.generation,
      pid: active.pid,
      processIdentity: active.processIdentity,
    };
    const stopped = await stop();
    if (!stopped.stopped || !stopped.endpointUnavailable) {
      throw new Error("PlotPickle application restart failed because the previous application process did not fully stop.");
    }
    const after = await start();
    return {
      restarted: true,
      boundary: "managed-plotpickle-application-process",
      previousProcess: before,
      stopped,
      currentProcess: after,
      newProcessIdentity: before.processIdentity !== after.processIdentity,
    };
  }

  return {
    start,
    stop,
    restart,
    get active() {
      return active ? {
        generation: active.generation,
        pid: active.pid,
        processIdentity: active.processIdentity,
        exited: active.exited,
      } : null;
    },
  };
}
