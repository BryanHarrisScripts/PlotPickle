import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  assertRecoveryProjectIdentity,
  buildRepositoryRecoveryDiagnosis,
  safeRecoveryBranch,
  safeRecoveryRepository,
  type GitHubRepositoryRecoveryDiagnosis,
  type VerifiedRecoveryBranch,
} from "../lib/github-repository-recovery";
import { createCollaborationPolicy, parseCollaborationPolicy } from "../lib/collaboration-invitations";
import { publicGitHubCommandEntry } from "../lib/github-command-outbox";
import { inspectStoryProjectManifest, STORY_PROJECT_MANIFEST_PATH } from "../lib/story-project-repository";
import { readGitHubCommandOutbox } from "./github-command-service";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";

const API = "/api/local-github-repository-recovery";
const CONNECTION_FILE = "github-connection.json";
const SYNC_FILE = "github-project-sync.json";
const INVITATION_FILE = "collaboration-invitation.json";
const MAX_BODY = 32 * 1024;

type Connection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  token: string;
  login?: string;
  verifiedAt: string;
  repositoryUrl?: string;
  readiness?: { ready: boolean; checks?: unknown[] };
  [key: string]: unknown;
};

type SyncState = {
  version: 1;
  repository: string;
  branch: string;
  projectId: string;
  remoteCommit: string;
  [key: string]: unknown;
};

type GitHubResult = { ok: boolean; status: number; body: unknown; headers: Headers };

function localRequest(request: IncomingMessage) {
  const remote = request.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(remote ?? "")) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch { return false; }
}

function send(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_BODY) throw new Error("The repository recovery request is too large.");
    chunks.push(bytes);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The repository recovery request is invalid.");
  return parsed as Record<string, unknown>;
}

function validConnection(value: unknown): value is Connection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Connection>;
  return item.version === 1 && Boolean(item.owner && item.repo && item.branch && item.token && item.verifiedAt);
}

function validSync(value: unknown): value is SyncState {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SyncState>;
  return item.version === 1 && Boolean(item.repository && item.branch && item.projectId && /^[a-f0-9]{40}$/i.test(item.remoteCommit ?? ""));
}

async function connection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

async function syncState() {
  const value = await readCredentialJson<unknown>(SYNC_FILE);
  return validSync(value) ? value : null;
}

