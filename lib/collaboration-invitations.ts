export const PLOTPICKLE_INVITATION_FORMAT = "plotpickle-invitation" as const;
export const PLOTPICKLE_INVITATION_VERSION = "1.0.0" as const;
export const PLOTPICKLE_COLLABORATION_POLICY_FORMAT = "plotpickle-collaboration-policy" as const;
export const PLOTPICKLE_COLLABORATION_POLICY_VERSION = "1.0.0" as const;

export type CollaborationRole = "writer" | "director" | "actor" | "producer" | "reviewer";

export type CollaborationRoleProfile = {
  id: CollaborationRole;
  label: string;
  description: string;
  readOnly: boolean;
  canSubmitProposals: boolean;
  canComment: boolean;
  primaryWorkspace: string;
  workspaceDefaults: string[];
};

export const COLLABORATION_ROLE_PROFILES: readonly CollaborationRoleProfile[] = [
  {
    id: "writer",
    label: "Writer",
    description: "Write, structure and revise the approved story while keeping local drafts private until submitted.",
    readOnly: false,
    canSubmitProposals: true,
    canComment: true,
    primaryWorkspace: "/write",
    workspaceDefaults: ["/write", "/build", "/feedback", "/read-learn"],
  },
  {
    id: "director",
    label: "Director",
    description: "Review scenes, visual intent, performance notes and production choices.",
    readOnly: false,
    canSubmitProposals: true,
    canComment: true,
    primaryWorkspace: "/storyboard",
    workspaceDefaults: ["/storyboard", "/production", "/feedback", "/read"],
  },
  {
    id: "actor",
    label: "Actor",
    description: "Focus on character, dialogue, table-read notes and performance continuity.",
    readOnly: false,
    canSubmitProposals: true,
    canComment: true,
    primaryWorkspace: "/table-read",
    workspaceDefaults: ["/table-read", "/characters", "/feedback", "/read"],
  },
  {
    id: "producer",
    label: "Producer",
    description: "Review production readiness, schedules, reports, rights and delivery risks.",
    readOnly: false,
    canSubmitProposals: true,
    canComment: true,
    primaryWorkspace: "/reports",
    workspaceDefaults: ["/reports", "/production", "/feedback", "/dashboard"],
  },
  {
    id: "reviewer",
    label: "Reviewer",
    description: "Read the approved story and leave bounded feedback without changing canonical project files.",
    readOnly: true,
    canSubmitProposals: false,
    canComment: true,
    primaryWorkspace: "/feedback",
    workspaceDefaults: ["/feedback", "/read", "/reports", "/read-learn"],
  },
] as const;

export type PlotPickleInvitation = {
  format: typeof PLOTPICKLE_INVITATION_FORMAT;
  formatVersion: typeof PLOTPICKLE_INVITATION_VERSION;
  invitationId: string;
  project: {
    id: string;
    title: string;
  };
  repository: {
    owner: string;
    repo: string;
    url: string;
    branch: string;
    projectRoot: string;
  };
  role: CollaborationRole;
  recipientName: string;
  issuer: {
    name: string;
    githubLogin: string;
  };
  permissions: {
    readOnly: boolean;
    canSubmitProposals: boolean;
    canComment: boolean;
  };
  workspaceDefaults: string[];
  issuedAt: string;
  expiresAt: string;
  note: string;
};

export type CollaborationPolicy = {
  format: typeof PLOTPICKLE_COLLABORATION_POLICY_FORMAT;
  formatVersion: typeof PLOTPICKLE_COLLABORATION_POLICY_VERSION;
  projectId: string;
  acceptingProposals: boolean;
  revokedInvitationIds: string[];
  updatedAt: string;
  updatedBy: string;
};

export type LocalInvitationState = {
  version: 1;
  invitation: PlotPickleInvitation;
  acceptedAt: string;
  verifiedAt: string;
  verificationState: "imported" | "verified" | "expired" | "revoked" | "wrong-project" | "repository-mismatch";
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The PlotPickle invitation is not a valid object.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`The PlotPickle invitation is missing ${label}.`);
  return value.trim();
}

function safeRepositoryPart(value: unknown, label: string) {
  const result = text(value, label);
  if (!/^[A-Za-z0-9_.-]+$/.test(result)) throw new Error(`The PlotPickle invitation contains an invalid ${label}.`);
  return result;
}

function safeBranch(value: unknown) {
  const result = text(value, "approved branch");
  if (result.startsWith("/") || result.includes("..") || result.endsWith("/") || !/^[A-Za-z0-9._/-]+$/.test(result)) {
    throw new Error("The PlotPickle invitation contains an invalid approved branch.");
  }
  return result;
}

