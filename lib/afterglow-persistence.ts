export const AFTERGLOW_PROJECT_ID = "afterglow-echoes-of-sentience" as const;
export const AFTERGLOW_PROJECT_TITLE = "Afterglow: Reflections of Sentience" as const;
export const AFTERGLOW_PROJECT_FILE = "afterglow-echoes-of-sentience.ppf" as const;
export const AFTERGLOW_REPOSITORY_OWNER = "BryanHarrisScripts" as const;
export const AFTERGLOW_REPOSITORY_NAME = "Afterglow-Echoes-of-Sentience" as const;
export const AFTERGLOW_REPOSITORY_FULL_NAME = `${AFTERGLOW_REPOSITORY_OWNER}/${AFTERGLOW_REPOSITORY_NAME}` as const;
export const AFTERGLOW_REPOSITORY_URL = `https://github.com/${AFTERGLOW_REPOSITORY_FULL_NAME}` as const;
export const AFTERGLOW_REPOSITORY_PROJECT_PATH = "stories/afterglow.ppf" as const;

export type AfterglowPersistenceRepository = {
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  ready: boolean;
  verifiedAt: string;
};

export type AfterglowPersistenceServerStatus = {
  available: boolean;
  enabled: boolean;
  localProjectAvailable: boolean;
  repository: AfterglowPersistenceRepository;
  error: string;
};

export type AfterglowDashboardStateId =
  | "not-loaded"
  | "loaded-locally"
  | "github-repository-connected";

export type AfterglowDashboardState = {
  id: AfterglowDashboardStateId;
  label: "Afterglow not loaded" | "Afterglow loaded locally" | "Afterglow GitHub repository connected";
  detail: string;
  tone: "green" | "yellow";
  enabled: boolean;
  available: boolean;
  localProjectAvailable: boolean;
  error: string;
};

const EMPTY_REPOSITORY: AfterglowPersistenceRepository = {
  owner: "",
  repo: "",
  branch: "main",
  projectPath: AFTERGLOW_REPOSITORY_PROJECT_PATH,
  ready: false,
  verifiedAt: "",
};

export const EMPTY_AFTERGLOW_PERSISTENCE_STATUS: AfterglowPersistenceServerStatus = {
  available: false,
  enabled: false,
  localProjectAvailable: false,
  repository: EMPTY_REPOSITORY,
  error: "",
};

function text(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function isAfterglowProjectId(value: unknown): value is typeof AFTERGLOW_PROJECT_ID {
  return value === AFTERGLOW_PROJECT_ID;
}

export function isExpectedAfterglowRepository(owner: unknown, repo: unknown) {
  return text(owner).toLowerCase() === AFTERGLOW_REPOSITORY_OWNER.toLowerCase()
    && text(repo).toLowerCase() === AFTERGLOW_REPOSITORY_NAME.toLowerCase();
}

export function normalizeAfterglowPersistenceStatus(
  value: unknown,
  localProjectAvailable = false,
): AfterglowPersistenceServerStatus {
  if (!value || typeof value !== "object") {
    return { ...EMPTY_AFTERGLOW_PERSISTENCE_STATUS, localProjectAvailable };
  }
  const source = value as Record<string, unknown>;
  const repositorySource = source.repository && typeof source.repository === "object"
    ? source.repository as Record<string, unknown>
    : {};
  const repository: AfterglowPersistenceRepository = {
    owner: text(repositorySource.owner, 100),
    repo: text(repositorySource.repo, 100),
    branch: text(repositorySource.branch, 120) || "main",
    projectPath: text(repositorySource.projectPath, 300) || AFTERGLOW_REPOSITORY_PROJECT_PATH,
    ready: Boolean(repositorySource.ready)
      && isExpectedAfterglowRepository(repositorySource.owner, repositorySource.repo),
    verifiedAt: text(repositorySource.verifiedAt, 50),
  };
  return {
    available: source.available !== false,
    enabled: Boolean(source.enabled),
    localProjectAvailable,
    repository,
    error: text(source.error, 700),
  };
}

export function deriveAfterglowDashboardState(
  activeProjectId: unknown,
  status: AfterglowPersistenceServerStatus,
): AfterglowDashboardState {
  const base = {
    enabled: status.enabled,
    available: status.available,
    localProjectAvailable: status.localProjectAvailable,
    error: status.error,
  };

  if (!isAfterglowProjectId(activeProjectId)) {
    return {
      ...base,
      id: "not-loaded",
      label: "Afterglow not loaded",
      detail: status.enabled
        ? "GitHub persistence is selected. Load Afterglow to open its saved project."
        : "Load the bundled Afterglow example, or opt in to its GitHub-backed project.",
      tone: "yellow",
    };
  }

  if (status.enabled && status.repository.ready) {
    return {
      ...base,
      id: "github-repository-connected",
      label: "Afterglow GitHub repository connected",
      detail: `Edits save to the persistent Afterglow project folder. Reviewed pull and publish actions use ${AFTERGLOW_REPOSITORY_FULL_NAME}.`,
      tone: "green",
    };
  }

  return {
    ...base,
    id: "loaded-locally",
    label: "Afterglow loaded locally",
    detail: status.enabled
      ? "The saved local Afterglow project remains available, but its GitHub repository is not currently verified."
      : "This is today’s default: Afterglow is loaded from PlotPickle’s bundled example and the next local load restores that example.",
    tone: "green",
  };
}

export function afterglowCollaborationPatch(
  connection: Partial<AfterglowPersistenceRepository> & { login?: string; repositoryUrl?: string },
  now = new Date().toISOString(),
) {
  if (!isExpectedAfterglowRepository(connection.owner, connection.repo) || connection.ready !== true) {
    throw new Error("The verified GitHub connection is not the expected Afterglow repository.");
  }
  return {
    provider: "github" as const,
    owner: AFTERGLOW_REPOSITORY_OWNER,
    repo: AFTERGLOW_REPOSITORY_NAME,
    branch: text(connection.branch, 120) || "main",
    projectPath: text(connection.projectPath, 300) || AFTERGLOW_REPOSITORY_PROJECT_PATH,
    repositoryUrl: text(connection.repositoryUrl, 500) || AFTERGLOW_REPOSITORY_URL,
    syncEnabled: true,
    connectedAt: now,
    updatedAt: now,
  };
}
