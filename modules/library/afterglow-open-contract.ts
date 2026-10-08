import type { LibraryPPFProject, ProjectLibrarySummary } from "../../core/storage/project-library-browser";
import type { ProfileRecoveryPoint } from "../../core/storage/profile-private-browser";

export type AfterglowRestoreChoice = Readonly<{
  id: string;
  label: string;
  project: LibraryPPFProject;
  recoveryPointId: string | null;
}>;

/** Inputs come only from the currently hydrated Human profile. */
export function afterglowRestoreChoices(
  summaries: readonly ProjectLibrarySummary[],
  snapshot: (id: string) => LibraryPPFProject | null,
  points: readonly ProfileRecoveryPoint[],
): readonly AfterglowRestoreChoice[] {
  const projects = summaries.flatMap((summary) => {
    if (summary.sourceKind !== "example" || summary.sourceId !== "afterglow-v9" || summary.archivedAt) return [];
    const project = snapshot(summary.id);
    if (!project || project.id !== summary.id) return [];
    return [{ id: `saved:${summary.id}`, label: `Saved changes · ${summary.updatedAt}`, project, recoveryPointId: null }];
  }).sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
  const projectIds = new Set(projects.map((item) => item.project.id));
  const recovery = points.filter((point) => projectIds.has(point.projectId) && point.project.id === point.projectId)
    .map((point) => ({ id: `point:${point.id}`, label: `Recovery point · ${point.createdAt}`, project: point.project, recoveryPointId: point.id }));
  return [...projects, ...recovery];
}

/**
 * Continue the newest complete saved working project by default.
 * This is a presentation preference, NOT a merge of independent project IDs.
 * Older saved projects and explicit recovery points remain profile-owned.
 */
export function latestAfterglowSavedChoice(
  choices: readonly AfterglowRestoreChoice[],
): AfterglowRestoreChoice | null {
  return choices
    .filter((choice) => choice.id === `saved:${choice.project.id}` && choice.recoveryPointId === null)
    .sort((left, right) => right.project.updatedAt.localeCompare(left.project.updatedAt))[0] ?? null;
}
