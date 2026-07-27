"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COLLABORATION_ROLE_PROFILES,
  collaborationRoleProfile,
  type CollaborationPolicy,
  type CollaborationRole,
  type PlotPickleInvitation,
} from "@/lib/collaboration-invitations";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./collaboration-invitations.module.css";

export type CollaborationAccess = {
  connected: boolean;
  role: CollaborationRole | null;
  roleLabel: string;
  isProjectLead: boolean;
  readOnly: boolean;
  canSubmitProposals: boolean;
  acceptingProposals: boolean;
  verificationState: string;
  verificationMessage: string;
  remoteCommit: string;
  primaryWorkspace: string;
  workspaceDefaults: string[];
  invitationId: string;
  recipientName: string;
  projectTitle: string;
  revokedInvitationIds: string[];
};

type CreatedInvitation = {
  invitation: PlotPickleInvitation;
  fileName: string;
  content: string;
};

type JsonError = Error & { response?: Record<string, unknown> };

const LEAD_ACCESS: CollaborationAccess = {
  connected: false,
  role: null,
  roleLabel: "Project Lead",
  isProjectLead: true,
  readOnly: false,
  canSubmitProposals: true,
  acceptingProposals: true,
  verificationState: "lead",
  verificationMessage: "",
  remoteCommit: "",
  primaryWorkspace: "/",
  workspaceDefaults: ["/", "/settings"],
  invitationId: "",
  recipientName: "",
  projectTitle: "",
  revokedInvitationIds: [],
};

async function request(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("Collaboration invitations are available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof value.message === "string" ? value.message : "The collaboration invitation operation failed.") as JsonError;
    error.response = value;
    throw error;
  }
  return value;
}

function invitationFromStatus(value: Record<string, unknown>) {
  const state = value.invitation && typeof value.invitation === "object" ? value.invitation as Record<string, unknown> : null;
  const invitation = state?.invitation && typeof state.invitation === "object" ? state.invitation as PlotPickleInvitation : null;
  return invitation;
}

function policyFromStatus(value: Record<string, unknown>) {
  return value.policy && typeof value.policy === "object" ? value.policy as CollaborationPolicy : null;
}

function accessFromStatus(value: Record<string, unknown>): CollaborationAccess {
  const invitation = invitationFromStatus(value);
  const policy = policyFromStatus(value);
  const role = invitation?.role ?? null;
  const profile = role ? collaborationRoleProfile(role) : null;
  const verificationState = typeof value.verificationState === "string" ? value.verificationState : role ? "imported" : "lead";
  const verified = !role || verificationState === "verified";
  const acceptingProposals = policy?.acceptingProposals !== false;
  const roleCanSubmit = role ? Boolean(value.canSubmitProposals) && profile?.canSubmitProposals !== false : true;
  return {
    connected: Boolean(value.connected),
    role,
    roleLabel: profile?.label || "Project Lead",
    isProjectLead: !role,
    readOnly: Boolean(value.readOnly) || profile?.readOnly === true,
    canSubmitProposals: verified && roleCanSubmit && acceptingProposals,
    acceptingProposals,
    verificationState,
    verificationMessage: typeof value.verificationMessage === "string" ? value.verificationMessage : "",
    remoteCommit: typeof value.remoteCommit === "string" ? value.remoteCommit : "",
    primaryWorkspace: profile?.primaryWorkspace || "/",
    workspaceDefaults: invitation?.workspaceDefaults?.length ? [...invitation.workspaceDefaults] : profile ? [...profile.workspaceDefaults] : ["/", "/settings"],
    invitationId: invitation?.invitationId || "",
    recipientName: invitation?.recipientName || "",
    projectTitle: invitation?.project.title || "",
    revokedInvitationIds: policy?.revokedInvitationIds ? [...policy.revokedInvitationIds] : [],
  };
}

