export type StoryFindingDisposition = "open" | "resolved" | "rejected" | "superseded" | "deferred" | "blocked" | "duplicate" | "not-reproducible";
export type StoryFindingLifecycle = Readonly<{
  findingId: string;
  severity: "low" | "medium" | "high";
  disposition: StoryFindingDisposition;
  targetRefs: readonly string[];
  evidenceRefs: readonly string[];
  resolutionRefs: readonly string[];
  rationale: string;
}>;

export declare const STORY_CONVERGENCE_EVIDENCE_VERSION: 1;
export declare function normalizeStoryFindingLifecycle(input: Readonly<Record<string, any>>): StoryFindingLifecycle;
export declare function evaluateStoryEditorialReadiness(input: Readonly<Record<string, any>>): Readonly<Record<string, any>>;
export declare function createStoryConvergenceEvidence(input: Readonly<Record<string, any>>): Readonly<Record<string, any>>;
