import { mkdir, open, readFile, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { compareCollaborativeProjects } from "../lib/github-collaboration";
import { createPortableProjectFile, parsePortableProjectFile, serializePortableProjectFile } from "../lib/project-package";
import { normalizePlotPickleProject, type PlotPickleProject } from "../lib/project";

const API = "/api/local-github";
const MAX_BODY = 30 * 1024 * 1024;

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  token: string;
  verifiedAt: string;
};

type ServerIdentity = {
  version: 1;
  id: string;
  label: string;
  createdAt: string;
};

type GitHubError = Error & { status?: number; body?: unknown };

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function connectionFile() { return path.join(persistentHome(), "secrets", "github-connection.json"); }
function identityFile() { return path.join(persistentHome(), "server-identity.json"); }

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
    if (length > MAX_BODY) throw new Error("The collaboration proposal is too large.");
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
}

function validConnection(value: unknown): value is GitHubConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GitHubConnection>;
  return item.version === 1 && typeof item.owner === "string" && typeof item.repo === "string"
    && typeof item.branch === "string" && typeof item.projectPath === "string"
    && typeof item.token === "string" && typeof item.verifiedAt === "string";
}

async function readConnection() {
  const value: unknown = JSON.parse(await readFile(connectionFile(), "utf8"));
  if (!validConnection(value)) throw new Error("Reconnect the GitHub repository before submitting changes.");
  return value;
}

async function serverIdentity() {
  try {
    const value: unknown = JSON.parse(await readFile(identityFile(), "utf8"));
    if (value && typeof value === "object") {
      const item = value as Partial<ServerIdentity>;
      if (item.version === 1 && typeof item.id === "string" && typeof item.label === "string" && typeof item.createdAt === "string") return item as ServerIdentity;
    }
  } catch { /* Create the durable local identity below. */ }
  const identity: ServerIdentity = {
    version: 1,
    id: randomUUID(),
    label: `${os.hostname() || "PlotPickle server"} · ${process.platform}`,
    createdAt: new Date().toISOString(),
  };
  await atomicWrite(identityFile(), `${JSON.stringify(identity, null, 2)}\n`);
  return identity;
}

