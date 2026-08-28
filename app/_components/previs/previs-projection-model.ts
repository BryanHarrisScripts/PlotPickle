import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import {
  RENDER_MINI_BLOCK_SECONDS,
  renderClipSlotsForAnchor,
  type ProductionShotIntent,
  type RenderClipSlot,
} from "@/core/contracts/previs";
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
  readonly storyboardDependencyKey: string;
  readonly observedReference: boolean;
  readonly staleBecause: readonly string[];
  readonly shots: readonly ProductionShotIntent[];
  readonly staleShotIds: readonly string[];
  readonly authoredDurationSeconds: number;
  readonly renderClips: readonly RenderClipSlot[];
  readonly renderPlanReady: boolean;
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
  readonly renderPlanReadyAnchors: number;
  readonly totalAnchors: number;
  readonly totalShots: number;
  readonly totalRenderClips: number;
  readonly totalRenderKeyframes: number;
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

function storyboardDependencyKey(artifact: FoundationsVisualArtifact | null) {
  return (artifact?.sourceDecisionKeys ?? []).find((key) => key.startsWith("storyboard-upstream:")) ?? "";
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

function authoredDurationSeconds(shots: readonly ProductionShotIntent[]) {
  return Math.round(shots.reduce((total, shot) => total + (shot.durationSeconds ?? 0), 0) * 100) / 100;
}

export function shotNeedsReview(anchor: PrevisAnchorProjection, shot: ProductionShotIntent) {
  return !anchor.timingAllowed
    || shot.storyboardArtifactId !== anchor.storyboardArtifactId
    || shot.storyboardDependencyKey !== anchor.storyboardDependencyKey;
}

export function createProductionShotForAnchor(
  project: PPFProject,
  anchor: PrevisAnchorProjection,
  occurredAt: string,
): ProductionShotIntent | null {
  if (!anchor.timingAllowed || !anchor.storyboardArtifactId || !anchor.storyboardDependencyKey) return null;
  const nextOrder = anchor.shots.reduce((maximum, shot) => Math.max(maximum, shot.order), 0) + 1;
  return {
    id: `previs-shot-${anchor.blockNumber}-${anchor.miniBlockNumber}-${project.revision + 1}-${nextOrder}`,
    anchorRef: anchor.id,
    storyboardArtifactId: anchor.storyboardArtifactId,
    storyboardDependencyKey: anchor.storyboardDependencyKey,
    order: nextOrder,
    shotSize: "Wide",
    angle: "Eye level",
    movement: "Locked",
    lens: "Natural perspective",
    visualIntent: "",
    durationSeconds: null,
    transitionIn: "",
    transitionOut: "",
    reviewState: "planned",
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
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
      const anchorId = storyboardAnchorTargetRef(target.id, miniBlockNumber);
      const dependencyKey = storyboardDependencyKey(kept);
      const shots = project.production.shots
        .filter((shot) => shot.anchorRef === anchorId)
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
      const staleShotIds = shots
        .filter((shot) => (
          !timingAllowed
          || shot.storyboardArtifactId !== kept?.id
          || shot.storyboardDependencyKey !== dependencyKey
        ))
        .map((shot) => shot.id);
      const authoredDuration = authoredDurationSeconds(shots);
      const allShotsTimed = shots.length > 0 && shots.every((shot) => Boolean(shot.durationSeconds && shot.durationSeconds > 0));
      const renderClips = renderClipSlotsForAnchor(blockNumber, miniBlockNumber);
      const renderPlanReady = timingAllowed
        && staleShotIds.length === 0
        && allShotsTimed
        && Math.abs(authoredDuration - RENDER_MINI_BLOCK_SECONDS) < 0.01;
      const reason = !target.storyboardAllowed
        ? target.missingPrerequisites.join(" · ") || "Storyboard evidence has not earned this Previs anchor yet."
        : staleBecause.length
          ? "The kept Storyboard visual changed upstream and needs Human review before timing continues."
          : timingAllowed
            ? "Approved Storyboard visual is ready for Human-authored Previs. Complete 75 seconds of creative timing to unlock its fixed 25 × 3-second Render Plan."
            : observed
              ? "Observed Storyboard reference is visible, but it must be kept in Storyboard before Previs timing begins."
              : "This canonical anchor has no approved Storyboard visual yet.";

      return {
        id: anchorId,
        targetId: target.id,
        blockNumber,
        miniBlockNumber,
        state,
        storyboardAllowed: target.storyboardAllowed,
        timingAllowed,
        storyboardAssetUrl: kept?.assetUrl || draft?.assetUrl || observed?.assetUrl || "",
        storyboardArtifactId: kept?.id ?? null,
        storyboardDependencyKey: dependencyKey,
        observedReference: Boolean(observed && !kept),
        staleBecause,
        shots,
        staleShotIds,
        authoredDurationSeconds: authoredDuration,
        renderClips,
        renderPlanReady,
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

  const allAnchors = blocks.flatMap((block) => block.anchors);
  const totalRenderClips = allAnchors.reduce((sum, anchor) => sum + anchor.renderClips.length, 0);
  return {
    projectId: project.id,
    projectRevision: project.revision,
    blocks,
    timingReadyAnchors: allAnchors.filter((anchor) => anchor.timingAllowed).length,
    renderPlanReadyAnchors: allAnchors.filter((anchor) => anchor.renderPlanReady).length,
    totalAnchors: allAnchors.length,
    totalShots: project.production.shots.length,
    totalRenderClips,
    totalRenderKeyframes: totalRenderClips ? totalRenderClips + 1 : 0,
  };
}
