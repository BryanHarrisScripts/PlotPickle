import type { PlotPickleProject, StoryBlock } from "./project";
import { normalizePlotPickleProject } from "./project";
import {
  MODULE_FORMAT_VERSION,
  blockModuleFiles,
  characterModuleFiles,
  fountainText,
  moduleManifestEntries,
  safeModuleStem,
  voiceprintModuleFiles,
  type ModuleManifestEntry,
} from "./project-modules";

export const PROJECT_FOLDER_FORMAT = "plotpickle-project" as const;
export const PROJECT_FOLDER_VERSION = "2.1.0" as const;

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
  modules: Record<string, ModuleManifestEntry>;
  canon: { root: string; policy: "approved-only" };
  rights: { path: string };
  imports: Array<Record<string, unknown>>;
  extensions: Record<string, unknown>;
};

export type ProjectFolderFiles = Record<string, unknown>;

type CollectionIndex = { items?: Array<{ path?: string }> };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A required project module is not a JSON object.");
  return value as Record<string, unknown>;
}

function arrayAt(files: ProjectFolderFiles, indexPath: string) {
  const index = object(files[indexPath]) as CollectionIndex;
  return (index.items ?? []).map((item) => {
    if (!item.path || !(item.path in files)) throw new Error(`A module item referenced by ${indexPath} is missing.`);
    return files[item.path];
  });
}

function miniBlockFiles(project: PlotPickleProject) {
  const structure = project.structure as unknown as Record<string, unknown>;
  const miniBlocks = Array.isArray(structure.miniBlocks) ? structure.miniBlocks : [];
  const items = miniBlocks.map((value, index) => {
    const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const blockNumber = typeof record.blockNumber === "number" ? record.blockNumber : Math.floor(index / 4) + 1;
    const position = typeof record.position === "number" ? record.position : index % 4 + 1;
    return { path: `96-blocks/block-${String(blockNumber).padStart(2, "0")}-${String(position).padStart(2, "0")}.json`, value };
  });
  return {
    index: { schemaVersion: MODULE_FORMAT_VERSION, count: items.length, items: items.map(({ path }) => ({ path })) },
    files: Object.fromEntries(items.map(({ path, value }) => [path, value])),
  };
}

export function projectFolderName(project: PlotPickleProject) {
  return safeModuleStem(project.metadata.title, "untitled-story");
}

export function createProjectFolder(project: PlotPickleProject, applicationVersion = "1.0.0-rc.3") {
  const imports = project.screenplay.importedAt ? [{
    id: `import-${project.id}`,
    type: project.screenplay.format,
    sourceFilename: project.screenplay.fileName,
    importedAt: project.screenplay.importedAt,
    reviewStatus: project.screenplay.analysisStatus,
  }] : [];
  const manifest: ProjectFolderManifest = {
    $schema: "https://plotpickle.org/schemas/2.1/manifest.schema.json",
    format: PROJECT_FOLDER_FORMAT,
    formatVersion: PROJECT_FOLDER_VERSION,
    projectId: project.id,
    title: project.metadata.title,
    createdAt: project.metadata.createdAt,
    updatedAt: project.metadata.updatedAt,
    createdWith: `PlotPickle ${applicationVersion}`,
    minimumReaderVersion: "2.0.0",
    modules: moduleManifestEntries(),
    canon: { root: "canon/", policy: "approved-only" },
    rights: { path: "canon/rights.json" },
    imports,
    extensions: { legacySchemaVersion: project.schemaVersion, modularArchitecture: "phase-3" },
  };

  const characters = characterModuleFiles(project.characters);
  const voiceprints = voiceprintModuleFiles(project.characters);
  const blocks = blockModuleFiles(project.blocks);
  const miniBlocks = miniBlockFiles(project);
  const storyboardFrames = project.blocks.flatMap((block) => block.visuals.map((frame) => ({ ...frame, blockId: block.id, blockNumber: block.number })));

  const files: ProjectFolderFiles = {
    "manifest.json": manifest,
    "project/identity.json": { schemaVersion: project.schemaVersion, id: project.id, metadata: project.metadata },
    "story/story.json": project.story,
    "story/development.json": project.development,
    "story/threads.json": project.storyThreads,
    "world/world.json": project.world,
    "characters/index.json": characters.index,
    ...characters.files,
    "voiceprints/index.json": voiceprints.index,
    ...voiceprints.files,
    "screenplay/module.json": project.screenplay,
    "screenplay/main.fountain": fountainText(project),
    "24-blocks/index.json": { ...blocks.index, structure: project.structure },
    ...blocks.files,
    "96-blocks/index.json": miniBlocks.index,
    ...miniBlocks.files,
    "storyboard/index.json": { schemaVersion: MODULE_FORMAT_VERSION, frameCount: storyboardFrames.length, frames: storyboardFrames },
    "production/module.json": project.production,
    "research/index.json": { schemaVersion: MODULE_FORMAT_VERSION, notes: project.development.notes.research, sources: project.development.notes.sources, attachments: [] },
    "canon/index.json": { schemaVersion: MODULE_FORMAT_VERSION, policy: "approved-only", files: ["canon/rules.json", "canon/continuity.json", "canon/timeline.json", "canon/glossary.json", "canon/rights.json"] },
    "canon/rules.json": { worldRules: project.world.rules, technology: project.world.technology, approvedFacts: [] },
    "canon/continuity.json": { notes: project.development.notes.continuity, issues: [], callbacks: [], foreshadowing: [] },
    "canon/timeline.json": { period: project.world.period, history: project.world.history, events: [] },
    "canon/glossary.json": { entries: [] },
    "canon/rights.json": project.rights,
    "review/module.json": project.review,
    "reports/revisions.json": project.revisions,
    "collaboration/module.json": project.collaboration,
    "imports/index.json": { schemaVersion: MODULE_FORMAT_VERSION, imports },
    "plugins/registry.json": { schemaVersion: MODULE_FORMAT_VERSION, plugins: [], disabledUnknownModules: [] },
  };
  return { manifest, files };
}

