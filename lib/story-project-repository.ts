export const STORY_PROJECT_MANIFEST_PATH = "plotpickle-project.json" as const;
export const STORY_PROJECT_FORMAT = "plotpickle-story-project" as const;
export const STORY_PROJECT_FORMAT_VERSION = "1.0.0" as const;
export const STORY_PROJECT_SCHEMA_VERSION = "2.3.0" as const;
export const DEFAULT_CANONICAL_PROJECT_PATH = "stories/plotpickle-story.ppf" as const;

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
    mode: "portable-ppf";
    path: string;
  };
  modularProject: {
    format: "plotpickle-project";
    formatVersion: typeof STORY_PROJECT_SCHEMA_VERSION;
    manifestPath: "manifest.json";
    status: "phase-3";
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
  createdAt?: string;
  applicationVersion?: string;
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
  const candidate = (value || DEFAULT_CANONICAL_PROJECT_PATH).trim().replace(/^\/+/, "");
  const parts = candidate.split("/");
  if (candidate.length > 500 || !candidate.toLowerCase().endsWith(".ppf") || parts.some((part) => !part || part === "." || part === ".." || /[\\\u0000-\u001f]/.test(part))) {
    throw new Error("The canonical story path must be a safe .ppf repository path.");
  }
  return candidate;
}

export function createStoryProjectManifest(input: StoryProjectManifestInput): StoryProjectManifest {
  const timestamp = input.createdAt || new Date().toISOString();
  const title = input.title.trim() || input.repository;
  const repository = validateRepositoryName(input.repository);
  const projectId = input.projectId.trim();
  if (!projectId) throw new Error("A PlotPickle project ID is required before creating the story project.");
  if (!input.owner.trim()) throw new Error("Choose the GitHub account or organization that will own the story project.");
  return {
    $schema: "https://plotpickle.org/schemas/github-story-project/1.0/manifest.schema.json",
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
      mode: "portable-ppf",
      path: safeCanonicalProjectPath(input.canonicalProjectPath),
    },
    modularProject: {
      format: "plotpickle-project",
      formatVersion: STORY_PROJECT_SCHEMA_VERSION,
      manifestPath: "manifest.json",
      status: "phase-3",
    },
    collaboration: {
      approvalAuthority: "project-lead",
      proposalMode: "pull-request",
      acceptingProposals: true,
    },
  };
}

export function parseStoryProjectManifest(value: unknown): StoryProjectManifest {
  const source = record(value);
  if (source.format !== STORY_PROJECT_FORMAT) {
    throw new Error("This repository contains a manifest for a different project format. PlotPickle did not overwrite it.");
  }
  if (source.formatVersion !== STORY_PROJECT_FORMAT_VERSION || source.schemaVersion !== STORY_PROJECT_SCHEMA_VERSION) {
    throw new Error(`This story project uses PlotPickle manifest ${String(source.formatVersion || "unknown")} and schema ${String(source.schemaVersion || "unknown")}. Upgrade or migrate it before connecting.`);
  }
  const repository = record(source.repository);
  const canonicalProject = record(source.canonicalProject);
  const modularProject = record(source.modularProject);
  const collaboration = record(source.collaboration);
  const projectId = typeof source.projectId === "string" ? source.projectId : "";
  const title = typeof source.title === "string" ? source.title : "";
  if (!projectId || !title) throw new Error("The PlotPickle story project manifest is missing its project identity.");
  return {
    $schema: typeof source.$schema === "string" ? source.$schema : "",
    format: STORY_PROJECT_FORMAT,
    formatVersion: STORY_PROJECT_FORMAT_VERSION,
    schemaVersion: STORY_PROJECT_SCHEMA_VERSION,
    projectId,
    title,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : "",
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    createdWith: typeof source.createdWith === "string" ? source.createdWith : "",
    repository: {
      owner: typeof repository.owner === "string" ? repository.owner : "",
      name: typeof repository.name === "string" ? repository.name : "",
      defaultBranch: typeof repository.defaultBranch === "string" && repository.defaultBranch ? repository.defaultBranch : "main",
    },
    canonicalProject: {
      mode: "portable-ppf",
      path: safeCanonicalProjectPath(typeof canonicalProject.path === "string" ? canonicalProject.path : undefined),
    },
    modularProject: {
      format: "plotpickle-project",
      formatVersion: STORY_PROJECT_SCHEMA_VERSION,
      manifestPath: "manifest.json",
      status: "phase-3",
    },
    collaboration: {
      approvalAuthority: "project-lead",
      proposalMode: "pull-request",
      acceptingProposals: collaboration.acceptingProposals !== false,
    },
  };
}

function repositoryReadme(manifest: StoryProjectManifest) {
  return `# ${manifest.title}\n\nThis is a user-owned PlotPickle story project. PlotPickle remains local-first; GitHub stores approved revisions and Story Proposals only when a collaborator explicitly submits them.\n\n## Project files\n\n- \`${STORY_PROJECT_MANIFEST_PATH}\` describes the repository and supported PlotPickle format.\n- \`${manifest.canonicalProject.path}\` is the transitional portable story file used by the current collaboration engine.\n- \`manifest.json\` will become the canonical modular-project manifest during Phase 3.\n- \`assets/\` and \`exports/\` hold optional user-approved media and deliverables.\n\n## Collaboration\n\nThe Project Lead controls the approved branch. Contributors work locally and submit Story Proposals for review. Credentials and API keys must never be committed to this repository.\n`;
}

function pullRequestTemplate() {
  return `## PlotPickle Story Proposal\n\n### What changed\n\nDescribe the story, character, dialogue, visual, production or collaboration changes.\n\n### Why\n\nExplain the creative reason and anything the Project Lead should inspect closely.\n\n### Approval boundary\n\n- [ ] This proposal does not contain credentials, API keys or private local files.\n- [ ] I reviewed the generated change summary.\n- [ ] The approved branch should change only after Project Lead review.\n`;
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
    "stories/.gitkeep": "",
    "canon/.gitkeep": "",
    "assets/.gitkeep": "",
    "exports/.gitkeep": "",
    "collaboration/.gitkeep": "",
  };
}
