import type { LibraryPPFProject, ProjectLibrarySummary } from "../../core/storage/project-library-browser";
import type { ProfileRecoveryPoint } from "../../core/storage/profile-private-browser";

export type AfterglowReviewSource = Readonly<{
  project: LibraryPPFProject;
  sourceKey?: string;
  savedAt: string;
  sourceKind: "working-copy" | "recovery-point" | "archived-copy";
}>;
export function collectAfterglowReviewSources(input: Readonly<{
  active: readonly ProjectLibrarySummary[];
  archived: readonly ProjectLibrarySummary[];
  recoveryPoints: readonly ProfileRecoveryPoint[];
  load: (id: string)=>LibraryPPFProject | null;
}>): Readonly<{ sources: AfterglowReviewSource[]; warnings: string[] }>;
