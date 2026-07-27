export const STORY_PROJECT_MANIFEST_PATH = "plotpickle-project.json" as const;
export const STORY_PROJECT_FORMAT = "plotpickle-story-project" as const;
export const LEGACY_STORY_PROJECT_FORMAT_VERSION = "1.0.0" as const;
export const STORY_PROJECT_FORMAT_VERSION = "1.1.0" as const;
export const STORY_PROJECT_SCHEMA_VERSION = "2.3.0" as const;
export const DEFAULT_CANONICAL_PROJECT_ROOT = "project" as const;
export const DEFAULT_CANONICAL_PROJECT_MANIFEST_PATH = "project/manifest.json" as const;
export const DEFAULT_PORTABLE_PROJECT_PATH = "stories/plotpickle-story.ppf" as const;
export const DEFAULT_CANONICAL_PROJECT_PATH = DEFAULT_PORTABLE_PROJECT_PATH;

export type StoryProjectManifest = {
  $schema: string;
  format: typeof STORY_PROJECT_FORMAT;
  formatVersion: typeof STORY_PROJECT_FORMAT_VERSION;
  schemaVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdWith: string;
  repository: {
    owner: string;
    name: string;
    defaultBranch: string;
  };
  canonicalProject: {
    mode: "modular-folder";
    root: string;
    manifestPath: string;
    format: "plotpickle-project";
    formatVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
  };
  portableProject: {
    path: string;
    role: "exchange-snapshot";
    legacyCanonicalPath: string;
  };
  modularProject: {
    format: "plotpickle-project";
    formatVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
    root: string;
    manifestPath: string;
    status: "active";
  };
  collaboration: {
    approvalAuthority: "project-lead";
    proposalMode: "pull-request";
    acceptingProposals: boolean;
  };
};

export type StoryProjectManifestInput = {
  projectId: string;
  title: string;
  owner: string;
  repository: string;
  defaultBranch?: string;
  canonicalProjectPath?: string;
  canonicalProjectRoot?: string;
  createdAt?: string;
  applicationVersion?: string;
};

export type StoryProjectManifestInspection = {
  manifest: StoryProjectManifest;
  sourceVersion: string;
  migrationRequired: boolean;
  legacyPortablePath: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The PlotPickle story project manifest is not a JSON object.");
  }
  return value as Record<string, unknown>;
}

export function normalizeRepositoryName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 100);
}

export function validateRepositoryName(value: string) {
  const normalized = normalizeRepositoryName(value);
  if (!normalized) throw new Error("Enter a repository name using letters, numbers, periods, hyphens or underscores.");
  if (normalized === "." || normalized === "..") throw new Error("Choose a different repository name.");
  if (normalized.length > 100) throw new Error("The repository name must be 100 characters or fewer.");
  return normalized;
}

export function safeCanonicalProjectPath(value: string | undefined) {
  const candidate = (value || DEFAULT_PORTABLE_PROJECT_PATH).trim().replace(/^\/+/, "");
  const parts = candidate.split("/");
  if (candidate.length > 500 || !candidate.toLowerCase().endsWith(".ppf") || parts.some((part) => !part || part === "." || part === ".." || /[\\\u0000-\u001f]/.test(part))) {
    throw new Error("The portable story path must be a safe .ppf repository path.");
  }
  return candidate;
}

export function safeCanonicalProjectRoot(value: string | undefined) {
  const candidate = (value || DEFAULT_CANONICAL_PROJECT_ROOT).trim().replace(/^\/+|\/+$/g, "");
  const parts = candidate.split("/");
  if (!candidate || candidate.length > 200 || parts.some((part) => !part || part === "." || part === ".." || /[\\\u0000-\u001f]/.test(part))) {
    throw new Error("The canonical project root must be a safe repository folder path.");
  }
  return candidate;
}

