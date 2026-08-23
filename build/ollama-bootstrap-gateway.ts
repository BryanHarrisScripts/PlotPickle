import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import starterSource from "../config/ollama-starter-model.json";

const API_PATH = "/api/ollama-bootstrap/starter-model";
const OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const OLLAMA_TAGS_URL = `${OLLAMA_BASE_URL}/api/tags`;
const OLLAMA_PULL_URL = `${OLLAMA_BASE_URL}/api/pull`;
const STARTER_MODEL = starterSource.model;
const PULL_TIMEOUT_MS = 15 * 60 * 1_000;

type OllamaTags = { models?: Array<{ name?: unknown; model?: unknown }> };

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

async function installedModels(signal?: AbortSignal) {
  const response = await fetch(OLLAMA_TAGS_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status} from /api/tags.`);
  const body = await response.json() as OllamaTags;
  return (body.models ?? [])
    .map((item) => typeof item.name === "string" ? item.name : typeof item.model === "string" ? item.model : "")
    .filter(Boolean)
    .slice(0, 100);
}

async function installStarterModel() {
  const before = await installedModels(AbortSignal.timeout(5_000));
  if (before.includes(STARTER_MODEL)) {
    return { installed: false, alreadyInstalled: true, models: before };
  }

  const response = await fetch(OLLAMA_PULL_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ model: STARTER_MODEL, stream: false }),
    signal: AbortSignal.timeout(PULL_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => ({})) as { status?: unknown; error?: unknown };
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : `Ollama returned HTTP ${response.status} from /api/pull.`;
    throw new Error(message.slice(0, 300));
  }
  if (body.status !== "success") throw new Error("Ollama did not report a successful starter-model pull.");

  const models = await installedModels(AbortSignal.timeout(5_000));
  if (!models.includes(STARTER_MODEL)) throw new Error("Ollama completed the pull, but the starter model was not reported by /api/tags.");
  return { installed: true, alreadyInstalled: false, models };
}

export function registerOllamaBootstrapGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API_PATH) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "The Ollama starter-model action accepts requests only from this PlotPickle server." });
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "Use POST to install the reviewed Ollama starter model." });
      return;
    }

    void installStarterModel()
      .then((result) => sendJson(response, 200, {
        ok: true,
        model: STARTER_MODEL,
        displayName: starterSource.displayName,
        qualityBoundary: starterSource.qualityBoundary,
        ...result,
      }))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "The Ollama starter model could not be installed.";
        sendJson(response, 400, {
          ok: false,
          model: STARTER_MODEL,
          message: message.replace(/[\r\n]+/g, " ").slice(0, 400),
        });
      });
  });
}
