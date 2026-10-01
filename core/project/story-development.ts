import { createEmptyFoundationLessonAnswers } from "../contracts/foundation-plan";
import { createEmptyWorldLessonAnswers } from "../contracts/world-plan";
import {
  createEmptyStoryDevelopmentFieldState,
  storyDevelopmentFieldState,
  type LibraryPPFProject,
  type StoryDevelopmentAcceptedSource,
} from "../storage/library-project";
import {
  storyDevelopmentFieldStorageId,
  type StoryDevelopmentAct,
  type StoryDevelopmentFieldDefinition,
} from "../../modules/learn/model/story-development-fields";

export type StoryDevelopmentFieldView = {
  readonly value: string;
  readonly acceptedSource: StoryDevelopmentAcceptedSource | null;
  readonly proposal: string;
  readonly proposalSourceRef: string | null;
  readonly proposalGeneratedAt: string | null;
  readonly updatedAt: string | null;
};

function baseFieldValue(project: LibraryPPFProject, field: StoryDevelopmentFieldDefinition) {
  if (field.topicId === "foundations") {
    return project.foundations.lessons[field.lessonId]?.answers[field.fieldId] ?? "";
  }
  if (field.topicId === "world") {
    return project.world.lessons[field.lessonId]?.answers[field.fieldId] ?? "";
  }
  return storyDevelopmentFieldState(project.storyDevelopment, field.canonicalId).value;
}

function hasScopedActivity(state: ReturnType<typeof storyDevelopmentFieldState>) {
  return state.acceptedSource !== null
    || state.updatedAt !== null
    || Boolean(state.proposal)
    || Boolean(state.proposalSourceRef)
    || state.proposalGeneratedAt !== null;
}

export function storyDevelopmentFieldView(
  project: LibraryPPFProject,
  field: StoryDevelopmentFieldDefinition,
  act?: StoryDevelopmentAct,
): StoryDevelopmentFieldView {
  const baseState = storyDevelopmentFieldState(project.storyDevelopment, field.canonicalId);
  const value = baseFieldValue(project, field);

  if (field.scope === "project-wide" || act === undefined || !field.validActs.includes(act)) {
    return { ...baseState, value };
  }

  const storageId = storyDevelopmentFieldStorageId(field, act);
  const scopedState = storyDevelopmentFieldState(project.storyDevelopment, storageId);
  if (!hasScopedActivity(scopedState)) return { ...baseState, value };

  const hasAcceptedScopedValue = scopedState.acceptedSource !== null || scopedState.updatedAt !== null;
  return {
    ...scopedState,
    value: hasAcceptedScopedValue ? scopedState.value : value,
  };
}

function withFieldMetadata(
  project: LibraryPPFProject,
  field: StoryDevelopmentFieldDefinition,
  patch: Partial<ReturnType<typeof createEmptyStoryDevelopmentFieldState>>,
  act?: StoryDevelopmentAct,
) {
  const storageId = storyDevelopmentFieldStorageId(field, act);
  const current = storyDevelopmentFieldState(project.storyDevelopment, storageId);
  return {
    ...project.storyDevelopment,
    fields: {
      ...project.storyDevelopment.fields,
      [storageId]: { ...current, ...patch },
    },
  };
}

export function writeStoryDevelopmentFieldValue(input: {
  readonly project: LibraryPPFProject;
  readonly field: StoryDevelopmentFieldDefinition;
  readonly value: string;
  readonly source: StoryDevelopmentAcceptedSource;
  readonly act?: StoryDevelopmentAct;
  readonly occurredAt?: string;
}) {
  if (input.act !== undefined && !input.field.validActs.includes(input.act)) {
    return input.project;
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const value = input.value.trim().slice(0, 12_000);
  const usesActStorage = input.act !== undefined && input.field.scope !== "project-wide";
  const metadata = withFieldMetadata(input.project, input.field, {
    value: usesActStorage || (input.field.topicId !== "foundations" && input.field.topicId !== "world") ? value : "",
    acceptedSource: input.source,
    updatedAt: occurredAt,
  }, input.act);

  if (!usesActStorage && input.field.topicId === "foundations") {
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

  if (!usesActStorage && input.field.topicId === "world") {
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
  readonly act?: StoryDevelopmentAct;
  readonly occurredAt?: string;
}) {
  if (input.act !== undefined && !input.field.validActs.includes(input.act)) {
    return input.project;
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return {
    ...input.project,
    revision: input.project.revision + 1,
    updatedAt: occurredAt,
    storyDevelopment: withFieldMetadata(input.project, input.field, {
      proposal: input.proposal.trim().slice(0, 12_000),
      proposalSourceRef: input.sourceRef.trim().slice(0, 320) || null,
      proposalGeneratedAt: occurredAt,
    }, input.act),
  } satisfies LibraryPPFProject;
}

export function acceptStoryDevelopmentFieldProposal(input: {
  readonly project: LibraryPPFProject;
  readonly field: StoryDevelopmentFieldDefinition;
  readonly act?: StoryDevelopmentAct;
  readonly occurredAt?: string;
}) {
  if (input.act !== undefined && !input.field.validActs.includes(input.act)) {
    return input.project;
  }

  const storageId = storyDevelopmentFieldStorageId(input.field, input.act);
  const state = storyDevelopmentFieldState(input.project.storyDevelopment, storageId);
  if (!state.proposal.trim()) return input.project;
  const accepted = writeStoryDevelopmentFieldValue({
    project: input.project,
    field: input.field,
    value: state.proposal,
    source: "agent-proposal",
    act: input.act,
    occurredAt: input.occurredAt,
  });
  const acceptedState = storyDevelopmentFieldState(accepted.storyDevelopment, storageId);
  return {
    ...accepted,
    storyDevelopment: {
      ...accepted.storyDevelopment,
      fields: {
        ...accepted.storyDevelopment.fields,
        [storageId]: {
          ...acceptedState,
          proposal: "",
          proposalSourceRef: null,
          proposalGeneratedAt: null,
        },
      },
    },
  } satisfies LibraryPPFProject;
}
