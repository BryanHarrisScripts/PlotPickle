import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import {
  startManagedPlotPickleEndpoint,
  stopManagedLocalEndpoint,
} from "./local-endpoint-runtime.mjs";

const DEFAULT_WRITER_URL = "http://127.0.0.1:4173";
const READY_TIMEOUT_MS = 60_000;
const POLL_MS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isDefaultWriterLocalUrl(value) {
  if (!URL.canParse(String(value || ""))) return false;
  const url = new URL(value);
  return url.protocol === "http:"
    && new Set(["127.0.0.1", "localhost"]).has(url.hostname)
    && (url.port || "80") === "4173";
}

export function looksLikePlotPickleHtml(text) {
  return /\bPlotPickle\b/i.test(String(text || ""));
}

async function tcpReachable(url, timeoutMs = 650) {
  if (!new Set(["http:", "https:"]).has(url.protocol)) return false;
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: url.hostname, port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

export async function probeWriterApp(baseUrl, { fetchImpl = globalThis.fetch, tcpProbe = tcpReachable } = {}) {
  const url = new URL(baseUrl);
  try {
    const response = await fetchImpl(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(2_500),
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const body = await response.text();
    if (response.ok && looksLikePlotPickleHtml(body)) {
      return { state: "ready", status: response.status, detail: "PlotPickle responded successfully." };
    }
    return {
      state: "occupied",
      status: response.status,
      detail: response.ok
        ? "The target responded, but it did not identify itself as PlotPickle."
        : `The target returned HTTP ${response.status}.`,
    };
  } catch (error) {
    const occupied = await tcpProbe(url).catch(() => false);
    return {
      state: occupied ? "occupied" : "unavailable",
      status: 0,
      detail: occupied
        ? "The target port accepts connections but did not return a usable PlotPickle page."
        : (error instanceof Error ? error.message : "The target is unavailable."),
    };
  }
}

async function defaultForceKill(child) {
  if (!child || child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("error", () => resolve());
      killer.once("exit", () => resolve());
    });
    return;
  }
  child.kill("SIGKILL");
}

export async function stopOwnedWriterApp(runtime, {
  sleepImpl = sleep,
  forceKillImpl = defaultForceKill,
} = {}) {
  if (runtime?.source === "local-endpoint-registry-direct") {
    await stopManagedLocalEndpoint(runtime);
    return;
  }
  if (!runtime?.owned || runtime.stopped) return;
  runtime.stopped = true;
  const child = runtime.child;
  if (!child || child.exitCode !== null) return;
  child.kill();
  for (let index = 0; index < 10 && child.exitCode === null; index += 1) {
    await sleepImpl(150);
  }
  if (child.exitCode === null) await forceKillImpl(child);
}

export async function ensureWriterAppRuntime({
  baseUrl = DEFAULT_WRITER_URL,
  repoRoot,
  timeoutMs = READY_TIMEOUT_MS,
  pollMs = POLL_MS,
  onStatus = () => {},
  deps = {},
  managedEndpoint = false,
  jobId,
  profileRef,
} = {}) {
  if (!repoRoot) throw new Error("Writer app preflight requires the PlotPickle repository root.");
  if (managedEndpoint) {
    return startManagedPlotPickleEndpoint({
      repoRoot,
      jobId,
      profileRef,
      serviceKind: "plotpickle-writer-app",
      startupContract: "plotpickle-writer-endpoint-v1",
      timeoutMs,
      pollMs,
      onStatus,
      onOutput: deps.onOutput,
      deps: deps.managed || {},
    });
  }

  const probe = deps.probe || probeWriterApp;
  const spawnImpl = deps.spawn || spawn;
  const accessImpl = deps.access || access;
  const sleepImpl = deps.sleep || sleep;
  const first = await probe(baseUrl);

  if (first.state === "ready") {
    return {
      baseUrl,
      owned: false,
      child: null,
      stopped: false,
      source: "existing",
      stop: async () => {},
    };
  }

  if (first.state === "occupied") {
    throw new Error(`Writer app preflight refused ${baseUrl}: ${first.detail} Stop the process using that address or choose a verified PlotPickle URL.`);
  }

  if (!isDefaultWriterLocalUrl(baseUrl)) {
    throw new Error(`Writer app preflight could not reach ${baseUrl}. Automatic startup is limited to ${DEFAULT_WRITER_URL}; start the requested PlotPickle target yourself and retry.`);
  }

  const viteCli = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
  const viteAvailable = await accessImpl(viteCli).then(
    () => true,
    (error) => {
      if (error?.code === "ENOENT") return false;
      throw error;
    },
  );
  if (!viteAvailable) {
    throw new Error("Writer app preflight cannot start PlotPickle because the local Vite runtime is missing. Run Start-PlotPickle.bat once to prepare the local runtime, then retry Avery.");
  }

  const url = new URL(baseUrl);
  const output = [];
  const child = spawnImpl(process.execPath, [
    viteCli,
    "--host", url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
    "--port", url.port || "4173",
    "--strictPort",
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NODE_ENV: "development",
      VITE_CONFIG_NATIVE_IGNORE_WARNING: "true",
      PLOTPICKLE_STARTUP_CONTRACT: "plotpickle-writer-owned-v1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout?.setEncoding?.("utf8");
  child.stderr?.setEncoding?.("utf8");
  child.stdout?.on?.("data", (chunk) => output.push(String(chunk)));
  child.stderr?.on?.("data", (chunk) => output.push(String(chunk)));

  const runtime = {
    baseUrl,
    owned: true,
    child,
    stopped: false,
    source: "writer-owned-vite",
    stop: null,
  };
  runtime.stop = () => stopOwnedWriterApp(runtime, {
    sleepImpl,
    forceKillImpl: deps.forceKill,
  });

  onStatus("starting", `Starting temporary PlotPickle at ${baseUrl}.`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const tail = output.join("").slice(-2_000).trim();
      throw new Error(`Writer app preflight could not start PlotPickle (Vite exited ${child.exitCode}).${tail ? ` ${tail}` : ""}`);
    }
    await sleepImpl(pollMs);
    const current = await probe(baseUrl);
    if (current.state === "ready") {
      onStatus("ready", `Temporary PlotPickle is ready at ${baseUrl}.`);
      return runtime;
    }
  }

  await runtime.stop();
  const tail = output.join("").slice(-2_000).trim();
  throw new Error(`Writer app preflight timed out waiting for PlotPickle at ${baseUrl}.${tail ? ` ${tail}` : ""}`);
}
