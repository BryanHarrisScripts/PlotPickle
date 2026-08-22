import { createEmptyProject, normalizeFoundationProject, type PPFProject } from "../project/project";
import * as libraryCore from "./project-library-core.mjs";

export type ProjectLibrarySourceKind = "user" | "example" | "preset" | "migrated";

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
};

export const PROJECT_LIBRARY_CHANGED_EVENT = libraryCore.PROJECT_LIBRARY_CHANGED_EVENT as string;
export const PROJECT_LIBRARY_ACTIVE_PROFILE_KEY = libraryCore.PROJECT_LIBRARY_ACTIVE_PROFILE_KEY as string;
export const DEFAULT_LOCAL_PROFILE_ID = libraryCore.DEFAULT_LOCAL_PROFILE_ID as string;

function storage() {
  if (typeof window === "undefined") throw new Error("Project Library is available only in the local PlotPickle browser session.");
  return window.sessionStorage;
}

function idFactory() {
  return globalThis.crypto?.randomUUID?.() ?? `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function coreInput() {
  return {
    storage: storage(),
    profileId: profileId(),
    normalizeProject: normalizeFoundationProject,
    createProject: createEmptyProject,
    describeProject,
    now: Date.prototype.toISOString.bind(new Date()),
    idFactory,
  };
}

function announceChange() {
  window.dispatchEvent(new Event(PROJECT_LIBRARY_CHANGED_EVENT));
}

export function initializeProjectLibrary() {
  return libraryCore.initializeProfileProjectLibrary(coreInput()) as {
    readonly registry: { readonly activeProjectId: string; readonly projects: readonly ProjectLibrarySummary[] };
    readonly activeProject: PPFProject;
    readonly migrated: boolean;
    readonly quarantined: readonly string[];
  };
}

export function loadActiveLibraryProject() {
  return initializeProjectLibrary().activeProject;
}

export function saveActiveLibraryProject(project: PPFProject) {
  const result = libraryCore.saveProfileActiveProject({ ...coreInput(), project }) as {
    readonly activeProject: PPFProject;
  };
  announceChange();
  return result.activeProject;
}

export function listLibraryProjects() {
  return libraryCore.listProfileProjectSummaries(coreInput()) as readonly ProjectLibrarySummary[];
}

export function switchActiveLibraryProject(projectId: string) {
  const result = libraryCore.switchProfileActiveProject({ ...coreInput(), projectId }) as {
    readonly activeProject: PPFProject;
  };
  announceChange();
  return result.activeProject;
}

export function createLibraryUserProject(input: {
  readonly title: string;
  readonly genre?: string;
  readonly format?: string;
}) {
  const result = libraryCore.createProfileUserProject({ ...coreInput(), ...input }) as {
    readonly activeProject: PPFProject;
  };
  announceChange();
  return result.activeProject;
}

export function createLibraryWorkingCopy(input: {
  readonly sourceProject: PPFProject;
  readonly sourceKind: "example" | "preset";
  readonly sourceId: string;
  readonly title: string;
  readonly genre: string;
  readonly format: string;
}) {
  const result = libraryCore.createProfileWorkingCopy({ ...coreInput(), ...input }) as {
    readonly activeProject: PPFProject;
  };
  announceChange();
  return result.activeProject;
}
