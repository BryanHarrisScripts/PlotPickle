import { mkdir, open, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { createPortableProjectFile, parsePortableProjectFile } from "../lib/project-package";
import { createProjectFolder, parseProjectFolder, projectFolderName, type ProjectFolderFiles } from "../lib/project-folder";
import { normalizePlotPickleProject, type PlotPickleProject } from "../lib/project";

const API = "/api/local-projects";
const MAX_BODY = 30 * 1024 * 1024;
const BACKUP_LIMIT = 20;

function home() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}
function projectsRoot() { return path.join(home(), "projects-v2"); }
function backupsRoot() { return path.join(home(), "backups"); }
function isLoopback(value?: string) { return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1"; }
function isLocal(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch { return false; }
}
function send(response: ServerResponse, status: number, payload: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}
async function body(request: IncomingMessage) {
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
function safeKey(value: unknown) {
  const source = typeof value === "string" ? value : "untitled-story";
  const stem = source.replace(/\.ppf$/i, "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return stem || "untitled-story";
}
async function atomicFile(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  const content = typeof value === "string" && !file.endsWith(".json") ? value : `${JSON.stringify(value, null, 2)}\n`;
  try { await handle.writeFile(content, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
  await rename(temporary, file);
}

async function collectFolderFiles(folder: string, relative = "", files: ProjectFolderFiles = {}) {
  const current = path.join(folder, relative);
  for (const entry of await readdir(current, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "assets" || entry.name === "exports") continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await collectFolderFiles(folder, child, files);
    else if (entry.name.endsWith(".json")) files[child] = JSON.parse(await readFile(path.join(folder, child), "utf8"));
    else if (entry.name.endsWith(".fountain")) files[child] = await readFile(path.join(folder, child), "utf8");
  }
  return files;
}
async function readFolder(folder: string) {
  return parseProjectFolder(await collectFolderFiles(folder));
}
async function writeFolder(project: PlotPickleProject, requestedName?: unknown) {
  const key = safeKey(requestedName || projectFolderName(project));
  const folder = path.join(projectsRoot(), key);
  let backup: string | null = null;
  try {
    const previous = await readFolder(folder);
    await mkdir(backupsRoot(), { recursive: true, mode: 0o700 });
    backup = `${key}-${new Date().toISOString().replace(/[:.]/g, "-")}.ppf`;
    await atomicFile(path.join(backupsRoot(), backup), createPortableProjectFile(previous));
    const entries = (await readdir(backupsRoot())).filter((name) => name.startsWith(`${key}-`) && name.endsWith(".ppf")).sort().reverse();
    await Promise.all(entries.slice(BACKUP_LIMIT).map((name) => rm(path.join(backupsRoot(), name), { force: true })));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const temporaryFolder = `${folder}.${process.pid}.${Date.now()}.tmp`;
  await rm(temporaryFolder, { recursive: true, force: true });
  const { files, manifest } = createProjectFolder(project);
  for (const [relative, value] of Object.entries(files)) await atomicFile(path.join(temporaryFolder, relative), value);
  await rm(folder, { recursive: true, force: true });
  await rename(temporaryFolder, folder);
  return { fileName: `${key}.ppf`, projectKey: key, storage: "modular-folder", backup, savedAt: manifest.updatedAt, projectPath: folder, moduleCount: Object.keys(manifest.modules).length };
}
async function library() {
  await mkdir(projectsRoot(), { recursive: true, mode: 0o700 });
  const entries = await readdir(projectsRoot(), { withFileTypes: true });
  const results = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const folder = path.join(projectsRoot(), entry.name);
    try {
      const [project, manifest, info] = await Promise.all([
        readFolder(folder),
        readFile(path.join(folder, "manifest.json"), "utf8").then((source) => JSON.parse(source) as { modules?: Record<string, unknown>; formatVersion?: string }),
        stat(path.join(folder, "manifest.json")),
      ]);
      return { fileName: `${entry.name}.ppf`, projectKey: entry.name, title: project.metadata.title, updatedAt: project.metadata.updatedAt, bytes: info.size, integrityValid: true, storage: "modular-folder", formatVersion: manifest.formatVersion, moduleCount: Object.keys(manifest.modules ?? {}).length };
    } catch {
      const info = await stat(folder);
      return { fileName: `${entry.name}.ppf`, projectKey: entry.name, title: "Unreadable project folder", updatedAt: info.mtime.toISOString(), bytes: 0, integrityValid: false, storage: "modular-folder" };
    }
  }));
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
async function backups(projectFile?: string) {
  await mkdir(backupsRoot(), { recursive: true, mode: 0o700 });
  const stem = projectFile ? safeKey(projectFile) : "";
  const entries = await readdir(backupsRoot(), { withFileTypes: true });
  return Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith(".ppf") && (!stem || entry.name.startsWith(`${stem}-`))).sort((a, b) => b.name.localeCompare(a.name)).map(async (entry) => ({ fileName: entry.name, bytes: (await stat(path.join(backupsRoot(), entry.name))).size })));
}
async function recover(fileName: string) {
  const source = await readFile(path.join(backupsRoot(), path.basename(fileName)), "utf8");
  const result = parsePortableProjectFile(source);
  if (!result.integrityValid) throw new Error("The selected backup failed its integrity check.");
  return result;
}

export function folderProjectGateway(): Plugin {
  return {
    name: "plotpickle-folder-project-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const raw = request.url;
        if (!raw) { next(); return; }
        const url = new URL(raw, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocal(request)) { send(response, 403, { ok: false, message: "Project folders accept requests only from this local PlotPickle server." }); return; }
        void (async () => {
          if (request.method === "GET" && url.pathname === `${API}/status`) { send(response, 200, { ok: true, available: true, home: home(), projectsRoot: projectsRoot(), storage: "modular-folder", formatVersion: "2.1.0", backupLimit: BACKUP_LIMIT }); return; }
          if (request.method === "GET" && url.pathname === `${API}/library`) { send(response, 200, { ok: true, projects: await library() }); return; }
          if (request.method === "GET" && url.pathname === `${API}/backups`) { send(response, 200, { ok: true, backups: await backups(url.searchParams.get("project") || undefined) }); return; }
          if (request.method === "GET" && url.pathname === `${API}/load`) {
            const key = safeKey(url.searchParams.get("file"));
            const project = await readFolder(path.join(projectsRoot(), key));
            send(response, 200, { ok: true, fileName: `${key}.ppf`, projectKey: key, storage: "modular-folder", project, portable: createPortableProjectFile(project) }); return;
          }
          if (request.method === "GET" && url.pathname === `${API}/recover`) {
            const fileName = path.basename(url.searchParams.get("file") || "");
            const result = await recover(fileName);
            send(response, 200, { ok: true, fileName, project: result.project, portable: result.file }); return;
          }
          if (request.method === "POST" && url.pathname === `${API}/save`) {
            const input = await body(request) as { project?: unknown; fileName?: unknown };
            const project = normalizePlotPickleProject(input.project);
            if (!project) throw new Error("The active story could not be normalized before saving.");
            send(response, 200, { ok: true, ...(await writeFolder(project, input.fileName)) }); return;
          }
          send(response, 404, { ok: false, message: "Folder project operation not found." });
        })().catch((error) => send(response, 400, { ok: false, message: error instanceof Error ? error.message : "The folder project operation failed." }));
      });
    },
  };
}
