import type { PPFProject } from "../../project/project";
import { RevisionConflictError } from "../project-store";
import {
  loadFoundationProject,
  saveFoundationProject,
} from "../foundation-project-browser";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "../project-library-browser";
import { flushProfilePrivateWrites, persistActiveProfileProject } from "../profile-private-browser";

/** Preserve a current Human decision and acknowledge its encrypted backing write. */
export async function saveFoundationProjectDurably(project: PPFProject, expectedRevision: number) {
  const profileId = window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
  const current = loadFoundationProject();
  if (current.id !== project.id) throw new Error("The active PlotPickle story changed before this decision could be saved.");
  if (current.revision !== expectedRevision) throw new RevisionConflictError(project.id, expectedRevision, current.revision);
  const saved = saveFoundationProject(project);
  await persistActiveProfileProject();
  await flushProfilePrivateWrites();
  const latest = loadFoundationProject();
  if (window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY) !== profileId) throw new Error("The Human profile changed while this decision was being persisted.");
  if (latest.id !== saved.id) throw new Error("The active PlotPickle story changed while this decision was being persisted.");
  return latest;
}

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
