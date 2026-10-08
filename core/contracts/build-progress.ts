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
export const MARKETING_REFERENCE_MAX_VERSIONS = 5 as const;

export type MarketingReferenceArtifact = FoundationsVisualArtifact & {
  readonly workflow: typeof FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW;
  readonly curriculumFrontier: typeof FOUNDATIONS_MARKETING_REFERENCE_FRONTIER;
};

export function isMarketingReferenceArtifact(artifact: FoundationsVisualArtifact): artifact is MarketingReferenceArtifact {
  return artifact.workflow === FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW
    && artifact.curriculumFrontier === FOUNDATIONS_MARKETING_REFERENCE_FRONTIER
    && artifact.reviewState !== "rejected";
}

export function marketingReferenceVersions(artifacts: readonly FoundationsVisualArtifact[]) {
  return artifacts
    .filter(isMarketingReferenceArtifact)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MARKETING_REFERENCE_MAX_VERSIONS);
}

export function lockedMarketingReference(
  artifacts: readonly FoundationsVisualArtifact[],
  acceptedVisualArtifactIds: readonly string[],
) {
  const accepted = new Set(acceptedVisualArtifactIds);
  return marketingReferenceVersions(artifacts).find((artifact) => accepted.has(artifact.id)) ?? null;
}

export function currentMarketingReference(artifacts: readonly FoundationsVisualArtifact[]) {
  return marketingReferenceVersions(artifacts)[0] ?? null;
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

/**
 * PP-SAVE-001 v1.0.0, T7: a Storyboard image can be offered to downstream
 * Previs only when the SAME candidate has both the explicit persisted Save
 * marker and the canonical Human acceptance. This is a derived predicate,
 * not a second authority or a replacement for vault durability verification.
 *
 * The caller must source the project from the authenticated/recovered story
 * and independently verify its backing vault for a full T7/T6 PASS.
 */
export function isSavedLockedStoryboardImage(
  artifact: FoundationsVisualArtifact,
  acceptedIds: ReadonlySet<string>,
): boolean {
  return artifact.workflow === "storyboard-frame-webp-v2"
    && artifact.reviewState === "accepted"
    && acceptedIds.has(artifact.id)
    && (artifact.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1");
}
