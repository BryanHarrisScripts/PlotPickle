import {
  createEmptyBuildProgressState,
  type BuildProgressState,
  type FoundationsVisualArtifact,
  type VisualArtifactReviewState,
  type WorldArtifactChangeKind,
  type WorldVisualArtifact,
} from "../contracts/build-progress";
import {
  createEmptyFoundationLessonAnswers,
  createEmptyFoundationPlanState,
  isUsableFoundationAnswer,
  type FoundationDraftProposal,
  type FoundationLessonAnswers,
  type FoundationPlanState,
} from "../contracts/foundation-plan";
import {
  createEmptyPrevisProductionState,
  normalizePrevisProductionState,
  type PrevisProductionState,
} from "../contracts/previs";
import {
  createEmptyWorldLessonAnswers,
  createEmptyWorldPlanState,
  isUsableWorldAnswer,
  type WorldLessonAnswers,
  type WorldPlanState,
} from "../contracts/world-plan";

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
  readonly world: WorldPlanState;
  readonly build: BuildProgressState;
  readonly production: PrevisProductionState;
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
    world: createEmptyWorldPlanState(),
    build: createEmptyBuildProgressState(),
    production: createEmptyPrevisProductionState(),
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

function usableWorldAnswerRecord(value: unknown): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(stringRecord(value)).filter(([, answer]) => isUsableWorldAnswer(answer)),
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

function normalizeWorldLessonAnswers(value: unknown): WorldLessonAnswers {
  const empty = createEmptyWorldLessonAnswers();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const answers = value as Partial<WorldLessonAnswers>;
  return {
    answers: usableWorldAnswerRecord(answers.answers),
    updatedAt: typeof answers.updatedAt === "string" ? answers.updatedAt : null,
  };
}

function normalizeWorld(value: unknown): WorldPlanState {
  const empty = createEmptyWorldPlanState();
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const source = value as Record<string, unknown>;
  const sourceLessons = source.lessons && typeof source.lessons === "object" && !Array.isArray(source.lessons)
    ? source.lessons as Record<string, unknown>
    : {};
  const brief = source.brief && typeof source.brief === "object" && !Array.isArray(source.brief)
    ? source.brief as { readonly content?: unknown; readonly savedAt?: unknown }
    : {};
  return {
    activeLessonId: typeof source.activeLessonId === "string" && source.activeLessonId ? source.activeLessonId : null,
    lessons: Object.fromEntries(
      Object.entries(sourceLessons).map(([lessonId, answers]) => [lessonId, normalizeWorldLessonAnswers(answers)]),
    ),
    brief: {
      content: typeof brief.content === "string" ? brief.content : "",
      savedAt: typeof brief.savedAt === "string" ? brief.savedAt : null,
    },
  };
}

function normalizeReviewState(value: unknown): VisualArtifactReviewState {
  return value === "accepted" || value === "rejected" ? value : "draft";
}

function isSupportedVisualAssetUrl(value: unknown): value is string {
  return typeof value === "string" && (
    value.startsWith("/api/local-ai/assets/")
    || value.startsWith("/assets/library/examples/")
  );
}

function cleanStringArray(value: unknown, limit = 48) {
  return Array.isArray(value)
    ? value
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim().slice(0, 240))
      .slice(0, limit)
    : [];
}

function normalizeVisualArtifact(value: unknown): FoundationsVisualArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<FoundationsVisualArtifact>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (!isSupportedVisualAssetUrl(item.assetUrl)) return null;
  if (typeof item.prompt !== "string" || !item.prompt.trim()) return null;
  const frameNumber = typeof item.frameNumber === "number" && Number.isInteger(item.frameNumber) && item.frameNumber > 0
    ? Math.min(item.frameNumber, 999)
    : undefined;
  const sourceDecisionKeys = cleanStringArray(item.sourceDecisionKeys);
  return {
    id: item.id.trim(),
    assetUrl: item.assetUrl,
    prompt: item.prompt.slice(0, 30_000),
    createdAt: typeof item.createdAt === "string" && item.createdAt ? item.createdAt : new Date().toISOString(),
    provider: typeof item.provider === "string" ? item.provider : "",
    model: typeof item.model === "string" ? item.model : "",
    ...(frameNumber ? { frameNumber } : {}),
    ...(typeof item.narrativeIntention === "string" && item.narrativeIntention.trim()
      ? { narrativeIntention: item.narrativeIntention.trim().slice(0, 500) }
      : {}),
    ...(item.curriculumFrontier === "Foundations" ? { curriculumFrontier: "Foundations" as const } : {}),
    ...(sourceDecisionKeys.length ? { sourceDecisionKeys } : {}),
    ...(typeof item.workflow === "string" && item.workflow.trim() ? { workflow: item.workflow.trim().slice(0, 160) } : {}),
    reviewState: normalizeReviewState(item.reviewState),
    parentArtifactId: typeof item.parentArtifactId === "string" && item.parentArtifactId.trim()
      ? item.parentArtifactId.trim()
      : null,
  };
}

function normalizeWorldChangeKind(value: unknown): WorldArtifactChangeKind {
  return value === "revised" || value === "retained" || value === "superseded" ? value : "added";
}

