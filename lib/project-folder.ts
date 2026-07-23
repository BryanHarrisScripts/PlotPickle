import type { PlotPickleProject } from "./project";
import { normalizePlotPickleProject } from "./project";

export const PROJECT_FOLDER_FORMAT = "plotpickle-project" as const;
export const PROJECT_FOLDER_VERSION = "2.0.0" as const;

export type ProjectFolderManifest = {
  $schema: string;
  format: typeof PROJECT_FOLDER_FORMAT;
  formatVersion: typeof PROJECT_FOLDER_VERSION;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdWith: string;
  minimumReaderVersion: string;
  modules: Record<string, {
    id: string;
    type: string;
    path: string;
    schemaVersion: string;
    required: boolean;
    dependencies?: string[];
  }>;
  canon: { root: string; policy: "approved-only" };
  rights: { path: string };
  imports: Array<Record<string, unknown>>;
  extensions: Record<string, unknown>;
};

export type ProjectFolderFiles = Record<string, unknown>;

const MODULE_PATHS = {
  identity: "project/identity.json",
  story: "story/module.json",
  world: "world/module.json",
  characters: "characters/module.json",
  screenplay: "screenplay/module.json",
  structure: "blocks/module.json",
  review: "review/module.json",
  production: "production/module.json",
  revisions: "reports/revisions.json",
  collaboration: "collaboration/module.json",
  rights: "canon/rights.json",
} as const;

function moduleEntry(key: keyof typeof MODULE_PATHS, required = true) {
  return {
    id: `module-${key}`,
    type: `plotpickle.${key}`,
    path: MODULE_PATHS[key],
    schemaVersion: PROJECT_FOLDER_VERSION,
    required,
  };
}

export function projectFolderName(project: PlotPickleProject) {
  const stem = project.metadata.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return stem || "untitled-story";
}

export function createProjectFolder(project: PlotPickleProject, applicationVersion = "1.0.0-rc.3") {
  const manifest: ProjectFolderManifest = {
    $schema: "https://plotpickle.org/schemas/2.0/manifest.schema.json",
    format: PROJECT_FOLDER_FORMAT,
    formatVersion: PROJECT_FOLDER_VERSION,
    projectId: project.id,
    title: project.metadata.title,
    createdAt: project.metadata.createdAt,
    updatedAt: project.metadata.updatedAt,
    createdWith: `PlotPickle ${applicationVersion}`,
    minimumReaderVersion: "2.0.0",
    modules: {
      identity: moduleEntry("identity"), story: moduleEntry("story"), world: moduleEntry("world"),
      characters: moduleEntry("characters"), screenplay: moduleEntry("screenplay"), structure: moduleEntry("structure"),
      review: moduleEntry("review", false), production: moduleEntry("production", false), revisions: moduleEntry("revisions", false),
      collaboration: moduleEntry("collaboration", false), rights: moduleEntry("rights"),
    },
    canon: { root: "canon/", policy: "approved-only" },
    rights: { path: MODULE_PATHS.rights },
    imports: project.screenplay.importedAt ? [{ id: `import-${project.id}`, type: project.screenplay.format, sourceFilename: project.screenplay.fileName, importedAt: project.screenplay.importedAt, reviewStatus: project.screenplay.analysisStatus }] : [],
    extensions: { legacySchemaVersion: project.schemaVersion },
  };

  const files: ProjectFolderFiles = {
    "manifest.json": manifest,
    [MODULE_PATHS.identity]: { schemaVersion: project.schemaVersion, id: project.id, metadata: project.metadata },
    [MODULE_PATHS.story]: { story: project.story, development: project.development, storyThreads: project.storyThreads },
    [MODULE_PATHS.world]: project.world,
    [MODULE_PATHS.characters]: project.characters,
    [MODULE_PATHS.screenplay]: project.screenplay,
    [MODULE_PATHS.structure]: { structure: project.structure, blocks: project.blocks },
    [MODULE_PATHS.review]: project.review,
    [MODULE_PATHS.production]: project.production,
    [MODULE_PATHS.revisions]: project.revisions,
    [MODULE_PATHS.collaboration]: project.collaboration,
    [MODULE_PATHS.rights]: project.rights,
  };
  return { manifest, files };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A required project module is not a JSON object.");
  return value as Record<string, unknown>;
}

export function parseProjectFolder(files: ProjectFolderFiles): PlotPickleProject {
  const manifest = object(files["manifest.json"]);
  if (manifest.format !== PROJECT_FOLDER_FORMAT || manifest.formatVersion !== PROJECT_FOLDER_VERSION) throw new Error("This folder is not a supported PlotPickle 2.0 project.");
  const identity = object(files[MODULE_PATHS.identity]);
  const story = object(files[MODULE_PATHS.story]);
  const structure = object(files[MODULE_PATHS.structure]);
  const candidate = {
    schemaVersion: identity.schemaVersion,
    id: identity.id,
    metadata: identity.metadata,
    story: story.story,
    development: story.development,
    storyThreads: story.storyThreads,
    world: files[MODULE_PATHS.world],
    characters: files[MODULE_PATHS.characters],
    screenplay: files[MODULE_PATHS.screenplay],
    structure: structure.structure,
    blocks: structure.blocks,
    review: files[MODULE_PATHS.review],
    production: files[MODULE_PATHS.production],
    revisions: files[MODULE_PATHS.revisions],
    collaboration: files[MODULE_PATHS.collaboration],
    rights: files[MODULE_PATHS.rights],
  };
  const normalized = normalizePlotPickleProject(candidate);
  if (!normalized) throw new Error("The project folder could not be normalized to the current PlotPickle schema.");
  return normalized;
}

export const projectFolderModulePaths = Object.values(MODULE_PATHS);
