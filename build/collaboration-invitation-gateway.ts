import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { readCredentialJson, removeCredentialFile, writeCredentialJson } from "./local-credentials";
import { collaborationStatus, createInvitation, hasProjectLeadPermission, readConnection, revokeInvitation, setAcceptingProposals, validateInvitation } from "./collaboration-invitation-github";
import { COLLABORATION_ROLES, COLLABORATION_ROLE_DEFAULTS, type CollaborationRole, type CollaborationSession } from "../lib/collaboration-invitations";

const API = "/api/local-collaboration";
const SESSION_FILE = "github-collaboration-role.json";
const MAX_BODY = 2 * 1024 * 1024;
type HttpError = Error & { status?: number };

function local(request: IncomingMessage) {
  const address = request.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address || "")) return false;
  const host = request.headers.host; if (!host) return false;
  try { const parsed = new URL(`http://${host}`); const origin = request.headers.origin; return ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) && (!origin || new URL(origin).host === parsed.host); } catch { return false; }
}
function send(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.setHeader("Cache-Control", "no-store"); response.setHeader("X-Content-Type-Options", "nosniff"); response.end(JSON.stringify(body));
}
async function body(request: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += bytes.length; if (size > MAX_BODY) throw new Error("The collaboration request is too large."); chunks.push(bytes); }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The collaboration request is invalid.");
  return value as Record<string, unknown>;
}
function role(value: unknown): CollaborationRole {
  if (typeof value !== "string" || !COLLABORATION_ROLES.includes(value as CollaborationRole)) throw new Error("Choose a supported collaborator role.");
  return value as CollaborationRole;
}
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
async function session() { return readCredentialJson<CollaborationSession>(SESSION_FILE); }
async function requireLead() { const connection = await readConnection(); if (!(await hasProjectLeadPermission(connection))) throw new Error("Only a repository owner or maintainer acting as Project Lead can change collaboration settings or invitation status."); return connection; }
function sessionFrom(invitation: Awaited<ReturnType<typeof validateInvitation>>["invitation"]): CollaborationSession {
  const defaults = COLLABORATION_ROLE_DEFAULTS[invitation.invitation.role];
  return { version: 1, repository: `${invitation.project.owner}/${invitation.project.repo}`, projectId: invitation.project.projectId, projectTitle: invitation.project.title, role: invitation.invitation.role, invitationId: invitation.invitationId, recipientName: invitation.invitation.recipientName, expiresAt: invitation.invitation.expiresAt, defaultWorkspace: defaults.defaultWorkspace, workspaceHref: defaults.workspaceHref, readOnlyReview: defaults.readOnlyReview, canSubmitProposals: defaults.canSubmitProposals, validatedAt: new Date().toISOString() };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    const active = await session();
    let remote: Record<string, unknown> = { connected: false };
    try { remote = { connected: true, ...(await collaborationStatus(await readConnection())) }; } catch { /* Disconnected local work remains available. */ }
    send(response, 200, { ok: true, session: active, ...remote }); return;
  }
  if (request.method === "POST" && url.pathname === `${API}/validate-invitation`) {
    const input = await body(request); const connection = await readConnection(); const result = await validateInvitation(connection, input.invitation); const active = sessionFrom(result.invitation); await writeCredentialJson(SESSION_FILE, active);
    send(response, 200, { ok: true, ...result, session: active }); return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/session`) { await requireLead(); await removeCredentialFile(SESSION_FILE); send(response, 200, { ok: true }); return; }
  const connection = await requireLead();
  if (request.method === "POST" && url.pathname === `${API}/accepting-proposals`) {
    const input = await body(request); send(response, 200, { ok: true, ...(await setAcceptingProposals(connection, text(input.expectedRemoteCommit), input.acceptingProposals !== false)) }); return;
  }
  if (request.method === "POST" && url.pathname === `${API}/create-invitation`) {
    const input = await body(request); send(response, 200, { ok: true, ...(await createInvitation(connection, { expectedRemoteCommit: text(input.expectedRemoteCommit), role: role(input.role), recipientName: text(input.recipientName), issuer: text(input.issuer) || "Project Lead", expiresAt: text(input.expiresAt) })) }); return;
  }
  if (request.method === "POST" && url.pathname === `${API}/revoke-invitation`) {
    const input = await body(request); send(response, 200, { ok: true, ...(await revokeInvitation(connection, text(input.expectedRemoteCommit), text(input.invitationId))) }); return;
  }
  send(response, 404, { ok: false, message: "Collaboration invitation operation not found." });
}

const LEAD_ONLY = new Set(["/api/local-github/approve-proposal", "/api/local-github/decline-proposal", "/api/local-github-sync/publish", "/api/local-github-sync/release-snapshot"]);
async function guardExisting(request: IncomingMessage, response: ServerResponse, url: URL) {
  const active = await session();
  if (LEAD_ONLY.has(url.pathname) && !(await hasProjectLeadPermission(await readConnection()))) { send(response, 403, { ok: false, message: "Only a repository owner or maintainer acting as Project Lead can approve or decline Story Proposals, publish the approved folder, migrate the repository or create repository release snapshots." }); return true; }
  if (url.pathname === "/api/local-github/submit-proposal") {
    if (active?.readOnlyReview || active?.role === "reviewer") { send(response, 403, { ok: false, message: "Reviewer read-only mode cannot create Story Proposals. Feedback notes remain available." }); return true; }
    const state = await collaborationStatus(await readConnection());
    if (!state.acceptingProposals) { send(response, 409, { ok: false, message: "The Project Lead paused new Story Proposals. Approved-story refresh and local work remain available." }); return true; }
    if (active?.invitationId) {
      const record = state.invitations.find((item) => item.invitationId === active.invitationId);
      if (!record) { send(response, 403, { ok: false, message: "This collaboration invitation is no longer registered." }); return true; }
      if (record.status === "revoked") { send(response, 403, { ok: false, message: "This collaboration invitation has been revoked." }); return true; }
      if (Date.now() >= Date.parse(record.expiresAt)) { send(response, 403, { ok: false, message: "This collaboration invitation has expired." }); return true; }
    }
  }
  return false;
}

export function collaborationInvitationGateway(): Plugin {
  return { name: "plotpickle-collaboration-invitation-gateway", apply: "serve", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const raw = request.url; if (!raw) { next(); return; } const url = new URL(raw, "http://127.0.0.1");
      const owned = url.pathname.startsWith(API); const guarded = LEAD_ONLY.has(url.pathname) || url.pathname === "/api/local-github/submit-proposal";
      if (!owned && !guarded) { next(); return; }
      if (!local(request)) { send(response, 403, { ok: false, message: "Collaboration operations accept requests only from this local PlotPickle server." }); return; }
      void (owned ? handle(request, response, url) : guardExisting(request, response, url).then((blocked) => { if (!blocked) next(); })).catch((error) => {
        const message = (error instanceof Error ? error.message : "The collaboration operation failed.").replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]").slice(0, 700);
        send(response, (error as HttpError).status === 409 ? 409 : 400, { ok: false, message });
      });
    });
  } };
}