function currentManifest(input: StoryProjectManifestInput, timestamp: string): StoryProjectManifest {
  const title = input.title.trim() || input.repository;
  const repository = validateRepositoryName(input.repository);
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("A PlotPickle project ID is required before creating the story project.");
  if (!input.owner.trim()) throw new Error("Choose the GitHub account or organization that will own the story project.");
  const root = safeCanonicalProjectRoot(input.canonicalProjectRoot);
  const portablePath = safeCanonicalProjectPath(input.canonicalProjectPath);
  return {
    $schema: "https://plotpickle.org/schemas/github-story-project/1.1/manifest.schema.json",
    format: STORY_PROJECT_FORMAT,
    formatVersion: STORY_PROJECT_FORMAT_VERSION,
    schemaVersion: STORY_PROJECT_SCHEMA_VERSION,
    projectId,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdWith: `PlotPickle ${input.applicationVersion || "1.0.0-rc.3"}`,
    repository: {
      owner: input.owner.trim(),
      name: repository,
      defaultBranch: input.defaultBranch?.trim() || "main",
    },
    canonicalProject: {
      mode: "modular-folder",
      root,
      manifestPath: `${root}/manifest.json`,
      format: "plotpickle-project",
      formatVersion: STORY_PROJECT_SCHEMA_VERSION,
    },
    portableProject: {
      path: portablePath,
      role: "exchange-snapshot",
      legacyCanonicalPath: portablePath,
    },
    modularProject: {
      format: "plotpickle-project",
      formatVersion: STORY_PROJECT_SCHEMA_VERSION,
      root,
      manifestPath: `${root}/manifest.json`,
      status: "active",
    },
    collaboration: {
      approvalAuthority: "project-lead",
      proposalMode: "pull-request",
      acceptingProposals: true,
    },
  };
}

export function createStoryProjectManifest(input: StoryProjectManifestInput): StoryProjectManifest {
  return currentManifest(input, input.createdAt || new Date().toISOString());
}

export function inspectStoryProjectManifest(value: unknown): StoryProjectManifestInspection {
  const source = record(value);
  if (source.format !== STORY_PROJECT_FORMAT) {
    throw new Error("This repository contains a manifest for a different project format. PlotPickle did not overwrite it.");
  }
  const sourceVersion = typeof source.formatVersion === "string" ? source.formatVersion : "unknown";
  if (![LEGACY_STORY_PROJECT_FORMAT_VERSION, STORY_PROJECT_FORMAT_VERSION].includes(sourceVersion as typeof STORY_PROJECT_FORMAT_VERSION)) {
    throw new Error(`This story project uses PlotPickle manifest ${sourceVersion} and schema ${String(source.schemaVersion || "unknown")}. Upgrade or migrate it before connecting.`);
  }
  if (source.schemaVersion !== STORY_PROJECT_SCHEMA_VERSION) {
    throw new Error(`This story project uses PlotPickle schema ${String(source.schemaVersion || "unknown")}. Upgrade or migrate it before connecting.`);
  }
  const repository = record(source.repository);
  const collaboration = record(source.collaboration);
  const projectId = typeof source.projectId === "string" ? source.projectId : "";
  const title = typeof source.title === "string" ? source.title : "";
  if (!projectId || !title) throw new Error("The PlotPickle story project manifest is missing its project identity.");

  let legacyPortablePath = DEFAULT_PORTABLE_PROJECT_PATH;
  let projectRoot = DEFAULT_CANONICAL_PROJECT_ROOT;
  if (sourceVersion === LEGACY_STORY_PROJECT_FORMAT_VERSION) {
    const legacyCanonical = record(source.canonicalProject);
    legacyPortablePath = safeCanonicalProjectPath(typeof legacyCanonical.path === "string" ? legacyCanonical.path : undefined);
  } else {
    const canonicalProject = record(source.canonicalProject);
    const portableProject = record(source.portableProject);
    if (canonicalProject.mode !== "modular-folder") throw new Error("The story project manifest does not identify a canonical modular folder.");
    projectRoot = safeCanonicalProjectRoot(typeof canonicalProject.root === "string" ? canonicalProject.root : undefined);
    legacyPortablePath = safeCanonicalProjectPath(typeof portableProject.legacyCanonicalPath === "string"
      ? portableProject.legacyCanonicalPath
      : typeof portableProject.path === "string" ? portableProject.path : undefined);
  }

  const manifest = currentManifest({
    projectId,
    title,
    owner: typeof repository.owner === "string" ? repository.owner : "",
    repository: typeof repository.name === "string" ? repository.name : "",
    defaultBranch: typeof repository.defaultBranch === "string" ? repository.defaultBranch : "main",
    canonicalProjectPath: legacyPortablePath,
    canonicalProjectRoot: projectRoot,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
    applicationVersion: typeof source.createdWith === "string" ? source.createdWith.replace(/^PlotPickle\s+/, "") : undefined,
  }, typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString());
  manifest.updatedAt = typeof source.updatedAt === "string" ? source.updatedAt : manifest.createdAt;
  manifest.collaboration.acceptingProposals = collaboration.acceptingProposals !== false;
  return {
    manifest,
    sourceVersion,
    migrationRequired: sourceVersion === LEGACY_STORY_PROJECT_FORMAT_VERSION,
    legacyPortablePath,
  };
}

