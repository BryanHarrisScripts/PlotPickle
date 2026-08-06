import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { detectLocalAiInstallations } from "./local-ai-installation-status";

const API_PATH = "/api/local-ai/installations";
const OLLAMA_URL = "http://127.0.0.1:11434/api/tags";
const COMFYUI_URL = "http://127.0.0.1:8188/system_stats";

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

async function responds(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function installationSnapshot() {
  const [ollamaRunning, comfyuiRunning] = await Promise.all([
    responds(OLLAMA_URL),
    responds(COMFYUI_URL),
  ]);
  const installations = await detectLocalAiInstallations({ ollamaRunning, comfyuiRunning });
  return {
    ok: true,
    checkedAt: installations.checkedAt,
    ollama: {
      ...installations.ollama,
      running: ollamaRunning,
    },
    comfyui: {
      ...installations.comfyui,
      running: comfyuiRunning,
    },
  };
}

export function registerLocalAiInstallationGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API_PATH) {
      next();
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { ok: false, message: "Method not allowed." });
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Local AI installation status is restricted to this computer." });
      return;
    }
    void installationSnapshot()
      .then((value) => sendJson(response, 200, value))
      .catch((error) => sendJson(response, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "Local AI installation status could not be read.",
      }));
  });
}