function normalizeWorldVisualArtifact(value: unknown): WorldVisualArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<WorldVisualArtifact>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (!isSupportedVisualAssetUrl(item.assetUrl)) return null;
  if (typeof item.prompt !== "string" || !item.prompt.trim()) return null;
  if (typeof item.frameNumber !== "number" || !Number.isInteger(item.frameNumber) || item.frameNumber < 1) return null;
  if (item.curriculumFrontier !== "Foundations + World") return null;
  const worldDecisionKeys = cleanStringArray(item.worldDecisionKeys);
  if (!worldDecisionKeys.length) return null;
  return {
    id: item.id.trim(),
    assetUrl: item.assetUrl,
    prompt: item.prompt.slice(0, 30_000),
    createdAt: typeof item.createdAt === "string" && item.createdAt ? item.createdAt : new Date().toISOString(),
    provider: typeof item.provider === "string" ? item.provider : "",
    model: typeof item.model === "string" ? item.model : "",
    frameNumber: Math.min(item.frameNumber, 999),
    narrativeIntention: typeof item.narrativeIntention === "string" && item.narrativeIntention.trim()
      ? item.narrativeIntention.trim().slice(0, 500)
      : "World-driven wireframe revision",
    curriculumFrontier: "Foundations + World",
    sourceDecisionKeys: cleanStringArray(item.sourceDecisionKeys),
    worldDecisionKeys,
    retainedFoundationArtifactIds: cleanStringArray(item.retainedFoundationArtifactIds, 75),
    workflow: typeof item.workflow === "string" && item.workflow.trim()
      ? item.workflow.trim().slice(0, 160)
      : "world-visual-narrative-wireframe-v1",
    changeKind: normalizeWorldChangeKind(item.changeKind),
    reviewState: normalizeReviewState(item.reviewState),
    parentArtifactId: typeof item.parentArtifactId === "string" && item.parentArtifactId.trim()
      ? item.parentArtifactId.trim()
      : null,
  };
}

function normalizeAcceptedIds(value: unknown, knownArtifactIds: ReadonlySet<string>) {
  return Array.isArray(value)
    ? [...new Set(value.filter(
      (artifactId): artifactId is string => typeof artifactId === "string"
        && Boolean(artifactId.trim())
        && knownArtifactIds.has(artifactId),
    ))]
    : [];
}

function normalizeBuild(value: unknown): BuildProgressState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyBuildProgressState();
  const source = value as {
    readonly foundations?: {
      readonly visualArtifacts?: unknown;
      readonly acceptedVisualArtifactIds?: unknown;
    };
    readonly world?: {
      readonly visualArtifacts?: unknown;
      readonly acceptedVisualArtifactIds?: unknown;
    };
  };
  const foundationArtifacts = Array.isArray(source.foundations?.visualArtifacts)
    ? source.foundations.visualArtifacts
      .map(normalizeVisualArtifact)
      .filter((artifact): artifact is FoundationsVisualArtifact => Boolean(artifact))
      .filter((artifact, index, all) => all.findIndex((candidate) => candidate.id === artifact.id) === index)
      .slice(0, 75)
    : [];
  const foundationKnownIds = new Set(foundationArtifacts.map((artifact) => artifact.id));
  const foundationAcceptedIds = normalizeAcceptedIds(source.foundations?.acceptedVisualArtifactIds, foundationKnownIds);
  const foundationAccepted = new Set(foundationAcceptedIds);
  const normalizedFoundations = foundationArtifacts.map((artifact) => (
    foundationAccepted.has(artifact.id)
      ? { ...artifact, reviewState: "accepted" as const }
      : artifact.reviewState === "accepted"
        ? { ...artifact, reviewState: "draft" as const }
        : artifact
  ));

  const worldArtifacts = Array.isArray(source.world?.visualArtifacts)
    ? source.world.visualArtifacts
      .map(normalizeWorldVisualArtifact)
      .filter((artifact): artifact is WorldVisualArtifact => Boolean(artifact))
      .filter((artifact, index, all) => all.findIndex((candidate) => candidate.id === artifact.id) === index)
      .map((artifact) => ({
        ...artifact,
        retainedFoundationArtifactIds: artifact.retainedFoundationArtifactIds.filter((id) => foundationKnownIds.has(id)),
      }))
      .slice(0, 100)
    : [];
  const worldKnownIds = new Set(worldArtifacts.map((artifact) => artifact.id));
  const worldAcceptedIds = normalizeAcceptedIds(source.world?.acceptedVisualArtifactIds, worldKnownIds);
  const worldAccepted = new Set(worldAcceptedIds);
  const normalizedWorld = worldArtifacts.map((artifact) => (
    worldAccepted.has(artifact.id)
      ? { ...artifact, reviewState: "accepted" as const }
      : artifact.reviewState === "accepted"
        ? { ...artifact, reviewState: "draft" as const }
        : artifact
  ));

  return {
    foundations: {
      visualArtifacts: normalizedFoundations,
      acceptedVisualArtifactIds: foundationAcceptedIds,
    },
    world: {
      visualArtifacts: normalizedWorld,
      acceptedVisualArtifactIds: worldAcceptedIds,
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
    world: normalizeWorld(source.world),
    build: normalizeBuild(source.build),
    production: normalizePrevisProductionState(source.production),
  };
}