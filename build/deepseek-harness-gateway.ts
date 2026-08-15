import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { deepSeekHarnessStatus, launchDeepSeekHarness } from "./deepseek-harness-runtime";

const STATUS_PATH = "/api/deepseek-harness/status";
const LAUNCH_PATH = "/api/deepseek-harness/launch";

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  let hostUrl: URL;
  try { hostUrl = new URL(`http://${host}`); } catch { return false; }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === hostUrl.host; } catch { return false; }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

export function registerDeepSeekHarnessGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== STATUS_PATH && pathname !== LAUNCH_PATH) {
      next();
      return;
    }

    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "DeepSeek Harness controls are available only from this local PlotPickle server." });
      return;
    }

    if (pathname === STATUS_PATH && request.method === "GET") {
      void deepSeekHarnessStatus()
        .then((status) => sendJson(response, 200, { ok: true, status }))
        .catch((error) => sendJson(response, 500, {
          ok: false,
          message: error instanceof Error ? error.message : "Could not inspect DeepSeek Harness.",
        }));
      return;
    }

    if (pathname === LAUNCH_PATH && request.method === "POST") {
      void launchDeepSeekHarness()
        .then((result) => sendJson(response, 200, { ok: true, ...result }))
        .catch((error) => sendJson(response, 409, {
          ok: false,
          message: error instanceof Error ? error.message : "Could not launch DeepSeek Harness.",
        }));
      return;
    }

    sendJson(response, 405, {
      ok: false,
      message: pathname === STATUS_PATH
        ? "Use GET to inspect DeepSeek Harness status."
        : "Use POST to explicitly install or launch DeepSeek Harness through Ollama.",
    });
  });
}
