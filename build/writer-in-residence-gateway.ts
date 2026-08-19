import os from "node:os";
import path from "node:path";
import { readdir, readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const SESSIONS_API = "/api/writer-in-residence/sessions";
const ASSET_API = "/api/writer-in-residence/session-asset";
const SESSION_ID = /^\d{14}$/;
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov"]);

function sessionRoot() {
  const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localRoot, "PlotPickle", "writer-in-residence");
}

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function safeSessionDirectory(sessionId: string) {
  if (!SESSION_ID.test(sessionId)) return null;
  return path.join(sessionRoot(), sessionId);
}

async function walkFiles(root: string, relative = "", depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const directory = path.join(root, relative);
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === "browser-profile") continue;
    const child = relative ? path.join(relative, entry.name) : entry.name;
    if (entry.isDirectory()) files.push(...await walkFiles(root, child, depth + 1));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function assetUrl(sessionId: string, relativePath: string) {
  return `${ASSET_API}?session=${encodeURIComponent(sessionId)}&path=${encodeURIComponent(relativePath.replaceAll("\\", "/"))}`;
}

function chooseArtifacts(sessionId: string, files: string[]) {
  const images = files.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const videos = files.filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()));
  const poster = images.find((file) => /(?:^|[\\/_. -])(poster|key[-_ ]?art)(?:[\\/_. -]|$)/i.test(file)) || "";
  const trailer = videos.find((file) => /(?:^|[\\/_. -])(trailer|teaser|animatic)(?:[\\/_. -]|$)/i.test(file)) || "";
  const representative = poster
    || images.find((file) => /world-build|foundations-build|writer-review|dashboard/i.test(file))
    || images[0]
    || "";
  return {
    representativeVisualUrl: representative ? assetUrl(sessionId, representative) : "",
    posterUrl: poster ? assetUrl(sessionId, poster) : "",
    trailerUrl: trailer ? assetUrl(sessionId, trailer) : "",
  };
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function reportSummary(sessionId: string, report: Record<string, any>, files: string[]) {
  const visited = asArray(report.journeyCoverage?.writerVisitedScreens).map(String);
  const observations = asArray(report.observations);
  const promoted = asArray(report.promotedFindings);
  const frictionCount = observations.filter((item: any) => item?.kind && item.kind !== "positive").length;
  const completionFrontier = report.session?.completionFrontier
    || (visited.includes("world-build") ? "BUILD" : visited.includes("foundations-build") ? "FOUNDATIONS BUILD" : visited.at(-1) || "START");
  return {
    id: sessionId,
    synthetic: true,
    syntheticOwner: report.session?.syntheticOwner || report.persona?.name || "Avery North",
    generatedAt: report.generatedAt || "",
    projectName: report.syntheticProject?.name || report.storySeed?.title || "Avery synthetic test story",
    completionFrontier,
    completionState: report.finishedReason === "complete-journey" ? "Complete" : "Incomplete",
    finishedReason: report.finishedReason || "unknown",
    findingCount: promoted.length,
    frictionCount,
    stageCount: visited.length,
    ...chooseArtifacts(sessionId, files),
  };
}

async function readSession(sessionId: string) {
  const directory = safeSessionDirectory(sessionId);
  if (!directory) return null;
  try {
    const raw = await readFile(path.join(directory, "writer-in-residence-report.json"), "utf8");
    const report = JSON.parse(raw) as Record<string, any>;
    const files = await walkFiles(directory);
    return { summary: reportSummary(sessionId, report, files), report };
  } catch {
    return null;
  }
}

async function listSessions() {
  let entries;
  try {
    entries = await readdir(sessionRoot(), { withFileTypes: true });
  } catch {
    return [];
  }
  const sessionIds = entries
    .filter((entry) => entry.isDirectory() && SESSION_ID.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a));
  const sessions = await Promise.all(sessionIds.map(readSession));
  return sessions.filter(Boolean).map((item) => item!.summary);
}

function contentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mov": return "video/quicktime";
    default: return "application/octet-stream";
  }
}

async function sendAsset(response: ServerResponse, sessionId: string, relativePath: string) {
  const directory = safeSessionDirectory(sessionId);
  if (!directory) return sendJson(response, 400, { message: "Invalid Avery session." });
  const normalizedRelative = relativePath.replaceAll("/", path.sep);
  const absolute = path.resolve(directory, normalizedRelative);
  const directoryPrefix = `${path.resolve(directory)}${path.sep}`;
  if (!absolute.startsWith(directoryPrefix)) return sendJson(response, 403, { message: "Session asset path is not allowed." });
  const extension = path.extname(absolute).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension) && !VIDEO_EXTENSIONS.has(extension)) return sendJson(response, 415, { message: "Unsupported session asset type." });
  try {
    const metadata = await stat(absolute);
    if (!metadata.isFile()) throw new Error("Not a file");
    const bytes = await readFile(absolute);
    response.statusCode = 200;
    response.setHeader("Content-Type", contentType(absolute));
    response.setHeader("Cache-Control", "private, max-age=60");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.end(bytes);
  } catch {
    return sendJson(response, 404, { message: "Session asset was not found." });
  }
}

export function writerInResidenceGateway(): Plugin {
  return {
    name: "plotpickle-writer-in-residence-gateway",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        if (url.pathname !== SESSIONS_API && url.pathname !== ASSET_API) return next();
        if (request.method !== "GET") return sendJson(response, 405, { message: "Method not allowed." });
        if (!isLocalRequest(request)) return sendJson(response, 403, { message: "Avery session review is restricted to this computer." });

        if (url.pathname === ASSET_API) {
          return sendAsset(response, url.searchParams.get("session") || "", url.searchParams.get("path") || "");
        }

        const sessionId = url.searchParams.get("session") || "";
        if (sessionId) {
          const session = await readSession(sessionId);
          return session
            ? sendJson(response, 200, { session })
            : sendJson(response, 404, { message: "Avery session was not found." });
        }
        return sendJson(response, 200, { sessions: await listSessions() });
      });
    },
  };
}
