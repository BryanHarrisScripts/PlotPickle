import type { ViteDevServer } from "vite";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { acceptsDsddLoopbackRequest, readDsddRequestBody } from "./dsdd-session-gateway";
import { HunkReviewController } from "./hunk-review-controller.mjs";

const API = "/api/dsdd/review";
export function registerHunkReviewGateway(server: ViteDevServer, controller = new HunkReviewController()) {
  server.middlewares.use((request, response, next) => {
    if (request.url?.split("?", 1)[0] !== API) { next(); return; }
    const reply = (status: number, body: unknown) => {
      response.statusCode = status;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.end(JSON.stringify(body));
    };
    const profile = currentProfileRequestContext();
    if (!profile || !acceptsDsddLoopbackRequest(request, API)) { reply(403, { ok: false, message: "Unlock the local profile before reviewing changes." }); return; }
    void (async () => {
      if (request.method === "GET") { reply(200, { ok: true, ...(await controller.capabilities()), review: await controller.current(profile.profileId) }); return; }
      if (request.method !== "POST") { reply(405, { ok: false, message: "Method not allowed." }); return; }
      const body = await readDsddRequestBody(request, 16_384);
      const review = body.action === "start" ? await controller.start(profile.profileId, body.target, body.notes)
        : body.action === "cancel" && typeof body.id === "string" ? await controller.cancel(profile.profileId, body.id)
        : null;
      if (!review) throw new Error("Choose a supported review action.");
      reply(200, { ok: true, review });
    })().catch(() => reply(400, { ok: false, message: "Review could not complete. Check Hunk availability and the selected target; the repository was not changed." }));
  });
}
