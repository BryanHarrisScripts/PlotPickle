import type { IncomingMessage } from "node:http";
import { parsePortableProjectFile } from "../../lib/projects/persistence/project-package";
import { projectFromPackage } from "../../lib/projects/canon/ppf-exchange";
import type { PlotPickleProject } from "../../lib/projects/project";

export const MAX_LOCAL_PPF_BYTES = 48 * 1024 * 1024;

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function localHostUrl(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return null;
  const host = request.headers.host;
  if (!host) return null;
  const value = `http://${host}`;
  if (!URL.canParse(value)) return null;
  const hostUrl = new URL(value);
  return ["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname) ? hostUrl : null;
}

export function isLocalPlotPickleRequest(request: IncomingMessage) {
  const hostUrl = localHostUrl(request);
  if (!hostUrl) return false;
  const origin = request.headers.origin;
  return !origin || (URL.canParse(origin) && new URL(origin).host === hostUrl.host);
}

export async function readLocalPpfRequest(request: IncomingMessage) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_LOCAL_PPF_BYTES) {
    throw new Error("The .ppf is larger than PlotPickle's 48 MB local ingestion limit.");
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > MAX_LOCAL_PPF_BYTES) throw new Error("The .ppf is larger than PlotPickle's 48 MB local ingestion limit.");
    chunks.push(value);
  }
  if (!length) throw new Error("Choose a PlotPickle .ppf file first.");
  return Buffer.concat(chunks);
}

export function openLocalPpf(buffer: Buffer): { project: PlotPickleProject; packageKind: string } {
  const text = buffer.toString("utf8").trimStart();
  if (text.startsWith("{")) {
    const portable = parsePortableProjectFile(text);
    if (!portable.integrityValid) throw new Error("The .ppf integrity check failed. Recover a valid project or backup before importing it.");
    return { project: portable.project, packageKind: "portable-project" };
  }
  const exchange = projectFromPackage(buffer);
  return { project: exchange.project, packageKind: exchange.manifest.packageKind };
}
