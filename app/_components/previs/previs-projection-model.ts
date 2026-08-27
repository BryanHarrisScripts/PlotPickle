import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import type { PPFProject } from "@/core/project/project";
import { deriveVisualReadiness, type VisualReadinessState } from "@/modules/build/visual-readiness";
import {
  STORYBOARD_REFERENCE_WORKFLOW,
  currentStoryboardArtifactForFrame,
  storyboardAnchorTargetRef,
  storyboardArtifactStaleReasons,
  storyboardReferenceCandidates,
  storyboardTargetSourceKey,
} from "../storyboard/storyboard-editorial-model";

export type PrevisAnchorProjection = {
  readonly id: string;
  readonly targetId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly state: VisualReadinessState;
  readonly storyboardAllowed: boolean;
  readonly timingAllowed: boolean;
  readonly storyboardAssetUrl: string;
  readonly storyboardArtifactId: string | null;
  readonly observedReference: boolean;
  readonly staleBecause: readonly string[];
  readonly reason: string;
};

export type PrevisBlockProjection = {
  readonly targetId: string;
  readonly blockNumber: number;
  readonly label: string;
  readonly state: VisualReadinessState;
  readonly anchors: readonly PrevisAnchorProjection[];
};

export type PrevisProjection = {
  readonly projectId: string;
  readonly projectRevision: number;
  readonly blocks: readonly PrevisBlockProjection[];
  readonly timingReadyAnchors: number;
  readonly totalAnchors: number;
};

function blockNumberFromTargetId(targetId: string) {
  const match = targetId.match(/^block:block-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

function draftStoryboardArtifactForFrame(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
): FoundationsVisualArtifact | null {
  const targetKey = storyboardTargetSourceKey(targetId);
  const anchorKey = storyboardAnchorTargetRef(targetId, miniBlockNumber);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
    && artifact.reviewState !== "rejected"
    && (artifact.sourceDecisionKeys ?? []).includes(targetKey)
    && (artifact.sourceDecisionKeys ?? []).includes(anchorKey)
  )) ?? null;
}

function anchorState(input: {
  readonly blockState: VisualReadinessState;
  readonly storyboardAllowed: boolean;
  readonly kept: FoundationsVisualArtifact | null;
  readonly draft: FoundationsVisualArtifact | null;
  readonly hasObservedReference: boolean;
}): VisualReadinessState {
  if (!input.storyboardAllowed) return "locked";
  if (input.kept) return "defined";
  if (input.draft?.provider === "bundled-reference" || input.hasObservedReference) return "observed";
  if (input.draft) return "emerging";
  if (input.blockState === "emerging") return "emerging";
  return "missing";
}

export function derivePrevisProjection(project: PPFProject): PrevisProjection {
  const readiness = deriveVisualReadiness({ project });
  const blockTargets = readiness.targets
    .filter((target) => target.kind === "block")
    .sort((left, right) => blockNumberFromTargetId(left.id) - blockNumberFromTargetId(right.id));

  const blocks = blockTargets.map((target): PrevisBlockProjection => {
    const blockNumber = blockNumberFromTargetId(target.id);
    const references = storyboardReferenceCandidates(project, target.id);
    const anchors = [1, 2, 3, 4].map((miniBlockNumber): PrevisAnchorProjection => {
      const kept = currentStoryboardArtifactForFrame(project, target.id, miniBlockNumber);
      const draft = draftStoryboardArtifactForFrame(project, target.id, miniBlockNumber);
      const observed = references.find((candidate) => candidate.miniBlockNumber === miniBlockNumber) ?? null;
      const staleBecause = kept
        ? storyboardArtifactStaleReasons(project, target.id, miniBlockNumber, kept)
        : [];
      const state = anchorState({
        blockState: target.state,
        storyboardAllowed: target.storyboardAllowed,
        kept,
        draft,
        hasObservedReference: Boolean(observed),
      });
      const timingAllowed = Boolean(kept && staleBecause.length === 0 && target.storyboardAllowed);
      const reason = !target.storyboardAllowed
        ? target.missingPrerequisites.join(" · ") || "Storyboard evidence has not earned this Previs anchor yet."
        : staleBecause.length
          ? "The kept Storyboard visual changed upstream and needs Human review before timing continues."
          : timingAllowed
            ? "Approved Storyboard visual is ready for timing. No duration or motion is inferred until the Human plans it."
            : observed
              ? "Observed Storyboard reference is visible, but it must be kept in Storyboard before Previs timing begins."
              : "This canonical anchor has no approved Storyboard visual yet.";

      return {
        id: storyboardAnchorTargetRef(target.id, miniBlockNumber),
        targetId: target.id,
        blockNumber,
        miniBlockNumber,
        state,
        storyboardAllowed: target.storyboardAllowed,
        timingAllowed,
        storyboardAssetUrl: kept?.assetUrl || draft?.assetUrl || observed?.assetUrl || "",
        storyboardArtifactId: kept?.id ?? null,
        observedReference: Boolean(observed && !kept),
        staleBecause,
        reason,
      };
    });

    return {
      targetId: target.id,
      blockNumber,
      label: target.label,
      state: anchors.some((anchor) => anchor.timingAllowed)
        ? "defined"
        : anchors.some((anchor) => anchor.state === "observed")
          ? "observed"
          : anchors.some((anchor) => anchor.state === "emerging")
            ? "emerging"
            : target.storyboardAllowed
              ? "missing"
              : "locked",
      anchors,
    };
  });

  return {
    projectId: project.id,
    projectRevision: project.revision,
    blocks,
    timingReadyAnchors: blocks.flatMap((block) => block.anchors).filter((anchor) => anchor.timingAllowed).length,
    totalAnchors: blocks.reduce((sum, block) => sum + block.anchors.length, 0),
  };
}
