import type { ProjectCollaboration } from "./project";

export const COLLABORATION_MODES = [
  "local-story",
  "writers-room",
  "repository-collaboration",
] as const;

export type CollaborationMode = (typeof COLLABORATION_MODES)[number];

export type CollaborationModeRecord = ProjectCollaboration & {
  mode: CollaborationMode;
};

export type CollaborationModeRequirements = {
  localPpf: true;
  localBackups: true;
  buzz: "optional" | "required";
  github: "optional" | "required";
};

const MODE_REQUIREMENTS: Record<CollaborationMode, CollaborationModeRequirements> = {
  "local-story": {
    localPpf: true,
    localBackups: true,
    buzz: "optional",
    github: "optional",
  },
  "writers-room": {
    localPpf: true,
    localBackups: true,
    buzz: "required",
    github: "optional",
  },
  "repository-collaboration": {
    localPpf: true,
    localBackups: true,
    buzz: "optional",
    github: "required",
  },
};

export function isCollaborationMode(value: unknown): value is CollaborationMode {
  return typeof value === "string" && COLLABORATION_MODES.includes(value as CollaborationMode);
}

export function normalizeCollaborationMode(value: unknown): CollaborationMode {
  return isCollaborationMode(value) ? value : "local-story";
}

export function collaborationModeRequirements(mode: unknown): CollaborationModeRequirements {
  return MODE_REQUIREMENTS[normalizeCollaborationMode(mode)];
}

export function withCollaborationMode(
  collaboration: ProjectCollaboration | (Partial<ProjectCollaboration> & { mode?: unknown }),
  mode: unknown,
): CollaborationModeRecord {
  return {
    ...collaboration,
    mode: normalizeCollaborationMode(mode),
  } as CollaborationModeRecord;
}

export function normalizeCollaborationModeRecord(
  collaboration: ProjectCollaboration | (Partial<ProjectCollaboration> & { mode?: unknown }),
): CollaborationModeRecord {
  return withCollaborationMode(collaboration, collaboration.mode);
}

export const COLLABORATION_MODE_COPY: Record<CollaborationMode, {
  title: string;
  summary: string;
}> = {
  "local-story": {
    title: "Local Story Mode",
    summary: "PPF and local backups only. Buzz and GitHub remain optional.",
  },
  "writers-room": {
    title: "Writers' Room Mode",
    summary: "PPF plus Buzz discussion. Human approval remains required before canon changes.",
  },
  "repository-collaboration": {
    title: "Repository Collaboration Mode",
    summary: "PPF plus GitHub proposals, revision history, synchronization and formal approvals.",
  },
};
