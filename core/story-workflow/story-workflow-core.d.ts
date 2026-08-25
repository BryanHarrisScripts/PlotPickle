export type StoryWorkItemStatus = "queued" | "running" | "waiting-human" | "resolved" | "blocked" | "failed" | "superseded";
export type StoryResultKind = "finding" | "proposal" | "alternatives" | "no-finding" | "blocked" | "needs-human";
export type StoryHumanGate = "informational" | "auto-check-complete" | "proposal-review" | "creative-choice" | "conflict" | "blocked";
export type StoryWorkPriority = "blocking" | "high" | "normal" | "low";

export interface StoryWorkflowRequirement {
  id: string;
  frontier: string;
  targetRefs: readonly string[];
  evidenceRefs?: readonly string[];
  dependencyRefs?: readonly string[];
  assignedAgentId?: string;
  reason?: string;
  locked?: boolean;
  satisfied?: boolean;
  stale?: boolean;
  contradiction?: boolean;
  waitingHuman?: boolean;
  severity?: "low" | "medium" | "high";
  priority?: StoryWorkPriority;
}

export interface StoryWorkItem {
  workItemId: string;
  projectId: string;
  baseRevision: string;
  curriculumRequirementId: string;
  frontier: string;
  targetRefs: string[];
  status: StoryWorkItemStatus;
  reason: string;
  evidenceRefs: string[];
  assignedAgentId: string;
  runId: string;
  proposalIds: string[];
  dependencyRefs: string[];
  severity: "low" | "medium" | "high";
  priority: StoryWorkPriority;
  kind: "requirement" | "audit" | "re-evaluation" | "human-gate";
}

export interface StoryResultInput {
  resultId?: string;
  workItemId: string;
  kind: StoryResultKind;
  targetRefs: readonly string[];
  evidenceRefs?: readonly string[];
  curriculumRequirementId?: string;
  principleRef?: string;
  severity?: "low" | "medium" | "high";
  confidence?: number;
  changesCanon?: boolean;
  explanation: string;
  proposal?: string;
  alternatives?: readonly string[];
  affectedDownstreamRefs?: readonly string[];
}

export interface StoryResult extends Required<Omit<StoryResultInput, "resultId" | "confidence">> {
  resultId: string;
  confidence: number;
  humanGate: StoryHumanGate;
  duplicateResultIds: string[];
}

export const STORY_WORK_ITEM_STATUSES: readonly StoryWorkItemStatus[];
export const STORY_RESULT_KINDS: readonly StoryResultKind[];
export const STORY_HUMAN_GATES: readonly StoryHumanGate[];

export function storyWorkItemId(input: {
  projectId: string;
  baseRevision: string | number;
  curriculumRequirementId: string;
  targetRefs: readonly string[];
}): string;

export function planStoryWorkItems(input: {
  projectId: string;
  baseRevision: string | number;
  requirements: readonly StoryWorkflowRequirement[];
  maxItems?: number;
}): StoryWorkItem[];

export function classifyStoryResultHumanGate(result: Pick<StoryResultInput, "kind">): StoryHumanGate;
export function normalizeStoryResult(result: StoryResultInput): StoryResult;
export function reduceStoryResults(input: readonly StoryResultInput[]): {
  results: StoryResult[];
  conflicts: Array<{ targetKey: string; resultIds: string[] }>;
};
export function affectedStoryWorkItemIds(workItems: readonly StoryWorkItem[], changedRefs: readonly string[]): string[];
export function requeueAffectedStoryWorkItems(workItems: readonly StoryWorkItem[], changedRefs: readonly string[]): StoryWorkItem[];