export function parseProjectFolder(files: ProjectFolderFiles): PlotPickleProject {
  const manifest = object(files["manifest.json"]);
  if (manifest.format !== PROJECT_FOLDER_FORMAT || !["2.0.0", PROJECT_FOLDER_VERSION].includes(String(manifest.formatVersion))) {
    throw new Error("This folder is not a supported PlotPickle 2.x project.");
  }

  // Phase 2 folders remain readable and are migrated in memory on the next save.
  if (manifest.formatVersion === "2.0.0") {
    const identity = object(files["project/identity.json"]);
    const story = object(files["story/module.json"]);
    const structure = object(files["blocks/module.json"]);
    const legacy = normalizePlotPickleProject({
      schemaVersion: identity.schemaVersion, id: identity.id, metadata: identity.metadata,
      story: story.story, development: story.development, storyThreads: story.storyThreads,
      world: files["world/module.json"], characters: files["characters/module.json"], screenplay: files["screenplay/module.json"],
      structure: structure.structure, blocks: structure.blocks, review: files["review/module.json"], production: files["production/module.json"],
      revisions: files["reports/revisions.json"], collaboration: files["collaboration/module.json"], rights: files["canon/rights.json"],
    });
    if (!legacy) throw new Error("The Phase 2 project folder could not be migrated.");
    return legacy;
  }

  const identity = object(files["project/identity.json"]);
  const structureIndex = object(files["24-blocks/index.json"]);
  const blocks = arrayAt(files, "24-blocks/index.json") as StoryBlock[];
  const candidate = {
    schemaVersion: identity.schemaVersion,
    id: identity.id,
    metadata: identity.metadata,
    story: files["story/story.json"],
    development: files["story/development.json"],
    storyThreads: files["story/threads.json"],
    world: files["world/world.json"],
    characters: arrayAt(files, "characters/index.json"),
    screenplay: files["screenplay/module.json"],
    structure: structureIndex.structure,
    blocks,
    review: files["review/module.json"],
    production: files["production/module.json"],
    revisions: files["reports/revisions.json"],
    collaboration: files["collaboration/module.json"],
    rights: files["canon/rights.json"],
  };
  const normalized = normalizePlotPickleProject(candidate);
  if (!normalized) throw new Error("The modular project folder could not be normalized to the current PlotPickle schema.");
  return normalized;
}

export function pathsFromManifest(manifestValue: unknown) {
  const manifest = object(manifestValue) as unknown as ProjectFolderManifest;
  const paths = new Set<string>(["manifest.json"]);
  for (const module of Object.values(manifest.modules ?? {})) paths.add(module.path);
  return [...paths];
}
