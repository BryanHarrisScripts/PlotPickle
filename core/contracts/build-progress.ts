export type VisualArtifactReviewState = "draft" | "accepted" | "rejected";

export interface FoundationsVisualArtifact {
  readonly id: string;
  readonly assetUrl: string;
  readonly prompt: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly model: string;
  /** Progressive Visual Writer metadata. Legacy single concepts normalize safely into frame 1. */
  readonly frameNumber?: number;
  readonly narrativeIntention?: string;
  readonly curriculumFrontier?: "Foundations";
  readonly sourceDecisionKeys?: readonly string[];
  readonly workflow?: string;
  readonly reviewState?: VisualArtifactReviewState;
  readonly parentArtifactId?: string | null;
}

export interface BuildProgressState {
  readonly foundations: {
    readonly visualArtifacts: readonly FoundationsVisualArtifact[];
    readonly acceptedVisualArtifactIds: readonly string[];
  };
}

export function createEmptyBuildProgressState(): BuildProgressState {
  return {
    foundations: {
      visualArtifacts: [],
      acceptedVisualArtifactIds: [],
    },
  };
}
