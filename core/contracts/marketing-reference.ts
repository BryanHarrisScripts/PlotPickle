import type { FoundationsVisualArtifact } from "./build-progress";

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
    `authority:marketing-reference`,
    `director:marquee-director`,
    `recipe:${FOUNDATIONS_MARKETING_REFERENCE_RECIPE}`,
    `ppf-revision:${input.projectRevision}`,
    ...input.decisionKeys.map((key) => `decision:${key}`),
    ...input.sourceArtifactIds.map((id) => `artifact:${id}`),
  ];
}
