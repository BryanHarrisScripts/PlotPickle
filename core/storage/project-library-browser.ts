import { createEmptyProject, type PPFProject } from "../project/project";
import { createEmptyWorldMapState, normalizeWorldMapState } from "../contracts/world-map";
import { createEmptyDiscoveryState, normalizeDiscoveryState } from "../contracts/discovery";
import { createEmptyProjectSourceEvidence, normalizeProjectSourceEvidence } from "../contracts/imported-screenplay-evidence";
import {
  createEmptyBlockWritingState,
  normalizeBlockWritingState,
} from "../contracts/block-writing";
import {
  createEmptyStoryStructureV2,
  normalizeStoryStructureV2,
} from "../project/story-structure-v2";
import {
  createEmptyMindMapNotesState,
  createEmptyStoryDevelopmentState,
  normalizeLibraryProject,
  normalizeMindMapNotesState,
  normalizeStoryDevelopmentState,
  type LibraryPPFProject,
} from "./library-project";
import * as libraryCore from "./project-library-core.mjs";

export type { LibraryPPFProject } from "./library-project";

export type ProjectLibrarySourceKind = "user" | "example" | "preset" | "migrated" | "import" | "synthetic";

export const AFTERGLOW_EXAMPLE_SOURCE_ID = "afterglow-v9" as const;
export const AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID = "afterglow-v9-defaults" as const;
export const PROJECT_LIBRARY_SESSION_PROJECT_KEY_PREFIX = "plotpickle.project-library.session-project" as const;
export const PROJECT_LIBRARY_SESSION_HANDOFF_KEY_PREFIX = libraryCore.PROJECT_LIBRARY_SESSION_HANDOFF_KEY_PREFIX as string;

export type ProjectLibrarySummary = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly progress: number;
  readonly frontier: string;
  readonly thumbnail: string;
  readonly sourceKind: ProjectLibrarySourceKind;
  readonly sourceId: string | null;
  readonly genre: string;
  readonly format: string;
  readonly archivedAt: string | null;
};

export const PROJECT_LIBRARY_CHANGED_EVENT = libraryCore.PROJECT_LIBRARY_CHANGED_EVENT as string;
export const PROJECT_LIBRARY_ACTIVE_PROFILE_KEY = libraryCore.PROJECT_LIBRARY_ACTIVE_PROFILE_KEY as string;
export const DEFAULT_LOCAL_PROFILE_ID = libraryCore.DEFAULT_LOCAL_PROFILE_ID as string;

const PROJECT_SNAPSHOT_KEY_MARKER = ".projects.";
const projectSnapshotSessionCache = new Map<string, string>();

type ActiveProjectReadCache = Readonly<{
  profileId: string;
  registryRaw: string;
  projectRaw: string;
  project: LibraryPPFProject;
}>;

type DetachedProjectCache = Readonly<{
  profileId: string;
  project: LibraryPPFProject;
}>;

let activeProjectReadCache: ActiveProjectReadCache | null = null;
let detachedProjectCache: DetachedProjectCache | null = null;

function isProjectSnapshotKey(key: string) {
  // Authenticated Human projects have an encrypted profile-vault backing store.
  // Autonomous Guest checkpoints still rely on Web Storage and must remain visible there.
  return key.startsWith("plotpickle.library.profile.v1.profile_") && key.includes(PROJECT_SNAPSHOT_KEY_MARKER);
}

