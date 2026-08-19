export type VisualArtifactReviewState = "draft" | "accepted" | "rejected";
export type WorldArtifactChangeKind = "added" | "revised" | "retained" | "superseded";

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

export const FOUNDATIONS_MARKETING_REFERENCE_RECIPE = "foundations-first-poster-v1" as const;
export const FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW = `marquee-director/${FOUNDATIONS_MARKETING_REFERENCE_RECIPE}` as const;
export const FOUNDATIONS_MARKETING_REFERENCE_FRONTIER = "Foundations" as const;

export type MarketingReferenceArtifact = FoundationsVisualArtifact & {
  readonly workflow: typeof FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW;
  readonly curriculumFrontier: typeof FOUNDATIONS_MARKETING_REFERENCE_FRONTIER;
};

export function isMarketingReferenceArtifact(artifact: FoundationsVisualArtifact): artifact is MarketingReferenceArtifact {
  return artifact.workflow === FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW
    && artifact.curriculumFrontier === FOUNDATIONS_MARKETING_REFERENCE_FRONTIER
    && artifact.reviewState !== "rejected";
}

export function currentMarketingReference(artifacts: readonly FoundationsVisualArtifact[]) {
  return artifacts.find(isMarketingReferenceArtifact) ?? null;
}

export function marketingReferenceSourceKeys(input: {
  readonly projectRevision: number;
  readonly decisionKeys: readonly string[];
  readonly sourceArtifactIds: readonly string[];
}) {
  return [
    "authority:marketing-reference",
    "director:marquee-director",
    `recipe:${FOUNDATIONS_MARKETING_REFERENCE_RECIPE}`,
    `ppf-revision:${input.projectRevision}`,
    ...input.decisionKeys.map((key) => `decision:${key}`),
    ...input.sourceArtifactIds.map((id) => `artifact:${id}`),
  ];
}

export interface WorldVisualArtifact {
  readonly id: string;
  readonly assetUrl: string;
  readonly prompt: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly model: string;
  readonly frameNumber: number;
  readonly narrativeIntention: string;
  readonly curriculumFrontier: "Foundations + World";
  readonly sourceDecisionKeys: readonly string[];
  readonly worldDecisionKeys: readonly string[];
  readonly retainedFoundationArtifactIds: readonly string[];
  readonly workflow: string;
  readonly changeKind: WorldArtifactChangeKind;
  readonly reviewState: VisualArtifactReviewState;
  readonly parentArtifactId: string | null;
}

export interface BuildProgressState {
  readonly foundations: {
    readonly visualArtifacts: readonly FoundationsVisualArtifact[];
    readonly acceptedVisualArtifactIds: readonly string[];
  };
  readonly world: {
    readonly visualArtifacts: readonly WorldVisualArtifact[];
    readonly acceptedVisualArtifactIds: readonly string[];
  };
}

export function createEmptyBuildProgressState(): BuildProgressState {
  return {
    foundations: {
      visualArtifacts: [],
      acceptedVisualArtifactIds: [],
    },
    world: {
      visualArtifacts: [],
      acceptedVisualArtifactIds: [],
    },
  };
}
