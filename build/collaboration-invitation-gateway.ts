import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createCollaborationPolicy,
  createPlotPickleInvitation,
  invitationFileName,
  parseCollaborationPolicy,
  parsePlotPickleInvitation,
  serializeCollaborationPolicy,
  serializePlotPickleInvitation,
  validateInvitationUse,
  type CollaborationPolicy,
  type CollaborationRole,
  type LocalInvitationState,
} from "../lib/collaboration-invitations";
import {
  inspectStoryProjectManifest,
  STORY_PROJECT_MANIFEST_PATH,
} from "../lib/story-project-repository";
import {
  readCredentialJson,
  removeCredentialFile,
  writeCredentialJson,
} from "./local-credentials";

const API = "/api/local-collaboration";
const CONNECTION_FILE = "github-connection.json";
const INVITATION_STATE_FILE = "collaboration-invitation.json";
const MAX_BODY = 2 * 1024 * 1024;

const ROLES: CollaborationRole[] = ["writer", "director", "actor", "producer", "reviewer"];

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
};

type GitHubError = Error & { status?: number; body?: unknown };
type TreeItem = { path: string; sha: string; mode: string; type: "blob"; size: number };
type BranchState = { commitSha: string; treeSha: string; tree: TreeItem[] };
type RepositoryState = {
  branch: BranchState;
  projectId: string;
  title: string;
  projectRoot: string;
  policyPath: string;
  policy: CollaborationPolicy;
};

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
    if (length > MAX_BODY) throw new Error("The PlotPickle invitation request is too large.");
    chunks.push(bytes);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The PlotPickle invitation request is invalid.");
  return value as Record<string, unknown>;
}

function validConnection(value: unknown): value is GitHubConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GitHubConnection>;
  return item.version === 1
    && typeof item.owner === "string" && Boolean(item.owner)
    && typeof item.repo === "string" && Boolean(item.repo)
    && typeof item.branch === "string" && Boolean(item.branch)
    && typeof item.token === "string" && Boolean(item.token)
    && typeof item.verifiedAt === "string";
}

async function optionalConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

async function readyConnection() {
  const value = await optionalConnection();
  if (!value || !value.readiness?.ready) throw new Error("Connect GitHub and wait for the green Ready light before managing collaboration invitations.");
  return value;
}

function repoEndpoint(connection: GitHubConnection) {
  return `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`;
}

