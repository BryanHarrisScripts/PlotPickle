export type StoryCouncilRuntimeKind = "finding" | "proposal" | "alternatives" | "no-finding" | "blocked" | "needs-human";
export type StoryCouncilRuntimeSeverity = "low" | "medium" | "high";

export const STORY_COUNCIL_RUNTIME_MARKER: "PLOTPICKLE_STORY_COUNCIL_V1";
export const STORY_COUNCIL_RUNTIME_KINDS: readonly StoryCouncilRuntimeKind[];
export const STORY_COUNCIL_RUNTIME_SEVERITIES: readonly StoryCouncilRuntimeSeverity[];
export function isStoryCouncilRuntimeMessage(value: unknown): boolean;
export function storyCouncilRuntimeMessage(content: unknown): string;
