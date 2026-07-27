import type { PlotPickleProject, ProjectCollaborationRole } from "./project";

export const COLLABORATION_INVITATION_FORMAT = "plotpickle-invitation" as const;
export const COLLABORATION_INVITATION_VERSION = 1 as const;

export const INVITABLE_COLLABORATION_ROLES = ["writer", "director", "actor", "producer", "reviewer"] as const;
export type InvitableCollaborationRole = typeof INVITABLE_COLLABORATION_ROLES[number];
export type CollaborationRoleWorkspace = "script" | "visuals" | "feedback" | "reports";

export type CollaborationRoleDefaults = {
  role: ProjectCollaborationRole;
  label: string;
  description: string;
  defaultWorkspace: CollaborationRoleWorkspace;
  workspaceHref: string;
  readOnlyReview: boolean;
  canSubmitProposals: boolean;
};

export const COLLABORATION_ROLE_DEFAULTS: Record<InvitableCollaborationRole, CollaborationRoleDefaults> = {
  writer: {
    role: "writer",
    label: "Writer",
    description: "Start in Write with Plan, Build, Refine and Feedback close by.",
    defaultWorkspace: "script",
    workspaceHref: "/?workspace=1&tab=script&view=writer",
    readOnlyReview: false,
    canSubmitProposals: true,
  },
  director: {
    role: "director",
    label: "Director",
    description: "Start in Storyboard with production notes and Feedback available.",
    defaultWorkspace: "visuals",
    workspaceHref: "/?workspace=1&tab=planner&section=storyboard",
    readOnlyReview: false,
    canSubmitProposals: true,
  },
  actor: {
    role: "actor",
    label: "Actor",
    description: "Start in Feedback and Table Read with character context visible.",
    defaultWorkspace: "feedback",
    workspaceHref: "/?workspace=1&tab=feedback&section=table-read",
    readOnlyReview: false,
    canSubmitProposals: true,
  },
  producer: {
    role: "producer",
    label: "Producer",
    description: "Start in Reports with production planning and approvals available.",
    defaultWorkspace: "reports",
    workspaceHref: "/?workspace=1&tab=reports&section=production",
    readOnlyReview: false,
    canSubmitProposals: true,
  },
  reviewer: {
    role: "reviewer",
    label: "Reviewer",
    description: "Start in Feedback. Review notes remain available while canon editing and Story Proposal submission stay locked.",
    defaultWorkspace: "feedback",
    workspaceHref: "/?workspace=1&tab=feedback&section=human-review",
    readOnlyReview: true,
    canSubmitProposals: false,
  },
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
    role: InvitableCollaborationRole;
    recipientName: string;
    issuer: string;
    issuedAt: string;
    expiresAt: string;
  };
  defaults: {
    defaultWorkspace: CollaborationRoleWorkspace;
    readOnlyReview: boolean;
    canSubmitProposals: boolean;
  };
};

export type CollaborationInvitation = CollaborationInvitationPayload & { integrity: string };

