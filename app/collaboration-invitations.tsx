"use client";

import { useEffect, useRef, useState } from "react";
import { COLLABORATION_ROLES, COLLABORATION_ROLE_DEFAULTS, parseCollaborationInvitation, serializeCollaborationInvitation, type CollaborationInvitation, type CollaborationInvitationRecord, type CollaborationRole, type CollaborationSession } from "@/lib/collaboration-invitations";
import styles from "./collaboration-invitations.module.css";

type Status = { connected: boolean; projectLead: boolean; repository: string; branch: string; remoteCommit: string; projectId: string; title: string; acceptingProposals: boolean; invitations: CollaborationInvitationRecord[]; session: CollaborationSession | null };
const EMPTY: Status = { connected: false, projectLead: false, repository: "", branch: "main", remoteCommit: "", projectId: "", title: "", acceptingProposals: true, invitations: [], session: null };

async function request(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: object) {
  const response = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error("Collaboration invitations are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "The collaboration operation failed.");
  return value;
}
function status(value: Record<string, unknown>): Status {
  return { connected: value.connected === true, projectLead: value.projectLead === true, repository: String(value.repository || ""), branch: String(value.branch || "main"), remoteCommit: String(value.remoteCommit || ""), projectId: String(value.projectId || ""), title: String(value.title || ""), acceptingProposals: value.acceptingProposals !== false, invitations: Array.isArray(value.invitations) ? value.invitations as CollaborationInvitationRecord[] : [], session: value.session && typeof value.session === "object" ? value.session as CollaborationSession : null };
}
function download(invitation: CollaborationInvitation) {
  const slug = invitation.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle";
  const url = URL.createObjectURL(new Blob([serializeCollaborationInvitation(invitation)], { type: "application/vnd.plotpickle.invitation+json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${slug}-${invitation.invitation.role}.ppinvite`; anchor.click(); URL.revokeObjectURL(url);
}
function announce(session: CollaborationSession | null) {
  window.dispatchEvent(new CustomEvent("plotpickle-collaboration-session", { detail: session }));
}

export default function CollaborationInvitationHost() {
  const [open, setOpen] = useState(false); const [value, setValue] = useState<Status>(EMPTY); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<CollaborationRole>("writer"); const [recipient, setRecipient] = useState(""); const [issuer, setIssuer] = useState("Project Lead"); const [days, setDays] = useState(14);
  const file = useRef<HTMLInputElement>(null);
  async function refresh() { try { const next = status(await request("/api/local-collaboration/status")); setValue(next); announce(next.session); } catch (error) { setNotice(error instanceof Error ? error.message : "Collaboration status could not be loaded."); } }
  useEffect(() => { const timer = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(timer); }, []);
  async function importInvite(selected: File) {
    setBusy(true); try {
      const parsed = parseCollaborationInvitation(JSON.parse(await selected.text()));
      if (!value.connected || value.repository.toLowerCase() !== `${parsed.project.owner}/${parsed.project.repo}`.toLowerCase()) {
        const selectedRepository = await request("/api/local-github-app/select", "POST", { fullName: `${parsed.project.owner}/${parsed.project.repo}`, projectPath: parsed.project.canonicalRoot, initializeMissingManifest: false, title: parsed.project.title, projectId: parsed.project.projectId });
        if (selectedRepository.requiresInitialization) throw new Error("The invited repository is missing its PlotPickle manifest and cannot be initialized by a collaborator.");
        await request("/api/local-github/connection/check", "POST");
      }
      const result = await request("/api/local-collaboration/validate-invitation", "POST", { invitation: parsed });
      const active = result.session as CollaborationSession; setNotice(`${COLLABORATION_ROLE_DEFAULTS[parsed.invitation.role].label} invitation accepted. Opening the role workspace.`); await refresh(); announce(active);
      window.location.href = active.workspaceHref;
    } catch (error) { setNotice(error instanceof Error ? error.message : "The .ppinvite package could not be accepted."); } finally { setBusy(false); if (file.current) file.current.value = ""; }
  }
  async function createInvite() {
    setBusy(true); try {
      const result = await request("/api/local-collaboration/create-invitation", "POST", { expectedRemoteCommit: value.remoteCommit, role, recipientName: recipient, issuer, expiresAt: new Date(Date.now() + days * 86_400_000).toISOString() });
      download(result.invitation as CollaborationInvitation); setRecipient(""); setNotice(`Created a credential-free ${COLLABORATION_ROLE_DEFAULTS[role].label} invitation.`); await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "The invitation could not be created."); } finally { setBusy(false); }
  }
  async function toggleProposals() {
    setBusy(true); try { await request("/api/local-collaboration/accepting-proposals", "POST", { expectedRemoteCommit: value.remoteCommit, acceptingProposals: !value.acceptingProposals }); setNotice(value.acceptingProposals ? "New Story Proposals are paused. Approved-story refresh and local work remain available." : "The story project is accepting new Story Proposals."); await refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "The proposal setting could not be changed."); } finally { setBusy(false); }
  }
  async function revoke(invitationId: string) {
    setBusy(true); try { await request("/api/local-collaboration/revoke-invitation", "POST", { expectedRemoteCommit: value.remoteCommit, invitationId }); setNotice("The invitation was revoked."); await refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "The invitation could not be revoked."); } finally { setBusy(false); }
  }
  async function leaveRole() { await request("/api/local-collaboration/session", "DELETE"); setNotice("This computer returned to Project Lead mode. GitHub credentials and local story files were kept."); await refresh(); }
  const active = value.session; const isLead = value.projectLead;
  return <div data-plotpickle-collaboration-ui className={styles.host}>
    <button type="button" className={styles.launcher} onClick={() => setOpen(true)}><span aria-hidden="true">◎</span>{active ? COLLABORATION_ROLE_DEFAULTS[active.role as CollaborationRole]?.label || "Collaboration" : "Collaboration"}</button>
    {active?.readOnlyReview ? <div className={styles.reviewBanner}><strong>Reviewer read-only mode</strong><span>Canon editing and Story Proposals are locked. Feedback remains available.</span><a href={active.workspaceHref}>Open Feedback</a></div> : null}
    {open ? <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="PlotPickle collaboration invitations">
        <header><div><p>Invitations and collaborator roles</p><h2>{active ? `${active.projectTitle} · ${active.role}` : value.connected ? value.title || value.repository : "Connect a story project"}</h2><span>.ppinvite packages contain bounded project identity, role and expiry—never GitHub credentials. No repository metadata needs to be typed.</span></div><button type="button" onClick={() => setOpen(false)}>Close</button></header>
        {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
        <div className={styles.connection}><span>{value.connected ? "GitHub ready" : "GitHub not connected"}</span><code>{value.repository || "Use Settings → GitHub to connect"}</code>{value.remoteCommit ? <small>Approved {value.branch} · {value.remoteCommit.slice(0, 12)}</small> : null}</div>
        <div className={styles.actions}><input ref={file} hidden type="file" accept=".ppinvite,application/json" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void importInvite(selected); }} /><button type="button" className={styles.primary} disabled={busy} onClick={() => file.current?.click()}>Open .ppinvite</button>{active ? <a href={active.workspaceHref}>Open {COLLABORATION_ROLE_DEFAULTS[active.role as CollaborationRole]?.label || "role"} workspace</a> : null}{active && value.projectLead ? <button type="button" disabled={busy} onClick={() => void leaveRole()}>Return to Project Lead mode</button> : null}</div>
        {isLead && value.connected ? <>
          <div className={styles.setting}><div><strong>Accepting Proposals</strong><span>Pause submissions without disabling approved-story refresh or local work.</span></div><button type="button" disabled={busy || !value.remoteCommit} className={value.acceptingProposals ? styles.on : styles.off} onClick={() => void toggleProposals()}>{value.acceptingProposals ? "On" : "Paused"}</button></div>
          <div className={styles.form}><label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as CollaborationRole)}>{COLLABORATION_ROLES.map((item) => <option key={item} value={item}>{COLLABORATION_ROLE_DEFAULTS[item].label}</option>)}</select></label><label><span>Collaborator name</span><input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Optional" /></label><label><span>Issued by</span><input value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label><label><span>Expires</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label></div>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={busy || !value.remoteCommit} onClick={() => void createInvite()}>Create .ppinvite</button></div>
          <div className={styles.list}>{value.invitations.length ? value.invitations.map((item) => <article key={item.invitationId}><div><strong>{COLLABORATION_ROLE_DEFAULTS[item.role].label}{item.recipientName ? ` · ${item.recipientName}` : ""}</strong><span>{item.status === "revoked" ? "Revoked" : `Expires ${item.expiresAt}`}</span><code>{item.invitationId}</code></div>{item.status === "active" ? <button type="button" disabled={busy} onClick={() => void revoke(item.invitationId)}>Revoke</button> : null}</article>) : <p>No invitations registered yet.</p>}</div>
        </> : null}
      </section>
    </div> : null}
  </div>;
}
