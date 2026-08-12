import {
  createEmptyFoundationBuilderState,
  type FoundationBuilderState,
} from "../contracts/foundation-builder";

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
  readonly foundations: FoundationBuilderState;
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
    foundations: createEmptyFoundationBuilderState(),
  };
}

function recoveredId() {
  return globalThis.crypto?.randomUUID?.() ?? `recovered-${Date.now()}`;
}

function normalizeFoundations(value: unknown): FoundationBuilderState {
  const empty = createEmptyFoundationBuilderState();
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, typeof saved[key] === "string" ? saved[key] : ""]),
  ) as FoundationBuilderState;
}

/**
 * Repair browser-persisted foundation projects from earlier PlotPickle builds.
 *
 * Local storage survives application upgrades, so callers must not trust the
 * compile-time PPFProject shape when reading it back. This normalizer restores
 * every nested object LEARN and PLAN dereference and preserves valid existing
 * values rather than forcing the writer to clear their browser data.
 */
export function normalizeFoundationProject(
  project: Partial<PPFProject> | null | undefined,
): PPFProject {
  const source = project ?? {};
  const now = typeof source.updatedAt === "string" && source.updatedAt
    ? source.updatedAt
    : new Date().toISOString();
  const learning = source.learning;
  const completedLessonIds = Array.isArray(learning?.completedLessonIds)
    ? learning.completedLessonIds.filter((lessonId): lessonId is string => typeof lessonId === "string" && Boolean(lessonId))
    : [];

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
      completedLessonIds,
    },
    creativeRoom: {
      threadId: typeof source.creativeRoom?.threadId === "string" && source.creativeRoom.threadId
        ? source.creativeRoom.threadId
        : null,
    },
    foundations: normalizeFoundations(source.foundations),
  };
}
