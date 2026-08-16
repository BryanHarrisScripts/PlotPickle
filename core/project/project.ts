import { createEmptyBuildProgressState, type BuildProgressState } from "../contracts/build-progress";
import {
  createEmptyFoundationLessonAnswers,
  createEmptyFoundationPlanState,
  isUsableFoundationAnswer,
  type FoundationDraftProposal,
  type FoundationLessonAnswers,
  type FoundationPlanState,
} from "../contracts/foundation-plan";

export const PPF_FOUNDATION_VERSION = "2.0-foundation" as const;

export interface PPFProject {
  readonly format: typeof PPF_FOUNDATION_VERSION;
  readonly id: string;
  readonly title: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly learning: {
    readonly activeLessonId: string | null;
    readonly completedLessonIds: readonly string[];
  };
  readonly creativeRoom: {
    readonly threadId: string | null;
  };
  readonly foundations: FoundationPlanState;
  readonly build: BuildProgressState;
}

export function createEmptyProject(input: {
  id: string;
  now: string;
  title?: string;
}): PPFProject {
  return {
    format: PPF_FOUNDATION_VERSION,
    id: input.id,
    title: input.title?.trim() || "Untitled Story",
    revision: 0,
    createdAt: input.now,
    updatedAt: input.now,
    learning: {
      activeLessonId: null,
      completedLessonIds: [],
    },
    creativeRoom: {
      threadId: null,
    },
    foundations: createEmptyFoundationPlanState(),
    build: createEmptyBuildProgressState(),
  };
}

const LEGACY_FOUNDATION_FIELDS: Readonly<Record<string, string>> = {
  storyPromise: "pitch",
  pitchPositioning: "foundations-general-general-the-pitch-md",
  screenplayAnatomy: "foundations-general-readme-md",
  primaryLogline: "loglines-that-carry-the-movie",
  loglineTests: "foundations-loglines-loglines-md",
  storyLayers: "why-plotpickle-works-in-layers",
  structureDialogueVisuals: "foundations-essentials-essential-aspects-1-md",
  themeCharacterStakes: "foundations-essentials-essential-aspects-2-md",
  craftRoadmap: "foundations-essentials-readme-md",
  pacingTone: "foundations-essentials-storytelling-dynamics-md",
  foundationsBrief: "essentials-experience",
};

const LEGACY_AUTOMATED_BRIEF_MARKER = "this story decision is still open because no accepted writer material produced a usable local-model answer";

function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function usableAnswerRecord(value: unknown): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(stringRecord(value)).filter(([, answer]) => isUsableFoundationAnswer(answer)),
  );
}

function normalizeProposal(value: unknown): FoundationDraftProposal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const proposal = value as Partial<FoundationDraftProposal>;
  const values = usableAnswerRecord(proposal.values);
  if (!Object.keys(values).length) return null;
  return {
    values,
    model: typeof proposal.model === "string" && proposal.model ? proposal.model : "local Ollama model",
    generatedAt: typeof proposal.generatedAt === "string" && proposal.generatedAt
      ? proposal.generatedAt
      : new Date().toISOString(),
  };
}

function normalizeLessonAnswers(value: unknown): FoundationLessonAnswers {
  const empty = createEmptyFoundationLessonAnswers();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const answers = value as Partial<FoundationLessonAnswers>;
  const cleanAnswers = usableAnswerRecord(answers.answers);
  const proposal = normalizeProposal(answers.proposal);
  return {
    answers: cleanAnswers,
    proposal,
    proposalAcceptedAt: proposal && typeof answers.proposalAcceptedAt === "string" ? answers.proposalAcceptedAt : null,
    updatedAt: typeof answers.updatedAt === "string" ? answers.updatedAt : null,
  };
}

