import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { assembleFoundationSourceContext } from "../lib/foundation-source-context";
import { parsePortableProjectFile } from "../lib/project-package";
import { projectFromPackage } from "../lib/ppf-exchange";
import type { PlotPickleProject } from "../lib/project";

const FOUNDATIONS_PPF_PATH = "/api/plan/foundations/ppf-context";
const MAX_PPF_BYTES = 48 * 1024 * 1024;

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

async function readPpf(request: IncomingMessage) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_PPF_BYTES) {
    throw new Error("The .ppf is larger than PlotPickle's 48 MB PLAN ingestion limit.");
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > MAX_PPF_BYTES) throw new Error("The .ppf is larger than PlotPickle's 48 MB PLAN ingestion limit.");
    chunks.push(value);
  }
  if (!length) throw new Error("Choose a PlotPickle .ppf file before asking AI to complete Foundations.");
  return Buffer.concat(chunks);
}

function openPpf(buffer: Buffer): { project: PlotPickleProject; packageKind: string } {
  const text = buffer.toString("utf8").trimStart();
  if (text.startsWith("{")) {
    const portable = parsePortableProjectFile(text);
    if (!portable.integrityValid) throw new Error("The .ppf integrity check failed. Recover a valid project or backup before using it as Foundations evidence.");
    return { project: portable.project, packageKind: "portable-project" };
  }
  const exchange = projectFromPackage(buffer);
  return { project: exchange.project, packageKind: exchange.manifest.packageKind };
}

export function registerFoundationsPpfGateway(server: ViteDevServer) {
  server.middlewares.use(async (request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== FOUNDATIONS_PPF_PATH) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
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
      const { project, packageKind } = openPpf(await readPpf(request));
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
