import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { GET as profileGet, POST as profilePost } from "../app/api/auth/profile/route";

const PROFILE_API = "/api/auth/profile";
const MAXIMUM_BODY_BYTES = 64 * 1024;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function desktopLoopbackMode() {
  return process.env.PLOTPICKLE_ACCESS_MODE?.trim() !== "server-network";
}

function requestOrigin(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host) throw new Error("PlotPickle rejected a local profile request without a Host header.");
  const parsed = new URL(`http://${host}`);
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) throw new Error("PlotPickle local profile Auth accepts loopback hosts only.");
  if (!LOOPBACK_PEERS.has(String(request.socket.remoteAddress || ""))) {
    throw new Error("PlotPickle local profile Auth accepts loopback peers only.");
  }
  const origin = request.headers.origin;
  if (origin && new URL(origin).origin !== parsed.origin) {
    throw new Error("PlotPickle rejected a cross-origin local profile request.");
  }
  return parsed.origin;
}

function requestHeaders(request: IncomingMessage) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (typeof value === "string") {
      headers.set(name, value);
    }
  }
  return headers;
}

async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > MAXIMUM_BODY_BYTES) throw new Error("PlotPickle local profile request body is too large.");
    chunks.push(value);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function webRequest(request: IncomingMessage, origin: string) {
  const method = String(request.method || "GET").toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await requestBody(request);
  return new Request(new URL(request.url || PROFILE_API, origin), {
    method,
    headers: requestHeaders(request),
    body,
  });
}

async function sendWebResponse(result: Response, response: ServerResponse) {
  response.statusCode = result.status;
  result.headers.forEach((value, name) => response.setHeader(name, value));
  const body = Buffer.from(await result.arrayBuffer());
  response.end(body);
}

function sendRejected(response: ServerResponse, statusCode: number, message: string) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify({ code: "ACCESS_DENIED", message }));
}

export function localProfileAuthGateway(): Plugin {
  return {
    name: "plotpickle-local-profile-auth-node-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!desktopLoopbackMode()) { next(); return; }
        let pathname = "";
        try { pathname = new URL(request.url || "/", "http://127.0.0.1").pathname; } catch { next(); return; }
        if (pathname !== PROFILE_API) { next(); return; }

        const method = String(request.method || "GET").toUpperCase();
        if (method !== "GET" && method !== "POST") {
          sendRejected(response, 405, "That local profile method is unavailable.");
          return;
        }

        void (async () => {
          const origin = requestOrigin(request);
          const web = await webRequest(request, origin);
          const result = method === "GET" ? await profileGet(web) : await profilePost(web);
          await sendWebResponse(result, response);
        })().catch(() => {
          if (response.headersSent) {
            response.destroy();
            return;
          }
          sendRejected(response, 403, "The local profile request could not be authorized.");
        });
      });
    },
  };
}
