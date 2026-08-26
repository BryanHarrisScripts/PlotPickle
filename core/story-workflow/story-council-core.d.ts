import type {
  StoryHumanGate,
  StoryResultKind,
  StoryWorkItem,
} from "./story-workflow-core.mjs";

export type StoryCouncilDecisionClass =
  | "no-action"
  | "informational-finding"
  | "bounded-proposal"
  | "alternative-choice"
  | "unresolved-conflict"
  | "blocked-prerequisite";

export type StoryCouncilResponsibility =
  | "curriculum-coordination"
  | "foundations-application"
  | "creative-coordination"
  | "structure-causality"
  | "continuity"
  | "independent-critique"
  | "visual-development"
  | "provenance-lookup";

export type StoryCouncilSpecialistContract = {
  readonly agentId: string;
  readonly buzzActorId: string;
  readonly responsibility: StoryCouncilResponsibility;
  readonly coordinator: boolean;
  readonly workerEligible: boolean;
  readonly requiredReadScope: string;
};

export type StoryCouncilPlan = {
  readonly version: 1;
  readonly workItemId: string;
  readonly baseRevision: string;
  readonly coordinatorAgentId: string;
  readonly specialists: ReadonlyArray<{
    readonly agentId: string;
    readonly responsibility: StoryCouncilResponsibility;
    readonly reason: string;
    readonly independent: boolean;
  }>;
  readonly maxParallelism: number;
  readonly buzz: {
    readonly optional: true;
    readonly mode: "local-only" | "private-story-room" | "story-council" | "marquee";
    readonly privateEvidence: boolean;
    readonly transcriptRequired: false;
  };
};

export type StoryCouncilContributionInput = {
  readonly contributionId?: string;
  readonly workItemId: string;
  readonly runId: string;
  readonly agentId: string;
  readonly baseRevision: string | number;
  readonly kind: StoryResultKind;
  readonly targetRefs: readonly string[];
  readonly evidenceRefs?: readonly string[];
  readonly curriculumRequirementId?: string;
  readonly principleRef?: string;
  readonly curriculumRefs?: readonly string[];
  readonly severity?: "low" | "medium" | "high";
  readonly confidence?: number;
  readonly changesCanon?: boolean;
  readonly explanation: string;
  readonly proposal?: string;
  readonly alternatives?: readonly string[];
  readonly affectedDownstreamRefs?: readonly string[];
  readonly agreementRefs?: readonly string[];
  readonly disagreementRefs?: readonly string[];
  readonly provenance?: {
    readonly transport?: "local-runtime" | "buzz";
    readonly roomClass?: "local-only" | "private-story-room" | "story-council" | "marquee";
    readonly buzzActorId?: string;
    readonly buzzActorPublicKey?: string;
    readonly buzzEventId?: string;
    readonly buzzSignatureVerified?: boolean;
    readonly recordedAt?: string;
  };
};

export type StoryCouncilContribution = {
  readonly version: 1;
  readonly contributionId: string;
  readonly workItemId: string;
  readonly runId: string;
  readonly agentId: string;
  readonly responsibility: StoryCouncilResponsibility;
  readonly baseRevision: string;
  readonly targetRefs: string[];
  readonly findingClass: StoryResultKind;
  readonly evidenceRefs: string[];
  readonly curriculumRefs: string[];
  readonly severity: "low" | "medium" | "high";
  readonly confidence: number;
  readonly changesCanon: boolean;
  readonly explanation: string;
  readonly proposal: string;
  readonly alternatives: string[];
  readonly affectedDownstreamRefs: string[];
  readonly agreementRefs: string[];
  readonly disagreementRefs: string[];
  readonly humanGate: StoryHumanGate;
  readonly provenance: {
    readonly transport: "local-runtime" | "buzz";
    readonly roomClass: string;
    readonly buzzActorId: string;
    readonly buzzActorPublicKey: string;
    readonly buzzEventId: string;
    readonly buzzSignatureVerified: boolean;
    readonly recordedAt: string;
  };
};

export type StoryCouncilResult = {
  readonly version: 1;
  readonly workItemId: string;
  readonly baseRevision: string;
  readonly contributionIds: string[];
  readonly positions: StoryCouncilContribution[];
  readonly agreements: Array<{ contributionId: string; ref: string }>;
  readonly disagreements: Array<{ contributionId: string; ref: string }>;
  readonly evidenceRefs: string[];
  readonly affectedDownstreamRefs: string[];
  readonly humanGate: StoryHumanGate;
  readonly decisionClass: StoryCouncilDecisionClass;
  readonly requiresHuman: boolean;
  readonly summary: string;
};

export const STORY_COUNCIL_VERSION: 1;
export const STORY_COUNCIL_DECISION_CLASSES: readonly StoryCouncilDecisionClass[];
export const STORY_COUNCIL_SPECIALISTS: readonly StoryCouncilSpecialistContract[];

export function storyCouncilSpecialistByAgentId(agentId: string): StoryCouncilSpecialistContract | null;
export function selectStoryCouncilSpecialists(workItem: StoryWorkItem, input?: {
  readonly maxSpecialists?: number;
  readonly buzzAvailable?: boolean;
  readonly allowPublicDiscussion?: boolean;
}): StoryCouncilPlan;
export function normalizeStoryCouncilContribution(input: StoryCouncilContributionInput): StoryCouncilContribution;
export function reduceStoryCouncilContributions(input: readonly StoryCouncilContributionInput[]): StoryCouncilResult[];
