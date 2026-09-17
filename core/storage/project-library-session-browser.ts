import {
  DEFAULT_LOCAL_PROFILE_ID,
  PROJECT_LIBRARY_ACTIVE_PROFILE_KEY,
  initializeProjectLibrary,
  type LibraryPPFProject,
} from "./project-library-browser";

export const PROJECT_LIBRARY_SESSION_CHANGED_EVENT = "plotpickle:project-library-session-changed";

const SESSION_PROJECT_KEY_PREFIX = "plotpickle.project-library.session-project";

function storage() {
  if (typeof window === "undefined") throw new Error("Project Library session state is available only in the local PlotPickle browser session.");
  return window.sessionStorage;
}

function profileId() {
  return storage().getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)?.trim() || DEFAULT_LOCAL_PROFILE_ID;
}

function sessionProjectKey() {
  return `${SESSION_PROJECT_KEY_PREFIX}:${profileId()}`;
}

function announceChange() {
  window.dispatchEvent(new Event(PROJECT_LIBRARY_SESSION_CHANGED_EVENT));
}

export function markCurrentSessionLibraryProject(projectId: string) {
  const normalized = projectId.trim();
  if (!normalized) throw new Error("A current-session story requires a project ID.");
  storage().setItem(sessionProjectKey(), normalized);
  announceChange();
}

export function clearCurrentSessionLibraryProject() {
  storage().removeItem(sessionProjectKey());
  announceChange();
}

export function currentSessionLibraryProject(): LibraryPPFProject | null {
  const projectId = storage().getItem(sessionProjectKey())?.trim();
  if (!projectId) return null;

  const activeProject = initializeProjectLibrary().activeProject;
  if (!activeProject || activeProject.id !== projectId) return null;
  return activeProject;
}