export type CollaborationInvitationRegistryRecord = {
  invitationId: string;
  role: InvitableCollaborationRole;
  recipientName: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  status: "active" | "revoked";
  revokedAt?: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
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

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function invitationRole(value: unknown): InvitableCollaborationRole {
  if (typeof value !== "string" || !INVITABLE_COLLABORATION_ROLES.includes(value as InvitableCollaborationRole)) {
    throw new Error("The PlotPickle invitation contains an unsupported collaborator role.");
  }
  return value as InvitableCollaborationRole;
}

function nonEmpty(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(message);
  return value.trim();
}

function isoDate(value: unknown, message: string) {
  const source = nonEmpty(value, message);
  const timestamp = Date.parse(source);
  if (!Number.isFinite(timestamp)) throw new Error(message);
  return new Date(timestamp).toISOString();
}

export function createCollaborationInvitation(input: {
  invitationId: string;
  projectId: string;
  title: string;
  repositoryUrl: string;
  owner: string;
  repo: string;
  approvedBranch: string;
  canonicalRoot: string;
  role: InvitableCollaborationRole;
  recipientName?: string;
  issuer: string;
  issuedAt?: string;
  expiresAt: string;
}): CollaborationInvitation {
  const defaults = COLLABORATION_ROLE_DEFAULTS[input.role];
  const payload: CollaborationInvitationPayload = {
    format: COLLABORATION_INVITATION_FORMAT,
    formatVersion: COLLABORATION_INVITATION_VERSION,
    invitationId: nonEmpty(input.invitationId, "A PlotPickle invitation ID is required."),
    project: {
      projectId: nonEmpty(input.projectId, "A PlotPickle project ID is required."),
      title: nonEmpty(input.title, "A PlotPickle project title is required."),
      repositoryUrl: nonEmpty(input.repositoryUrl, "A GitHub story-project address is required."),
      owner: nonEmpty(input.owner, "A GitHub story-project owner is required."),
      repo: nonEmpty(input.repo, "A GitHub story-project repository is required."),
      approvedBranch: nonEmpty(input.approvedBranch, "An approved branch is required."),
      canonicalRoot: nonEmpty(input.canonicalRoot, "A canonical project root is required."),
    },
    invitation: {
      role: input.role,
      recipientName: input.recipientName?.trim() || "",
      issuer: nonEmpty(input.issuer, "An invitation issuer is required."),
      issuedAt: isoDate(input.issuedAt || new Date().toISOString(), "The invitation issue date is invalid."),
      expiresAt: isoDate(input.expiresAt, "The invitation expiry date is invalid."),
    },
    defaults: {
      defaultWorkspace: defaults.defaultWorkspace,
      readOnlyReview: defaults.readOnlyReview,
      canSubmitProposals: defaults.canSubmitProposals,
    },
  };
  if (Date.parse(payload.invitation.expiresAt) <= Date.parse(payload.invitation.issuedAt)) {
    throw new Error("The PlotPickle invitation must expire after it is issued.");
  }
  return { ...payload, integrity: digest(payload) };
}

export function serializeCollaborationInvitation(invitation: CollaborationInvitation) {
  return `${JSON.stringify(invitation, null, 2)}\n`;
}

export function parseCollaborationInvitation(
  value: unknown,
  options: {
    now?: string;
    expectedProjectId?: string;
    expectedOwner?: string;
    expectedRepo?: string;
    expectedBranch?: string;
    revokedInvitationIds?: string[];
  } = {},
): CollaborationInvitation {
  const source = record(value, "The selected file is not a PlotPickle invitation.");
  if (source.format !== COLLABORATION_INVITATION_FORMAT || source.formatVersion !== COLLABORATION_INVITATION_VERSION) {
    throw new Error("This file is not a supported PlotPickle .ppinvite package.");
  }
  const project = record(source.project, "The PlotPickle invitation is missing its project identity.");
  const invitation = record(source.invitation, "The PlotPickle invitation is missing its collaborator details.");
  const parsed = createCollaborationInvitation({
    invitationId: nonEmpty(source.invitationId, "The PlotPickle invitation ID is missing."),
    projectId: nonEmpty(project.projectId, "The PlotPickle invitation project ID is missing."),
    title: nonEmpty(project.title, "The PlotPickle invitation project title is missing."),
    repositoryUrl: nonEmpty(project.repositoryUrl, "The PlotPickle invitation repository address is missing."),
    owner: nonEmpty(project.owner, "The PlotPickle invitation repository owner is missing."),
    repo: nonEmpty(project.repo, "The PlotPickle invitation repository name is missing."),
    approvedBranch: nonEmpty(project.approvedBranch, "The PlotPickle invitation approved branch is missing."),
    canonicalRoot: nonEmpty(project.canonicalRoot, "The PlotPickle invitation canonical root is missing."),
    role: invitationRole(invitation.role),
    recipientName: typeof invitation.recipientName === "string" ? invitation.recipientName : "",
    issuer: nonEmpty(invitation.issuer, "The PlotPickle invitation issuer is missing."),
    issuedAt: isoDate(invitation.issuedAt, "The PlotPickle invitation issue date is invalid."),
    expiresAt: isoDate(invitation.expiresAt, "The PlotPickle invitation expiry date is invalid."),
  });
  if (source.integrity !== parsed.integrity) throw new Error("The PlotPickle invitation failed its integrity check and may have been changed.");
  const now = Date.parse(options.now || new Date().toISOString());
  if (!Number.isFinite(now)) throw new Error("The invitation validation time is invalid.");
  if (now >= Date.parse(parsed.invitation.expiresAt)) throw new Error("This PlotPickle invitation has expired.");
  if (options.expectedProjectId && parsed.project.projectId !== options.expectedProjectId) throw new Error("This PlotPickle invitation belongs to a different story project.");
  if (options.expectedOwner && parsed.project.owner !== options.expectedOwner) throw new Error("This PlotPickle invitation belongs to a different repository owner.");
  if (options.expectedRepo && parsed.project.repo !== options.expectedRepo) throw new Error("This PlotPickle invitation belongs to a different story repository.");
  if (options.expectedBranch && parsed.project.approvedBranch !== options.expectedBranch) throw new Error("This PlotPickle invitation targets a different approved branch.");
  if (options.revokedInvitationIds?.includes(parsed.invitationId)) throw new Error("This PlotPickle invitation has been revoked.");
  return parsed;
}

export function invitationMatchesRegistryRecord(invitation: CollaborationInvitation, record: CollaborationInvitationRegistryRecord) {
  return invitation.invitationId === record.invitationId
    && invitation.invitation.role === record.role
    && invitation.invitation.recipientName === record.recipientName
    && invitation.invitation.issuer === record.issuer
    && invitation.invitation.issuedAt === record.issuedAt
    && invitation.invitation.expiresAt === record.expiresAt;
}

export function applyCollaborationInvitation(project: PlotPickleProject, invitation: CollaborationInvitation): PlotPickleProject {
  const defaults = COLLABORATION_ROLE_DEFAULTS[invitation.invitation.role];
  const now = new Date().toISOString();
  return {
    ...project,
    id: invitation.project.projectId,
    metadata: { ...project.metadata, title: invitation.project.title, updatedAt: now },
    collaboration: {
      ...project.collaboration,
      provider: "github",
      repositoryUrl: invitation.project.repositoryUrl,
      sourceRepositoryUrl: invitation.project.repositoryUrl,
      owner: invitation.project.owner,
      repo: invitation.project.repo,
      branch: invitation.project.approvedBranch,
      projectPath: invitation.project.canonicalRoot,
      syncEnabled: true,
      role: invitation.invitation.role,
      invitationId: invitation.invitationId,
      invitationRecipientName: invitation.invitation.recipientName,
      invitationIssuer: invitation.invitation.issuer,
      invitationIssuedAt: invitation.invitation.issuedAt,
      invitationExpiresAt: invitation.invitation.expiresAt,
      defaultWorkspace: defaults.defaultWorkspace,
      readOnlyReview: defaults.readOnlyReview,
      acceptingProposals: true,
      updatedAt: now,
    },
  };
}

export function collaborationCanSubmitProposal(project: PlotPickleProject) {
  if (!project.collaboration.acceptingProposals || project.collaboration.readOnlyReview) return false;
  return project.collaboration.role !== "reviewer";
}

export function collaborationCanEditCanon(project: PlotPickleProject) {
  return !project.collaboration.readOnlyReview && project.collaboration.role !== "reviewer";
}