function storageKeys(browserStorage: Storage) {
  const keys = Array.from({ length: browserStorage.length }, (_, index) => browserStorage.key(index))
    .filter((key): key is string => Boolean(key));
  for (const key of projectSnapshotSessionCache.keys()) {
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

function sessionLibraryStorage(browserStorage: Storage): Storage {
  return {
    get length() {
      return storageKeys(browserStorage).length;
    },
    clear() {
      projectSnapshotSessionCache.clear();
      browserStorage.clear();
      activeProjectReadCache = null;
      detachedProjectCache = null;
    },
    getItem(key: string) {
      if (projectSnapshotSessionCache.has(key)) return projectSnapshotSessionCache.get(key) ?? null;
      return browserStorage.getItem(key);
    },
    key(index: number) {
      return storageKeys(browserStorage)[index] ?? null;
    },
    removeItem(key: string) {
      projectSnapshotSessionCache.delete(key);
      browserStorage.removeItem(key);
      activeProjectReadCache = null;
    },
    setItem(key: string, value: string) {
      const normalized = String(value);
      if (isProjectSnapshotKey(key)) {
        projectSnapshotSessionCache.set(key, normalized);
        // Retire any legacy Web Storage copy so large project snapshots cannot consume browser quota.
        browserStorage.removeItem(key);
      } else {
        browserStorage.setItem(key, normalized);
      }
      activeProjectReadCache = null;
    },
  };
}

function storage() {
  if (typeof window === "undefined") throw new Error("Project Library is available only in the local PlotPickle browser session.");
  return sessionLibraryStorage(window.sessionStorage);
}

export function clearLibraryProjectSessionCache() {
  projectSnapshotSessionCache.clear();
  activeProjectReadCache = null;
  detachedProjectCache = null;
}

function idFactory() {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function createEmptyLibraryProject(input: { readonly id: string; readonly now: string; readonly title?: string }): LibraryPPFProject {
  return normalizeLibraryProject(createEmptyProject(input));
}

function answerCount(project: PPFProject) {
  const foundationAnswers = Object.values(project.foundations.lessons)
    .reduce((total, lesson) => total + Object.keys(lesson.answers).length, 0);
  const worldAnswers = Object.values(project.world.lessons)
    .reduce((total, lesson) => total + Object.keys(lesson.answers).length, 0);
  return foundationAnswers + worldAnswers;
}

function describeProject(project: PPFProject) {
  const acceptedFoundations = project.build.foundations.acceptedVisualArtifactIds.length;
  const acceptedWorld = project.build.world.acceptedVisualArtifactIds.length;
  const evidence = project.learning.completedLessonIds.length + answerCount(project) + acceptedFoundations + acceptedWorld;
  const progress = Math.min(100, Math.round((evidence / 24) * 100));
  const frontier = acceptedWorld
    ? "World Build"
    : Object.keys(project.world.lessons).length
      ? "World"
      : acceptedFoundations
        ? "Foundations Build"
        : Object.keys(project.foundations.lessons).length
          ? "Foundations"
          : "Getting Started";
  const worldThumbnail = [...project.build.world.visualArtifacts].reverse().find((item) => item.assetUrl)?.assetUrl;
  const foundationThumbnail = [...project.build.foundations.visualArtifacts].reverse().find((item) => item.assetUrl)?.assetUrl;
  return { progress, frontier, thumbnail: worldThumbnail || foundationThumbnail || "" };
}

function profileId() {
  return libraryCore.resolveProjectLibraryProfileId(storage()) as string;
}

function sessionProjectKey(activeProfileId = profileId()) {
  return `${PROJECT_LIBRARY_SESSION_PROJECT_KEY_PREFIX}:${activeProfileId}`;
}

export function sessionActiveProjectId() {
  return window.sessionStorage.getItem(sessionProjectKey())?.trim() || null;
}

export function stageSessionActiveProjectHandoff() {
  const projectId = sessionActiveProjectId();
  if (!projectId) return null;
  return libraryCore.stageProjectLibrarySessionHandoff({
    storage: window.sessionStorage,
    profileId: profileId(),
    projectId,
    nowMs: Date.now(),
  }) as string;
}

export function consumeSessionActiveProjectHandoff(activeProfileId: string) {
  return libraryCore.consumeProjectLibrarySessionHandoff({
    storage: window.sessionStorage,
    profileId: activeProfileId,
    nowMs: Date.now(),
  }) as string | null;
}

export function resumeSessionActiveProject(projectId: string) {
  const snapshot = loadLibraryProjectSnapshot(projectId);
  if (!snapshot) return null;
  markSessionActiveProject(projectId);
  announceChange();
  return snapshot;
}

function markSessionActiveProject(projectId: string) {
  const normalized = projectId.trim();
  if (!normalized) throw new Error("A current-session story requires a project ID.");
  window.sessionStorage.setItem(sessionProjectKey(), normalized);
  detachedProjectCache = null;
}

export function clearSessionActiveProject() {
  window.sessionStorage.removeItem(sessionProjectKey());
  detachedProjectCache = null;
}

export function unloadActiveLibraryProject() {
  const projectId = sessionActiveProjectId();
  if (!projectId) return null;
  clearSessionActiveProject();
  announceChange();
  return projectId;
}

function coreInput() {
  return {
    storage: storage(),
    profileId: profileId(),
    normalizeProject: normalizeLibraryProject,
    createProject: createEmptyLibraryProject,
    describeProject,
    now: Date.prototype.toISOString.bind(new Date()),
    idFactory,
  };
}

function readActiveProjectSnapshotFast(): LibraryPPFProject | null {
  const browserStorage = storage();
  const activeProfileId = profileId();
  const registryKey = libraryCore.projectLibraryRegistryKey(activeProfileId) as string;
  const registryRaw = browserStorage.getItem(registryKey);
  if (!registryRaw) return null;

  try {
    const registry = JSON.parse(registryRaw) as Readonly<Record<string, unknown>>;
    if (
      registry.version !== libraryCore.PROJECT_LIBRARY_VERSION
      || registry.profileId !== activeProfileId
      || typeof registry.activeProjectId !== "string"
      || !registry.activeProjectId.trim()
    ) return null;

    const activeProjectId = registry.activeProjectId.trim();
    const projectKey = libraryCore.projectLibraryProjectKey(activeProfileId, activeProjectId) as string;
    const projectRaw = browserStorage.getItem(projectKey);
    if (!projectRaw) return null;

    if (
      activeProjectReadCache?.profileId === activeProfileId
      && activeProjectReadCache.registryRaw === registryRaw
      && activeProjectReadCache.projectRaw === projectRaw
    ) return activeProjectReadCache.project;

    const entry = JSON.parse(projectRaw) as Readonly<Record<string, unknown>>;
    if (
      entry.version !== libraryCore.PROJECT_LIBRARY_VERSION
      || entry.profileId !== activeProfileId
      || entry.projectId !== activeProjectId
      || !entry.project
      || typeof entry.project !== "object"
      || Array.isArray(entry.project)
    ) return null;

    const project = normalizeLibraryProject(entry.project);
    activeProjectReadCache = { profileId: activeProfileId, registryRaw, projectRaw, project };
    return project;
  } catch {
    return null;
  }
}

function isImplicitStartupPlaceholder(summary: ProjectLibrarySummary) {
  return summary.sourceKind === "user"
    && summary.sourceId === null
    && summary.title === "Untitled Story"
    && summary.progress === 0
    && !summary.thumbnail
    && summary.createdAt === summary.updatedAt;
}

function announceChange() {
  window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGED_EVENT));
}

export function hydrateProfileProjectLibrary(input: {
  readonly activeProjectId: string | null;
  readonly projects: readonly Readonly<{ readonly project: unknown; readonly summary?: Readonly<Record<string, unknown>> }>[];
}) {
  const result = libraryCore.hydrateProfileProjectLibrary({
    ...coreInput(),
    activeProjectId: input.activeProjectId,
    projects: input.projects,
  }) as {
    readonly registry: { readonly activeProjectId: string | null; readonly projects: readonly ProjectLibrarySummary[] };
    readonly activeProject: LibraryPPFProject | null;
    readonly migrated: boolean;
    readonly quarantined: readonly string[];
  };
  announceChange();
  return result;
}

export function initializeProjectLibrary() {
  return libraryCore.initializeProfileProjectLibrary(coreInput()) as {
    readonly registry: { readonly activeProjectId: string | null; readonly projects: readonly ProjectLibrarySummary[] };
    readonly activeProject: LibraryPPFProject | null;
    readonly migrated: boolean;
    readonly quarantined: readonly string[];
  };
}

export function hasActiveLibraryProject() {
  const currentProjectId = sessionActiveProjectId();
  return Boolean(currentProjectId && loadLibraryProjectSnapshot(currentProjectId));
}

/**
 * Return the project currently visible to authoring/review surfaces.
 *
 * With an explicit Library choice this is the active durable project. Without
 * one it is a detached, empty project that exists only for the current browser
 * runtime until the Human chooses Save as New Project.
 */
export function loadActiveLibraryProject(): LibraryPPFProject {
  const currentProjectId = sessionActiveProjectId();
  if (currentProjectId) {
    const currentProject = loadLibraryProjectSnapshot(currentProjectId);
    if (currentProject) return currentProject;
    clearSessionActiveProject();
  }

  const activeProfileId = profileId();
  if (detachedProjectCache?.profileId === activeProfileId) return detachedProjectCache.project;

  const initialized = initializeProjectLibrary();
  const implicitPlaceholder = initialized.registry.projects.find((item) => isImplicitStartupPlaceholder(item));
  const placeholderProject = implicitPlaceholder ? loadLibraryProjectSnapshot(implicitPlaceholder.id) : null;
  const now = new Date().toISOString();
  const project = placeholderProject ?? createEmptyLibraryProject({
    id: idFactory(),
    now,
    title: "Untitled Story",
  });
  detachedProjectCache = { profileId: activeProfileId, project };
  return project;
}

export function saveActiveLibraryProject(project: PPFProject | LibraryPPFProject) {
  const initialized = initializeProjectLibrary();
  const incoming = objectRecord(project);
  const hasStructure = Boolean(incoming.structure && typeof incoming.structure === "object" && !Array.isArray(incoming.structure));
  const structure = hasStructure
    ? normalizeStoryStructureV2(incoming.structure)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.structure
      : createEmptyStoryStructureV2();
  const writing = "writing" in incoming
    ? normalizeBlockWritingState(incoming.writing)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.writing
      : createEmptyBlockWritingState();
  const worldMap = "worldMap" in incoming
    ? normalizeWorldMapState(incoming.worldMap)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.worldMap
      : createEmptyWorldMapState();
  const discovery = "discovery" in incoming
    ? normalizeDiscoveryState(incoming.discovery)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.discovery
      : createEmptyDiscoveryState();
  const sourceEvidence = "sourceEvidence" in incoming
    ? normalizeProjectSourceEvidence(incoming.sourceEvidence)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.sourceEvidence
      : createEmptyProjectSourceEvidence();
  const storyDevelopment = "storyDevelopment" in incoming
    ? normalizeStoryDevelopmentState(incoming.storyDevelopment)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.storyDevelopment
      : createEmptyStoryDevelopmentState();
  const mindMapNotes = "mindMapNotes" in incoming
    ? normalizeMindMapNotesState(incoming.mindMapNotes)
    : initialized.activeProject?.id === project.id
      ? initialized.activeProject.mindMapNotes
      : createEmptyMindMapNotesState();
  const projectWithStructure = { ...project, structure, sourceEvidence, writing, discovery, worldMap, storyDevelopment, mindMapNotes };
  const referenceFixture = objectRecord(objectRecord(incoming.sourceEvidence).referenceFixture);
  const afterglowReference = referenceFixture.sourceId === "afterglow-v9-complete-baseline";
  const priorSummary = initialized.registry.projects.find((item) => item.id === project.id);
  const afterglowSourceId = afterglowReference
    ? (
      priorSummary?.sourceId === AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID && project.revision === 0
        ? AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID
        : AFTERGLOW_EXAMPLE_SOURCE_ID
    )
    : null;
  const firstMeaningfulSave = !sessionActiveProjectId() && Boolean(priorSummary && isImplicitStartupPlaceholder(priorSummary));
  const result = libraryCore.saveProfileActiveProject({
    ...coreInput(),
    project: projectWithStructure,
    ...(afterglowReference
      ? { sourceKind: "example", sourceId: afterglowSourceId }
      : firstMeaningfulSave
        ? { sourceKind: "user", sourceId: "first-meaningful-save" }
        : {}),
  }) as {
    readonly activeProject: LibraryPPFProject;
  };
  markSessionActiveProject(result.activeProject.id);
  announceChange();
  return result.activeProject;
}

export function loadLibraryProjectSnapshot(projectId: string): LibraryPPFProject | null {
  return libraryCore.readProfileProjectSnapshot({
    ...coreInput(),
    projectId,
  }) as LibraryPPFProject | null;
}

/** Exact cached snapshot identity, without parsing another story on every Save. */
export function libraryProjectSnapshotText(projectId: string): string | null {
  return storage().getItem(libraryCore.projectLibraryProjectKey(profileId(), projectId) as string);
}

export function listLibraryProjects() {
  return libraryCore.listProfileProjectSummaries(coreInput()) as readonly ProjectLibrarySummary[];
}

export function listPersistableLibraryProjects() {
  return listLibraryProjects().filter((item) => !isImplicitStartupPlaceholder(item));
}

export function listArchivedLibraryProjects() {
  return libraryCore.listProfileArchivedProjectSummaries(coreInput()) as readonly ProjectLibrarySummary[];
}

export function listHumanLibraryProjects() {
  return listPersistableLibraryProjects().filter((item) => item.sourceKind !== "example" && item.sourceKind !== "synthetic");
}

export function listHumanArchivedLibraryProjects() {
  return listArchivedLibraryProjects().filter((item) => item.sourceKind !== "example" && item.sourceKind !== "synthetic");
}

export function listAfterglowExampleProjects() {
  return listLibraryProjects()
    .filter((item) => item.sourceKind === "example" && item.sourceId === AFTERGLOW_EXAMPLE_SOURCE_ID)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function latestAfterglowExampleProject() {
  return listAfterglowExampleProjects()[0] ?? null;
}

export function switchActiveLibraryProject(projectId: string) {
  const result = libraryCore.switchProfileActiveProject({ ...coreInput(), projectId }) as {
    readonly activeProject: LibraryPPFProject;
  };
  markSessionActiveProject(result.activeProject.id);
  announceChange();
  return result.activeProject;
}

export function createLibraryUserProject(input: {
  readonly title: string;
  readonly genre?: string;
  readonly format?: string;
}) {
  const created = libraryCore.createProfileUserProject({ ...coreInput(), ...input }) as {
    readonly activeProject: LibraryPPFProject;
  };
  const result = libraryCore.saveProfileActiveProject({
    ...coreInput(),
    project: created.activeProject,
    sourceKind: "user",
    sourceId: "human-new-story",
    genre: input.genre || "",
    format: input.format || "Story",
  }) as { readonly activeProject: LibraryPPFProject };
  markSessionActiveProject(result.activeProject.id);
  announceChange();
  return result.activeProject;
}

/**
 * Turn the detached blank workspace into a Human-owned Library project.
 *
 * The durable project receives a fresh Library identity. The detached runtime
 * id is never promoted directly, which keeps login Blank distinct from saved
 * projects and packaged examples.
 */
export function saveDetachedLibraryProjectAs(
  project: PPFProject | LibraryPPFProject,
  input: {
    readonly title: string;
    readonly genre?: string;
    readonly format?: string;
  },
) {
  if (hasActiveLibraryProject()) {
    throw new Error("Save as New Project is only valid before a Library project has been selected.");
  }
  const title = input.title.trim();
  if (!title) throw new Error("Save as New Project requires a project name.");

  const created = libraryCore.createProfileUserProject({
    ...coreInput(),
    title,
    genre: input.genre || "",
    format: input.format || "Feature",
  }) as { readonly activeProject: LibraryPPFProject };
  const now = new Date().toISOString();
  const adopted = normalizeLibraryProject({
    ...project,
    id: created.activeProject.id,
    title,
    createdAt: created.activeProject.createdAt,
    updatedAt: now,
  });
  const result = libraryCore.saveProfileActiveProject({
    ...coreInput(),
    project: adopted,
    sourceKind: "user",
    sourceId: "first-meaningful-save",
    genre: input.genre || "",
    format: input.format || "Feature",
  }) as { readonly activeProject: LibraryPPFProject };
  markSessionActiveProject(result.activeProject.id);
  detachedProjectCache = null;
  announceChange();
  return result.activeProject;
}

export function createLibraryWorkingCopy(input: {
  readonly sourceProject: PPFProject;
  readonly sourceKind: "example" | "preset" | "synthetic";
  readonly sourceId: string;
  readonly title: string;
  readonly genre: string;
  readonly format: string;
}) {
  const result = libraryCore.createProfileWorkingCopy({ ...coreInput(), ...input }) as {
    readonly activeProject: LibraryPPFProject;
  };
  markSessionActiveProject(result.activeProject.id);
  announceChange();
  return result.activeProject;
}

export function importLibraryProject(input: {
  readonly sourceProject: LibraryPPFProject;
  readonly sourceId: string;
  readonly title: string;
  readonly genre?: string;
  readonly format?: string;
}) {
  const result = libraryCore.createProfileWorkingCopy({
    ...coreInput(),
    sourceProject: input.sourceProject,
    sourceKind: "import",
    sourceId: input.sourceId,
    title: input.title,
    genre: input.genre || "",
    format: input.format || "Imported screenplay",
  }) as { readonly activeProject: LibraryPPFProject };
  markSessionActiveProject(result.activeProject.id);
  announceChange();
  return result.activeProject;
}

export function archiveLibraryProject(projectId: string) {
  const result = libraryCore.archiveProfileProject({ ...coreInput(), projectId }) as {
    readonly activeProject: LibraryPPFProject | null;
  };
  if (sessionActiveProjectId() === projectId) clearSessionActiveProject();
  announceChange();
  return result.activeProject;
}

export function restoreArchivedLibraryProject(projectId: string) {
  const result = libraryCore.restoreProfileProject({ ...coreInput(), projectId }) as {
    readonly activeProject: LibraryPPFProject | null;
  };
  announceChange();
  return result.activeProject;
}

export function deleteArchivedLibraryProject(projectId: string) {
  const result = libraryCore.deleteArchivedProfileProject({ ...coreInput(), projectId }) as {
    readonly activeProject: LibraryPPFProject | null;
  };
  announceChange();
  return result.activeProject;
}
