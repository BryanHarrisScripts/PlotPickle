import { chmod, copyFile, mkdir, open, readFile, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createPortableProjectFile,
  parsePortableProjectFile,
  portableProjectFileName,
  serializePortableProjectFile,
} from "../lib/project-package";
import { normalizePlotPickleProject, type PlotPickleProject } from "../lib/project";

const PROJECT_API = "/api/local-projects";
const GITHUB_API = "/api/local-github";
const MAX_BODY = 30 * 1024 * 1024;
const BACKUP_LIMIT = 20;

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  token: string;
  verifiedAt: string;
};

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function projectsDirectory() { return path.join(persistentHome(), "projects"); }
function backupsDirectory() { return path.join(persistentHome(), "backups"); }
function githubConnectionFile() { return path.join(persistentHome(), "secrets", "github-connection.json"); }

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

async function readBody(request: IncomingMessage, maximum = MAX_BODY): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > maximum) throw new Error("The local project request is too large.");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function safeName(value: unknown, extension = ".ppf") {
  const source = typeof value === "string" ? value : "untitled-story";
  const stem = source.toLowerCase().replace(/\.ppf$/i, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return `${stem || "untitled-story"}${extension}`;
}

function timestampStem() {
  return new Date().toISOString().replace(/[:.]/g, "-");
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

async function createBackup(filePath: string) {
  try {
    await stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  await mkdir(backupsDirectory(), { recursive: true, mode: 0o700 });
  const fileName = path.basename(filePath, ".ppf");
  const backupName = `${fileName}-${timestampStem()}.ppf`;
  const backupPath = path.join(backupsDirectory(), backupName);
  await copyFile(filePath, backupPath);
  const entries = (await readdir(backupsDirectory(), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.startsWith(`${fileName}-`) && entry.name.endsWith(".ppf"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  await Promise.all(entries.slice(BACKUP_LIMIT).map((entry) => rm(path.join(backupsDirectory(), entry), { force: true })));
  return backupName;
}

async function saveProject(project: PlotPickleProject, requestedName?: unknown) {
  const fileName = safeName(requestedName || portableProjectFileName(project));
  const filePath = path.join(projectsDirectory(), fileName);
  const backup = await createBackup(filePath);
  const portable = createPortableProjectFile(project);
  await atomicWrite(filePath, serializePortableProjectFile(portable));
  return { fileName, backup, projectHash: portable.integrity.projectHash, savedAt: portable.createdAt };
}

async function readPortableFile(filePath: string) {
  const source = await readFile(filePath, "utf8");
  const result = parsePortableProjectFile(source);
  if (!result.integrityValid) throw new Error("The .ppf integrity check failed. Recover a backup before continuing.");
  return result;
}

async function projectLibrary() {
  await mkdir(projectsDirectory(), { recursive: true, mode: 0o700 });
  const entries = await readdir(projectsDirectory(), { withFileTypes: true });
  const results = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ppf"))
    .map(async (entry) => {
      const filePath = path.join(projectsDirectory(), entry.name);
      try {
        const [{ project, integrityValid }, info] = await Promise.all([readPortableFile(filePath), stat(filePath)]);
        return { fileName: entry.name, title: project.metadata.title, updatedAt: project.metadata.updatedAt, bytes: info.size, integrityValid };
      } catch {
        const info = await stat(filePath);
        return { fileName: entry.name, title: "Unreadable project", updatedAt: info.mtime.toISOString(), bytes: info.size, integrityValid: false };
      }
    }));
  return results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

async function backupLibrary(projectFile?: string) {
  await mkdir(backupsDirectory(), { recursive: true, mode: 0o700 });
  const stem = projectFile ? safeName(projectFile).replace(/\.ppf$/, "") : "";
  const entries = await readdir(backupsDirectory(), { withFileTypes: true });
  return Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ppf") && (!stem || entry.name.startsWith(`${stem}-`)))
    .sort((left, right) => right.name.localeCompare(left.name))
    .map(async (entry) => ({ fileName: entry.name, bytes: (await stat(path.join(backupsDirectory(), entry.name))).size })));
}

function validGitHubConnection(value: unknown): value is GitHubConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GitHubConnection>;
  return item.version === 1 && typeof item.owner === "string" && typeof item.repo === "string"
    && typeof item.branch === "string" && typeof item.projectPath === "string"
    && typeof item.token === "string" && typeof item.verifiedAt === "string";
}

async function readGitHubConnection() {
  try {
    const value: unknown = JSON.parse(await readFile(githubConnectionFile(), "utf8"));
    return validGitHubConnection(value) ? value : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeGitHubConnection(connection: GitHubConnection) {
  const file = githubConnectionFile();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await atomicWrite(file, `${JSON.stringify(connection, null, 2)}\n`);
}

function publicGitHubConnection(connection: GitHubConnection | null) {
  return connection ? {
    available: true,
    connected: true,
    owner: connection.owner,
    repo: connection.repo,
    branch: connection.branch,
    projectPath: connection.projectPath,
    repositoryUrl: `https://github.com/${connection.owner}/${connection.repo}`,
    verifiedAt: connection.verifiedAt,
  } : { available: true, connected: false };
}

function githubHeaders(connection: GitHubConnection, includeJson = false) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${connection.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PlotPickle-Local",
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

async function githubRequest(connection: GitHubConnection, endpoint: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers: { ...githubHeaders(connection, Boolean(init.body)), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
      ? String((body as { message: string }).message)
      : `GitHub returned ${response.status}.`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

async function verifyGitHubConnection(input: Record<string, unknown>, saved: GitHubConnection | null) {
  const owner = typeof input.owner === "string" ? input.owner.trim() : saved?.owner ?? "";
  const repo = typeof input.repo === "string" ? input.repo.trim() : saved?.repo ?? "";
  const branch = typeof input.branch === "string" && input.branch.trim() ? input.branch.trim() : saved?.branch ?? "main";
  const projectPath = typeof input.projectPath === "string" && input.projectPath.trim()
    ? input.projectPath.trim().replace(/^\/+/, "")
    : saved?.projectPath ?? "stories/plotpickle-story.ppf";
  const token = typeof input.token === "string" && input.token.trim() ? input.token.trim() : saved?.token ?? "";
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Enter a valid GitHub owner and repository name.");
  if (!token) throw new Error("Enter a GitHub token with access to this story repository.");
  if (!projectPath.toLowerCase().endsWith(".ppf") || projectPath.includes("..")) throw new Error("The repository story path must be a safe .ppf path.");
  const connection: GitHubConnection = { version: 1, owner, repo, branch, projectPath, token, verifiedAt: new Date().toISOString() };
  await githubRequest(connection, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  await writeGitHubConnection(connection);
  return connection;
}

async function githubPull(connection: GitHubConnection) {
  const endpoint = `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${connection.projectPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(connection.branch)}`;
  const body = await githubRequest(connection, endpoint);
  if (!body || typeof body !== "object" || typeof (body as Record<string, unknown>).content !== "string" || typeof (body as Record<string, unknown>).sha !== "string") {
    throw new Error("The GitHub story file is missing content or a revision SHA.");
  }
  const record = body as Record<string, unknown>;
  const decoded = Buffer.from(String(record.content).replace(/\s/g, ""), "base64").toString("utf8");
  const portable = parsePortableProjectFile(decoded);
  if (!portable.integrityValid) throw new Error("The GitHub .ppf file failed its integrity check.");
  return { project: portable.project, portable: portable.file, remoteSha: String(record.sha) };
}

async function githubPush(connection: GitHubConnection, project: PlotPickleProject, message: string) {
  await saveProject(project);
  let existingSha: string | undefined;
  try {
    const current = await githubRequest(connection, `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${connection.projectPath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(connection.branch)}`);
    if (current && typeof current === "object" && typeof (current as Record<string, unknown>).sha === "string") existingSha = String((current as Record<string, unknown>).sha);
  } catch (error) {
    if ((error as Error & { status?: number }).status !== 404) throw error;
  }
  const portable = createPortableProjectFile(project);
  const body = await githubRequest(connection, `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/contents/${connection.projectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body: JSON.stringify({
      message: message.trim() || `Back up ${project.metadata.title} from PlotPickle`,
      content: Buffer.from(serializePortableProjectFile(portable), "utf8").toString("base64"),
      branch: connection.branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  const responseRecord = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const commit = responseRecord.commit && typeof responseRecord.commit === "object" ? responseRecord.commit as { sha?: unknown; html_url?: unknown } : {};
  return { commitSha: typeof commit.sha === "string" ? commit.sha : "", commitUrl: typeof commit.html_url === "string" ? commit.html_url : "" };
}

async function githubHistory(connection: GitHubConnection) {
  const body = await githubRequest(connection, `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}/commits?sha=${encodeURIComponent(connection.branch)}&path=${encodeURIComponent(connection.projectPath)}&per_page=20`);
  const items = Array.isArray(body) ? body : [];
  return items.map((item) => {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const commit = value.commit && typeof value.commit === "object" ? value.commit as Record<string, unknown> : {};
    const author = commit.author && typeof commit.author === "object" ? commit.author as Record<string, unknown> : {};
    return {
      sha: typeof value.sha === "string" ? value.sha : "",
      url: typeof value.html_url === "string" ? value.html_url : "",
      message: typeof commit.message === "string" ? commit.message : "",
      date: typeof author.date === "string" ? author.date : "",
    };
  });
}

async function handleProjects(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${PROJECT_API}/status`) {
    sendJson(response, 200, { ok: true, available: true, home: persistentHome(), backupLimit: BACKUP_LIMIT });
    return;
  }
  if (request.method === "GET" && url.pathname === `${PROJECT_API}/library`) {
    sendJson(response, 200, { ok: true, projects: await projectLibrary() });
    return;
  }
  if (request.method === "GET" && url.pathname === `${PROJECT_API}/backups`) {
    sendJson(response, 200, { ok: true, backups: await backupLibrary(url.searchParams.get("project") ?? undefined) });
    return;
  }
  if (request.method === "GET" && url.pathname === `${PROJECT_API}/load`) {
    const fileName = safeName(url.searchParams.get("file"));
    const result = await readPortableFile(path.join(projectsDirectory(), fileName));
    sendJson(response, 200, { ok: true, fileName, project: result.project, portable: result.file });
    return;
  }
  if (request.method === "GET" && url.pathname === `${PROJECT_API}/recover`) {
    const fileName = safeName(url.searchParams.get("file"));
    const result = await readPortableFile(path.join(backupsDirectory(), fileName));
    sendJson(response, 200, { ok: true, fileName, project: result.project, portable: result.file });
    return;
  }
  if (request.method === "POST" && url.pathname === `${PROJECT_API}/save`) {
    const body = await readBody(request) as { project?: unknown; fileName?: unknown };
    const project = normalizePlotPickleProject(body.project);
    if (!project) throw new Error("The active story could not be normalized before saving.");
    sendJson(response, 200, { ok: true, ...(await saveProject(project, body.fileName)) });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Local project operation not found." });
}

async function handleGitHub(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${GITHUB_API}/connection`) {
    sendJson(response, 200, publicGitHubConnection(await readGitHubConnection()));
    return;
  }
  if (request.method === "POST" && (url.pathname === `${GITHUB_API}/connection` || url.pathname === `${GITHUB_API}/connection/check`)) {
    const saved = await readGitHubConnection();
    const input = url.pathname.endsWith("/check") ? {} : await readBody(request) as Record<string, unknown>;
    const connection = await verifyGitHubConnection(input, saved);
    sendJson(response, 200, { ok: true, message: "GitHub repository connected.", ...publicGitHubConnection(connection) });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${GITHUB_API}/connection`) {
    try { await unlink(githubConnectionFile()); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    sendJson(response, 200, { ok: true, available: true, connected: false, message: "GitHub connection removed from this computer." });
    return;
  }
  const connection = await readGitHubConnection();
  if (!connection) throw new Error("Connect a GitHub story repository in Settings first.");
  if (request.method === "POST" && url.pathname === `${GITHUB_API}/pull`) {
    sendJson(response, 200, { ok: true, ...(await githubPull(connection)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${GITHUB_API}/push`) {
    const body = await readBody(request) as { project?: unknown; message?: unknown };
    const project = normalizePlotPickleProject(body.project);
    if (!project) throw new Error("The active story could not be normalized before the GitHub backup.");
    const message = typeof body.message === "string" ? body.message : "";
    sendJson(response, 200, { ok: true, ...(await githubPush(connection, project, message)) });
    return;
  }
  if (request.method === "GET" && url.pathname === `${GITHUB_API}/history`) {
    sendJson(response, 200, { ok: true, history: await githubHistory(connection) });
    return;
  }
  sendJson(response, 404, { ok: false, message: "GitHub project operation not found." });
}

export function localProjectGateway(): Plugin {
  return {
    name: "plotpickle-local-project-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(PROJECT_API) && !url.pathname.startsWith(GITHUB_API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Project storage and GitHub synchronization accept requests only from this local PlotPickle server." });
          return;
        }
        const handler = url.pathname.startsWith(PROJECT_API) ? handleProjects : handleGitHub;
        void handler(request, response, url).catch((error) => {
          const message = error instanceof Error
            ? error.message.replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
            : "The local project operation failed.";
          sendJson(response, 400, { ok: false, message });
        });
      });
    },
  };
}