function safeProjectRoot(value: unknown) {
  const result = text(value, "canonical project root").replace(/^\/+|\/+$/g, "");
  if (!result || result.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(result)) throw new Error("The PlotPickle invitation contains an invalid canonical project root.");
  return result;
}

function roleProfile(value: unknown) {
  const profile = COLLABORATION_ROLE_PROFILES.find((item) => item.id === value);
  if (!profile) throw new Error("The PlotPickle invitation contains an unsupported collaborator role.");
  return profile;
}

function date(value: unknown, label: string) {
  const result = text(value, label);
  if (!Number.isFinite(Date.parse(result))) throw new Error(`The PlotPickle invitation contains an invalid ${label}.`);
  return new Date(result).toISOString();
}

function assertNoCredentialKeys(value: unknown, path = "invitation") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/(?:access|refresh)?token|secret|password|privatekey|clientsecret|authorization/i.test(key)) {
      throw new Error(`The PlotPickle invitation contains forbidden credential material at ${path}.${key}.`);
    }
    assertNoCredentialKeys(child, `${path}.${key}`);
  }
}

export function collaborationRoleProfile(role: CollaborationRole) {
  const profile = COLLABORATION_ROLE_PROFILES.find((item) => item.id === role);
  if (!profile) throw new Error("Unsupported PlotPickle collaborator role.");
  return profile;
}

export function createCollaborationPolicy(projectId: string, updatedBy = "Project Lead"): CollaborationPolicy {
  return {
    format: PLOTPICKLE_COLLABORATION_POLICY_FORMAT,
    formatVersion: PLOTPICKLE_COLLABORATION_POLICY_VERSION,
    projectId,
    acceptingProposals: true,
    revokedInvitationIds: [],
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
}

export function parseCollaborationPolicy(value: unknown, projectId = ""): CollaborationPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createCollaborationPolicy(projectId);
  const candidate = value as Partial<CollaborationPolicy>;
  if (candidate.format !== PLOTPICKLE_COLLABORATION_POLICY_FORMAT || candidate.formatVersion !== PLOTPICKLE_COLLABORATION_POLICY_VERSION) {
    throw new Error("The repository collaboration policy uses an unsupported format.");
  }
  const parsedProjectId = text(candidate.projectId, "collaboration policy project ID");
  if (projectId && parsedProjectId !== projectId) throw new Error("The repository collaboration policy belongs to a different PlotPickle project.");
  return {
    format: PLOTPICKLE_COLLABORATION_POLICY_FORMAT,
    formatVersion: PLOTPICKLE_COLLABORATION_POLICY_VERSION,
    projectId: parsedProjectId,
    acceptingProposals: candidate.acceptingProposals !== false,
    revokedInvitationIds: Array.isArray(candidate.revokedInvitationIds)
      ? [...new Set(candidate.revokedInvitationIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))].sort()
      : [],
    updatedAt: typeof candidate.updatedAt === "string" && Number.isFinite(Date.parse(candidate.updatedAt)) ? new Date(candidate.updatedAt).toISOString() : new Date().toISOString(),
    updatedBy: typeof candidate.updatedBy === "string" && candidate.updatedBy.trim() ? candidate.updatedBy.trim() : "Project Lead",
  };
}

export function serializeCollaborationPolicy(policy: CollaborationPolicy) {
  return `${JSON.stringify(parseCollaborationPolicy(policy, policy.projectId), null, 2)}\n`;
}

