import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createCollaborationPolicy,
  parseCollaborationPolicy,
  validateInvitationUse,
  type CollaborationPolicy,
  type LocalInvitationState,
} from "../lib/collaboration-invitations";
import {
  inspectStoryProjectManifest,
  STORY_PROJECT_MANIFEST_PATH,
} from "../lib/story-project-repository";
import { readCredentialJson } from "./local-credentials";

const CONNECTION_FILE = "github-connection.json";
const INVITATION_STATE_FILE = "collaboration-invitation.json";

const GUARDED_PATHS = new Set([
  "/api/local-github/submit-proposal",
  "/api/local-github/approve-proposal",
  "/api/local-github/decline-proposal",
  "/api/local-collaboration/create-invitation",
  "/api/local-collaboration/policy",
]);

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  token: string;
  login?: string;
  readiness?: { ready: boolean };
};

type GitHubContent = {
  content?: string;
  encoding?: string;
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

function validConnection(value: unknown): value is GitHubConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GitHubConnection>;
  return item.version === 1
    && typeof item.owner === "string" && Boolean(item.owner)
    && typeof item.repo === "string" && Boolean(item.repo)
    && typeof item.branch === "string" && Boolean(item.branch)
    && typeof item.token === "string" && Boolean(item.token);
}

async function connection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

async function localInvitation() {
  const value = await readCredentialJson<LocalInvitationState>(INVITATION_STATE_FILE);
  return value && value.version === 1 ? value : null;
}

function repoEndpoint(value: GitHubConnection) {
  return `/repos/${encodeURIComponent(value.owner)}/${encodeURIComponent(value.repo)}`;
}

async function githubJson(value: GitHubConnection, endpoint: string) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${value.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Collaboration-Access-Guard",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : `GitHub returned ${response.status}.`);
  return body;
}

async function repositoryText(value: GitHubConnection, filePath: string) {
  const endpoint = `${repoEndpoint(value)}/contents/${filePath.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(value.branch)}`;
  const body = await githubJson(value, endpoint) as GitHubContent;
  if (typeof body.content !== "string") return null;
  const source = body.content.replace(/\s/g, "");
  return body.encoding === "base64" || !body.encoding ? Buffer.from(source, "base64").toString("utf8") : source;
}

async function repositoryPolicy(value: GitHubConnection) {
  const manifestText = await repositoryText(value, STORY_PROJECT_MANIFEST_PATH);
  if (!manifestText) throw new Error("The connected repository is missing plotpickle-project.json.");
  let manifestSource: unknown;
  try { manifestSource = JSON.parse(manifestText); } catch { throw new Error("The connected repository manifest is not valid JSON."); }
  const inspected = inspectStoryProjectManifest(manifestSource);
  const policyPath = `${inspected.manifest.canonicalProject.root}/collaboration/policy.json`;
  const policyText = await repositoryText(value, policyPath);
  let policy: CollaborationPolicy = createCollaborationPolicy(inspected.manifest.projectId, value.owner);
  if (policyText) {
    let policySource: unknown;
    try { policySource = JSON.parse(policyText); } catch { throw new Error("The collaboration policy is not valid JSON."); }
    policy = parseCollaborationPolicy(policySource, inspected.manifest.projectId);
  }
  return { manifest: inspected.manifest, policy };
}

async function authenticatedLogin(value: GitHubConnection) {
  if (typeof value.login === "string" && value.login.trim()) return value.login.trim();
  const profile = await githubJson(value, "/user");
  if (typeof profile.login !== "string" || !profile.login.trim()) throw new Error("GitHub did not return the signed-in account for Project Lead verification.");
  return profile.login.trim();
}

async function assertProjectLead() {
  const invitation = await localInvitation();
  if (invitation) {
    throw new Error("Only the Project Lead workspace can approve or decline Story Proposals, create invitations or change collaboration policy.");
  }
  const value = await connection();
  if (!value || !value.readiness?.ready) throw new Error("Connect GitHub and wait for the green Ready light before using Project Lead controls.");
  const { policy } = await repositoryPolicy(value);
  const login = (await authenticatedLogin(value)).toLowerCase();
  const permittedLeads = new Set([value.owner, policy.updatedBy].map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (!permittedLeads.has(login)) {
    throw new Error("The signed-in GitHub account is not the repository owner or recorded Project Lead for this story.");
  }
}

async function assertProposalSubmissionAllowed(value: GitHubConnection) {
  const { manifest, policy } = await repositoryPolicy(value);
  if (!policy.acceptingProposals) throw new Error("This project is not accepting new Story Proposals. Local work and approved-story refresh remain available.");
  const local = await localInvitation();
  if (!local) return;
  const invitation = validateInvitationUse({
    invitation: local.invitation,
    policy,
    projectId: manifest.projectId,
    owner: value.owner,
    repo: value.repo,
    branch: value.branch,
  });
  if (invitation.permissions.readOnly || !invitation.permissions.canSubmitProposals) {
    throw new Error(`${invitation.role === "reviewer" ? "Reviewer" : "This collaborator"} access does not permit Story Proposal submission.`);
  }
}

async function authorize(pathname: string) {
  if (pathname === "/api/local-github/approve-proposal" || pathname === "/api/local-github/decline-proposal"
    || pathname === "/api/local-collaboration/create-invitation" || pathname === "/api/local-collaboration/policy") {
    await assertProjectLead();
    return;
  }
  if (pathname === "/api/local-github/submit-proposal") {
    const value = await connection();
    if (!value || !value.readiness?.ready) return;
    await assertProposalSubmissionAllowed(value);
  }
}

function safeMessage(error: unknown) {
  return (error instanceof Error ? error.message : "The collaboration role does not permit this operation.")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 700);
}

export function collaborationAccessGuard(): Plugin {
  return {
    name: "plotpickle-collaboration-access-guard",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl || request.method !== "POST") { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!GUARDED_PATHS.has(url.pathname)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Collaboration role checks accept requests only from this local PlotPickle server." });
          return;
        }
        void authorize(url.pathname)
          .then(() => next())
          .catch((error) => sendJson(response, 403, { ok: false, message: safeMessage(error) }));
      });
    },
  };
}
