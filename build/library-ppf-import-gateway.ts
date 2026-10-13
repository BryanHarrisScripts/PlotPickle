import type { ServerResponse } from "node:http";
import path from "node:path";
import { convertScreenplayTextToPpf } from "../lib/projects/screenplay/screenplay-to-ppf";
import type { ViteDevServer } from "vite";
import { richPpfToLibraryProject } from "../modules/library/import/rich-ppf-to-library-project";
import {
  isLocalPlotPickleRequest,
  openLocalPpf,
  readLocalPpfRequest,
} from "./projects/portable-ppf-reader";

const LIBRARY_PPF_IMPORT_PATH = "/api/library/import/ppf";
export const LIBRARY_FDX_CONVERT_PATH = "/api/library/convert/fdx";

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
    if (pathname === LIBRARY_FDX_CONVERT_PATH) {
      if (!isLocalPlotPickleRequest(request)) {
        sendLibraryJson(response, 403, { ok: false, message: "Screenplay conversion is available only from this local PlotPickle app." });
        return;
      }
      if (request.method !== "POST") {
        sendLibraryJson(response, 405, { ok: false, message: "Use POST to convert a Final Draft screenplay." });
        return;
      }
      try {
        const header = request.headers["x-plotpickle-screenplay-filename"];
        if (!header || Array.isArray(header)) throw new Error("Choose a Final Draft .fdx screenplay.");
        const decoded = decodeURIComponent(header);
        const sourceName = path.posix.basename(decoded.replace(/\\/g, "/"));
        if (!sourceName.toLowerCase().endsWith(".fdx") || sourceName.length > 200 || /[\u0000-\u001f\u007f]/.test(sourceName)) {
          throw new Error("Choose a valid Final Draft .fdx screenplay filename.");
        }
        const sourceText = (await readLocalPpfRequest(request, "Final Draft screenplay")).toString("utf8");
        if (!/^\uFEFF?\s*(?:<\?xml[^>]*>\s*)?<FinalDraft\b/i.test(sourceText)
          || !/<Content\b/i.test(sourceText) || !/<Paragraph\b/i.test(sourceText) || !/<Text\b/i.test(sourceText)) {
          throw new Error("The selected file does not contain a recognizable Final Draft screenplay.");
        }
        const result = convertScreenplayTextToPpf({ fileName: sourceName, sourceText });
        if (result.sourceSceneCount < 1 || result.sourcePassageCount < 2) {
          throw new Error("The Final Draft source lacks enough verified scene and screenplay evidence to convert.");
        }
        const buffer = Buffer.from(result.serializedPpf, "utf8");
        response.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${result.fileName}"`,
          "Content-Length": buffer.byteLength,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-PlotPickle-PPF-Filename": encodeURIComponent(result.fileName),
          "X-PlotPickle-Source-Scenes": String(result.sourceSceneCount),
          "X-PlotPickle-Source-Passages": String(result.sourcePassageCount),
        }).end(buffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The Final Draft screenplay could not be converted.";
        sendLibraryJson(response, /48 MB/.test(message) ? 413 : 400, { ok: false, message });
      }
      return;
    }
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
