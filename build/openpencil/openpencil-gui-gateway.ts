import type { ViteDevServer } from "vite";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { acceptsDsddLoopbackRequest, readDsddRequestBody } from "../dsdd/dsdd-session-gateway";
import {
  createOpenPencilGuiController,
  publicOpenPencilGuiError,
} from "./openpencil-gui-runtime.mjs";

export const OPENPENCIL_GUI_API = "/api/openpencil/gui";

type OpenPencilGuiController = ReturnType<typeof createOpenPencilGuiController>;

export function registerOpenPencilGuiGateway(
  server: ViteDevServer,
  controller: OpenPencilGuiController = createOpenPencilGuiController(),
) {
  server.middlewares.use((request, response, next) => {
    if (request.url?.split("?", 1)[0] !== OPENPENCIL_GUI_API) { next(); return; }

    const reply = (statusCode: number, body: unknown) => {
      response.statusCode = statusCode;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.end(JSON.stringify(body));
    };

    if (!currentProfileRequestContext() || !acceptsDsddLoopbackRequest(request, OPENPENCIL_GUI_API)) {
      reply(403, { ok: false, message: "Unlock the local PlotPickle profile before using the OpenPencil GUI." });
      return;
    }

    void (async () => {
      if (request.method !== "POST") {
        reply(405, { ok: false, message: "Method not allowed." });
        return;
      }
      const body = await readDsddRequestBody(request, 16_384);
      const action = String(body.action || "").trim();
      const surfaceName = String(body.surfaceName || "").trim();
      if (!surfaceName) {
        reply(400, { ok: false, message: "Name the OpenPencil surface explicitly, for example: OpenPencil open Timeline." });
        return;
      }
      if (action === "open") {
        reply(200, { ok: true, result: await controller.openSurface(surfaceName) });
        return;
      }
      if (action === "review") {
        reply(200, { ok: true, result: await controller.reviewSurface(surfaceName) });
        return;
      }
      reply(400, { ok: false, message: "OpenPencil GUI action must be open or review." });
    })().catch((error) => reply(400, { ok: false, message: publicOpenPencilGuiError(error) }));
  });
}