export function createPlotPickleInvitation(input: {
  projectId: string;
  projectTitle: string;
  owner: string;
  repo: string;
  repositoryUrl: string;
  branch: string;
  projectRoot?: string;
  role: CollaborationRole;
  recipientName?: string;
  issuerName?: string;
  issuerGitHubLogin?: string;
  expiresAt: string;
  note?: string;
  invitationId?: string;
  issuedAt?: string;
}): PlotPickleInvitation {
  const profile = collaborationRoleProfile(input.role);
  const issuedAt = input.issuedAt ? date(input.issuedAt, "issued date") : new Date().toISOString();
  const expiresAt = date(input.expiresAt, "expiry date");
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error("The PlotPickle invitation expiry must be after its issued date.");
  const invitation: PlotPickleInvitation = {
    format: PLOTPICKLE_INVITATION_FORMAT,
    formatVersion: PLOTPICKLE_INVITATION_VERSION,
    invitationId: input.invitationId?.trim() || globalThis.crypto?.randomUUID?.() || `invite-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    project: { id: text(input.projectId, "project ID"), title: text(input.projectTitle, "project title") },
    repository: {
      owner: safeRepositoryPart(input.owner, "repository owner"),
      repo: safeRepositoryPart(input.repo, "repository name"),
      url: text(input.repositoryUrl, "repository URL"),
      branch: safeBranch(input.branch),
      projectRoot: safeProjectRoot(input.projectRoot || "project"),
    },
    role: profile.id,
    recipientName: input.recipientName?.trim() || "Invited collaborator",
    issuer: {
      name: input.issuerName?.trim() || "Project Lead",
      githubLogin: input.issuerGitHubLogin?.trim() || input.owner,
    },
    permissions: {
      readOnly: profile.readOnly,
      canSubmitProposals: profile.canSubmitProposals,
      canComment: profile.canComment,
    },
    workspaceDefaults: [...profile.workspaceDefaults],
    issuedAt,
    expiresAt,
    note: input.note?.trim() || "",
  };
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(invitation.repository.url)) {
    throw new Error("The PlotPickle invitation repository URL must be a GitHub repository address.");
  }
  assertNoCredentialKeys(invitation);
  return invitation;
}

export function parsePlotPickleInvitation(value: unknown): PlotPickleInvitation {
  const source = typeof value === "string" ? JSON.parse(value) : value;
  assertNoCredentialKeys(source);
  const candidate = object(source);
  if (candidate.format !== PLOTPICKLE_INVITATION_FORMAT || candidate.formatVersion !== PLOTPICKLE_INVITATION_VERSION) {
    throw new Error("This is not a supported PlotPickle .ppinvite package.");
  }
  const project = object(candidate.project);
  const repository = object(candidate.repository);
  const issuer = object(candidate.issuer);
  const profile = roleProfile(candidate.role);
  const invitation = createPlotPickleInvitation({
    projectId: text(project.id, "project ID"),
    projectTitle: text(project.title, "project title"),
    owner: safeRepositoryPart(repository.owner, "repository owner"),
    repo: safeRepositoryPart(repository.repo, "repository name"),
    repositoryUrl: text(repository.url, "repository URL"),
    branch: safeBranch(repository.branch),
    projectRoot: safeProjectRoot(repository.projectRoot),
    role: profile.id,
    recipientName: typeof candidate.recipientName === "string" ? candidate.recipientName : "Invited collaborator",
    issuerName: typeof issuer.name === "string" ? issuer.name : "Project Lead",
    issuerGitHubLogin: typeof issuer.githubLogin === "string" ? issuer.githubLogin : String(repository.owner),
    issuedAt: date(candidate.issuedAt, "issued date"),
    expiresAt: date(candidate.expiresAt, "expiry date"),
    note: typeof candidate.note === "string" ? candidate.note : "",
    invitationId: text(candidate.invitationId, "invitation ID"),
  });
  return invitation;
}

export function serializePlotPickleInvitation(invitation: PlotPickleInvitation) {
  return `${JSON.stringify(parsePlotPickleInvitation(invitation), null, 2)}\n`;
}

export function invitationFileName(invitation: PlotPickleInvitation) {
  const slug = `${invitation.project.title}-${invitation.role}`.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "plotpickle-invitation";
  return `${slug}.ppinvite`;
}

export function validateInvitationUse(input: {
  invitation: PlotPickleInvitation;
  policy?: CollaborationPolicy | null;
  now?: string;
  projectId?: string;
  owner?: string;
  repo?: string;
  branch?: string;
}) {
  const invitation = parsePlotPickleInvitation(input.invitation);
  const now = Date.parse(input.now || new Date().toISOString());
  if (now >= Date.parse(invitation.expiresAt)) throw new Error("This PlotPickle invitation has expired.");
  if (input.projectId && invitation.project.id !== input.projectId) throw new Error("This PlotPickle invitation belongs to a different project.");
  if (input.owner && invitation.repository.owner.toLowerCase() !== input.owner.toLowerCase()) throw new Error("The connected repository does not match this PlotPickle invitation.");
  if (input.repo && invitation.repository.repo.toLowerCase() !== input.repo.toLowerCase()) throw new Error("The connected repository does not match this PlotPickle invitation.");
  if (input.branch && invitation.repository.branch !== input.branch) throw new Error("The connected approved branch does not match this PlotPickle invitation.");
  if (input.policy) {
    const policy = parseCollaborationPolicy(input.policy, invitation.project.id);
    if (policy.revokedInvitationIds.includes(invitation.invitationId)) throw new Error("This PlotPickle invitation was revoked by the Project Lead.");
  }
  return invitation;
}
