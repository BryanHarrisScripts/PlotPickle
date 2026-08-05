import os from "node:os";
import { statfs } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const SYSTEM_STATUS_API = "/api/local-system/status";
const COMFYUI_QUEUE_URL = "http://127.0.0.1:8188/queue";
const LOCAL_TIMEOUT_MS = 1_200;

type RuntimeEvent = {
  id: string;
  at: string;
  tone: "green" | "yellow" | "red";
  title: string;
  detail: string;
};

const runtimeEvents: RuntimeEvent[] = [];

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function recordEvent(event: Omit<RuntimeEvent, "id">) {
  const id = `${Date.parse(event.at)}-${event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  runtimeEvents.unshift({ id, ...event });
  if (runtimeEvents.length > 20) runtimeEvents.length = 20;
}

async function storageSnapshot() {
  try {
    const value = await statfs(process.cwd());
    const totalBytes = Number(value.blocks) * Number(value.bsize);
    const freeBytes = Number(value.bavail) * Number(value.bsize);
    return {
      available: Number.isFinite(totalBytes) && totalBytes > 0,
      totalBytes,
      freeBytes,
      usedBytes: Math.max(0, totalBytes - freeBytes),
      detail: "Storage totals are reported for the volume containing the running PlotPickle package.",
    };
  } catch (error) {
    return {
      available: false,
      totalBytes: 0,
      freeBytes: 0,
      usedBytes: 0,
      detail: error instanceof Error ? error.message : "Storage telemetry is unavailable.",
    };
  }
}

async function comfyQueueSnapshot() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOCAL_TIMEOUT_MS);
  try {
    const response = await fetch(COMFYUI_QUEUE_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ComfyUI returned HTTP ${response.status}.`);
    const body = await response.json() as Record<string, unknown>;
    const running = Array.isArray(body.queue_running) ? body.queue_running.length : 0;
    const pending = Array.isArray(body.queue_pending) ? body.queue_pending.length : 0;
    return {
      available: true,
      running,
      pending,
      detail: running || pending
        ? `${running} running and ${pending} queued ComfyUI job${running + pending === 1 ? "" : "s"}.`
        : "ComfyUI is reporting no active or queued image/video jobs.",
    };
  } catch {
    return {
      available: false,
      running: 0,
      pending: 0,
      detail: "ComfyUI queue telemetry is unavailable because the local service is not responding.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function snapshot() {
  const checkedAt = new Date().toISOString();
  const cpus = os.cpus();
  const totalMemoryBytes = os.totalmem();
  const freeMemoryBytes = os.freemem();
  const [storage, comfyui] = await Promise.all([storageSnapshot(), comfyQueueSnapshot()]);

  recordEvent({
    at: checkedAt,
    tone: "green",
    title: "Local runtime snapshot completed",
    detail: `PlotPickle read CPU, memory and ${storage.available ? "storage" : "runtime"} telemetry from this computer.`,
  });
  if (comfyui.available) {
    recordEvent({
      at: checkedAt,
      tone: comfyui.running || comfyui.pending ? "yellow" : "green",
      title: "ComfyUI queue checked",
      detail: comfyui.detail,
    });
  }

  return {
    checkedAt,
    runtime: {
      state: "connected",
      nodeVersion: process.versions.node,
      platform: process.platform,
      architecture: process.arch,
      uptimeSeconds: Math.round(process.uptime()),
    },
    cpu: {
      available: cpus.length > 0,
      model: cpus[0]?.model?.trim() || "CPU model unavailable",
      logicalCores: cpus.length,
      detail: "PlotPickle reports the processor model and logical-core count. Live CPU utilization is not sampled by this gateway.",
    },
    memory: {
      available: totalMemoryBytes > 0,
      totalBytes: totalMemoryBytes,
      freeBytes: freeMemoryBytes,
      usedBytes: Math.max(0, totalMemoryBytes - freeMemoryBytes),
      detail: "RAM totals come from the operating system at the time of this check.",
    },
    storage,
    gpu: {
      available: false,
      model: "Unavailable",
      totalVramBytes: 0,
      usedVramBytes: 0,
      detail: "GPU and VRAM telemetry are not exposed by the current packaged local runtime, so PlotPickle does not invent values.",
    },
    jobs: {
      comfyui,
      ollama: {
        available: false,
        detail: "Ollama does not expose model-pull progress through PlotPickle's current reviewed local status route.",
      },
      repository: {
        available: false,
        detail: "Repository operations do not yet publish a shared active-job queue to Dashboard.",
      },
    },
    events: runtimeEvents,
  };
}

export function localSystemStatusGateway(): Plugin {
  return {
    name: "plotpickle-local-system-status-gateway",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        if (url.pathname !== SYSTEM_STATUS_API) return next();
        if (request.method !== "GET") return sendJson(response, 405, { message: "Method not allowed." });
        if (!isLocalRequest(request)) return sendJson(response, 403, { message: "Local system status is restricted to this computer." });
        try {
          return sendJson(response, 200, await snapshot());
        } catch (error) {
          return sendJson(response, 500, {
            message: error instanceof Error ? error.message : "Local system status could not be read.",
          });
        }
      });
    },
  };
}
