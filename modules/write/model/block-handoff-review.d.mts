export type BlockHandoffMini = Readonly<{
  ordinal: number;
  address: string;
  planAccepted: boolean;
  planState: string;
  importedPassages: number;
  savedWriting: boolean;
}>;
export type BlockHandoffReview = Readonly<{
  projectId: string;
  revision: number;
  title: string;
  titleNeedsReview: boolean;
  blockNumber: number;
  blockId: string;
  miniBlocks: readonly BlockHandoffMini[];
  acceptedCount: number;
  allPlansAccepted: boolean;
  mappedSourcePassages: number;
  savedWritingCount: number;
  currentAssessment: boolean;
  sourceIsPartial: boolean;
  status: "ready-for-proposal-preparation" | "requires-human-outline-review";
}>;
export function reviewBlockHandoff(
  project: import("../../../core/storage/library-project").LibraryPPFProject,
  blockNumber: number,
  options?: Readonly<{ currentAssessment?: boolean }>,
): BlockHandoffReview;