function repositoryPath(repository: string) {
  const [owner, repo] = safeRecoveryRepository(repository).split("/");
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

function branchPath(branch: string) {
  return safeRecoveryBranch(branch).split("/").map(encodeURIComponent).join("/");
}

async function github(value: Connection, endpoint: string, init: { method?: string; body?: unknown } = {}): Promise<GitHubResult> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${value.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Recovery",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let parsed: unknown = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = {}; }
  return { ok: response.ok, status: response.status, body: parsed, headers: response.headers };
}

function message(result: GitHubResult, fallback: string) {
  return result.body && typeof result.body === "object" && typeof (result.body as { message?: unknown }).message === "string"
    ? String((result.body as { message: string }).message)
    : fallback;
}

async function manifestAt(value: Connection, repository: string, reference: string) {
  const result = await github(value, `${repositoryPath(repository)}/contents/${STORY_PROJECT_MANIFEST_PATH}?ref=${encodeURIComponent(reference)}`);
  if (!result.ok) throw new Error(message(result, "The PlotPickle project manifest could not be verified."));
  const record = result.body && typeof result.body === "object" ? result.body as Record<string, unknown> : {};
  if (typeof record.content !== "string") throw new Error("GitHub did not return the PlotPickle project manifest.");
  const source = Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8");
  return inspectStoryProjectManifest(JSON.parse(source)).manifest;
}

async function expectedProjectId(repository: string) {
  const sync = await syncState();
  if (sync && sync.repository.toLowerCase() === repository.toLowerCase()) return sync.projectId;
  const outbox = await readGitHubCommandOutbox();
  const entry = [...outbox.entries].reverse().find((item) => item.repository.toLowerCase() === repository.toLowerCase());
  return entry?.projectId ?? "";
}

async function conflictEntries() {
  const outbox = await readGitHubCommandOutbox();
  return outbox.entries.map(publicGitHubCommandEntry);
}

async function diagnose(): Promise<GitHubRepositoryRecoveryDiagnosis> {
  const value = await connection();
  const conflicts = await conflictEntries();
  if (!value) return buildRepositoryRecoveryDiagnosis({ connected: false, conflicts });
  const configured = `${value.owner}/${value.repo}`;
  let repositoryResult: GitHubResult;
  try { repositoryResult = await github(value, repositoryPath(configured)); }
  catch (error) {
    return buildRepositoryRecoveryDiagnosis({ connected: true, state: "offline", repository: configured, resolvedRepository: configured, branch: value.branch, defaultBranch: value.branch, expectedProjectId: (await syncState())?.projectId || "unknown", message: error instanceof Error ? error.message : "GitHub could not be reached.", conflicts });
  }
  if (!repositoryResult.ok) {
    const state = repositoryResult.status === 401 || repositoryResult.status === 403 ? "authentication" : repositoryResult.status === 404 ? "repository-missing" : "offline";
    return buildRepositoryRecoveryDiagnosis({ connected: true, state, repository: configured, resolvedRepository: configured, branch: value.branch, defaultBranch: value.branch, expectedProjectId: (await syncState())?.projectId || "unknown", message: message(repositoryResult, "The configured GitHub repository could not be verified."), conflicts });
  }
  const repositoryRecord = repositoryResult.body as Record<string, unknown>;
  const resolved = safeRecoveryRepository(typeof repositoryRecord.full_name === "string" ? repositoryRecord.full_name : configured);
  const defaultBranch = safeRecoveryBranch(typeof repositoryRecord.default_branch === "string" ? repositoryRecord.default_branch : value.branch);
  const expected = await expectedProjectId(configured) || await expectedProjectId(resolved);
  if (!expected) return buildRepositoryRecoveryDiagnosis({ connected: true, state: "project-mismatch", repository: configured, resolvedRepository: resolved, branch: value.branch, defaultBranch, expectedProjectId: "unverified", projectId: "missing", message: "No verified PlotPickle project identity is available for repository recovery.", conflicts });

  const ref = await github(value, `${repositoryPath(resolved)}/git/ref/heads/${branchPath(value.branch)}`);
  if (ref.ok) {
    const manifest = await manifestAt(value, resolved, value.branch);
    const projectId = manifest.projectId;
    return buildRepositoryRecoveryDiagnosis({ connected: true, repository: configured, resolvedRepository: resolved, branch: value.branch, defaultBranch, expectedProjectId: expected, projectId, message: projectId === expected ? "The repository and approved branch were verified for this PlotPickle project." : "The configured branch belongs to a different PlotPickle project.", conflicts });
  }
  if (ref.status !== 404) return buildRepositoryRecoveryDiagnosis({ connected: true, state: ref.status === 401 || ref.status === 403 ? "authentication" : "offline", repository: configured, resolvedRepository: resolved, branch: value.branch, defaultBranch, expectedProjectId: expected, message: message(ref, "The approved branch could not be verified."), conflicts });

  const branchesResult = await github(value, `${repositoryPath(resolved)}/branches?per_page=20`);
  const candidates: VerifiedRecoveryBranch[] = [];
  if (branchesResult.ok && Array.isArray(branchesResult.body)) {
    for (const item of branchesResult.body.slice(0, 20)) {
      if (!item || typeof item !== "object") continue;
      const name = typeof (item as { name?: unknown }).name === "string" ? String((item as { name: string }).name) : "";
      const commitSha = typeof (item as { commit?: { sha?: unknown } }).commit?.sha === "string" ? String((item as { commit: { sha: string } }).commit.sha) : "";
      try {
        const manifest = await manifestAt(value, resolved, name);
        if (manifest.projectId === expected) candidates.push({ name, commitSha, projectId: manifest.projectId });
      } catch { /* Wrong-project and unreadable branches are omitted. */ }
    }
  }
  const sync = await syncState();
  let recoveryCommit = "";
  if (sync && sync.projectId === expected && sync.branch === value.branch && [configured.toLowerCase(), resolved.toLowerCase()].includes(sync.repository.toLowerCase())) {
    try {
      assertRecoveryProjectIdentity(expected, (await manifestAt(value, resolved, sync.remoteCommit)).projectId);
      recoveryCommit = sync.remoteCommit;
    } catch { recoveryCommit = ""; }
  }
  return buildRepositoryRecoveryDiagnosis({ connected: true, repository: configured, resolvedRepository: resolved, branch: value.branch, defaultBranch, expectedProjectId: expected, branchMissing: true, recoveryCommit, verifiedBranches: candidates, message: "The approved branch is missing. PlotPickle found only same-project recovery choices.", conflicts });
}

async function assertProjectLead(value: Connection, diagnosis: GitHubRepositoryRecoveryDiagnosis, reference: string) {
  if (await readCredentialJson<unknown>(INVITATION_FILE)) throw new Error("Only the Project Lead workspace can change the saved repository or approved branch.");
  const manifest = await manifestAt(value, diagnosis.resolvedRepository, reference);
  assertRecoveryProjectIdentity(diagnosis.expectedProjectId, manifest.projectId);
  const policyPath = `${manifest.canonicalProject.root}/collaboration/policy.json`;
  const policyResult = await github(value, `${repositoryPath(diagnosis.resolvedRepository)}/contents/${policyPath}?ref=${encodeURIComponent(reference)}`);
  let policy = createCollaborationPolicy(manifest.projectId, diagnosis.resolvedRepository.split("/")[0]);
  if (policyResult.ok) {
    const record = policyResult.body as Record<string, unknown>;
    if (typeof record.content === "string") policy = parseCollaborationPolicy(JSON.parse(Buffer.from(record.content.replace(/\s/g, ""), "base64").toString("utf8")), manifest.projectId);
  }
  const profile = await github(value, "/user");
  if (!profile.ok || !profile.body || typeof profile.body !== "object" || typeof (profile.body as { login?: unknown }).login !== "string") throw new Error("GitHub did not return the signed-in account for Project Lead verification.");
  const login = String((profile.body as { login: string }).login).toLowerCase();
  const allowed = new Set([value.owner, diagnosis.resolvedRepository.split("/")[0], policy.updatedBy].map((item) => item.toLowerCase()));
  if (!allowed.has(login)) throw new Error("The signed-in GitHub account is not the repository owner or recorded Project Lead for this story.");
}

async function saveConnection(value: Connection, diagnosis: GitHubRepositoryRecoveryDiagnosis, branch: string) {
  const [owner, repo] = diagnosis.resolvedRepository.split("/");
  await writeCredentialJson(CONNECTION_FILE, { ...value, owner, repo, branch, repositoryUrl: `https://github.com/${owner}/${repo}`, verifiedAt: "", readiness: { ready: false, checks: [] } });
}

async function migrateSync(diagnosis: GitHubRepositoryRecoveryDiagnosis, branch: string, commit = "") {
  const sync = await syncState();
  if (!sync || sync.projectId !== diagnosis.expectedProjectId) return;
  if (![diagnosis.repository.toLowerCase(), diagnosis.resolvedRepository.toLowerCase()].includes(sync.repository.toLowerCase())) return;
  await writeCredentialJson(SYNC_FILE, { ...sync, repository: diagnosis.resolvedRepository, branch, remoteCommit: commit || sync.remoteCommit });
}

function resultBody(diagnosis: GitHubRepositoryRecoveryDiagnosis, messageText: string) {
  return { ok: true, diagnosis, message: messageText, requiresReadinessCheck: true, payloadsExposed: false };
}

export function githubRepositoryRecoveryGateway(): Plugin {
  return {
    name: "plotpickle-github-repository-recovery",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) return next();
        void (async () => {
          if (!localRequest(request)) return send(response, 403, { message: "Repository recovery accepts requests only from this local PlotPickle server." });
          if (request.method === "GET" && url.pathname === API) {
            const diagnosis = await diagnose();
            return send(response, 200, { diagnosis, message: diagnosis.message, payloadsExposed: false });
          }
          if (request.method !== "POST") return send(response, 405, { message: "Method not allowed." });
          const input = await body(request);
          const value = await connection();
          if (!value) throw new Error("Connect GitHub before recovering the repository.");
          const diagnosis = await diagnose();

          if (url.pathname === `${API}/adopt-repository`) {
            if (!diagnosis.canAdoptRepository || safeRecoveryRepository(input.repository) !== diagnosis.resolvedRepository) throw new Error("The moved repository has not passed same-project verification.");
            await assertProjectLead(value, diagnosis, diagnosis.recoveryCommit || diagnosis.verifiedBranches[0]?.name || diagnosis.branch);
            await saveConnection(value, diagnosis, diagnosis.branch);
            await migrateSync(diagnosis, diagnosis.branch);
            return send(response, 200, resultBody({ ...diagnosis, repository: diagnosis.resolvedRepository, moved: false, canAdoptRepository: false }, "The verified repository location was saved."));
          }

          if (url.pathname === `${API}/select-branch`) {
            const branch = safeRecoveryBranch(input.branch);
            const candidate = diagnosis.verifiedBranches.find((item) => item.name === branch);
            if (!candidate) throw new Error("Choose a branch that PlotPickle verified for this project.");
            await assertProjectLead(value, diagnosis, branch);
            await saveConnection(value, diagnosis, branch);
            await migrateSync(diagnosis, branch, candidate.commitSha);
            return send(response, 200, resultBody({ ...diagnosis, branch, branchMissing: false, canRecreateBranch: false }, "The verified approved branch was saved."));
          }

          if (url.pathname === `${API}/recreate-branch`) {
            if (!diagnosis.canRecreateBranch) throw new Error("No verified synchronization commit is available for non-forced branch recreation.");
            await assertProjectLead(value, diagnosis, diagnosis.recoveryCommit);
            const existing = await github(value, `${repositoryPath(diagnosis.resolvedRepository)}/git/ref/heads/${branchPath(diagnosis.branch)}`);
            if (existing.ok) throw new Error("The approved branch already exists. PlotPickle will not replace it.");
            if (existing.status !== 404) throw new Error(message(existing, "The approved branch could not be checked safely."));
            const created = await github(value, `${repositoryPath(diagnosis.resolvedRepository)}/git/refs`, { method: "POST", body: { ref: `refs/heads/${diagnosis.branch}`, sha: diagnosis.recoveryCommit } });
            if (!created.ok) throw new Error(message(created, "GitHub did not create the approved branch."));
            await saveConnection(value, diagnosis, diagnosis.branch);
            await migrateSync(diagnosis, diagnosis.branch, diagnosis.recoveryCommit);
            return send(response, 200, resultBody({ ...diagnosis, branchMissing: false, canRecreateBranch: false }, "The approved branch was recreated from the last verified commit without force."));
          }

          return send(response, 404, { message: "Repository recovery action not found." });
        })().catch((error) => send(response, /already exists|different PlotPickle project|Project Lead|verified/.test(error instanceof Error ? error.message : "") ? 409 : 400, { message: error instanceof Error ? error.message : "GitHub repository recovery failed." }));
      });
    },
  };
}
