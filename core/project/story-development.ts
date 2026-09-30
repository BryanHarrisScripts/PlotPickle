import { createEmptyFoundationLessonAnswers } from "../contracts/foundation-plan";
import { createEmptyWorldLessonAnswers } from "../contracts/world-plan";
import {
  createEmptyStoryDevelopmentFieldState,
  storyDevelopmentFieldState,
  type StoryDevelopmentAcceptedSource,
} from "../contracts/story-development";
import type { LibraryPPFProject } from "../storage/library-project";
import type { StoryDevelopmentFieldDefinition } from "../../modules/learn/model/story-development-fields";

export type StoryDevelopmentFieldView = {
  readonly value: string;
  readonly acceptedSource: StoryDevelopmentAcceptedSource | null;
  readonly proposal: string;
  readonly proposalSourceRef: string | null;
  readonly proposalGeneratedAt: string | null;
  readonly updatedAt: string | null;
};

function genericFieldValue(project: LibraryPPFProject, field: StoryDevelopmentFieldDefinition) {
  return storyDevelopmentFieldState(project.storyDevelopment, field.canonicalId).value;
}

export function storyDevelopmentFieldView(
  project: LibraryPPFProject,
  field: StoryDevelopmentFieldDefinition,
): StoryDevelopmentFieldView {
  const state = storyDevelopmentFieldState(project.storyDevelopment, field.canonicalId);
  const value = field.topicId === "foundations"
    ? project.foundations.lessons[field.lessonId]?.answers[field.fieldId] ?? ""
    : field.topicId === "world"
      ? project.world.lessons[field.lessonId]?.answers[field.fieldId] ?? ""
      : genericFieldValue(project, field);

  return { ...state, value };
}

function withFieldMetadata(
  project: LibraryPPFProject,
  field: StoryDevelopmentFieldDefinition,
  patch: Partial<ReturnType<typeof createEmptyStoryDevelopmentFieldState>>,
) {
  const current = storyDevelopmentFieldState(project.storyDevelopment, field.canonicalId);
  return {
    ...project.storyDevelopment,
    fields: {
      ...project.storyDevelopment.fields,
      [field.canonicalId]: { ...current, ...patch },
    },
  };
}

export function writeStoryDevelopmentFieldValue(input: {
  readonly project: LibraryPPFProject;
  readonly field: StoryDevelopmentFieldDefinition;
  readonly value: string;
  readonly source: StoryDevelopmentAcceptedSource;
  readonly occurredAt?: string;
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const value = input.value.trim().slice(0, 12_000);
  const metadata = withFieldMetadata(input.project, input.field, {
    value: input.field.topicId === "foundations" || input.field.topicId === "world" ? "" : value,
    acceptedSource: input.source,
    updatedAt: occurredAt,
  });

  if (input.field.topicId === "foundations") {
    const lesson = input.project.foundations.lessons[input.field.lessonId] ?? createEmptyFoundationLessonAnswers();
    return {
      ...input.project,
      revision: input.project.revision + 1,
      updatedAt: occurredAt,
      foundations: {
        ...input.project.foundations,
        lessons: {
          ...input.project.foundations.lessons,
          [input.field.lessonId]: {
            ...lesson,
            answers: { ...lesson.answers, [input.field.fieldId]: value },
            updatedAt: occurredAt,
          },
        },
      },
      storyDevelopment: metadata,
    } satisfies LibraryPPFProject;
  }

  if (input.field.topicId === "world") {
    const lesson = input.project.world.lessons[input.field.lessonId] ?? createEmptyWorldLessonAnswers();
    return {
      ...input.project,
      revision: input.project.revision + 1,
      updatedAt: occurredAt,
      world: {
        ...input.project.world,
        lessons: {
          ...input.project.world.lessons,
          [input.field.lessonId]: {
            ...lesson,
            answers: { ...lesson.answers, [input.field.fieldId]: value },
            updatedAt: occurredAt,
          },
        },
      },
      storyDevelopment: metadata,
    } satisfies LibraryPPFProject;
  }

  return {
    ...input.project,
    revision: input.project.revision + 1,
    updatedAt: occurredAt,
    storyDevelopment: metadata,
  } satisfies LibraryPPFProject;
}

export function writeStoryDevelopmentFieldProposal(input: {
  readonly project: LibraryPPFProject;
  readonly field: StoryDevelopmentFieldDefinition;
  readonly proposal: string;
  readonly sourceRef: string;
  readonly occurredAt?: string;
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return {
    ...input.project,
    revision: input.project.revision + 1,
    updatedAt: occurredAt,
    storyDevelopment: withFieldMetadata(input.project, input.field, {
      proposal: input.proposal.trim().slice(0, 12_000),
      proposalSourceRef: input.sourceRef.trim().slice(0, 320) || null,
      proposalGeneratedAt: occurredAt,
    }),
  } satisfies LibraryPPFProject;
}

export function acceptStoryDevelopmentFieldProposal(input: {
  readonly project: LibraryPPFProject;
  readonly field: StoryDevelopmentFieldDefinition;
  readonly occurredAt?: string;
}) {
  const state = storyDevelopmentFieldState(input.project.storyDevelopment, input.field.canonicalId);
  if (!state.proposal.trim()) return input.project;
  const accepted = writeStoryDevelopmentFieldValue({
    project: input.project,
    field: input.field,
    value: state.proposal,
    source: "agent-proposal",
    occurredAt: input.occurredAt,
  });
  const acceptedState = storyDevelopmentFieldState(accepted.storyDevelopment, input.field.canonicalId);
  return {
    ...accepted,
    storyDevelopment: {
      ...accepted.storyDevelopment,
      fields: {
        ...accepted.storyDevelopment.fields,
        [input.field.canonicalId]: {
          ...acceptedState,
          proposal: "",
          proposalSourceRef: null,
          proposalGeneratedAt: null,
        },
      },
    },
  } satisfies LibraryPPFProject;
}
