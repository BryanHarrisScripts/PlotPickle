import { chmod, mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { createPortableProjectFile, parsePortableProjectFile, portableProjectFileName, serializePortableProjectFile } from "../lib/project-package";
import { normalizePlotPickleProject } from "../lib/project";
import { persistentHome } from "./local-credentials";

const PROJECT_API = "/api/local-projects";
const MAX_BODY = 30 * 1024 * 1024;
const DEFAULT_BACKUP_LIMIT = 20;
const MAX_BACKUP_LIMIT = 100;

function backupsDirectory() { return path.join(persistentHome(), "backups"); }

function normalizeBackupLimit(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BACKUP_LIMIT;
  return Math.min(MAX_BACKUP_LIMIT, Math.max(1, Math.round(parsed)));
}

function safeName(value: unknown, extension = ".ppf") {
  const source = typeof value === "string" ? value : "untitled-story";
  const stem = source.toLowerCase().replace(/\.ppf$/i, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return `${stem || "untitled-story"}${extension}`;
}

function timestampStem() {
  return new Date().toISOString().replace(/[:.]/g, "-");
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

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The local project request is too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function atomicWrite(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
  try { await chmod(filePath, 0o600); } catch { /* Windows uses account permissions. */ }
}

async function pruneRestorePoints(projectStem: string, backupLimit: number) {
  const entries = await readdir(backupsDirectory(), { withFileTypes: true });
  const candidates = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${projectStem}-`) && entry.name.endsWith(".ppf"))
    .map(async (entry) => ({ entry, modified: (await stat(path.join(backupsDirectory(), entry.name))).mtimeMs })));
  candidates.sort((left, right) => right.modified - left.modified);
  await Promise.all(candidates.slice(backupLimit).map(({ entry }) => rm(path.join(backupsDirectory(), entry.name), { force: true })));
}

async function createCurrentProjectSnapshot(projectValue: unknown, requestedLimit: unknown) {
  const project = normalizePlotPickleProject(projectValue);
  if (!project) throw new Error("The active story could not be normalized before creating a snapshot.");
  const backupLimit = normalizeBackupLimit(requestedLimit);
  const projectStem = safeName(portableProjectFileName(project)).replace(/\.ppf$/, "");
  const fileName = `${projectStem}-${timestampStem()}.ppf`;
  const portable = createPortableProjectFile(project);
  await atomicWrite(path.join(backupsDirectory(), fileName), serializePortableProjectFile(portable));
  await pruneRestorePoints(projectStem, backupLimit);
  return { fileName, backup: fileName, backupLimit, projectHash: portable.integrity.projectHash, savedAt: portable.createdAt };
}

async function chronologicalBackupLibrary(projectFile?: string) {
  await mkdir(backupsDirectory(), { recursive: true, mode: 0o700 });
  const stem = projectFile ? safeName(projectFile).replace(/\.ppf$/, "") : "";
  const entries = await readdir(backupsDirectory(), { withFileTypes: true });
  const backups = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ppf") && (!stem || entry.name.startsWith(`${stem}-`)))
    .map(async (entry) => {
      const filePath = path.join(backupsDirectory(), entry.name);
      const info = await stat(filePath);
      try {
        const parsed = parsePortableProjectFile(await readFile(filePath, "utf8"));
        if (!parsed.integrityValid) return null;
        return {
          fileName: entry.name,
          bytes: info.size,
          createdAt: info.mtime.toISOString(),
          projectId: parsed.project.id,
          title: parsed.project.metadata.title,
        };
      } catch {
        return null;
      }
    }));
  return backups
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function localStorageSafetyGateway(): Plugin {
  return {
    name: "plotpickle-local-storage-safety-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        const isBackupList = request.method === "GET" && url.pathname === `${PROJECT_API}/backups`;
        const isSnapshot = request.method === "POST" && url.pathname === `${PROJECT_API}/snapshot`;
        if (!isBackupList && !isSnapshot) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Project storage accepts requests only from this local PlotPickle server." });
          return;
        }
        void (async () => {
          if (isBackupList) {
            sendJson(response, 200, { ok: true, backups: await chronologicalBackupLibrary(url.searchParams.get("project") ?? undefined) });
            return;
          }
          const body = await readBody(request) as { project?: unknown; backupLimit?: unknown };
          sendJson(response, 200, { ok: true, ...(await createCurrentProjectSnapshot(body.project, body.backupLimit)) });
        })().catch((error) => {
          sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "The local storage operation failed." });
        });
      });
    },
  };
}