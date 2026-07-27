import { randomUUID } from "node:crypto";
import { readCredentialJson } from "./local-credentials";
import { createCollaborationInvitation, invitationMatchesRecord, parseCollaborationInvitation, type CollaborationInvitation, type CollaborationInvitationRecord, type CollaborationRole } from "../lib/collaboration-invitations";

export type GitHubConnection = { version: 1; owner: string; repo: string; branch: string; projectPath: string; token: string; verifiedAt: string; readiness?: { ready: boolean } };
type GitHubError = Error & { status?: number };
type Manifest = Record<string, unknown> & { projectId?: string; title?: string; canonicalProject?: { root?: string }; collaboration?: { acceptingProposals?: boolean } };
type Registry = { format: "plotpickle-invitation-registry"; version: 1; projectId: string; invitations: CollaborationInvitationRecord[]; updatedAt: string };

const MANIFEST_PATH = "plotpickle-project.json";
const REGISTRY_PATH = "collaboration/invitations.json";

export async function readConnection() {
  const value = await readCredentialJson<GitHubConnection>("github-connection.json");
  if (!value || value.version !== 1 || !value.owner || !value.repo || !value.branch || !value.token) throw new Error("Connect the invited GitHub story project and wait for the green Ready light.");
  if (!value.readiness?.ready) throw new Error("Test the GitHub connection and wait for the green Ready light.");
  return value;
}
function repo(connection: GitHubConnection) { return `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`; }
async function request(connection: GitHubConnection, endpoint: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init.method || "GET",
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${connection.token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "PlotPickle-Collaboration-Invitations", ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body), signal: AbortSignal.timeout(30_000),
  });
  const source = await response.text();
  let body: unknown = {};
  try { body = source ? JSON.parse(source) : {}; } catch { body = {}; }
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string" ? String((body as { message: string }).message) : `GitHub returned ${response.status}.`;
    const error = new Error(message) as GitHubError; error.status = response.status; throw error;
  }
  return body as Record<string, unknown>;
}
async function content(connection: GitHubConnection, path: string, ref = connection.branch) {
  const body = await request(connection, `${repo(connection)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
  const encoded = typeof body.content === "string" ? body.content.replace(/\s/g, "") : "";
  if (!encoded) throw new Error(`The story project is missing ${path}.`);
  return Buffer.from(encoded, "base64").toString("utf8");
}
async function optionalContent(connection: GitHubConnection, path: string, ref = connection.branch) {
  try { return await content(connection, path, ref); } catch (error) { if ((error as GitHubError).status === 404) return ""; throw error; }
}
function json<T>(source: string, message: string): T { try { return JSON.parse(source) as T; } catch { throw new Error(message); } }
export async function approvedState(connection: GitHubConnection) {
  const ref = await request(connection, `${repo(connection)}/git/ref/heads/${encodeURIComponent(connection.branch)}`);
  const commitSha = String((ref.object as { sha?: unknown } | undefined)?.sha || "");
  if (!commitSha) throw new Error("GitHub did not return the approved story revision.");
  const commit = await request(connection, `${repo(connection)}/git/commits/${encodeURIComponent(commitSha)}`);
  const treeSha = String((commit.tree as { sha?: unknown } | undefined)?.sha || "");
  if (!treeSha) throw new Error("GitHub did not return the approved story tree.");
  const manifest = json<Manifest>(await content(connection, MANIFEST_PATH, commitSha), "The story-project manifest is invalid.");
  const registrySource = await optionalContent(connection, REGISTRY_PATH, commitSha);
  const registry = registrySource ? json<Registry>(registrySource, "The invitation registry is invalid.") : { format: "plotpickle-invitation-registry" as const, version: 1 as const, projectId: String(manifest.projectId || ""), invitations: [], updatedAt: new Date(0).toISOString() };
  return { commitSha, treeSha, manifest, registry };
}
function accepting(manifest: Manifest) { return manifest.collaboration?.acceptingProposals !== false; }
function canonicalRoot(manifest: Manifest) { return manifest.canonicalProject?.root || "project"; }
function repositoryUrl(connection: GitHubConnection) { return `https://github.com/${connection.owner}/${connection.repo}`; }
export async function hasProjectLeadPermission(connection: GitHubConnection) {
  const repository = await request(connection, repo(connection));
  const permissions = repository.permissions && typeof repository.permissions === "object" ? repository.permissions as Record<string, unknown> : {};
  return permissions.admin === true || permissions.maintain === true;
}

async function guardedCommit(connection: GitHubConnection, expected: string, files: Record<string, string>, message: string) {
  const state = await approvedState(connection);
  if (!expected || state.commitSha !== expected) { const error = new Error("The approved story changed after this operation began. Refresh and try again.") as GitHubError; error.status = 409; throw error; }
  const entries = [] as Array<{ path: string; mode: "100644"; type: "blob"; sha: string }>;
  for (const [path, value] of Object.entries(files)) {
    const blob = await request(connection, `${repo(connection)}/git/blobs`, { method: "POST", body: { content: value, encoding: "utf-8" } });
    entries.push({ path, mode: "100644", type: "blob", sha: String(blob.sha || "") });
  }
  const tree = await request(connection, `${repo(connection)}/git/trees`, { method: "POST", body: { base_tree: state.treeSha, tree: entries } });
  const commit = await request(connection, `${repo(connection)}/git/commits`, { method: "POST", body: { message, tree: String(tree.sha || ""), parents: [state.commitSha] } });
  const next = String(commit.sha || "");
  await request(connection, `${repo(connection)}/git/refs/heads/${encodeURIComponent(connection.branch)}`, { method: "PATCH", body: { sha: next, force: false } });
  return next;
}

export async function collaborationStatus(connection: GitHubConnection) {
  const state = await approvedState(connection);
  return { repository: `${connection.owner}/${connection.repo}`, branch: connection.branch, remoteCommit: state.commitSha, projectLead: await hasProjectLeadPermission(connection), projectId: String(state.manifest.projectId || ""), title: String(state.manifest.title || connection.repo), canonicalRoot: canonicalRoot(state.manifest), acceptingProposals: accepting(state.manifest), invitations: state.registry.invitations };
}
export async function setAcceptingProposals(connection: GitHubConnection, expected: string, value: boolean) {
  const state = await approvedState(connection);
  const manifest = { ...state.manifest, collaboration: { ...(state.manifest.collaboration || {}), approvalAuthority: "project-lead", proposalMode: "pull-request", acceptingProposals: value } };
  const remoteCommit = await guardedCommit(connection, expected, { [MANIFEST_PATH]: `${JSON.stringify(manifest, null, 2)}\n` }, value ? "Open PlotPickle Story Proposals" : "Pause PlotPickle Story Proposals");
  return { remoteCommit, acceptingProposals: value };
}
export async function createInvitation(connection: GitHubConnection, input: { expectedRemoteCommit: string; role: CollaborationRole; recipientName: string; issuer: string; expiresAt: string }) {
  const state = await approvedState(connection);
  const invitation = createCollaborationInvitation({ invitationId: randomUUID(), projectId: String(state.manifest.projectId || ""), title: String(state.manifest.title || connection.repo), repositoryUrl: repositoryUrl(connection), owner: connection.owner, repo: connection.repo, approvedBranch: connection.branch, canonicalRoot: canonicalRoot(state.manifest), role: input.role, recipientName: input.recipientName, issuer: input.issuer, expiresAt: input.expiresAt });
  const record: CollaborationInvitationRecord = { invitationId: invitation.invitationId, role: invitation.invitation.role, recipientName: invitation.invitation.recipientName, issuer: invitation.invitation.issuer, issuedAt: invitation.invitation.issuedAt, expiresAt: invitation.invitation.expiresAt, status: "active" };
  const registry: Registry = { format: "plotpickle-invitation-registry", version: 1, projectId: invitation.project.projectId, invitations: [...state.registry.invitations.filter((item) => item.invitationId !== record.invitationId), record], updatedAt: new Date().toISOString() };
  const remoteCommit = await guardedCommit(connection, input.expectedRemoteCommit, { [REGISTRY_PATH]: `${JSON.stringify(registry, null, 2)}\n` }, `Register PlotPickle ${input.role} invitation`);
  return { invitation, remoteCommit };
}
export async function revokeInvitation(connection: GitHubConnection, expected: string, invitationId: string) {
  const state = await approvedState(connection); let found = false; const now = new Date().toISOString();
  const invitations = state.registry.invitations.map((item) => item.invitationId === invitationId ? (found = true, { ...item, status: "revoked" as const, revokedAt: now }) : item);
  if (!found) throw new Error("The invitation is not registered in this story project.");
  const registry: Registry = { ...state.registry, invitations, updatedAt: now };
  const remoteCommit = await guardedCommit(connection, expected, { [REGISTRY_PATH]: `${JSON.stringify(registry, null, 2)}\n` }, "Revoke PlotPickle collaboration invitation");
  return { remoteCommit };
}
export async function validateInvitation(connection: GitHubConnection, value: unknown) {
  const state = await approvedState(connection);
  const invitation = parseCollaborationInvitation(value, { expectedProjectId: String(state.manifest.projectId || ""), expectedRepository: `${connection.owner}/${connection.repo}` });
  const record = state.registry.invitations.find((item) => item.invitationId === invitation.invitationId);
  if (!record) throw new Error("This invitation is not registered in the approved story project.");
  if (record.status === "revoked") throw new Error("This invitation has been revoked.");
  if (Date.now() >= Date.parse(record.expiresAt)) throw new Error("This invitation has expired.");
  if (!invitationMatchesRecord(invitation, record)) throw new Error("The invitation no longer matches its registered role, recipient, issuer, issue date or expiry details.");
  return { invitation, acceptingProposals: accepting(state.manifest), remoteCommit: state.commitSha };
}
