export const CHARACTER_DEVELOPMENT_STUDY_TYPES: readonly [
  "reference-board",
  "turnaround",
  "expressions",
  "movement",
  "wardrobe-props",
  "powers-effects",
  "palette-materials",
  "environment-interaction",
];

export type CharacterDevelopmentStudyType = typeof CHARACTER_DEVELOPMENT_STUDY_TYPES[number];

export function createCharacterDevelopmentPackage(input: Record<string, unknown>):
  | { status: "ready"; package: Record<string, unknown> & { studies: readonly Record<string, unknown>[] } }
  | { status: "blocked"; blocker: { code: string; detail: string } };
export function markCharacterDevelopmentStale(candidatePackage: Record<string, any>, changedEvidenceRefs: readonly string[], reason: string): Record<string, any>;
export function recordConsistencyFindings(candidatePackage: Record<string, any>, findings: readonly Record<string, unknown>[]): Record<string, any>;
export function linkAcceptedVisualArtifact(candidatePackage: Record<string, any>, artifactId: string, acceptedVisualArtifactIds: readonly string[]): Record<string, any>;
export function toVisualReadinessEvidence(candidatePackage: Record<string, any>): {
  id: string;
  kind: "character";
  label: string;
  approved: boolean;
  sourceRef: string;
};