export function parseStoryProjectManifest(value: unknown): StoryProjectManifest {
  return inspectStoryProjectManifest(value).manifest;
}

export function upgradeStoryProjectManifest(value: unknown, updatedAt = new Date().toISOString()) {
  const inspected = inspectStoryProjectManifest(value);
  return {
    ...inspected.manifest,
    formatVersion: STORY_PROJECT_FORMAT_VERSION,
    updatedAt,
    canonicalProject: { ...inspected.manifest.canonicalProject },
    modularProject: { ...inspected.manifest.modularProject, status: "active" as const },
    portableProject: { ...inspected.manifest.portableProject, role: "exchange-snapshot" as const },
  };
}

function repositoryReadme(manifest: StoryProjectManifest) {
  return `# ${manifest.title}\n\nThis is a user-owned PlotPickle story project. PlotPickle remains local-first; GitHub stores approved revisions and Story Proposals only when a collaborator explicitly submits them.\n\n## Project files\n\n- \`${STORY_PROJECT_MANIFEST_PATH}\` describes the repository and supported PlotPickle format.\n- \`${manifest.canonicalProject.root}/\` is the canonical modular story folder used for readable Git history and file-level collaboration.\n- \`${manifest.portableProject.path}\` is retained only for portable exchange, migration and optional release snapshots.\n- \`assets/\` and \`exports/\` hold optional user-approved media and deliverables.\n\n## Collaboration\n\nThe Project Lead controls the approved branch. Contributors work locally and submit Story Proposals for review. Credentials and API keys must never be committed to this repository.\n`;
}

function pullRequestTemplate() {
  return `## PlotPickle Story Proposal\n\n### What changed\n\nDescribe the story, character, dialogue, visual, production or collaboration changes.\n\n### Why\n\nExplain the creative reason and anything the Project Lead should inspect closely.\n\n### Approval boundary\n\n- [ ] This proposal does not contain credentials, API keys or private local files.\n- [ ] I reviewed the generated file-level change summary.\n- [ ] The approved branch should change only after Project Lead review.\n`;
}

export function storyProjectBootstrapFiles(manifest: StoryProjectManifest): Record<string, string> {
  return {
    [STORY_PROJECT_MANIFEST_PATH]: `${JSON.stringify(manifest, null, 2)}\n`,
    "README.md": repositoryReadme(manifest),
    ".gitignore": [
      ".DS_Store",
      "Thumbs.db",
      "*.tmp",
      "*.log",
      ".env",
      ".env.*",
      "*.key",
      "*.pem",
      ".plotpickle/",
      "credentials/",
      "node_modules/",
      "exports/*.zip",
      "",
    ].join("\n"),
    ".github/pull_request_template.md": pullRequestTemplate(),
    "project/.gitkeep": "",
    "stories/.gitkeep": "",
    "canon/.gitkeep": "",
    "assets/.gitkeep": "",
    "exports/.gitkeep": "",
    "collaboration/.gitkeep": "",
  };
}
