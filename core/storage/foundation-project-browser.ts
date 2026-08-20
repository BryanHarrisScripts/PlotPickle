import type { PPFProject } from "../project/project";
import {
  PROJECT_LIBRARY_CHANGED_EVENT,
  loadActiveLibraryProject,
  saveActiveLibraryProject,
} from "./project-library-browser";

export const FOUNDATION_PROJECT_SAVED_EVENT = PROJECT_LIBRARY_CHANGED_EVENT;

export function loadFoundationProject(): PPFProject {
  return loadActiveLibraryProject();
}

export function saveFoundationProject(project: PPFProject) {
  saveActiveLibraryProject(project);
}
