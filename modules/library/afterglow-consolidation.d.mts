import type { LibraryPPFProject } from "../../core/storage/library-project";

export type AfterglowConsolidationChange = Readonly<{ path: string; sources: string[] }>;
export type AfterglowConsolidationConflict = Readonly<{
  path: string;
  reason: string;
  sources: string[];
  options?: unknown[];
}>;
export type AfterglowConsolidationReview = Readonly<{
  path: string;
  reason: string;
  sourceProjectId: string;
}>;
export type AfterglowConsolidationPlan = Readonly<{
  candidate: LibraryPPFProject;
  sources: ReadonlyArray<Readonly<{ id: string; revision: number; updatedAt: string }>>;
  applied: AfterglowConsolidationChange[];
  conflicts: AfterglowConsolidationConflict[];
  needsReview: AfterglowConsolidationReview[];
  localAssetsToVerify: string[];
  mergeShapeConsistent: boolean;
  readyForHumanCommit: false;
  packageModified: false;
}>;

/** Pure preview; no current profile, media, or publication authorization. */
export declare function planAfterglowConsolidation(input: {
  readonly baseline: LibraryPPFProject;
  readonly sources: ReadonlyArray<Readonly<{ project: LibraryPPFProject }>>;
}): AfterglowConsolidationPlan;
export declare const AFTERGLOW_DURABLE_FIELDS: readonly string[];

export type AfterglowConflictChoice = number | "baseline";
export type AfterglowDecisionPreview = Readonly<{
  candidate: LibraryPPFProject;
  resolved: ReadonlyArray<Readonly<{ path: string; choice: AfterglowConflictChoice }>>;
  unresolvedConflicts: AfterglowConsolidationConflict[];
  needsReview: AfterglowConsolidationReview[];
  localAssetsToVerify: string[];
  decisionShapeConsistent: boolean;
  readyForHumanCommit: false;
  packageModified: false;
}>;
export declare function reviewAfterglowConsolidationDecisions(
  plan: AfterglowConsolidationPlan,
  decisions: Readonly<Record<string, AfterglowConflictChoice>>,
): AfterglowDecisionPreview;