function headers(connection: GitHubConnection, includeJson = false) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${connection.token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PlotPickle-Local-Collaboration",
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

async function githubRequest(connection: GitHubConnection, endpoint: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers: { ...headers(connection, Boolean(init.body)), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  });
  const source = await response.text();
  let body: unknown = {};
  try { body = source ? JSON.parse(source) : {}; } catch { body = {}; }
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
      ? String((body as { message: string }).message)
      : `GitHub returned ${response.status}.`;
    const error = new Error(message) as GitHubError;
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function repoEndpoint(connection: GitHubConnection) {
  return `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`;
}

function contentEndpoint(connection: GitHubConnection, ref: string) {
  const safePath = connection.projectPath.split("/").map(encodeURIComponent).join("/");
  return `${repoEndpoint(connection)}/contents/${safePath}?ref=${encodeURIComponent(ref)}`;
}

async function canonicalProject(connection: GitHubConnection) {
  try {
    const body = await githubRequest(connection, contentEndpoint(connection, connection.branch));
    if (!body || typeof body !== "object") throw new Error("The canonical GitHub project response is invalid.");
    const record = body as Record<string, unknown>;
    if (typeof record.content !== "string" || typeof record.sha !== "string") throw new Error("The canonical .ppf file is missing content or a revision SHA.");
    const source = Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8");
    const parsed = parsePortableProjectFile(source);
    if (!parsed.integrityValid) throw new Error("The canonical GitHub .ppf failed its integrity check.");
    return { exists: true as const, project: parsed.project, blobSha: record.sha };
  } catch (error) {
    if ((error as GitHubError).status === 404) return { exists: false as const, project: null, blobSha: "" };
    throw error;
  }
}

function safeSlug(value: string, fallback = "story") {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || fallback;
}

function proposalBody(project: PlotPickleProject, identity: ServerIdentity, baseSha: string, summary: ReturnType<typeof compareCollaborativeProjects> | null, note: string) {
  const changed = summary ? [
    `${summary.changedStoryFields.length} story fields`,
    `${summary.changedBlockNumbers.length} Blocks`,
    `${summary.changedSceneIds.length} scenes`,
    `${summary.changedScreenplayElementIds.length} screenplay elements`,
    `${summary.changedCharacterIds.length} characters`,
    `${summary.changedThreadIds.length} Story Threads`,
  ].join(", ") : "A new canonical project file";
  return [
    "## PlotPickle collaboration proposal",
    "",
    `**Project:** ${project.metadata.title}`,
    `**Local server:** ${identity.label}`,
    `**Server ID:** \`${identity.id}\``,
    `**Canonical base:** \`${baseSha || "new project"}\``,
    `**Project path:** \`${project.collaboration.projectPath || "configured .ppf path"}\``,
    "",
    `**Tracked change summary:** ${changed}.`,
    "",
    note.trim() ? `### Contributor note\n\n${note.trim()}` : "",
    "",
    "### Approval boundary",
    "",
    "This branch was created by a local PlotPickle server. The canonical repository branch is unchanged until a repository owner or maintainer reviews and merges this pull request. Closing the pull request declines the proposal.",
    "",
    "No API key or GitHub credential is stored in the `.ppf` project.",
  ].filter(Boolean).join("\n");
}

async function createProposal(connection: GitHubConnection, project: PlotPickleProject, title: string, note: string, expectedBaseRevision: string) {
  const identity = await serverIdentity();
  const canonical = await canonicalProject(connection);
  if (canonical.exists && expectedBaseRevision !== canonical.blobSha) {
    const error = new Error("The canonical GitHub story changed after this server last pulled it. Pull the approved version, review it, reapply local work if needed, then submit a new proposal.") as GitHubError;
    error.status = 409;
    throw error;
  }

  const refBody = await githubRequest(connection, `${repoEndpoint(connection)}/git/ref/heads/${connection.branch.split("/").map(encodeURIComponent).join("/")}`);
  const baseCommitSha = refBody && typeof refBody === "object" && (refBody as Record<string, unknown>).object && typeof (refBody as { object?: { sha?: unknown } }).object?.sha === "string"
    ? String((refBody as { object: { sha: string } }).object.sha)
    : "";
  if (!baseCommitSha) throw new Error("GitHub did not return the canonical branch commit.");

  const profile = await githubRequest(connection, "/user");
  const login = profile && typeof profile === "object" && typeof (profile as Record<string, unknown>).login === "string" ? String((profile as Record<string, unknown>).login) : "collaborator";
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const branchName = `plotpickle/${safeSlug(login, "writer")}-${identity.id.slice(0, 8)}/${stamp}-${safeSlug(project.metadata.title)}`;

  await githubRequest(connection, `${repoEndpoint(connection)}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseCommitSha }),
  });

  const portable = createPortableProjectFile(project, "1.0.0-rc.2");
  const update = await githubRequest(connection, `${repoEndpoint(connection)}/contents/${connection.projectPath.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body: JSON.stringify({
      message: title.trim() || `Propose PlotPickle changes to ${project.metadata.title}`,
      content: Buffer.from(serializePortableProjectFile(portable), "utf8").toString("base64"),
      branch: branchName,
      ...(canonical.exists ? { sha: canonical.blobSha } : {}),
    }),
  });
  const commit = update && typeof update === "object" && (update as Record<string, unknown>).commit && typeof (update as { commit?: { sha?: unknown } }).commit?.sha === "string"
    ? String((update as { commit: { sha: string } }).commit.sha)
    : "";
  const summary = canonical.project ? compareCollaborativeProjects(canonical.project, project) : null;
  const pull = await githubRequest(connection, `${repoEndpoint(connection)}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: title.trim() || `PlotPickle proposal: ${project.metadata.title}`,
      head: branchName,
      base: connection.branch,
      body: proposalBody(project, identity, canonical.blobSha, summary, note),
      maintainer_can_modify: true,
    }),
  });
  const record = pull && typeof pull === "object" ? pull as Record<string, unknown> : {};
  return {
    branchName,
    commitSha: commit,
    pullRequestNumber: Number(record.number) || 0,
    pullRequestUrl: typeof record.html_url === "string" ? record.html_url : "",
    baseRevision: canonical.blobSha,
    serverId: identity.id,
    serverLabel: identity.label,
    summary,
  };
}

async function listProposals(connection: GitHubConnection) {
  const body = await githubRequest(connection, `${repoEndpoint(connection)}/pulls?state=all&base=${encodeURIComponent(connection.branch)}&sort=updated&direction=desc&per_page=100`);
  return (Array.isArray(body) ? body : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const head = value.head && typeof value.head === "object" ? value.head as Record<string, unknown> : {};
    const user = value.user && typeof value.user === "object" ? value.user as Record<string, unknown> : {};
    const branchName = typeof head.ref === "string" ? head.ref : "";
    if (!branchName.startsWith("plotpickle/")) return [];
    return [{
      number: Number(value.number) || 0,
      title: typeof value.title === "string" ? value.title : "PlotPickle proposal",
      url: typeof value.html_url === "string" ? value.html_url : "",
      state: value.merged_at ? "merged" : value.state === "closed" ? "declined" : value.draft ? "draft" : "open",
      author: typeof user.login === "string" ? user.login : "unknown",
      branchName,
      updatedAt: typeof value.updated_at === "string" ? value.updated_at : "",
      mergedAt: typeof value.merged_at === "string" ? value.merged_at : "",
    }];
  });
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/identity`) {
    sendJson(response, 200, { ok: true, ...(await serverIdentity()) });
    return;
  }
  const connection = await readConnection();
  if (request.method === "GET" && url.pathname === `${API}/proposals`) {
    sendJson(response, 200, { ok: true, proposals: await listProposals(connection) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/submit-proposal`) {
    const body = await readBody(request) as { project?: unknown; title?: unknown; note?: unknown; baseRevision?: unknown };
    const project = normalizePlotPickleProject(body.project);
    if (!project) throw new Error("The active story could not be normalized before creating the collaboration proposal.");
    const title = typeof body.title === "string" ? body.title : "";
    const note = typeof body.note === "string" ? body.note : "";
    const baseRevision = typeof body.baseRevision === "string" ? body.baseRevision : "";
    sendJson(response, 200, { ok: true, ...(await createProposal(connection, project, title, note, baseRevision)) });
    return;
  }
  sendJson(response, 404, { ok: false, message: "GitHub review operation not found." });
}

export function githubReviewGateway(): Plugin {
  return {
    name: "plotpickle-github-review-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (![`${API}/identity`, `${API}/proposals`, `${API}/submit-proposal`].includes(url.pathname)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Collaboration proposals accept requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          const rawMessage = error instanceof Error ? error.message : "The collaboration proposal failed.";
          const message = rawMessage.replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]");
          const status = (error as GitHubError).status === 409 ? 409 : 400;
          sendJson(response, status, { ok: false, message });
        });
      });
    },
  };
}
