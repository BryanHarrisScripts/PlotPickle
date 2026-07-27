"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import {
  COLLABORATION_ROLE_DEFAULTS,
  INVITABLE_COLLABORATION_ROLES,
  applyCollaborationInvitation,
  parseCollaborationInvitation,
  serializeCollaborationInvitation,
  type CollaborationInvitation,
  type InvitableCollaborationRole,
} from "@/lib/collaboration-invitations";
import styles from "./collaboration-invitations.module.css";

type InvitationRecord = {
  invitationId: string;
  role: InvitableCollaborationRole;
  recipientName: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "revoked";
};

async function request(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) throw new Error("Collaboration invitations are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "The collaboration invitation operation failed.");
  return value;
}

function downloadInvitation(invitation: CollaborationInvitation) {
  const fileName = `${invitation.project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plotpickle"}-${invitation.invitation.role}.ppinvite`;
  const url = URL.createObjectURL(new Blob([serializeCollaborationInvitation(invitation)], { type: "application/vnd.plotpickle.invitation+json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function invitationRecords(value: unknown): InvitationRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const role = String(record.role) as InvitableCollaborationRole;
    if (!INVITABLE_COLLABORATION_ROLES.includes(role)) return [];
    return [{
      invitationId: String(record.invitationId ?? ""),
      role,
      recipientName: String(record.recipientName ?? ""),
      issuer: String(record.issuer ?? ""),
      issuedAt: String(record.issuedAt ?? ""),
      expiresAt: String(record.expiresAt ?? ""),
      status: record.status === "revoked" ? "revoked" : "active",
    }];
  });
}

export default function CollaborationInvitations({
  project,
  onChange,
  ready,
  onNotice,
  onOpenWorkspace,
}: {
  project: PlotPickleProject;
  onChange: (project: PlotPickleProject) => void;
  ready: boolean;
  onNotice: (message: string) => void;
  onOpenWorkspace?: (workspace: "script" | "visuals" | "feedback" | "reports") => void;
}) {
  const [role, setRole] = useState<InvitableCollaborationRole>("writer");
  const [recipientName, setRecipientName] = useState("");
  const [issuer, setIssuer] = useState(project.rights.projectOwner || "Project Lead");
  const [expiryDays, setExpiryDays] = useState(14);
  const [records, setRecords] = useState<InvitationRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const isProjectLead = project.collaboration.role === "project-lead";
  const defaults = project.collaboration.role === "project-lead"
    ? null
    : COLLABORATION_ROLE_DEFAULTS[project.collaboration.role as InvitableCollaborationRole];
  const revokedIds = useMemo(() => records.filter((record) => record.status === "revoked").map((record) => record.invitationId), [records]);

  async function loadSettings() {
    if (!ready) return;
    try {
      const invitationQuery = new URLSearchParams({
        invitationId: project.collaboration.invitationId,
        role: project.collaboration.role,
        recipientName: project.collaboration.invitationRecipientName,
        issuer: project.collaboration.invitationIssuer,
        issuedAt: project.collaboration.invitationIssuedAt,
        expiresAt: project.collaboration.invitationExpiresAt,
      });
      const value = await request(`/api/local-github/collaboration-settings?${invitationQuery.toString()}`);
      const acceptingProposals = value.acceptingProposals !== false;
      setRecords(invitationRecords(value.invitations));
      if (project.collaboration.acceptingProposals !== acceptingProposals) {
        onChange({
          ...project,
          collaboration: { ...project.collaboration, acceptingProposals, updatedAt: new Date().toISOString() },
        });
      }
      const invitationStatus = typeof value.currentInvitationStatus === "string" ? value.currentInvitationStatus : "";
      if (project.collaboration.invitationId && ["revoked", "expired", "missing", "changed"].includes(invitationStatus)) {
        onChange({
          ...project,
          collaboration: {
            ...project.collaboration,
            syncEnabled: false,
            readOnlyReview: true,
            acceptingProposals: false,
            updatedAt: new Date().toISOString(),
          },
        });
        onNotice(`This collaboration invitation is ${invitationStatus}. Local work remains available, but repository submissions are locked.`);
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Collaboration settings could not be loaded.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadSettings(); }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function setAcceptingProposals(value: boolean) {
    setBusy(true);
    try {
      const result = await request("/api/local-github/collaboration-settings", "POST", {
        expectedBaseCommit: project.collaboration.lastPulledCommit,
        acceptingProposals: value,
        projectRole: project.collaboration.role,
        callerInvitationId: project.collaboration.invitationId,
      });
      const remoteCommit = String(result.remoteCommit ?? "");
      onChange({
        ...project,
        collaboration: {
          ...project.collaboration,
          acceptingProposals: value,
          lastPulledCommit: remoteCommit || project.collaboration.lastPulledCommit,
          lastPushedCommit: remoteCommit || project.collaboration.lastPushedCommit,
          updatedAt: new Date().toISOString(),
        },
      });
      onNotice(value ? "The story project is accepting new Story Proposals." : "New Story Proposals are paused. Approved-story refresh and local work remain available.");
      await loadSettings();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The proposal setting could not be changed.");
    } finally { setBusy(false); }
  }

  async function createInvitation() {
    setBusy(true);
    try {
      const expiresAt = new Date(Date.now() + Math.max(1, expiryDays) * 86_400_000).toISOString();
      const value = await request("/api/local-github/create-invitation", "POST", {
        expectedBaseCommit: project.collaboration.lastPulledCommit,
        projectId: project.id,
        projectRole: project.collaboration.role,
        callerInvitationId: project.collaboration.invitationId,
        role,
        recipientName,
        issuer,
        expiresAt,
      });
      const invitation = value.invitation as CollaborationInvitation;
      downloadInvitation(invitation);
      const remoteCommit = String(value.remoteCommit ?? "");
      onChange({
        ...project,
        collaboration: {
          ...project.collaboration,
          lastPulledCommit: remoteCommit || project.collaboration.lastPulledCommit,
          lastPushedCommit: remoteCommit || project.collaboration.lastPushedCommit,
          updatedAt: new Date().toISOString(),
        },
      });
      setRecipientName("");
      onNotice(`Created a ${COLLABORATION_ROLE_DEFAULTS[role].label} invitation without credentials. The .ppinvite package is ready to share privately.`);
      await loadSettings();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The collaboration invitation could not be created.");
    } finally { setBusy(false); }
  }

  async function revokeInvitation(invitationId: string) {
    setBusy(true);
    try {
      const value = await request("/api/local-github/revoke-invitation", "POST", {
        expectedBaseCommit: project.collaboration.lastPulledCommit,
        invitationId,
        projectId: project.id,
        projectRole: project.collaboration.role,
        callerInvitationId: project.collaboration.invitationId,
      });
      const remoteCommit = String(value.remoteCommit ?? "");
      onChange({
        ...project,
        collaboration: {
          ...project.collaboration,
          lastPulledCommit: remoteCommit || project.collaboration.lastPulledCommit,
          lastPushedCommit: remoteCommit || project.collaboration.lastPushedCommit,
          updatedAt: new Date().toISOString(),
        },
      });
      onNotice("The invitation was revoked. Connected collaborators will be locked from new submissions when PlotPickle rechecks the story project.");
      await loadSettings();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The collaboration invitation could not be revoked.");
    } finally { setBusy(false); }
  }

  async function importInvitation(file: File) {
    setBusy(true);
    try {
      let parsed = parseCollaborationInvitation(JSON.parse(await file.text()), {
        expectedProjectId: project.collaboration.repo ? project.id : undefined,
        revokedInvitationIds: revokedIds,
      });
      let acceptingProposals = true;
      if (ready && project.collaboration.repo) {
        const validated = await request("/api/local-github/validate-invitation", "POST", { invitation: parsed });
        parsed = validated.invitation as CollaborationInvitation;
        acceptingProposals = validated.acceptingProposals !== false;
      }
      const next = applyCollaborationInvitation(project, parsed);
      next.collaboration.acceptingProposals = acceptingProposals;
      onChange(next);
      const roleDefaults = COLLABORATION_ROLE_DEFAULTS[parsed.invitation.role];
      onOpenWorkspace?.(roleDefaults.defaultWorkspace);
      onNotice(`${roleDefaults.label} invitation accepted. Repository details were applied without asking the collaborator to enter them manually.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The selected .ppinvite package could not be accepted.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className={styles.panel}>
      <header>
        <div>
          <p>Invitations and roles</p>
          <h3>{isProjectLead ? "Invite collaborators without exposing GitHub setup" : `${defaults?.label || "Collaborator"} workspace`}</h3>
          <span>.ppinvite packages contain bounded story-project identity, role and expiry information—never credentials. Normal onboarding hides repository fields and applies role-appropriate defaults.</span>
        </div>
        <div className={styles.actions}>
          <input ref={fileInput} className={styles.fileInput} type="file" accept=".ppinvite,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importInvitation(file); }} />
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>Open .ppinvite</button>
          {defaults ? <a className={styles.primaryLink} href={defaults.workspaceHref}>Open {defaults.label} start</a> : null}
        </div>
      </header>

      {project.collaboration.invitationId ? (
        <div className={styles.roleBanner}>
          <div><strong>{defaults?.label || project.collaboration.role}</strong><span>{defaults?.description}</span></div>
          <dl>
            <div><dt>Invitation</dt><dd>{project.collaboration.invitationId}</dd></div>
            <div><dt>Collaborator</dt><dd>{project.collaboration.invitationRecipientName || "Not named"}</dd></div>
            <div><dt>Issued by</dt><dd>{project.collaboration.invitationIssuer || "Project Lead"}</dd></div>
            <div><dt>Issued</dt><dd>{project.collaboration.invitationIssuedAt || "Not recorded"}</dd></div>
            <div><dt>Expires</dt><dd>{project.collaboration.invitationExpiresAt || "Not recorded"}</dd></div>
            <div><dt>Mode</dt><dd>{project.collaboration.readOnlyReview ? "Read-only review" : "Proposal contributor"}</dd></div>
          </dl>
        </div>
      ) : null}

      {isProjectLead ? (
        <>
          <div className={styles.settingRow}>
            <div><strong>Accepting Proposals</strong><span>Pause new submissions without disabling approved-story refresh or anyone’s local work.</span></div>
            <button type="button" className={project.collaboration.acceptingProposals ? styles.on : styles.off} disabled={!ready || busy} onClick={() => void setAcceptingProposals(!project.collaboration.acceptingProposals)}>{project.collaboration.acceptingProposals ? "On" : "Paused"}</button>
          </div>
          <div className={styles.form}>
            <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as InvitableCollaborationRole)}>{INVITABLE_COLLABORATION_ROLES.map((item) => <option key={item} value={item}>{COLLABORATION_ROLE_DEFAULTS[item].label}</option>)}</select></label>
            <label><span>Collaborator name</span><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Optional name" /></label>
            <label><span>Issued by</span><input value={issuer} onChange={(event) => setIssuer(event.target.value)} /></label>
            <label><span>Expires after</span><select value={expiryDays} onChange={(event) => setExpiryDays(Number(event.target.value))}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label>
          </div>
          <div className={styles.actions}><button type="button" className={styles.primary} disabled={!ready || busy || !project.collaboration.lastPulledCommit} onClick={() => void createInvitation()}>Create .ppinvite</button></div>
          <div className={styles.list}>
            {records.length ? records.map((record) => (
              <article key={record.invitationId}>
                <div><strong>{COLLABORATION_ROLE_DEFAULTS[record.role].label}{record.recipientName ? ` · ${record.recipientName}` : ""}</strong><span>{record.status === "revoked" ? "Revoked" : `Expires ${record.expiresAt}`}</span><code>{record.invitationId}</code></div>
                {record.status === "active" ? <button type="button" disabled={busy} onClick={() => void revokeInvitation(record.invitationId)}>Revoke</button> : null}
              </article>
            )) : <p>No invitation packages have been registered for this story project.</p>}
          </div>
        </>
      ) : (
        <p className={styles.help}>Repository owner, repository name, approved branch and canonical root came from the invitation package. GitHub account authorization remains separate and credentials stay in the private local secrets folder.</p>
      )}
    </section>
  );
}
