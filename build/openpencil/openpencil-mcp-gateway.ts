import type { ViteDevServer } from "vite";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { acceptsDsddLoopbackRequest, readDsddRequestBody } from "../dsdd/dsdd-session-gateway";
import {
  createOpenPencilMcpController,
  publicOpenPencilMcpError,
} from "./openpencil-mcp-runtime.mjs";

export const OPENPENCIL_MCP_API = "/api/openpencil/mcp";

type OpenPencilMcpController = ReturnType<typeof createOpenPencilMcpController>;

export function registerOpenPencilMcpGateway(
  server: ViteDevServer,
  controller: OpenPencilMcpController = createOpenPencilMcpController(),
) {
  server.httpServer?.once("close", () => { void controller.disconnect(); });
  server.middlewares.use((request, response, next) => {
    if (request.url?.split("?", 1)[0] !== OPENPENCIL_MCP_API) { next(); return; }

    const reply = (statusCode: number, body: unknown) => {
      response.statusCode = statusCode;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.end(JSON.stringify(body));
    };

    if (!currentProfileRequestContext() || !acceptsDsddLoopbackRequest(request, OPENPENCIL_MCP_API)) {
      reply(403, { ok: false, message: "Unlock the local PlotPickle profile before using OpenPencil." });
      return;
    }

    void (async () => {
      if (request.method === "GET") {
        reply(200, { ok: true, status: await controller.status() });
        return;
      }
      if (request.method === "POST") {
        const body = await readDsddRequestBody(request, 16_384);
        reply(200, { ok: true, status: await controller.connect({ workspaceRoot: body.workspaceRoot }) });
        return;
      }
      if (request.method === "DELETE") {
        reply(200, { ok: true, status: await controller.disconnect() });
        return;
      }
      reply(405, { ok: false, message: "Method not allowed." });
    })().catch((error) => reply(400, { ok: false, message: publicOpenPencilMcpError(error) }));
  });
}
