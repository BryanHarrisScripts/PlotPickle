import type { PlotPickleProject, ProjectCollaboration } from "./project";

export const PLOTPICKLE_REPOSITORY_MANIFEST_PATH = ".plotpickle/story.json" as const;
export const PLOTPICKLE_REPOSITORY_MANIFEST_FORMAT = "plotpickle-story-repository" as const;
export const PLOTPICKLE_REPOSITORY_MANIFEST_VERSION = 1 as const;

export type PlotPickleStoryRole = "writer" | "director" | "producer" | "actor" | "reviewer" | "owner" | "maintainer";

export type PlotPickleRepositoryManifest = {
  format: typeof PLOTPICKLE_REPOSITORY_MANIFEST_FORMAT;
  version: typeof PLOTPICKLE_REPOSITORY_MANIFEST_VERSION;
  title: string;
  projectPath: string;
  assetPath?: string;
  canonicalBranch: string;
  roles?: PlotPickleStoryRole[];
};

export type DashboardStorageState =
  | "local-only"
  | "local-with-assets"
  | "unpublished-changes"
  | "synchronized"
  | "pull-required"
  | "review-required"
  | "backup-recommended";

export type DashboardStorageInput = {
  hasLocalProject: boolean;
  hasLocalAssetFolder: boolean;
  collaboration: ProjectCollaboration;
  localContentHash?: string;
  lastPublishedContentHash?: string;
  remoteHead?: string;
  hasConflicts?: boolean;
  exportCreatedAt?: string;
  now?: string;
};

export type DashboardStorageStatus = {
  state: DashboardStorageState;
  label: string;
  detail: string;
  verifiedSynchronized: boolean;
  requiresReview: boolean;
};

const STATUS_COPY: Record<DashboardStorageState, Omit<DashboardStorageStatus, "state">> = {
  "local-only": {
    label: "Local only",
    detail: "The canonical .ppf project is stored on this device and has not been verified against GitHub.",
    verifiedSynchronized: false,
    requiresReview: false,
  },
  "local-with-assets": {
    label: "Local project plus local asset folder",
    detail: "The .ppf story and generated binary assets are local. Back up both because application upgrades do not replace them.",
    verifiedSynchronized: false,
    requiresReview: false,
  },
  "unpublished-changes": {
    label: "Connected to GitHub — unpublished changes",
    detail: "The local canonical project differs from the last verified published version. Review and publish deliberately.",
    verifiedSynchronized: false,
    requiresReview: true,
  },
  synchronized: {
    label: "Synchronized with GitHub",
    detail: "The local project hash and verified remote commit match the last completed synchronization.",
    verifiedSynchronized: true,
    requiresReview: false,
  },
  "pull-required": {
    label: "Pull required before contributing",
    detail: "The verified remote head is newer than the last pulled commit. Review incoming work before replacing local canonical content.",
    verifiedSynchronized: false,
    requiresReview: true,
  },
  "review-required": {
    label: "Conflict or review required",
    detail: "Local and remote work cannot be reconciled safely without review. PlotPickle must not overwrite either version silently.",
    verifiedSynchronized: false,
    requiresReview: true,
  },
  "backup-recommended": {
    label: "Backup/export recommended",
    detail: "This local project has no recent verified export. Save a .ppf backup and preserve the separate asset folder.",
    verifiedSynchronized: false,
    requiresReview: false,
  },
};

export function parsePlotPickleRepositoryManifest(input: string | unknown): PlotPickleRepositoryManifest | null {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<PlotPickleRepositoryManifest>;
  if (candidate.format !== PLOTPICKLE_REPOSITORY_MANIFEST_FORMAT || candidate.version !== PLOTPICKLE_REPOSITORY_MANIFEST_VERSION) return null;
  if (!candidate.title?.trim() || !candidate.projectPath?.endsWith(".ppf") || !candidate.canonicalBranch?.trim()) return null;
  const roles = Array.isArray(candidate.roles)
    ? candidate.roles.filter((role): role is PlotPickleStoryRole => ["writer", "director", "producer", "actor", "reviewer", "owner", "maintainer"].includes(role))
    : undefined;
  return {
    format: PLOTPICKLE_REPOSITORY_MANIFEST_FORMAT,
    version: PLOTPICKLE_REPOSITORY_MANIFEST_VERSION,
    title: candidate.title.trim(),
    projectPath: candidate.projectPath,
    assetPath: candidate.assetPath?.trim() || undefined,
    canonicalBranch: candidate.canonicalBranch.trim(),
    roles,
  };
}

export function dashboardRoles(project: PlotPickleProject, collaboratorName = "") {
  const normalizedName = collaboratorName.trim().toLowerCase();
  const roles = new Set<PlotPickleStoryRole>();
  if (normalizedName && project.rights.projectOwner.trim().toLowerCase() === normalizedName) roles.add("owner");
  for (const collaborator of project.rights.collaborators) {
    if (normalizedName && collaborator.name.trim().toLowerCase() !== normalizedName) continue;
    const value = `${collaborator.role} ${collaborator.contribution}`.toLowerCase();
    for (const role of ["writer", "director", "producer", "actor", "reviewer"] as PlotPickleStoryRole[]) {
      if (value.includes(role)) roles.add(role);
    }
  }
  return [...roles];
}

export function deriveDashboardStorageStatus(input: DashboardStorageInput): DashboardStorageStatus {
  const status = (state: DashboardStorageState): DashboardStorageStatus => ({ state, ...STATUS_COPY[state] });
  if (input.hasConflicts) return status("review-required");

  const connected = input.collaboration.provider === "github" && Boolean(input.collaboration.repositoryUrl);
  if (connected && input.remoteHead && input.collaboration.lastPulledCommit && input.remoteHead !== input.collaboration.lastPulledCommit) {
    return status("pull-required");
  }
  if (connected && input.localContentHash && input.lastPublishedContentHash && input.localContentHash !== input.lastPublishedContentHash) {
    return status("unpublished-changes");
  }
  if (
    connected
    && input.remoteHead
    && input.remoteHead === input.collaboration.lastPulledCommit
    && input.remoteHead === input.collaboration.lastPushedCommit
    && input.localContentHash
    && input.localContentHash === input.lastPublishedContentHash
  ) {
    return status("synchronized");
  }
  if (input.hasLocalProject && input.hasLocalAssetFolder) return status("local-with-assets");

  const now = Date.parse(input.now || new Date().toISOString());
  const exportedAt = Date.parse(input.exportCreatedAt || "");
  const exportIsOld = !Number.isFinite(exportedAt) || now - exportedAt > 14 * 24 * 60 * 60 * 1000;
  if (input.hasLocalProject && exportIsOld) return status("backup-recommended");
  return status("local-only");
}
