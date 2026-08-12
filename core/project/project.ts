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

export function normalizeFoundationProject(project: PPFProject): PPFProject {
  return {
    ...project,
    foundations: {
      ...createEmptyFoundationBuilderState(),
      ...(project.foundations ?? {}),
    },
  };
}
