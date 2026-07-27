export const COLLABORATION_INVITATION_FORMAT = "plotpickle-invitation" as const;
export const COLLABORATION_INVITATION_VERSION = 1 as const;
export const COLLABORATION_ROLES = ["writer", "director", "actor", "producer", "reviewer"] as const;
export type CollaborationRole = typeof COLLABORATION_ROLES[number];
export type CollaborationWorkspace = "script" | "visuals" | "feedback" | "reports";

export type CollaborationRoleDefault = {
  role: CollaborationRole;
  label: string;
  description: string;
  defaultWorkspace: CollaborationWorkspace;
  workspaceHref: string;
  readOnlyReview: boolean;
  canSubmitProposals: boolean;
};

export const COLLABORATION_ROLE_DEFAULTS: Record<CollaborationRole, CollaborationRoleDefault> = {
  writer: { role: "writer", label: "Writer", description: "Write, Plan, Build and Refine the story.", defaultWorkspace: "script", workspaceHref: "/?workspace=1&tab=script&view=writer", readOnlyReview: false, canSubmitProposals: true },
  director: { role: "director", label: "Director", description: "Start with Storyboard, visuals and production intent.", defaultWorkspace: "visuals", workspaceHref: "/?workspace=1&tab=planner&section=storyboard", readOnlyReview: false, canSubmitProposals: true },
  actor: { role: "actor", label: "Actor", description: "Start with Feedback, character context and Table Read.", defaultWorkspace: "feedback", workspaceHref: "/?workspace=1&tab=feedback&section=table-read", readOnlyReview: false, canSubmitProposals: true },
  producer: { role: "producer", label: "Producer", description: "Start with Reports and production planning.", defaultWorkspace: "reports", workspaceHref: "/?workspace=1&tab=reports&section=production", readOnlyReview: false, canSubmitProposals: true },
  reviewer: { role: "reviewer", label: "Reviewer", description: "Review and leave Feedback without changing canon.", defaultWorkspace: "feedback", workspaceHref: "/?workspace=1&tab=feedback&section=human-review", readOnlyReview: true, canSubmitProposals: false },
};

export type CollaborationInvitationPayload = {
  format: typeof COLLABORATION_INVITATION_FORMAT;
  formatVersion: typeof COLLABORATION_INVITATION_VERSION;
  invitationId: string;
  project: {
    projectId: string;
    title: string;
    repositoryUrl: string;
    owner: string;
    repo: string;
    approvedBranch: string;
    canonicalRoot: string;
  };
  invitation: {
    role: CollaborationRole;
    recipientName: string;
    issuer: string;
    issuedAt: string;
    expiresAt: string;
  };
  defaults: {
    defaultWorkspace: CollaborationWorkspace;
    workspaceHref: string;
    readOnlyReview: boolean;
    canSubmitProposals: boolean;
  };
};

export type CollaborationInvitation = CollaborationInvitationPayload & { integrity: string };

export type CollaborationInvitationRecord = {
  invitationId: string;
  role: CollaborationRole;
  recipientName: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "revoked";
  revokedAt?: string;
};

