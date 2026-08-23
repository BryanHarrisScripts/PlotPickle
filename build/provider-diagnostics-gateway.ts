import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { diagnoseComfyUI, normalizeLocalComfyUrl } from "./comfyui-connection-diagnostics";
import { readMediaRoutingStore, writeMediaRoutingStore } from "./media-routing-store";

const API_ROOT = "/api/provider-diagnostics";
const COMFYUI_PATH = `${API_ROOT}/comfyui`;

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

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 64 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The provider diagnostic request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid provider diagnostic request.");
  return parsed as Record<string, unknown>;
}

async function handleComfyUI(request: IncomingMessage, response: ServerResponse) {
  const body = request.method === "POST" ? await readBody(request) : {};
  const store = await readMediaRoutingStore();
  const baseUrl = normalizeLocalComfyUrl(body.baseUrl ?? store.comfyui.baseUrl);
  const endpointChanged = store.comfyui.baseUrl !== baseUrl;
  if (endpointChanged) {
    store.comfyui.baseUrl = baseUrl;
    store.comfyui.checkpoint = "";
    store.comfyui.imageVerifiedAt = "";
  }
  const diagnostic = await diagnoseComfyUI(baseUrl, store.comfyui.h3Workflow);
  if (store.comfyui.checkpoint && !diagnostic.checkpoints.includes(store.comfyui.checkpoint)) {
    store.comfyui.checkpoint = "";
    store.comfyui.imageVerifiedAt = "";
  }
  store.comfyui.lastError = diagnostic.error || diagnostic.capabilityError;
  await writeMediaRoutingStore(store);
  sendJson(response, 200, {
    ok: true,
    comfyui: {
      ...diagnostic,
      selectedCheckpoint: store.comfyui.checkpoint,
      checkpoint: store.comfyui.checkpoint || diagnostic.checkpoints[0] || "",
      imageVerifiedAt: store.comfyui.imageVerifiedAt,
      lastError: store.comfyui.lastError,
    },
  });
}

export function registerProviderDiagnosticsGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (!pathname.startsWith(API_ROOT)) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Provider diagnostics are available only from this local PlotPickle server." });
      return;
    }
    void (async () => {
      try {
        if (pathname === COMFYUI_PATH && (request.method === "GET" || request.method === "POST")) {
          await handleComfyUI(request, response);
          return;
        }
        sendJson(response, 404, { ok: false, message: "Provider diagnostic operation not found." });
      } catch (error) {
        sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "Provider diagnostics failed." });
      }
    })();
  });
}
