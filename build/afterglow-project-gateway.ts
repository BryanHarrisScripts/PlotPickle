import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  AFTERGLOW_PROJECT_ID,
  AFTERGLOW_PROJECT_TITLE,
  AFTERGLOW_REPOSITORY_FULL_NAME,
} from "../lib/afterglow-persistence";

const API = "/api/local-afterglow";

function isLoopback(value?: string) {
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

function sendJson(response: ServerResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function readOnlyStatus() {
  return {
    available: true,
    enabled: false,
    readOnly: true,
    projectId: AFTERGLOW_PROJECT_ID,
    title: AFTERGLOW_PROJECT_TITLE,
    repository: AFTERGLOW_REPOSITORY_FULL_NAME,
    message: "The bundled Afterglow project is a read-only PlotPickle example. Use Make My Own Copy to create an editable local project with a new ID.",
  };
}

export function afterglowProjectGateway(): Plugin {
  return {
    name: "plotpickle-afterglow-project-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) {
          next();
          return;
        }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) {
          next();
          return;
        }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Afterglow example status accepts requests only from this local PlotPickle server." });
          return;
        }

        if (request.method === "GET" && url.pathname === `${API}/status`) {
          sendJson(response, 200, { ok: true, ...readOnlyStatus() });
          return;
        }

        if (request.method === "POST" && (url.pathname === `${API}/enable` || url.pathname === `${API}/disable`)) {
          sendJson(response, 409, {
            ok: false,
            ...readOnlyStatus(),
            message: "The original Afterglow example and its repository cannot be enabled as a working project. Make My Own Copy creates an editable local project without an Afterglow repository destination.",
          });
          return;
        }

        sendJson(response, 404, { ok: false, message: "Afterglow example operation not found." });
      });
    },
  };
}
