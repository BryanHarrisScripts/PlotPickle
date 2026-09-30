export const STORY_DEVELOPMENT_VERSION = 1 as const;

export type StoryDevelopmentAcceptedSource = "human" | "agent-proposal";

export type StoryDevelopmentFieldState = {
  readonly value: string;
  readonly acceptedSource: StoryDevelopmentAcceptedSource | null;
  readonly proposal: string;
  readonly proposalSourceRef: string | null;
  readonly proposalGeneratedAt: string | null;
  readonly updatedAt: string | null;
};

export type StoryDevelopmentState = {
  readonly version: typeof STORY_DEVELOPMENT_VERSION;
  readonly fields: Readonly<Record<string, StoryDevelopmentFieldState>>;
};

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function cleanText(value: unknown, limit = 12_000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, limit)
    : "";
}

export function createEmptyStoryDevelopmentFieldState(): StoryDevelopmentFieldState {
  return {
    value: "",
    acceptedSource: null,
    proposal: "",
    proposalSourceRef: null,
    proposalGeneratedAt: null,
    updatedAt: null,
  };
}

export function createEmptyStoryDevelopmentState(): StoryDevelopmentState {
  return { version: STORY_DEVELOPMENT_VERSION, fields: {} };
}

export function normalizeStoryDevelopmentState(value: unknown): StoryDevelopmentState {
  const source = record(value);
  const rawFields = record(source.fields);
  const fields: Record<string, StoryDevelopmentFieldState> = {};

  for (const [rawKey, rawValue] of Object.entries(rawFields).slice(0, 2_000)) {
    const key = cleanText(rawKey, 360);
    if (!key) continue;
    const field = record(rawValue);
    const acceptedSource: StoryDevelopmentAcceptedSource | null = field.acceptedSource === "human"
      ? "human"
      : field.acceptedSource === "agent-proposal"
        ? "agent-proposal"
        : null;
    fields[key] = {
      value: cleanText(field.value),
      acceptedSource,
      proposal: cleanText(field.proposal),
      proposalSourceRef: cleanText(field.proposalSourceRef, 320) || null,
      proposalGeneratedAt: cleanText(field.proposalGeneratedAt, 80) || null,
      updatedAt: cleanText(field.updatedAt, 80) || null,
    };
  }

  return { version: STORY_DEVELOPMENT_VERSION, fields };
}

export function storyDevelopmentFieldState(
  state: StoryDevelopmentState,
  canonicalId: string,
): StoryDevelopmentFieldState {
  return state.fields[canonicalId] ?? createEmptyStoryDevelopmentFieldState();
}
