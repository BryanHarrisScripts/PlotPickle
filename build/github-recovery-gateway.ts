import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  dueGitHubRecoveryEntries,
  emptyGitHubRecoveryQueue,
  enqueueGitHubRecoveryOperation,
  isGitHubRecoveryPath,
  markGitHubRecoveryRetrying,
  normalizeGitHubRecoveryQueue,
  publicGitHubRecoveryEntry,
  recordGitHubRecoveryFailure,
  removeGitHubRecoveryEntry,
  safeGitHubRecoveryBody,
  type GitHubRecoveryEntry,
  type GitHubRecoveryFailure,
  type GitHubRecoveryQueue,
} from "../lib/github-recovery";
import { inspectStoryProjectManifest, STORY_PROJECT_MANIFEST_PATH } from "../lib/story-project-repository";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";

const API = "/api/local-github-recovery";
const QUEUE_FILE = "github-recovery-queue.json";
const CONNECTION_FILE = "github-connection.json";
const SYNC_STATE_FILE = "github-project-sync.json";
const INVITATION_STATE_FILE = "collaboration-invitation.json";
const MAX_BODY = 2 * 1024 * 1024;

const responseMessage = (value: unknown, fallback: string) => value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string"
  ? String((value as { message: string }).message)
  : fallback;

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  projectRoot?: string;
  repositoryUrl?: string;
  token: string;
  login?: string;
  verifiedAt: string;
  readiness?: { ready: boolean };
  [key: string]: unknown;
};

type SavedSyncState = {
  version: 1;
  repository: string;
  branch: string;
  projectId: string;
  remoteCommit: string;
};

type GitHubApiResult = {
  ok: boolean;
  status: number;
  body: unknown;
  headers: Headers;
};

type RecoveryError = Error & { status?: number };

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

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The GitHub recovery request is too large.");
    chunks.push(bytes);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The GitHub recovery request is invalid.");
  return value as Record<string, unknown>;
}

function validConnection(value: unknown): value is GitHubConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GitHubConnection>;
  return item.version === 1
    && typeof item.owner === "string" && Boolean(item.owner)
    && typeof item.repo === "string" && Boolean(item.repo)
    && typeof item.branch === "string" && Boolean(item.branch)
    && typeof item.projectPath === "string"
    && typeof item.token === "string" && Boolean(item.token)
    && typeof item.verifiedAt === "string";
}

async function optionalConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

async function loadQueue() {
  return normalizeGitHubRecoveryQueue(await readCredentialJson<unknown>(QUEUE_FILE));
}

async function saveQueue(queue: GitHubRecoveryQueue) {
  await writeCredentialJson(QUEUE_FILE, normalizeGitHubRecoveryQueue(queue));
}

function retryAfterMs(headers: Headers) {
  const source = headers.get("retry-after");
  if (!source) return 0;
  const seconds = Number(source);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(source);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

async function githubApi(connection: GitHubConnection, endpoint: string, init: { method?: string; body?: unknown } = {}): Promise<GitHubApiResult> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${connection.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Recovery",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
    redirect: "follow",
  });
  const source = await response.text();
  let body: unknown = {};
  try { body = source ? JSON.parse(source) : {}; } catch { body = {}; }
  return { ok: response.ok, status: response.status, body, headers: response.headers };
}

function encodedRepository(owner: string, repo: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function encodedBranch(branch: string) {
  return branch.split("/").map(encodeURIComponent).join("/");
}

function recoveryFailure(status: number, body: unknown, headers?: Headers): GitHubRecoveryFailure {
  return {
    status,
    message: responseMessage(body, status ? `GitHub returned ${status}.` : "GitHub could not be reached."),
    retryAfterMs: headers ? retryAfterMs(headers) : 0,
  };
}

async function manifestAt(connection: GitHubConnection, owner: string, repo: string, reference: string) {
  const endpoint = `${encodedRepository(owner, repo)}/contents/${STORY_PROJECT_MANIFEST_PATH}?ref=${encodeURIComponent(reference)}`;
  const result = await githubApi(connection, endpoint);
  if (!result.ok) {
    const error = new Error(responseMessage(result.body, "The PlotPickle project manifest could not be verified.")) as RecoveryError;
    error.status = result.status;
    throw error;
  }
  const record = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : {};
  if (typeof record.content !== "string") throw new Error("GitHub did not return the PlotPickle project manifest.");
  const encoding = typeof record.encoding === "string" ? record.encoding : "base64";
  const source = encoding === "base64"
    ? Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8")
    : record.content;
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error("The repository PlotPickle project manifest is not valid JSON."); }
  return inspectStoryProjectManifest(parsed).manifest;
}

