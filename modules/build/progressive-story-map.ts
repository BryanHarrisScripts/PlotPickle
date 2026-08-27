import { normalizeProjectSourceEvidence } from "../../core/contracts/imported-screenplay-evidence";
import type { PPFProject } from "../../core/project/project";
import { sequenceTemplates } from "../../lib/projects/structure";

export type BuildStoryEvidenceState = "defined" | "observed" | "emerging" | "missing" | "locked";

export type ProgressiveMiniBlock = {
  readonly id: string;
  readonly number: number;
  readonly label: "Promise" | "Progress" | "Pressure" | "Payoff";
  readonly state: BuildStoryEvidenceState;
  readonly observedPassageCount: number;
};

export type ProgressiveStoryTextPassage = {
  readonly id: string;
  readonly type: string;
  readonly text: string;
  readonly sceneNumber: number;
  readonly miniBlockNumber: number;
};

export type ProgressiveStoryTextProjection = {
  /** The same canonical Block id used by the visual projection. */
  readonly targetRef: string;
  readonly state: "observed" | "emerging" | "missing";
  readonly sourceKind: "observed-screenplay" | "none";
  readonly sourceFileName: string;
  readonly placementReviewed: boolean;
  readonly reviewState: "current" | "needs-review";
  readonly staleAtRevision: number | null;
  readonly staleReasonRefs: readonly string[];
  readonly passageCount: number;
  readonly passages: readonly ProgressiveStoryTextPassage[];
};

export type ProgressiveStoryBlock = {
  readonly id: string;
  readonly number: number;
  readonly act: number;
  readonly sequenceNumber: number;
  readonly sequenceTitle: string;
  readonly sequencePurpose: string;
  readonly state: BuildStoryEvidenceState;
  readonly observedPassageCount: number;
  readonly mappingNote: string;
  readonly miniBlocks: readonly ProgressiveMiniBlock[];
  readonly backgroundText: ProgressiveStoryTextProjection;
};

export type ProgressiveStoryMap = {
  readonly frontier: "Foundations";
  readonly blocks: readonly ProgressiveStoryBlock[];
  readonly observedPassageCount: number;
  readonly importedSourceFileName: string;
  readonly passagesTruncated: boolean;
};

const MINI_LABELS = ["Promise", "Progress", "Pressure", "Payoff"] as const;

/**
 * Foundations exposes the whole story topology but does not invent structure.
 * Imported passages are directly observed source evidence; their current 24/96
 * placement remains Emerging while the importer analysis is still suggested.
 */
export function deriveProgressiveStoryMap(project: PPFProject): ProgressiveStoryMap {
  const screenplay = normalizeProjectSourceEvidence(
    (project as PPFProject & { readonly sourceEvidence?: unknown }).sourceEvidence,
  ).screenplay;
  const passages = screenplay?.passages ?? [];
  const projectionReviews = screenplay?.projectionReviews ?? [];
  const reviewedMapping = screenplay?.analysisStatus === "reviewed";

  const blocks = Array.from({ length: 24 }, (_, index): ProgressiveStoryBlock => {
    const number = index + 1;
    const blockId = `block-${String(number).padStart(2, "0")}`;
    const sequenceIndex = Math.floor(index / 2);
    const [sequenceTitle, sequencePurpose] = sequenceTemplates[sequenceIndex];
    const blockPassages = passages.filter((passage) => passage.blockNumber === number);
    const projectionReview = projectionReviews.find((review) => review.blockNumber === number && review.state === "needs-review") ?? null;
    const state: BuildStoryEvidenceState = blockPassages.length
      ? reviewedMapping ? "observed" : "emerging"
      : "missing";
    const backgroundText: ProgressiveStoryTextProjection = {
      targetRef: blockId,
      state: blockPassages.length ? reviewedMapping ? "observed" : "emerging" : "missing",
      sourceKind: blockPassages.length ? "observed-screenplay" : "none",
      sourceFileName: screenplay?.sourceFileName ?? "",
      placementReviewed: reviewedMapping,
      reviewState: projectionReview ? "needs-review" : "current",
      staleAtRevision: projectionReview?.atRevision ?? null,
      staleReasonRefs: projectionReview?.reasonRefs ?? [],
      passageCount: blockPassages.length,
      passages: blockPassages.slice(0, 6).map((passage) => ({
        id: passage.id,
        type: passage.type,
        text: passage.text,
        sceneNumber: passage.sceneNumber,
        miniBlockNumber: passage.miniBlockNumber,
      })),
    };
    const miniBlocks = MINI_LABELS.map((label, miniIndex): ProgressiveMiniBlock => {
      const miniNumber = miniIndex + 1;
      const miniPassages = blockPassages.filter((passage) => passage.miniBlockNumber === miniNumber);
      return {
        id: `block-${String(number).padStart(2, "0")}-mini-${miniNumber}`,
        number: miniNumber,
        label,
        state: miniPassages.length
          ? reviewedMapping ? "observed" : "emerging"
          : "locked",
        observedPassageCount: miniPassages.length,
      };
    });
    return {
      id: blockId,
      number,
      act: Math.floor(sequenceIndex / 3) + 1,
      sequenceNumber: sequenceIndex + 1,
      sequenceTitle,
      sequencePurpose,
      state,
      observedPassageCount: blockPassages.length,
      mappingNote: blockPassages.length
        ? reviewedMapping
          ? "Direct screenplay passages support this reviewed story position."
          : "Direct screenplay passages are present, but placement remains importer-suggested and requires Human review."
        : "No screenplay passage or Human-approved structural decision currently supports this Block. PlotPickle leaves it unresolved.",
      miniBlocks,
      backgroundText,
    };
  });

  return {
    frontier: "Foundations",
    blocks,
    observedPassageCount: passages.length,
    importedSourceFileName: screenplay?.sourceFileName ?? "",
    passagesTruncated: screenplay?.passagesTruncated ?? false,
  };
}
