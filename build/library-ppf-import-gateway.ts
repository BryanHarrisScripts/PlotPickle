import type { ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { richPpfToLibraryProject } from "../modules/library/import/rich-ppf-to-library-project";
import {
  isLocalPlotPickleRequest,
  openLocalPpf,
  readLocalPpfRequest,
} from "./projects/portable-ppf-reader";

const LIBRARY_PPF_IMPORT_PATH = "/api/library/import/ppf";

function sendLibraryJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  }).end(JSON.stringify(body));
}

export function registerLibraryPpfImportGateway(server: ViteDevServer) {
  server.middlewares.use(async (request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== LIBRARY_PPF_IMPORT_PATH) {
      next();
      return;
    }
    if (!isLocalPlotPickleRequest(request)) {
      sendLibraryJson(response, 403, { ok: false, message: "Library .ppf import is available only from this local PlotPickle app." });
      return;
    }
    if (request.method !== "POST") {
      sendLibraryJson(response, 405, { ok: false, message: "Use POST to import a .ppf into Library." });
      return;
    }

    try {
      const filenameHeader = request.headers["x-plotpickle-project-filename"];
      const filename = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader || "project.ppf";
      if (!String(filename).toLowerCase().endsWith(".ppf")) throw new Error("Library imports PlotPickle .ppf files only. Convert screenplay sources to .ppf first.");
      const importedAt = new Date().toISOString();
      const { project, packageKind } = openLocalPpf(await readLocalPpfRequest(request));
      const modularProject = richPpfToLibraryProject(project, importedAt);
      sendLibraryJson(response, 200, {
        ok: true,
        packageKind,
        sourceProjectId: project.id,
        sourceFileName: project.screenplay.fileName,
        project: modularProject,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "PlotPickle could not import this .ppf into Library.";
      sendLibraryJson(response, /48 MB/.test(message) ? 413 : 400, { ok: false, message });
    }
  });
}
