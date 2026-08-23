import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { PPFProject } from "../../core/project/project";
import {
  deriveGuidedCreationProgression,
  type GuidedCurriculumGroupId,
  type GuidedWorkspace,
} from "./guided-progression";

export interface VisualWriterFrontierStatus {
  readonly currentGroupId: GuidedCurriculumGroupId;
  readonly currentGroupLabel: string;
  readonly currentWorkspace: GuidedWorkspace | null;
  readonly frontierLabel: "Foundations only" | "Foundations + World";
  readonly acceptedArtifactCount: number;
  readonly draftArtifactCount: number;
  readonly reachedImplementedBuildFrontier: boolean;
  readonly nextActionLabel: string;
  readonly nextActionDetail: string;
  readonly stopReason: string | null;
}

export function deriveVisualWriterFrontierStatus(
  curriculum: readonly CurriculumLesson[],
  project: PPFProject,
): VisualWriterFrontierStatus {
  const progression = deriveGuidedCreationProgression(curriculum, project);
  const reachedImplementedBuildFrontier = progression.world.complete;
  const currentGroupId = reachedImplementedBuildFrontier
    ? "world"
    : progression.nextAction.groupId;
  const currentGroup = progression.groups.find((group) => group.id === currentGroupId);
  const frontierLabel = progression.world.unlocked ? "Foundations + World" : "Foundations only";
  const foundationAccepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const worldAccepted = new Set(project.build.world.acceptedVisualArtifactIds);
  const acceptedArtifactCount = foundationAccepted.size + worldAccepted.size;
  const draftArtifactCount = [
    ...project.build.foundations.visualArtifacts.filter((artifact) => (
      artifact.reviewState !== "rejected" && !foundationAccepted.has(artifact.id)
    )),
    ...project.build.world.visualArtifacts.filter((artifact) => (
      artifact.reviewState !== "rejected" && !worldAccepted.has(artifact.id)
    )),
  ].length;

  return {
    currentGroupId,
    currentGroupLabel: currentGroup?.label ?? "World",
    currentWorkspace: reachedImplementedBuildFrontier ? "build" : progression.nextAction.workspace,
    frontierLabel,
    acceptedArtifactCount,
    draftArtifactCount,
    reachedImplementedBuildFrontier,
    nextActionLabel: progression.nextAction.label,
    nextActionDetail: progression.nextAction.detail,
    stopReason: reachedImplementedBuildFrontier
      ? "The implemented Visual Writer frontier ends after accepted World BUILD. Character is next in the canonical progression, but its workspace is still intentionally gated."
      : null,
  };
}
