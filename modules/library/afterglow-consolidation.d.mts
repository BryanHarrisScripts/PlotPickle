import type { LibraryPPFProject } from "../../core/storage/library-project";

export type AfterglowConsolidationChange = Readonly<{ path: string; sources: string[]; baselineAbsent: boolean; baselineValue: unknown }>;
export type AfterglowConsolidationConflict = Readonly<{
  path: string;
  reason: string;
  sources: string[];
  optionSources?: string[];
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
  /** Read-only canonical field mapping: matching a question is not semantic proof. */
  questionEvidence: ReadonlyArray<Readonly<{
    fieldId: string;
    path: string;
    question: string | null;
    questionStatus: "catalog-not-provided" | "canonical-question-matched" | "unknown-canonical-question";
    semanticStatus: "not-assessed";
    sourceProjectIds: string[];
    distinctAnswers: number;
  }>>;
  /** Existing Human visual acceptances reconciled from every snapshot. */
  reconciledVisuals: ReadonlyArray<Readonly<{
    path: string;
    artifactId: string;
    scope: "foundations" | "world";
    sources: string[];
    kind: "preserved-existing-human-acceptance";
  }>>;
  conflicts: AfterglowConsolidationConflict[];
  needsReview: AfterglowConsolidationReview[];
  localAssetsToVerify: string[];
  /** All distinct asset URLs in all source snapshots, not byte-verified. */
  sourceMediaReferences: string[];
  mergeShapeConsistent: boolean;
  readyForHumanCommit: false;
  packageModified: false;
}>;

/** Pure preview; no current profile, media, or publication authorization. */
export declare function planAfterglowConsolidation(input: {
  readonly baseline: LibraryPPFProject;
  readonly sources: ReadonlyArray<Readonly<{ project: LibraryPPFProject }>>;
  /** Exact canonical field ID → original curriculum prompt; required by live UI. */
  readonly questions?: Readonly<Record<string, string>>;
}): AfterglowConsolidationPlan;
export declare const AFTERGLOW_DURABLE_FIELDS: readonly string[];
export declare function describeAfterglowConsolidationConflict(path: string): Readonly<{
  kind: "visual-approval-collection" | "narration-approval-collection" |
    "shot-narration-approval" | "authorship-metadata" | "story-field-content" | "other";
  label: string;
  requiresSpecialReconciliation: boolean;
}>;

export type AfterglowConflictChoice = number | "baseline";
export type AfterglowDecisionPreview = Readonly<{
  candidate: LibraryPPFProject;
  resolved: ReadonlyArray<Readonly<{ path: string; choice: AfterglowConflictChoice }>>;
  excluded: readonly string[];
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
  exclusions?: readonly string[],
): AfterglowDecisionPreview;