export type CollaborationSession = {
  version: 1;
  repository: string;
  projectId: string;
  projectTitle: string;
  role: "project-lead" | CollaborationRole;
  invitationId: string;
  recipientName: string;
  expiresAt: string;
  defaultWorkspace: CollaborationWorkspace | "dashboard";
  workspaceHref: string;
  readOnlyReview: boolean;
  canSubmitProposals: boolean;
  validatedAt: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

function digest(value: unknown) {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(stable(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fnv1a64-${hash.toString(16).padStart(16, "0")}`;
}

function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
function text(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}
function iso(value: unknown, message: string) {
  const source = text(value, message);
  const time = Date.parse(source);
  if (!Number.isFinite(time)) throw new Error(message);
  return new Date(time).toISOString();
}
function role(value: unknown): CollaborationRole {
  if (typeof value !== "string" || !COLLABORATION_ROLES.includes(value as CollaborationRole)) throw new Error("The invitation contains an unsupported collaborator role.");
  return value as CollaborationRole;
}

export function createCollaborationInvitation(input: {
  invitationId: string; projectId: string; title: string; repositoryUrl: string; owner: string; repo: string;
  approvedBranch: string; canonicalRoot: string; role: CollaborationRole; recipientName?: string; issuer: string;
  issuedAt?: string; expiresAt: string;
}): CollaborationInvitation {
  const defaults = COLLABORATION_ROLE_DEFAULTS[input.role];
  const payload: CollaborationInvitationPayload = {
    format: COLLABORATION_INVITATION_FORMAT,
    formatVersion: COLLABORATION_INVITATION_VERSION,
    invitationId: text(input.invitationId, "An invitation ID is required."),
    project: {
      projectId: text(input.projectId, "A project ID is required."), title: text(input.title, "A project title is required."),
      repositoryUrl: text(input.repositoryUrl, "A repository address is required."), owner: text(input.owner, "A repository owner is required."),
      repo: text(input.repo, "A repository name is required."), approvedBranch: text(input.approvedBranch, "An approved branch is required."),
      canonicalRoot: text(input.canonicalRoot, "A canonical project root is required."),
    },
    invitation: {
      role: input.role, recipientName: input.recipientName?.trim() || "", issuer: text(input.issuer, "An invitation issuer is required."),
      issuedAt: iso(input.issuedAt || new Date().toISOString(), "The invitation issue date is invalid."), expiresAt: iso(input.expiresAt, "The invitation expiry is invalid."),
    },
    defaults: { defaultWorkspace: defaults.defaultWorkspace, workspaceHref: defaults.workspaceHref, readOnlyReview: defaults.readOnlyReview, canSubmitProposals: defaults.canSubmitProposals },
  };
  if (Date.parse(payload.invitation.expiresAt) <= Date.parse(payload.invitation.issuedAt)) throw new Error("The invitation must expire after it is issued.");
  return { ...payload, integrity: digest(payload) };
}

export function serializeCollaborationInvitation(invitation: CollaborationInvitation) { return `${JSON.stringify(invitation, null, 2)}\n`; }

export function parseCollaborationInvitation(value: unknown, options: { now?: string; expectedProjectId?: string; expectedRepository?: string; revokedIds?: string[] } = {}): CollaborationInvitation {
  const source = object(value, "The selected file is not a PlotPickle invitation.");
  if (source.format !== COLLABORATION_INVITATION_FORMAT || source.formatVersion !== COLLABORATION_INVITATION_VERSION) throw new Error("This file is not a supported .ppinvite package.");
  const project = object(source.project, "The invitation is missing its story-project identity.");
  const invitation = object(source.invitation, "The invitation is missing its collaborator details.");
  const parsed = createCollaborationInvitation({
    invitationId: text(source.invitationId, "The invitation ID is missing."), projectId: text(project.projectId, "The project ID is missing."),
    title: text(project.title, "The project title is missing."), repositoryUrl: text(project.repositoryUrl, "The repository address is missing."),
    owner: text(project.owner, "The repository owner is missing."), repo: text(project.repo, "The repository name is missing."),
    approvedBranch: text(project.approvedBranch, "The approved branch is missing."), canonicalRoot: text(project.canonicalRoot, "The canonical root is missing."),
    role: role(invitation.role), recipientName: typeof invitation.recipientName === "string" ? invitation.recipientName : "",
    issuer: text(invitation.issuer, "The issuer is missing."), issuedAt: iso(invitation.issuedAt, "The issue date is invalid."), expiresAt: iso(invitation.expiresAt, "The expiry is invalid."),
  });
  if (source.integrity !== parsed.integrity) throw new Error("The invitation failed its integrity check and may have been changed.");
  if (Date.parse(options.now || new Date().toISOString()) >= Date.parse(parsed.invitation.expiresAt)) throw new Error("This invitation has expired.");
  if (options.expectedProjectId && parsed.project.projectId !== options.expectedProjectId) throw new Error("This invitation belongs to a different story project.");
  if (options.expectedRepository && `${parsed.project.owner}/${parsed.project.repo}`.toLowerCase() !== options.expectedRepository.toLowerCase()) throw new Error("This invitation belongs to a different story repository.");
  if (options.revokedIds?.includes(parsed.invitationId)) throw new Error("This invitation has been revoked.");
  return parsed;
}

export function invitationMatchesRecord(invitation: CollaborationInvitation, record: CollaborationInvitationRecord) {
  return invitation.invitationId === record.invitationId && invitation.invitation.role === record.role
    && invitation.invitation.recipientName === record.recipientName && invitation.invitation.issuer === record.issuer
    && invitation.invitation.issuedAt === record.issuedAt && invitation.invitation.expiresAt === record.expiresAt;
}
