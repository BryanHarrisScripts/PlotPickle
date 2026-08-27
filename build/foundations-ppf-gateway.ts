import type { ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { assembleFoundationSourceContext } from "../lib/projects/canon/foundation-source-context";
import {
  isLocalPlotPickleRequest,
  openLocalPpf,
  readLocalPpfRequest,
} from "./projects/portable-ppf-reader";

const FOUNDATIONS_PPF_PATH = "/api/plan/foundations/ppf-context";

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

export function registerFoundationsPpfGateway(server: ViteDevServer) {
  server.middlewares.use(async (request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== FOUNDATIONS_PPF_PATH) {
      next();
      return;
    }
    if (!isLocalPlotPickleRequest(request)) {
      sendJson(response, 403, { ok: false, message: "PLAN .ppf ingestion is available only from this local PlotPickle app." });
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "Use POST to load a .ppf into PLAN Foundations." });
      return;
    }

    try {
      const filenameHeader = request.headers["x-plotpickle-project-filename"];
      const filename = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader || "project.ppf";
      if (!String(filename).toLowerCase().endsWith(".ppf")) throw new Error("PLAN Foundations accepts PlotPickle .ppf files only.");
      const { project, packageKind } = openLocalPpf(await readLocalPpfRequest(request));
      const context = assembleFoundationSourceContext(project);
      if (!context) throw new Error("The .ppf opened, but it did not contain usable story evidence for Foundations.");
      sendJson(response, 200, {
        ok: true,
        projectId: project.id,
        projectTitle: project.metadata.title || "Untitled Story",
        packageKind,
        context,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "PlotPickle could not read this .ppf for Foundations.";
      sendJson(response, /48 MB/.test(message) ? 413 : 400, { ok: false, message });
    }
  });
}
