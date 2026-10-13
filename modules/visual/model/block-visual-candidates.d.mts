export type VisualCandidate = {
  readonly id: string;
  readonly createdAt: string;
  readonly workflow?: string;
  readonly sourceDecisionKeys?: readonly string[];
  readonly frameNumber?: number;
  readonly reviewState?: "draft" | "accepted" | "rejected";
};
export function firstImageHistory<T extends VisualCandidate>(
  artifacts: readonly T[], anchor: string, source: string, workflow: string,
): T[];
export function canRejectFirstImage<T extends VisualCandidate>(
  artifact: T | null | undefined, acceptedIds: ReadonlySet<string>,
): boolean;
export function visualSequenceForAddress<T extends VisualCandidate>(
  artifacts: readonly T[], anchor: string, source: string, workflow: string,
  acceptedIds: ReadonlySet<string>,
): T[];
