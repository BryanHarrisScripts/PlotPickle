import type { LibraryPPFProject } from "../../core/storage/library-project";
import type { AfterglowConsolidationPlan, AfterglowDecisionPreview } from "./afterglow-consolidation.mjs";
import type { AfterglowMediaVerification } from "./afterglow-media-integrity.mjs";

export type AfterglowSavedSnapshotProof = Readonly<{
  id: string; revision: number; updatedAt: string; digest: string;
}>;
export type AfterglowMasterSavePreflight = Readonly<{
  sourceCount: number;
  questionCount: number;
  selectedMediaCount: number;
  blockers: ReadonlyArray<Readonly<{code:string;detail:string}>>;
  readyForHumanCommit: false;
  packageModified: false;
}>;
export declare function preflightAfterglowMasterSave(input: {
  readonly plan: AfterglowConsolidationPlan;
  readonly reviewed: AfterglowDecisionPreview;
  readonly initialProofs: ReadonlyArray<AfterglowSavedSnapshotProof>;
  readonly currentProofs: ReadonlyArray<AfterglowSavedSnapshotProof>;
  readonly sourceSnapshots: ReadonlyArray<Readonly<{project:LibraryPPFProject}>>;
  readonly mediaReport: AfterglowMediaVerification | null;
  readonly normalizedCandidate: LibraryPPFProject | null;
}): AfterglowMasterSavePreflight;
