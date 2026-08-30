export type StoryWorkbenchAxisStatus = "PASS" | "FINDINGS" | "NOT APPLICABLE";
export type StoryWorkbenchResponseClass = "accept-proposal" | "select-alternative" | "modify-proposal" | "reject-proposal" | "keep-current" | "freeform-decision";
export type StoryChangeOperation = Readonly<{
  kind: "set";
  targetRef: string;
  beforeValue: string;
  value: string;
  author: "human" | "agent-proposed";
}>;
export type StoryChangePackage = Readonly<{
  schemaVersion: 1;
  packageId: string;
  projectId: string;
  decisionId: string;
  responseId: string;
  responseClass: StoryWorkbenchResponseClass;
  baseRevision: number;
  targetRefs: readonly string[];
  operation: StoryChangeOperation | null;
  curriculumRefs: readonly string[];
  evidenceRefs: readonly string[];
  predictedImpactRefs: readonly string[];
  provenance: Readonly<{
    authorityClass: "authenticated-human" | "delegated-autonomous-operator";
    authority: Readonly<Record<string, unknown>>;
    humanProfileId: string;
    autonomousRunId: string;
    operatorId: string;
    modelRole: string;
    modelId: string;
    provider: string;
    runtime: string;
    runRefs: readonly string[];
    councilResultId: string;
    rationale: string;
  }>;
  requiresCanonApply: boolean;
  createdAt: string;
}>;
export type StoryWorkbenchAxis = Readonly<{
  id: "canon-authority" | "curriculum-spec" | "continuity-consistency" | "structural-impact" | "visual-script-impact";
  status: StoryWorkbenchAxisStatus;
  summary: string;
  blocking: boolean;
}>;
export type StoryWorkbenchReview = Readonly<{
  package: StoryChangePackage;
  axes: readonly StoryWorkbenchAxis[];
  canComplete: boolean;
  canApply: boolean;
  requiresCanonApply: boolean;
  blockingFindingCount: number;
}>;
export declare const STORY_WORKBENCH_VERSION: 1;
export declare const STORY_WORKBENCH_AXIS_STATUSES: readonly StoryWorkbenchAxisStatus[];
export declare function normalizeStoryChangePackage(input: Readonly<Record<string, any>>): StoryChangePackage;
export declare function reviewStoryChangePackage(input: Readonly<{
  package: Readonly<Record<string, any>>;
  currentRevision: number;
  projectMatches: boolean;
  targetOwned?: boolean;
  frontierEditable?: boolean;
  derivedTarget?: boolean;
  importedEvidenceTarget?: boolean;
  lockedPrerequisite?: boolean;
  structuralImpact?: boolean;
  visualScriptImpact?: boolean;
}>): StoryWorkbenchReview;
export declare function storyWorkbenchImpactMap(input: Readonly<{
  package: Readonly<Record<string, any>>;
  dependencyEvidenceRefs?: readonly string[];
}>): Readonly<{
  directChangedRefs: readonly string[];
  dependencyEvidenceRefs: readonly string[];
  explainableRefs: readonly string[];
  staleProjectionRefs: readonly string[];
  unaffectedByDefault: true;
}>;
export declare function storyDecisionReconciliationPlan(records: readonly any[], input: Readonly<{
  projectId: string;
  currentRevision: number;
  sourceDecisionIds?: readonly string[];
  satisfiedDecisionIds?: readonly string[];
  affectedRefs?: readonly string[];
}>): Readonly<{ currentRevision: string; staleDecisionIds: readonly string[]; withdrawDecisionIds: readonly string[] }>;
export declare function storyWorkbenchConvergenceTelemetry(input: Readonly<Record<string, any>>): Readonly<{
  openRequiredDecisions: number;
  unresolvedHighMediumFindings: number;
  missingCurrentFrontierRequirements: number;
  staleWorkOrProposals: number;
  specialistDisagreements: number;
  affectedWorkItemsRerun: number;
  newMaterialFindings: number;
  currentFrontierBlockers: readonly string[];
}>;