async function executeQueuedOperation(request: IncomingMessage, id: string) {
  const queue = await loadQueue();
  const entry = queue.entries.find((item) => item.id === id);
  if (!entry) throw new Error("The queued GitHub operation was not found.");
  const host = request.headers.host;
  if (!host) throw new Error("The local PlotPickle server address is unavailable.");
  await saveQueue(markGitHubRecoveryRetrying(queue, id));
  try {
    const response = await fetch(`http://${host}${entry.path}`, {
      method: entry.method,
      headers: {
        "Content-Type": "application/json",
        Origin: `http://${host}`,
        "X-PlotPickle-Recovery-Retry": entry.idempotencyKey,
      },
      body: JSON.stringify(entry.body),
      signal: AbortSignal.timeout(60_000),
    });
    const source = await response.text();
    let body: unknown = {};
    try { body = source ? JSON.parse(source) : {}; } catch { body = {}; }
    if (response.ok) {
      const next = removeGitHubRecoveryEntry(await loadQueue(), id);
      await saveQueue(next);
      return { ok: true, id, result: body, remaining: next.entries.length };
    }
    const failed = recordGitHubRecoveryFailure(await loadQueue(), id, recoveryFailure(response.status, body, response.headers));
    await saveQueue(failed.queue);
    return { ok: false, id, entry: publicGitHubRecoveryEntry(failed.entry), remaining: failed.queue.entries.length };
  } catch (error) {
    const failed = recordGitHubRecoveryFailure(await loadQueue(), id, {
      status: 0,
      message: error instanceof Error ? error.message : "GitHub could not be reached.",
    });
    await saveQueue(failed.queue);
    return { ok: false, id, entry: publicGitHubRecoveryEntry(failed.entry), remaining: failed.queue.entries.length };
  }
}

async function drainQueue(request: IncomingMessage) {
  const due = dueGitHubRecoveryEntries(await loadQueue()).slice(0, 3);
  const results = [];
  for (const entry of due) results.push(await executeQueuedOperation(request, entry.id));
  return { attempted: results.length, results };
}

