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
  readonly acceptedMiniBlockCount: number;
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

function storyboardTargetId(blockId: string) {
  return `block:${blockId}`;
}

function storyboardAnchorKey(blockId: string, miniBlockNumber: number) {
  return `storyboard-anchor:${storyboardTargetId(blockId)}:mini-${miniBlockNumber}`;
}

function acceptedStoryboardAnchors(project: PPFProject) {
  const anchors = new Set<string>();
  const collect = (
    artifacts: readonly PPFProject["build"]["foundations"]["visualArtifacts"][number][],
    acceptedIds: readonly string[],
  ) => {
    const accepted = new Set(acceptedIds);
    for (const artifact of artifacts) {
      if (!accepted.has(artifact.id) || artifact.reviewState !== "accepted") continue;
      for (const key of artifact.sourceDecisionKeys ?? []) {
        if (key.startsWith("storyboard-anchor:block:block-") && key.includes(":mini-")) anchors.add(key);
      }
    }
  };

  collect(project.build.foundations.visualArtifacts, project.build.foundations.acceptedVisualArtifactIds);
  collect(project.build.world.visualArtifacts, project.build.world.acceptedVisualArtifactIds);
  return anchors;
}

/**
 * Experience V2 keeps the complete 24/96 topology visible while separating
 * imported screenplay evidence from actual creative progression. Block 01 is
 * available in a new project. A later Block becomes available only after all
 * four Mini-Block visual anchors in the previous Block have been explicitly
 * accepted. LEARN completion is deliberately absent from this projection.
 */
export function deriveProgressiveStoryMap(project: PPFProject): ProgressiveStoryMap {
  const screenplay = normalizeProjectSourceEvidence(
    (project as PPFProject & { readonly sourceEvidence?: unknown }).sourceEvidence,
  ).screenplay;
  const passages = screenplay?.passages ?? [];
  const projectionReviews = screenplay?.projectionReviews ?? [];
  const reviewedMapping = screenplay?.analysisStatus === "reviewed";
  const acceptedAnchors = acceptedStoryboardAnchors(project);
  const acceptedCountForBlock = (blockId: string) => MINI_LABELS.reduce(
    (count, _label, miniIndex) => count + (acceptedAnchors.has(storyboardAnchorKey(blockId, miniIndex + 1)) ? 1 : 0),
    0,
  );
  const completedBlockIds = new Set(
    Array.from({ length: 24 }, (_, index) => `block-${String(index + 1).padStart(2, "0")}`)
      .filter((blockId) => acceptedCountForBlock(blockId) === 4),
  );

  const blocks = Array.from({ length: 24 }, (_, index): ProgressiveStoryBlock => {
    const number = index + 1;
    const blockId = `block-${String(number).padStart(2, "0")}`;
    const sequenceIndex = Math.floor(index / 2);
    const [sequenceTitle, sequencePurpose] = sequenceTemplates[sequenceIndex];
    const blockPassages = passages.filter((passage) => passage.blockNumber === number);
    const projectionReview = projectionReviews.find((review) => review.blockNumber === number && review.state === "needs-review") ?? null;
    const acceptedMiniBlockCount = acceptedCountForBlock(blockId);
    const complete = acceptedMiniBlockCount === 4;
    const unlocked = number === 1 || completedBlockIds.has(`block-${String(number - 1).padStart(2, "0")}`);
    const state: BuildStoryEvidenceState = complete
      ? "defined"
      : !unlocked
        ? "locked"
        : blockPassages.length
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
      const accepted = acceptedAnchors.has(storyboardAnchorKey(blockId, miniNumber));
      return {
        id: `block-${String(number).padStart(2, "0")}-mini-${miniNumber}`,
        number: miniNumber,
        label,
        state: accepted
          ? "defined"
          : !unlocked
            ? "locked"
            : miniPassages.length
              ? reviewedMapping ? "observed" : "emerging"
              : "missing",
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
      acceptedMiniBlockCount,
      mappingNote: complete
        ? "All four Mini-Block visual anchors are accepted for this Block."
        : !unlocked
          ? `This Block stays visible for orientation and unlocks after Block ${String(number - 1).padStart(2, "0")} has four accepted Storyboard anchors.`
          : blockPassages.length
            ? reviewedMapping
              ? "Direct screenplay passages support this reviewed story position. Add and accept visual candidates without leaving the 24-Block context."
              : "Direct screenplay passages are present, but placement remains importer-suggested and requires Human review."
            : "This Block is available for creative work. Add PLAN context, BUILD visual candidates, and explicit STORYBOARD acceptance here.",
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
