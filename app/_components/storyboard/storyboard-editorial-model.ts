import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import type { PPFProject } from "@/core/project/project";
import { AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID } from "@/data/afterglow-reference-identity";
import { createAfterglowStoryboardFrames } from "@/data/afterglow-storyboard";
import { deriveVisualReadiness } from "@/modules/build/visual-readiness";

export const STORYBOARD_REFERENCE_WORKFLOW = "storyboard-reference-adoption-v1" as const;
const STORYBOARD_UPSTREAM_PREFIX = "storyboard-upstream:" as const;

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

export function storyboardFrameTargetRef(targetId: string, miniBlockNumber: number) {
  return `storyboard-frame:${targetId}:mini-${miniBlockNumber}`;
}

function observedReferenceSourceKey(sourceRef: string) {
  return `observed-reference:${sourceRef}`;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

function artifactTargetsFrame(
  artifact: FoundationsVisualArtifact,
  targetId: string,
  miniBlockNumber: number,
) {
  const keys = artifact.sourceDecisionKeys ?? [];
  return artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
    && keys.includes(storyboardTargetSourceKey(targetId))
    && keys.includes(storyboardFrameTargetRef(targetId, miniBlockNumber));
}

function acceptedTargetScopedVisualIds(project: PPFProject, targetId: string, miniBlockNumber: number) {
  const targetKey = storyboardTargetSourceKey(targetId);
  const frameKey = storyboardFrameTargetRef(targetId, miniBlockNumber);
  const foundationAccepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const worldAccepted = new Set(project.build.world.acceptedVisualArtifactIds);
  const matchesTarget = (keys: readonly string[] | undefined) => (
    (keys ?? []).includes(frameKey) || (keys ?? []).includes(targetKey)
  );

  return [
    ...project.build.foundations.visualArtifacts
      .filter((artifact) => (
        artifact.workflow !== STORYBOARD_REFERENCE_WORKFLOW
        && artifact.reviewState === "accepted"
        && foundationAccepted.has(artifact.id)
        && matchesTarget(artifact.sourceDecisionKeys)
      ))
      .map((artifact) => `foundation:${artifact.id}`),
    ...project.build.world.visualArtifacts
      .filter((artifact) => (
        artifact.reviewState === "accepted"
        && worldAccepted.has(artifact.id)
        && matchesTarget(artifact.sourceDecisionKeys)
      ))
      .map((artifact) => `world:${artifact.id}`),
  ].sort();
}

export function storyboardFrameDependencySourceKey(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
) {
  const target = deriveVisualReadiness({ project }).targets.find((candidate) => candidate.id === targetId);
  const snapshot = JSON.stringify({
    targetId,
    miniBlockNumber,
    state: target?.state ?? "missing",
    storyboardAllowed: target?.storyboardAllowed ?? false,
    provenance: (target?.provenance ?? []).map((item) => `${item.source}:${item.ref}`).sort(),
    scopedAcceptedVisuals: acceptedTargetScopedVisualIds(project, targetId, miniBlockNumber),
  });
  return `${STORYBOARD_UPSTREAM_PREFIX}${storyboardFrameTargetRef(targetId, miniBlockNumber)}:${hashText(snapshot)}`;
}

export function storyboardArtifactStaleReasons(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
  artifact: FoundationsVisualArtifact | null,
) {
  if (!artifact) return [];
  const prefix = `${STORYBOARD_UPSTREAM_PREFIX}${storyboardFrameTargetRef(targetId, miniBlockNumber)}:`;
  const recorded = (artifact.sourceDecisionKeys ?? []).find((key) => key.startsWith(prefix));
  if (!recorded) return [];
  const current = storyboardFrameDependencySourceKey(project, targetId, miniBlockNumber);
  return recorded === current
    ? []
    : [`Upstream story or visual identity evidence changed for ${storyboardFrameTargetRef(targetId, miniBlockNumber)}. Review this kept frame before carrying it forward.`];
}

function acceptedArtifactForSource(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
  sourceRef: string,
) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    accepted.has(artifact.id)
    && artifact.reviewState === "accepted"
    && artifactTargetsFrame(artifact, targetId, miniBlockNumber)
    && (artifact.sourceDecisionKeys ?? []).includes(observedReferenceSourceKey(sourceRef))
  )) ?? null;
}

export function storyboardReferenceCandidates(project: PPFProject, targetId: string): readonly StoryboardEditorialCandidate[] {
  if (project.id !== AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID) return [];
  const match = targetId.match(/^block:block-(\d{2})$/);
  const blockNumber = match ? Number(match[1]) : 0;
  if (!blockNumber) return [];

  return createAfterglowStoryboardFrames(blockNumber).map((frame) => {
    const acceptedArtifact = acceptedArtifactForSource(project, targetId, frame.miniBlockNumber, frame.id);
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

export function currentStoryboardArtifactForFrame(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    accepted.has(artifact.id)
    && artifact.reviewState === "accepted"
    && artifactTargetsFrame(artifact, targetId, miniBlockNumber)
  )) ?? null;
}

export function createStoryboardReferenceArtifact(input: {
  readonly project: PPFProject;
  readonly targetId: string;
  readonly candidate: StoryboardEditorialCandidate;
  readonly occurredAt: string;
}): FoundationsVisualArtifact {
  const current = currentStoryboardArtifactForFrame(
    input.project,
    input.targetId,
    input.candidate.miniBlockNumber,
  );
  return {
    id: `storyboard-${input.candidate.id}-${input.project.revision + 1}`,
    assetUrl: input.candidate.assetUrl,
    prompt: `Adopt the bundled observed Storyboard reference ${input.candidate.sourceRef} for ${storyboardFrameTargetRef(input.targetId, input.candidate.miniBlockNumber)}. This Human Keep decision approves the visual projection only; it does not rewrite story canon.`,
    createdAt: input.occurredAt,
    provider: "bundled-reference",
    model: "",
    frameNumber: input.candidate.miniBlockNumber,
    narrativeIntention: input.candidate.caption,
    sourceDecisionKeys: [
      storyboardTargetSourceKey(input.targetId),
      storyboardFrameTargetRef(input.targetId, input.candidate.miniBlockNumber),
      storyboardFrameDependencySourceKey(input.project, input.targetId, input.candidate.miniBlockNumber),
      observedReferenceSourceKey(input.candidate.sourceRef),
      `ppf-revision:${input.project.revision}`,
    ],
    workflow: STORYBOARD_REFERENCE_WORKFLOW,
    reviewState: "draft",
    parentArtifactId: current?.id ?? null,
  };
}