async function diagnoseConnection() {
  const connection = await optionalConnection();
  if (!connection) return { connected: false, state: "disconnected", message: "GitHub is not connected on this computer." };
  let repository: GitHubApiResult;
  try {
    repository = await githubApi(connection, encodedRepository(connection.owner, connection.repo));
  } catch (error) {
    return { connected: true, state: "offline", message: error instanceof Error ? error.message : "GitHub could not be reached." };
  }
  if (!repository.ok) {
    const failure = recoveryFailure(repository.status, repository.body, repository.headers);
    return { connected: true, state: repository.status === 401 || repository.status === 403 ? "authorization-expired" : repository.status === 404 ? "repository-missing" : "error", message: failure.message };
  }
  const record = repository.body && typeof repository.body === "object" ? repository.body as Record<string, unknown> : {};
  const fullName = typeof record.full_name === "string" ? record.full_name : `${connection.owner}/${connection.repo}`;
  const [owner, repo] = fullName.split("/");
  const moved = fullName.toLowerCase() !== `${connection.owner}/${connection.repo}`.toLowerCase();
  const branchResult = await githubApi(connection, `${encodedRepository(owner, repo)}/git/ref/heads/${encodedBranch(connection.branch)}`);
  const branchMissing = branchResult.status === 404;
  let branches: string[] = [];
  if (branchMissing) {
    const available = await githubApi(connection, `${encodedRepository(owner, repo)}/branches?per_page=30`);
    if (available.ok && Array.isArray(available.body)) {
      branches = available.body.flatMap((item) => item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string" ? [String((item as { name: string }).name)] : []);
    }
  }
  let projectId = "";
  if (!branchMissing) {
    try { projectId = (await manifestAt(connection, owner, repo, connection.branch)).projectId; } catch { projectId = ""; }
  }
  return {
    connected: true,
    state: branchMissing ? "branch-missing" : moved ? "repository-moved" : "ready",
    repository: `${connection.owner}/${connection.repo}`,
    resolvedRepository: fullName,
    moved,
    branch: connection.branch,
    branchMissing,
    availableBranches: branches,
    projectId,
    message: branchMissing
      ? "The approved branch no longer exists. PlotPickle will not recreate or replace it without Project Lead approval."
      : moved
        ? `GitHub resolved this story repository to ${fullName}. Verify the project identity before adopting the new location.`
        : "The saved repository and approved branch are reachable.",
  };
}

async function adoptRepository(input: Record<string, unknown>) {
  const connection = await optionalConnection();
  if (!connection) throw new Error("Reconnect GitHub before adopting a moved repository.");
  const owner = typeof input.owner === "string" ? input.owner.trim() : "";
  const repo = typeof input.repo === "string" ? input.repo.trim() : "";
  const branch = typeof input.branch === "string" ? input.branch.trim() : connection.branch;
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("The recovered GitHub repository name is invalid.");
  if (!branch || branch.startsWith("/") || branch.includes("..") || branch.endsWith("/")) throw new Error("The recovered approved branch is invalid.");
  if (!projectId) throw new Error("The PlotPickle project ID is required before adopting a moved repository.");
  const repository = await githubApi(connection, encodedRepository(owner, repo));
  if (!repository.ok) throw new Error(responseMessage(repository.body, "The recovered GitHub repository could not be opened."));
  const record = repository.body && typeof repository.body === "object" ? repository.body as Record<string, unknown> : {};
  const fullName = typeof record.full_name === "string" ? record.full_name : `${owner}/${repo}`;
  if (fullName.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) throw new Error(`GitHub resolves that repository to ${fullName}. Use the resolved owner and name.`);
  const manifest = await manifestAt(connection, owner, repo, branch);
  if (manifest.projectId !== projectId) throw new Error("The recovered repository belongs to a different PlotPickle project. The saved connection was not changed.");
  const next: GitHubConnection = {
    ...connection,
    owner,
    repo,
    branch,
    repositoryUrl: `https://github.com/${owner}/${repo}`,
    verifiedAt: new Date().toISOString(),
    readiness: { ready: false },
  };
  await writeCredentialJson(CONNECTION_FILE, next);
  return { repository: `${owner}/${repo}`, branch, projectId, requiresReadinessCheck: true };
}

async function recreateApprovedBranch(input: Record<string, unknown>) {
  const connection = await optionalConnection();
  if (!connection) throw new Error("Reconnect GitHub before recovering the approved branch.");
  const invitation = await readCredentialJson<unknown>(INVITATION_STATE_FILE);
  if (invitation) throw new Error("Only the Project Lead workspace can recreate the approved branch. Collaborator invitations cannot perform branch recovery.");
  const sync = await readCredentialJson<SavedSyncState>(SYNC_STATE_FILE);
  const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
  if (!sync || sync.version !== 1 || !sync.remoteCommit || !sync.projectId) throw new Error("No verified synchronized commit is available for guarded branch recovery.");
  if (!projectId || projectId !== sync.projectId) throw new Error("The requested PlotPickle project does not match the verified synchronization state.");
  if (sync.repository.toLowerCase() !== `${connection.owner}/${connection.repo}`.toLowerCase()) throw new Error("The verified synchronization state belongs to a different repository.");
  const existing = await githubApi(connection, `${encodedRepository(connection.owner, connection.repo)}/git/ref/heads/${encodedBranch(connection.branch)}`);
  if (existing.ok) throw new Error("The approved branch already exists. PlotPickle did not replace it.");
  if (existing.status !== 404) throw new Error(responseMessage(existing.body, "The approved branch state could not be verified."));
  const commit = await githubApi(connection, `${encodedRepository(connection.owner, connection.repo)}/git/commits/${encodeURIComponent(sync.remoteCommit)}`);
  if (!commit.ok) throw new Error("The last verified approved commit is no longer available. Recover it in GitHub before recreating the branch.");
  const manifest = await manifestAt(connection, connection.owner, connection.repo, sync.remoteCommit);
  if (manifest.projectId !== projectId) throw new Error("The verified recovery commit belongs to a different PlotPickle project.");
  const created = await githubApi(connection, `${encodedRepository(connection.owner, connection.repo)}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${connection.branch}`, sha: sync.remoteCommit },
  });
  if (!created.ok) throw new Error(responseMessage(created.body, "GitHub did not recreate the approved branch."));
  return { branch: connection.branch, recoveredCommit: sync.remoteCommit, projectId, force: false };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    const queue = await loadQueue();
    sendJson(response, 200, {
      ok: true,
      version: queue.version,
      queued: queue.entries.length,
      due: dueGitHubRecoveryEntries(queue).length,
      localWritingAvailable: true,
      entries: queue.entries.map(publicGitHubRecoveryEntry),
    });
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/diagnose`) {
    sendJson(response, 200, { ok: true, ...(await diagnoseConnection()) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/enqueue`) {
    const body = await readBody(request);
    const path = typeof body.path === "string" ? body.path : "";
    if (!isGitHubRecoveryPath(path)) throw new Error("That operation is not eligible for GitHub recovery.");
    const failureSource = body.failure && typeof body.failure === "object" ? body.failure as Record<string, unknown> : {};
    const failure: GitHubRecoveryFailure = {
      status: Number(failureSource.status) || 0,
      message: typeof failureSource.message === "string" ? failureSource.message : "Queued while GitHub was unavailable.",
      retryAfterMs: Number(failureSource.retryAfterMs) || 0,
    };
    const queued = enqueueGitHubRecoveryOperation(await loadQueue(), {
      path,
      body: safeGitHubRecoveryBody(body.body),
      label: typeof body.label === "string" ? body.label : undefined,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
      failure,
    });
    await saveQueue(queued.queue);
    sendJson(response, queued.created ? 201 : 200, { ok: true, created: queued.created, entry: publicGitHubRecoveryEntry(queued.entry), queued: queued.queue.entries.length });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/retry`) {
    const body = await readBody(request);
    const id = typeof body.id === "string" ? body.id : "";
    sendJson(response, 200, await executeQueuedOperation(request, id));
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/drain`) {
    sendJson(response, 200, { ok: true, ...(await drainQueue(request)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/adopt-repository`) {
    sendJson(response, 200, { ok: true, ...(await adoptRepository(await readBody(request))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/recreate-branch`) {
    sendJson(response, 200, { ok: true, ...(await recreateApprovedBranch(await readBody(request))) });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/queue`) {
    const id = url.searchParams.get("id") || "";
    const queue = removeGitHubRecoveryEntry(await loadQueue(), id);
    await saveQueue(queue);
    sendJson(response, 200, { ok: true, queued: queue.entries.length });
    return;
  }
  sendJson(response, 404, { ok: false, message: "GitHub recovery operation not found." });
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "GitHub recovery failed.")
    .replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 700);
}

export function githubRecoveryGateway(): Plugin {
  return {
    name: "plotpickle-github-recovery-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "GitHub recovery accepts requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          const status = (error as RecoveryError).status;
          sendJson(response, status && status >= 400 && status < 600 ? status : 400, { ok: false, message: safeError(error) });
        });
      });
    },
  };
}