function normalizeFoundations(value: unknown): FoundationPlanState {
  const empty = createEmptyFoundationPlanState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const source = value as Record<string, unknown>;
  const sourceLessons = source.lessons && typeof source.lessons === "object" && !Array.isArray(source.lessons)
    ? source.lessons as Record<string, unknown>
    : {};
  const lessons = Object.fromEntries(
    Object.entries(sourceLessons).map(([lessonId, answers]) => [lessonId, normalizeLessonAnswers(answers)]),
  );

  // Preserve real answers written by the short-lived earlier PLAN implementation.
  for (const [legacyField, lessonId] of Object.entries(LEGACY_FOUNDATION_FIELDS)) {
    const legacyValue = typeof source[legacyField] === "string" ? source[legacyField].trim() : "";
    if (!isUsableFoundationAnswer(legacyValue) || lessons[lessonId]?.answers["output-1"]?.trim()) continue;
    lessons[lessonId] = {
      ...createEmptyFoundationLessonAnswers(),
      ...lessons[lessonId],
      answers: {
        ...(lessons[lessonId]?.answers ?? {}),
        "output-1": legacyValue,
      },
    };
  }

  const brief = source.brief && typeof source.brief === "object" && !Array.isArray(source.brief)
    ? source.brief as { readonly content?: unknown; readonly savedAt?: unknown }
    : {};
  const rawBrief = typeof brief.content === "string" ? brief.content : "";
  const briefWasGeneratedFromLegacyFallback = rawBrief.toLowerCase().includes(LEGACY_AUTOMATED_BRIEF_MARKER);
  return {
    activeLessonId: typeof source.activeLessonId === "string" && source.activeLessonId
      ? source.activeLessonId
      : null,
    lessons,
    brief: {
      content: briefWasGeneratedFromLegacyFallback ? "" : rawBrief,
      savedAt: briefWasGeneratedFromLegacyFallback
        ? null
        : typeof brief.savedAt === "string" ? brief.savedAt : null,
    },
  };
}

function normalizeBuild(value: unknown): BuildProgressState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyBuildProgressState();
  const source = value as { readonly foundations?: { readonly acceptedVisualArtifactIds?: unknown } };
  const acceptedVisualArtifactIds = Array.isArray(source.foundations?.acceptedVisualArtifactIds)
    ? [...new Set(source.foundations.acceptedVisualArtifactIds.filter(
      (artifactId): artifactId is string => typeof artifactId === "string" && Boolean(artifactId.trim()),
    ))]
    : [];
  return {
    foundations: {
      acceptedVisualArtifactIds,
    },
  };
}

function recoveredId() {
  return globalThis.crypto?.randomUUID?.() ?? `recovered-${Date.now()}`;
}

/** Repair browser-persisted projects without deleting valid writer work. */
export function normalizeFoundationProject(value: unknown): PPFProject {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<PPFProject>
    : {};
  const now = typeof source.updatedAt === "string" && source.updatedAt
    ? source.updatedAt
    : new Date().toISOString();
  const learning = source.learning;
  return {
    format: PPF_FOUNDATION_VERSION,
    id: typeof source.id === "string" && source.id.trim() ? source.id : recoveredId(),
    title: typeof source.title === "string" && source.title.trim() ? source.title : "Untitled Story",
    revision: typeof source.revision === "number" && Number.isInteger(source.revision) && source.revision >= 0
      ? source.revision
      : 0,
    createdAt: typeof source.createdAt === "string" && source.createdAt ? source.createdAt : now,
    updatedAt: now,
    learning: {
      activeLessonId: typeof learning?.activeLessonId === "string" && learning.activeLessonId
        ? learning.activeLessonId
        : null,
      completedLessonIds: Array.isArray(learning?.completedLessonIds)
        ? learning.completedLessonIds.filter((lessonId): lessonId is string => typeof lessonId === "string" && Boolean(lessonId))
        : [],
    },
    creativeRoom: {
      threadId: typeof source.creativeRoom?.threadId === "string" && source.creativeRoom.threadId
        ? source.creativeRoom.threadId
        : null,
    },
    foundations: normalizeFoundations(source.foundations),
    build: normalizeBuild(source.build),
  };
}
