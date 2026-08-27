import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import type { PPFProject } from "@/core/project/project";
import { AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID } from "@/data/afterglow-reference-identity";
import { createAfterglowStoryboardFrames } from "@/data/afterglow-storyboard";

export const STORYBOARD_REFERENCE_WORKFLOW = "storyboard-reference-adoption-v1" as const;

export type StoryboardEditorialCandidate = {
  readonly id: string;
  readonly targetId: string;
  readonly miniBlockNumber: number;
  readonly label: string;
  readonly caption: string;
  readonly assetUrl: string;
  readonly sourceRef: string;
  readonly acceptedArtifactId: string | null;
};

export function storyboardTargetSourceKey(targetId: string) {
  return `storyboard-target:${targetId}`;
}

function observedReferenceSourceKey(sourceRef: string) {
  return `observed-reference:${sourceRef}`;
}

function artifactTargets(artifact: FoundationsVisualArtifact, targetId: string) {
  return artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
    && (artifact.sourceDecisionKeys ?? []).includes(storyboardTargetSourceKey(targetId));
}

function acceptedArtifactForSource(project: PPFProject, targetId: string, sourceRef: string) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    accepted.has(artifact.id)
    && artifact.reviewState === "accepted"
    && artifactTargets(artifact, targetId)
    && (artifact.sourceDecisionKeys ?? []).includes(observedReferenceSourceKey(sourceRef))
  )) ?? null;
}

export function storyboardReferenceCandidates(project: PPFProject, targetId: string): readonly StoryboardEditorialCandidate[] {
  if (project.id !== AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID) return [];
  const match = targetId.match(/^block:block-(\d{2})$/);
  const blockNumber = match ? Number(match[1]) : 0;
  if (!blockNumber) return [];

  return createAfterglowStoryboardFrames(blockNumber).map((frame) => {
    const acceptedArtifact = acceptedArtifactForSource(project, targetId, frame.id);
    return {
      id: frame.id,
      targetId,
      miniBlockNumber: frame.miniBlockNumber,
      label: `Mini-block ${blockNumber}.${frame.miniBlockNumber}`,
      caption: frame.caption || frame.alt,
      assetUrl: `/api/local-ai/assets/storyboard-reference?block=${blockNumber}&mini=${frame.miniBlockNumber}`,
      sourceRef: frame.id,
      acceptedArtifactId: acceptedArtifact?.id ?? null,
    };
  });
}

export function currentStoryboardArtifactForTarget(project: PPFProject, targetId: string) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    accepted.has(artifact.id)
    && artifact.reviewState === "accepted"
    && artifactTargets(artifact, targetId)
  )) ?? null;
}

export function createStoryboardReferenceArtifact(input: {
  readonly project: PPFProject;
  readonly targetId: string;
  readonly candidate: StoryboardEditorialCandidate;
  readonly occurredAt: string;
}): FoundationsVisualArtifact {
  const current = currentStoryboardArtifactForTarget(input.project, input.targetId);
  return {
    id: `storyboard-${input.candidate.id}-${input.project.revision + 1}`,
    assetUrl: input.candidate.assetUrl,
    prompt: `Adopt the bundled observed Storyboard reference ${input.candidate.sourceRef} for ${input.targetId}. This Human Keep decision approves the visual projection only; it does not rewrite story canon.`,
    createdAt: input.occurredAt,
    provider: "bundled-reference",
    model: "",
    frameNumber: input.candidate.miniBlockNumber,
    narrativeIntention: input.candidate.caption,
    sourceDecisionKeys: [
      storyboardTargetSourceKey(input.targetId),
      observedReferenceSourceKey(input.candidate.sourceRef),
      `ppf-revision:${input.project.revision}`,
    ],
    workflow: STORYBOARD_REFERENCE_WORKFLOW,
    reviewState: "draft",
    parentArtifactId: current?.id ?? null,
  };
}
