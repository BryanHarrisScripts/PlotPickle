import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { createStudioIdentity, readPublicStudioIdentity, renameStudioIdentity } from "./studio-identity";

const API = "/api/studio-identity";

function local(request: IncomingMessage) {
  const address = request.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address || "")) return false;
  const host = request.headers.host || "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}

function json(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > 8192) throw new Error("The Studio identity request is too large.");
    chunks.push(part);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid Studio identity request.");
  return parsed as Record<string, unknown>;
}

export function registerStudioIdentityGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API) { next(); return; }
    if (!local(request)) { json(response, 403, { ok: false, message: "Studio identity is available only from this local PlotPickle server." }); return; }
    void (async () => {
      try {
        if (request.method === "GET") { json(response, 200, { ok: true, ...(await readPublicStudioIdentity()) }); return; }
        if (request.method === "POST") {
          const input = await body(request);
          const action = input.action === "rename" ? "rename" : "create";
          const identity = action === "rename" ? await renameStudioIdentity(input.prefix) : await createStudioIdentity(input.prefix);
          json(response, 200, { ok: true, ...identity }); return;
        }
        json(response, 405, { ok: false, message: "Use GET or POST for Studio identity." });
      } catch (error) {
        json(response, 400, { ok: false, message: error instanceof Error ? error.message : "Studio identity could not be updated." });
      }
    })();
  });
}