async function githubRequest(connection: GitHubConnection, endpoint: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${connection.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Collaboration-Invitations",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
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

async function branchState(connection: GitHubConnection): Promise<BranchState> {
  const branchPath = connection.branch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubRequest(connection, `${repoEndpoint(connection)}/git/ref/heads/${branchPath}`);
  const commitSha = ref && typeof ref === "object" && (ref as { object?: { sha?: unknown } }).object?.sha
    ? String((ref as { object: { sha: string } }).object.sha)
    : "";
  if (!commitSha) throw new Error("GitHub did not return the approved branch commit.");
  const commit = await githubRequest(connection, `${repoEndpoint(connection)}/git/commits/${encodeURIComponent(commitSha)}`);
  const treeSha = commit && typeof commit === "object" && (commit as { tree?: { sha?: unknown } }).tree?.sha
    ? String((commit as { tree: { sha: string } }).tree.sha)
    : "";
  if (!treeSha) throw new Error("GitHub did not return the approved project tree.");
  const result = await githubRequest(connection, `${repoEndpoint(connection)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (result && typeof result === "object" && (result as { truncated?: unknown }).truncated) throw new Error("The repository tree is too large for safe invitation policy management.");
  const source = result && typeof result === "object" && Array.isArray((result as { tree?: unknown[] }).tree)
    ? (result as { tree: unknown[] }).tree
    : [];
  const tree = source.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (record.type !== "blob" || typeof record.path !== "string" || typeof record.sha !== "string") return [];
    return [{
      path: record.path,
      sha: record.sha,
      mode: typeof record.mode === "string" ? record.mode : "100644",
      type: "blob" as const,
      size: Number(record.size) || 0,
    }];
  });
  return { commitSha, treeSha, tree };
}

async function blobText(connection: GitHubConnection, sha: string) {
  const result = await githubRequest(connection, `${repoEndpoint(connection)}/git/blobs/${encodeURIComponent(sha)}`);
  if (!result || typeof result !== "object" || typeof (result as { content?: unknown }).content !== "string") throw new Error("GitHub did not return a required collaboration file.");
  const encoding = typeof (result as { encoding?: unknown }).encoding === "string" ? String((result as { encoding: string }).encoding) : "base64";
  const content = String((result as { content: string }).content).replace(/\s/g, "");
  return encoding === "base64" ? Buffer.from(content, "base64").toString("utf8") : content;
}

async function treeText(connection: GitHubConnection, branch: BranchState, filePath: string) {
  const item = branch.tree.find((entry) => entry.path === filePath);
  return item ? blobText(connection, item.sha) : null;
}

async function repositoryState(connection: GitHubConnection): Promise<RepositoryState> {
  const branch = await branchState(connection);
  const manifestText = await treeText(connection, branch, STORY_PROJECT_MANIFEST_PATH);
  if (!manifestText) throw new Error("The connected repository is missing plotpickle-project.json.");
  let manifestSource: unknown;
  try { manifestSource = JSON.parse(manifestText); } catch { throw new Error("The connected repository manifest is not valid JSON."); }
  const inspected = inspectStoryProjectManifest(manifestSource);
  const projectRoot = inspected.manifest.canonicalProject.root;
  const policyPath = `${projectRoot}/collaboration/policy.json`;
  const policyText = await treeText(connection, branch, policyPath);
  let policy = createCollaborationPolicy(inspected.manifest.projectId, connection.login || connection.owner);
  if (policyText) {
    let policySource: unknown;
    try { policySource = JSON.parse(policyText); } catch { throw new Error("The collaboration policy is not valid JSON."); }
    policy = parseCollaborationPolicy(policySource, inspected.manifest.projectId);
  }
  return {
    branch,
    projectId: inspected.manifest.projectId,
    title: inspected.manifest.title,
    projectRoot,
    policyPath,
    policy,
  };
}

async function createBlob(connection: GitHubConnection, content: string) {
  const result = await githubRequest(connection, `${repoEndpoint(connection)}/git/blobs`, {
    method: "POST",
    body: { content: Buffer.from(content, "utf8").toString("base64"), encoding: "base64" },
  });
  const sha = result && typeof result === "object" && typeof (result as { sha?: unknown }).sha === "string" ? String((result as { sha: string }).sha) : "";
  if (!sha) throw new Error("GitHub did not create the collaboration policy file.");
  return sha;
}

async function writePolicy(connection: GitHubConnection, state: RepositoryState, policy: CollaborationPolicy, expectedRemoteCommit: string) {
  if (!expectedRemoteCommit || expectedRemoteCommit !== state.branch.commitSha) {
    const error = new Error("The approved branch changed after the collaboration policy was loaded. Refresh the policy before saving it.") as GitHubError;
    error.status = 409;
    throw error;
  }
  const blobSha = await createBlob(connection, serializeCollaborationPolicy(policy));
  const tree = await githubRequest(connection, `${repoEndpoint(connection)}/git/trees`, {
    method: "POST",
    body: { base_tree: state.branch.treeSha, tree: [{ path: state.policyPath, mode: "100644", type: "blob", sha: blobSha }] },
  });
  const treeSha = tree && typeof tree === "object" && typeof (tree as { sha?: unknown }).sha === "string" ? String((tree as { sha: string }).sha) : "";
  if (!treeSha) throw new Error("GitHub did not create the collaboration policy tree.");
  const commit = await githubRequest(connection, `${repoEndpoint(connection)}/git/commits`, {
    method: "POST",
    body: { message: `Update PlotPickle collaboration policy for ${state.title}`, tree: treeSha, parents: [state.branch.commitSha] },
  });
  const commitSha = commit && typeof commit === "object" && typeof (commit as { sha?: unknown }).sha === "string" ? String((commit as { sha: string }).sha) : "";
  if (!commitSha) throw new Error("GitHub did not create the collaboration policy commit.");
  const branchPath = connection.branch.split("/").map(encodeURIComponent).join("/");
  await githubRequest(connection, `${repoEndpoint(connection)}/git/refs/heads/${branchPath}`, {
    method: "PATCH",
    body: { sha: commitSha, force: false },
  });
  return commitSha;
}

async function readLocalInvitation() {
  const value = await readCredentialJson<LocalInvitationState>(INVITATION_STATE_FILE);
  return value && value.version === 1 ? value : null;
}

async function status() {
  const local = await readLocalInvitation();
  const connection = await optionalConnection();
  if (!connection || !connection.readiness?.ready) {
    return {
      connected: false,
      invitation: local,
      policy: null,
      role: local?.invitation.role || null,
      readOnly: local?.invitation.permissions.readOnly || false,
      canSubmitProposals: local?.invitation.permissions.canSubmitProposals ?? true,
      verificationState: local?.verificationState || "none",
    };
  }
  const repository = await repositoryState(connection);
  let invitation = local;
  let verificationState = local?.verificationState || "none";
  let verificationMessage = "";
  if (local) {
    try {
      validateInvitationUse({
        invitation: local.invitation,
        policy: repository.policy,
        projectId: repository.projectId,
        owner: connection.owner,
        repo: connection.repo,
        branch: connection.branch,
      });
      invitation = { ...local, verifiedAt: new Date().toISOString(), verificationState: "verified" };
      verificationState = "verified";
      await writeCredentialJson(INVITATION_STATE_FILE, invitation);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The invitation could not be verified.";
      verificationMessage = message;
      verificationState = /expired/i.test(message) ? "expired"
        : /revoked/i.test(message) ? "revoked"
          : /different project/i.test(message) ? "wrong-project"
            : "repository-mismatch";
      invitation = { ...local, verificationState, verifiedAt: "" };
      await writeCredentialJson(INVITATION_STATE_FILE, invitation);
    }
  }
  return {
    connected: true,
    repository: `${connection.owner}/${connection.repo}`,
    branch: connection.branch,
    remoteCommit: repository.branch.commitSha,
    projectId: repository.projectId,
    projectRoot: repository.projectRoot,
    policy: repository.policy,
    invitation,
    role: invitation?.invitation.role || null,
    readOnly: invitation?.invitation.permissions.readOnly || false,
    canSubmitProposals: invitation?.invitation.permissions.canSubmitProposals ?? true,
    verificationState,
    verificationMessage,
  };
}

async function createInvitation(connection: GitHubConnection, body: Record<string, unknown>) {
  const repository = await repositoryState(connection);
  const role = typeof body.role === "string" && ROLES.includes(body.role as CollaborationRole) ? body.role as CollaborationRole : null;
  if (!role) throw new Error("Choose a valid collaborator role.");
  const expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : "";
  const invitation = createPlotPickleInvitation({
    projectId: repository.projectId,
    projectTitle: repository.title,
    owner: connection.owner,
    repo: connection.repo,
    repositoryUrl: connection.repositoryUrl || `https://github.com/${connection.owner}/${connection.repo}`,
    branch: connection.branch,
    projectRoot: repository.projectRoot,
    role,
    recipientName: typeof body.recipientName === "string" ? body.recipientName : "",
    issuerName: typeof body.issuerName === "string" ? body.issuerName : connection.login || connection.owner,
    issuerGitHubLogin: connection.login || connection.owner,
    expiresAt,
    note: typeof body.note === "string" ? body.note : "",
  });
  return {
    invitation,
    fileName: invitationFileName(invitation),
    content: serializePlotPickleInvitation(invitation),
    remoteCommit: repository.branch.commitSha,
    policy: repository.policy,
  };
}

async function importInvitation(body: Record<string, unknown>) {
  const source = typeof body.content === "string" ? body.content : body.invitation;
  const invitation = parsePlotPickleInvitation(source);
  validateInvitationUse({ invitation, projectId: typeof body.projectId === "string" ? body.projectId : "" });
  const state: LocalInvitationState = {
    version: 1,
    invitation,
    acceptedAt: new Date().toISOString(),
    verifiedAt: "",
    verificationState: "imported",
  };
  await writeCredentialJson(INVITATION_STATE_FILE, state);
  return {
    invitation: state,
    repository: invitation.repository,
    role: invitation.role,
    readOnly: invitation.permissions.readOnly,
    canSubmitProposals: invitation.permissions.canSubmitProposals,
    primaryWorkspace: invitation.workspaceDefaults[0] || "/feedback",
  };
}

async function updatePolicy(connection: GitHubConnection, body: Record<string, unknown>) {
  const repository = await repositoryState(connection);
  const expectedRemoteCommit = typeof body.expectedRemoteCommit === "string" ? body.expectedRemoteCommit : "";
  const next = parseCollaborationPolicy(repository.policy, repository.projectId);
  if (typeof body.acceptingProposals === "boolean") next.acceptingProposals = body.acceptingProposals;
  const revokeId = typeof body.revokeInvitationId === "string" ? body.revokeInvitationId.trim() : "";
  const restoreId = typeof body.restoreInvitationId === "string" ? body.restoreInvitationId.trim() : "";
  if (revokeId) next.revokedInvitationIds = [...new Set([...next.revokedInvitationIds, revokeId])].sort();
  if (restoreId) next.revokedInvitationIds = next.revokedInvitationIds.filter((id) => id !== restoreId);
  next.updatedAt = new Date().toISOString();
  next.updatedBy = connection.login || connection.owner;
  const remoteCommit = await writePolicy(connection, repository, next, expectedRemoteCommit);
  return { policy: next, remoteCommit, previousRemoteCommit: repository.branch.commitSha };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "POST" && url.pathname === `${API}/import`) {
    sendJson(response, 200, { ok: true, ...(await importInvitation(await readBody(request))) });
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/invitation`) {
    await removeCredentialFile(INVITATION_STATE_FILE);
    sendJson(response, 200, { ok: true, removed: true });
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, { ok: true, ...(await status()) });
    return;
  }
  const connection = await readyConnection();
  if (request.method === "POST" && url.pathname === `${API}/create-invitation`) {
    sendJson(response, 200, { ok: true, ...(await createInvitation(connection, await readBody(request))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/policy`) {
    sendJson(response, 200, { ok: true, ...(await updatePolicy(connection, await readBody(request))) });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Collaboration invitation operation not found." });
}

export function collaborationInvitationGateway(): Plugin {
  return {
    name: "plotpickle-collaboration-invitation-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        const paths = [
          `${API}/status`,
          `${API}/import`,
          `${API}/invitation`,
          `${API}/create-invitation`,
          `${API}/policy`,
        ];
        if (!paths.includes(url.pathname)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Collaboration invitations accept requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          const rawMessage = error instanceof Error ? error.message : "The collaboration invitation operation failed.";
          const message = rawMessage.replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]");
          const statusCode = (error as GitHubError).status === 409 ? 409 : 400;
          sendJson(response, statusCode, { ok: false, message });
        });
      });
    },
  };
}
