import {
  githubCollaborationServiceState,
  normalizeCollaborationModeRecord,
  transitionCollaborationMode,
  withCollaborationMode,
} from "./collaboration-mode";

export const PROJECT_STORAGE_MODES = ["local-only", "local-github"] as const;

export type ProjectStorageMode = (typeof PROJECT_STORAGE_MODES)[number];

type PlotPickleProject = Parameters<typeof transitionCollaborationMode>[0];
type ProjectCollaboration = PlotPickleProject["collaboration"];

type StorageAwareCollaboration = ProjectCollaboration & {
  repositoryEnabled?: boolean;
};

export type ProjectStorageModeSnapshot = {
  mode: ProjectStorageMode;
  localWorkingCopy: true;
  localBackups: true;
  githubConfigured: boolean;
  githubRequired: boolean;
  repository: string;
  branch: string;
  ready: boolean;
};

export function normalizeProjectStorageMode(value: unknown): ProjectStorageMode {
  return value === "local-github" ? "local-github" : "local-only";
}

export function projectStorageMode(collaboration: ProjectCollaboration): ProjectStorageMode {
  const storageAware = collaboration as StorageAwareCollaboration;
  if (typeof storageAware.repositoryEnabled === "boolean") {
    return storageAware.repositoryEnabled ? "local-github" : "local-only";
  }
  return normalizeCollaborationModeRecord(collaboration).mode === "repository-collaboration"
    ? "local-github"
    : "local-only";
}

export function projectStorageModeSnapshot(project: PlotPickleProject): ProjectStorageModeSnapshot {
  const mode = projectStorageMode(project.collaboration);
  const githubConfigured = githubCollaborationServiceState(project.collaboration) === "configured";
  const owner = typeof project.collaboration.owner === "string" ? project.collaboration.owner.trim() : "";
  const repo = typeof project.collaboration.repo === "string" ? project.collaboration.repo.trim() : "";
  const repository = owner && repo ? `${owner}/${repo}` : "No story repository configured";
  const branch = typeof project.collaboration.branch === "string" && project.collaboration.branch.trim()
    ? project.collaboration.branch.trim()
    : "main";

  return {
    mode,
    localWorkingCopy: true,
    localBackups: true,
    githubConfigured,
    githubRequired: mode === "local-github",
    repository,
    branch,
    ready: mode === "local-only" || githubConfigured,
  };
}

export function transitionProjectStorageMode(
  project: PlotPickleProject,
  targetMode: unknown,
): PlotPickleProject {
  const target = normalizeProjectStorageMode(targetMode);
  const currentCollaboration = normalizeCollaborationModeRecord(project.collaboration);
  const nextMode = target === "local-github"
    ? "repository-collaboration"
    : currentCollaboration.mode === "repository-collaboration"
      ? "local-story"
      : currentCollaboration.mode;
  const collaboration = withCollaborationMode({
    ...project.collaboration,
    repositoryEnabled: target === "local-github",
  } as StorageAwareCollaboration, nextMode);

  return {
    ...project,
    collaboration,
  };
}

export function projectStorageTransitionConfirmation(
  project: PlotPickleProject,
  targetMode: unknown,
) {
  const target = normalizeProjectStorageMode(targetMode);
  const snapshot = projectStorageModeSnapshot(project);
  if (target === "local-github") {
    const repository = snapshot.githubConfigured
      ? `${snapshot.repository} on ${snapshot.branch}`
      : "a story repository that still needs to be configured";
    return `Enable Local + GitHub for this project?\n\n`
      + `PlotPickle will continue saving the working project and rolling backups locally. GitHub adds ${repository}, revision history, proposals and collaboration.\n\n`
      + "This does not push, pull, publish, merge or alter canon automatically.";
  }
  return "Switch this project to Local Only?\n\n"
    + "The local working project and rolling backups remain active. Saved GitHub account and repository configuration are preserved, but repository synchronization and collaboration are no longer the selected project mode.\n\n"
    + "This does not delete the repository, its history or any local story data.";
}
