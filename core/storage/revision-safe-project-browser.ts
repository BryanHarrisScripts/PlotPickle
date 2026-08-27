import type { PPFProject } from "../project/project";
import { RevisionConflictError } from "./project-store";
import {
  loadFoundationProject,
  saveFoundationProject,
} from "./foundation-project-browser";

/**
 * Save one already-reviewed canonical PPF mutation only if the active profile
 * still points at the exact project revision that Workbench reviewed.
 */
export function saveFoundationProjectAtRevision(project: PPFProject, expectedRevision: number) {
  const current = loadFoundationProject();
  if (current.id !== project.id) {
    throw new Error("The active PlotPickle story changed while Story Workbench was open.");
  }
  if (current.revision !== expectedRevision) {
    throw new RevisionConflictError(project.id, expectedRevision, current.revision);
  }
  if (project.revision !== expectedRevision + 1) {
    throw new Error(`Story Workbench expected exactly one canonical revision advance from ${expectedRevision} to ${expectedRevision + 1}.`);
  }
  return saveFoundationProject(project);
}