function downloadInvitation(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/vnd.plotpickle.invitation+json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function defaultExpiry() {
  const value = new Date();
  value.setDate(value.getDate() + 30);
  return value.toISOString().slice(0, 10);
}

function expiryIso(value: string) {
  if (!value) return "";
  return new Date(`${value}T23:59:59`).toISOString();
}

function workspaceLabel(path: string) {
  const names: Record<string, string> = {
    "/": "Dashboard",
    "/write": "Write",
    "/build": "Build",
    "/feedback": "Feedback",
    "/read-learn": "Read & Learn",
    "/storyboard": "Storyboard",
    "/production": "Production",
    "/read": "Read",
    "/table-read": "Table Read",
    "/characters": "Characters",
    "/reports": "Reports",
    "/dashboard": "Dashboard",
    "/settings": "Settings",
  };
  return names[path] || path.replace(/^\//, "").replace(/-/g, " ") || "Dashboard";
}

export default function CollaborationInvitations({
  project,
  ready,
  onNotice,
  onAccessChange,
}: {
  project: PlotPickleProject;
  ready: boolean;
  onNotice: (message: string) => void;
  onAccessChange: (access: CollaborationAccess) => void;
}) {
  const [access, setAccess] = useState<CollaborationAccess>(LEAD_ACCESS);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<CollaborationRole>("writer");
  const [recipientName, setRecipientName] = useState("");
  const [issuerName, setIssuerName] = useState("");
  const [expiresOn, setExpiresOn] = useState(defaultExpiry);
  const [note, setNote] = useState("");
  const [revokeId, setRevokeId] = useState("");
  const [created, setCreated] = useState<CreatedInvitation | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeProfile = useMemo(() => collaborationRoleProfile(role), [role]);

  function publish(next: CollaborationAccess) {
    setAccess(next);
    onAccessChange(next);
  }

  async function loadStatus() {
    try {
      const value = await request("/api/local-collaboration/status");
      publish(accessFromStatus(value));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Collaboration role status could not be loaded.";
      onNotice(message);
      publish({ ...LEAD_ACCESS, connected: ready });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStatus(); }, 0);
    return () => window.clearTimeout(timer);
    // Reload when the repository reaches or loses the Ready state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function createInvitation() {
    setBusy(true);
    try {
      const value = await request("/api/local-collaboration/create-invitation", "POST", {
        role,
        recipientName,
        issuerName,
        expiresAt: expiryIso(expiresOn),
        note,
      });
      const invitation = value.invitation as PlotPickleInvitation;
      const result: CreatedInvitation = {
        invitation,
        fileName: String(value.fileName || "PlotPickle.ppinvite"),
        content: String(value.content || ""),
      };
      setCreated(result);
      downloadInvitation(result.fileName, result.content);
      onNotice(`${activeProfile.label} invitation created for ${invitation.recipientName}. The .ppinvite contains no credentials.`);
      await loadStatus();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The collaboration invitation could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function tryAutomaticRepositorySelection(invitation: PlotPickleInvitation) {
    try {
      const status = await request("/api/local-github-app/status");
      if (!status.authenticated) return false;
      const selection = await request("/api/local-github-app/select", "POST", {
        fullName: `${invitation.repository.owner}/${invitation.repository.repo}`,
        projectPath: invitation.repository.projectRoot,
        initializeMissingManifest: false,
        projectId: invitation.project.id,
        title: invitation.project.title,
      });
      if (selection.requiresInitialization) throw new Error("The invited repository is missing its PlotPickle project manifest. Ask the Project Lead to repair the repository setup.");
      await request("/api/local-github/connection/check", "POST");
      return true;
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The invited story repository could not be selected automatically.");
      return false;
    }
  }

  async function importInvitation(file: File) {
    if (!/\.ppinvite$/i.test(file.name)) throw new Error("Choose a PlotPickle .ppinvite file.");
    if (file.size > 2 * 1024 * 1024) throw new Error("The PlotPickle invitation file is unexpectedly large.");
    const value = await request("/api/local-collaboration/import", "POST", { content: await file.text() });
    const state = value.invitation && typeof value.invitation === "object" ? value.invitation as Record<string, unknown> : {};
    const invitation = state.invitation as PlotPickleInvitation;
    const connected = await tryAutomaticRepositorySelection(invitation);
    await loadStatus();
    const profile = collaborationRoleProfile(invitation.role);
    onNotice(connected
      ? `${profile.label} invitation accepted. PlotPickle selected the story repository without asking for repository metadata.`
      : `${profile.label} invitation accepted. Connect your GitHub account above; PlotPickle will use the repository details already inside the invitation.`);
  }

  async function chooseInvitation(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await importInvitation(file);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The PlotPickle invitation could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  async function removeInvitation() {
    if (!window.confirm("Remove the accepted collaboration role from this computer? The story project and GitHub account will remain connected.")) return;
    setBusy(true);
    try {
      await request("/api/local-collaboration/invitation", "DELETE");
      setCreated(null);
      publish({ ...LEAD_ACCESS, connected: ready });
      onNotice("The local collaboration invitation was removed. This computer is no longer using a collaborator role.");
      await loadStatus();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The local collaboration role could not be removed.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePolicy(patch: { acceptingProposals?: boolean; revokeInvitationId?: string; restoreInvitationId?: string }) {
    setBusy(true);
    try {
      await request("/api/local-collaboration/policy", "POST", {
        expectedRemoteCommit: access.remoteCommit,
        ...patch,
      });
      setRevokeId("");
      await loadStatus();
      onNotice(patch.acceptingProposals === false
        ? "New Story Proposals are paused. Local work and approved-story refresh remain available."
        : patch.acceptingProposals === true
          ? "The project is accepting new Story Proposals again."
          : patch.restoreInvitationId
            ? "The invitation ID was restored."
            : "The invitation ID was revoked.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "The collaboration policy could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div>
          <p>Invitations and roles</p>
          <h3>{access.isProjectLead ? "Project Lead collaboration controls" : `${access.roleLabel} workspace`}</h3>
          <span>{access.isProjectLead
            ? "Create credential-free invitations, control whether new Story Proposals are accepted and revoke invitation IDs without exposing GitHub terminology to collaborators."
            : `This computer is using the ${access.roleLabel} defaults supplied by the Project Lead. Repository owner, branch and canonical path details are handled automatically.`}</span>
        </div>
        <div className={`${styles.modeBadge} ${access.readOnly ? styles.readOnlyBadge : access.isProjectLead ? styles.leadBadge : styles.contributorBadge}`}>
          {access.readOnly ? "Read-only review" : access.isProjectLead ? "Project Lead" : access.roleLabel}
        </div>
      </header>

      {!access.isProjectLead ? (
        <div className={styles.roleWorkspace}>
          <div>
            <strong>{access.recipientName || "Invited collaborator"}</strong>
            <span>{access.projectTitle || project.metadata.title}</span>
            <small>{access.verificationState === "verified" ? "Invitation verified against the connected repository" : access.verificationMessage || "Connect the invited repository to complete verification"}</small>
          </div>
          <nav aria-label="Role workspace shortcuts">
            {access.workspaceDefaults.map((path, index) => <a key={`${path}-${index}`} href={path} className={index === 0 ? styles.primaryLink : ""}>{workspaceLabel(path)}</a>)}
          </nav>
          {access.readOnly ? <p className={styles.boundary}>Reviewer mode is read-only for canonical project changes. Approved-story refresh and bounded feedback remain available.</p> : null}
          <button type="button" disabled={busy} onClick={() => void removeInvitation()}>Remove this role from this computer</button>
        </div>
      ) : null}

      <div className={styles.importRow}>
        <div><strong>Open a .ppinvite</strong><span>The invitation supplies the project, role and repository location. It never contains a token, password or API key.</span></div>
        <input ref={fileRef} className={styles.hiddenInput} type="file" accept=".ppinvite,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void chooseInvitation(file); }} />
        <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => fileRef.current?.click()}>Choose invitation</button>
      </div>

      {access.isProjectLead ? (
        <div className={styles.leadGrid}>
          <div className={styles.card}>
            <div><strong>Create an invitation</strong><p>The collaborator sees a role-first onboarding path. GitHub repository fields remain hidden during normal setup.</p></div>
            <div className={styles.form}>
              <label><span>Collaborator name</span><input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Name shown in the invitation" /></label>
              <label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as CollaborationRole)}>{COLLABORATION_ROLE_PROFILES.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}</select></label>
              <label><span>Expires on</span><input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /></label>
              <label><span>Issued by</span><input value={issuerName} onChange={(event) => setIssuerName(event.target.value)} placeholder="Project Lead" /></label>
              <label className={styles.wide}><span>Welcome note</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What this collaborator should focus on and how proposals will be reviewed." /></label>
            </div>
            <div className={styles.rolePreview}><b>{activeProfile.label}</b><span>{activeProfile.description}</span><small>{activeProfile.readOnly ? "Read-only canonical access" : "May edit locally"} · {activeProfile.canSubmitProposals ? "May submit proposals" : "No proposal submission"}</small></div>
            <button type="button" className={styles.primaryButton} disabled={!ready || busy || !recipientName.trim() || !expiresOn} onClick={() => void createInvitation()}>Create and download .ppinvite</button>
            {created ? <div className={styles.created}><span>Invitation ID</span><code>{created.invitation.invitationId}</code><button type="button" disabled={busy} onClick={() => void updatePolicy({ revokeInvitationId: created.invitation.invitationId })}>Revoke this invitation</button></div> : null}
          </div>

          <div className={styles.card}>
            <div><strong>Project proposal policy</strong><p>This setting is canonical and shared through <code>project/collaboration/policy.json</code>. It does not store collaborator credentials.</p></div>
            <label className={styles.toggle}>
              <span><b>Accepting Proposals</b><small>Turn this off to pause new submissions without blocking local work or approved-story refresh.</small></span>
              <input type="checkbox" checked={access.acceptingProposals} disabled={!ready || busy || !access.remoteCommit} onChange={(event) => void updatePolicy({ acceptingProposals: event.target.checked })} />
            </label>
            <div className={styles.revokeForm}>
              <label><span>Invitation ID to revoke</span><input value={revokeId} onChange={(event) => setRevokeId(event.target.value)} placeholder="Paste an invitation ID" /></label>
              <button type="button" disabled={!ready || busy || !revokeId.trim()} onClick={() => void updatePolicy({ revokeInvitationId: revokeId.trim() })}>Revoke ID</button>
            </div>
            <div className={styles.revokedList}>
              <strong>Revoked invitation IDs</strong>
              {access.revokedInvitationIds.length ? access.revokedInvitationIds.map((id) => <div key={id}><code>{id}</code><button type="button" disabled={busy} onClick={() => void updatePolicy({ restoreInvitationId: id })}>Restore</button></div>) : <p>No invitation IDs are revoked.</p>}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
