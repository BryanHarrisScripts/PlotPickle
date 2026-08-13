import {
  createEmptyFoundationLessonAnswers,
  createEmptyFoundationPlanState,
  type FoundationLessonAnswers,
  type FoundationPlanState,
} from "../contracts/foundation-plan";
import type { StoryCommand } from "../contracts/story-command";
import type { PPFProject } from "./project";

function foundationState(project: PPFProject): FoundationPlanState {
  return project.foundations ?? createEmptyFoundationPlanState();
}

function updateFoundationLesson(
  project: PPFProject,
  lessonId: string,
  update: (lesson: FoundationLessonAnswers) => FoundationLessonAnswers,
) {
  const foundations = foundationState(project);
  const lesson = foundations.lessons[lessonId] ?? createEmptyFoundationLessonAnswers();
  return {
    ...foundations,
    activeLessonId: lessonId,
    lessons: {
      ...foundations.lessons,
      [lessonId]: update(lesson),
    },
  };
}

export function applyStoryCommand(
  project: PPFProject,
  command: StoryCommand,
): PPFProject {
  const base = {
    ...project,
    revision: project.revision + 1,
    updatedAt: command.occurredAt,
  };

  switch (command.type) {
    case "lesson.open":
      return {
        ...base,
        learning: {
          ...project.learning,
          activeLessonId: command.lessonId,
        },
      };
    case "lesson.complete":
      return {
        ...base,
        learning: {
          activeLessonId: command.lessonId,
          completedLessonIds: project.learning.completedLessonIds.includes(command.lessonId)
            ? project.learning.completedLessonIds
            : [...project.learning.completedLessonIds, command.lessonId],
        },
      };
    case "lesson.uncomplete":
      return {
        ...base,
        learning: {
          activeLessonId: command.lessonId,
          completedLessonIds: project.learning.completedLessonIds.filter(
            (lessonId) => lessonId !== command.lessonId,
          ),
        },
      };
    case "creative-room.thread.attach":
      return {
        ...base,
        creativeRoom: {
          threadId: command.threadId,
        },
      };
    case "foundations.lesson.open":
      return {
        ...base,
        foundations: {
          ...foundationState(project),
          activeLessonId: command.lessonId,
        },
      };
    case "foundations.answer.update":
      return {
        ...base,
        foundations: updateFoundationLesson(project, command.lessonId, (lesson) => ({
          ...lesson,
          answers: {
            ...lesson.answers,
            [command.fieldId]: command.value,
          },
          updatedAt: command.occurredAt,
        })),
      };
    case "foundations.proposal.store":
      return {
        ...base,
        foundations: updateFoundationLesson(project, command.lessonId, (lesson) => ({
          ...lesson,
          proposal: command.proposal,
          proposalAcceptedAt: null,
        })),
      };
    case "foundations.proposal.accept":
      return {
        ...base,
        foundations: updateFoundationLesson(project, command.lessonId, (lesson) => ({
          ...lesson,
          answers: {
            ...lesson.answers,
            ...(lesson.proposal?.values ?? {}),
          },
          proposalAcceptedAt: command.occurredAt,
          updatedAt: command.occurredAt,
        })),
      };
    case "foundations.proposal.dismiss":
      return {
        ...base,
        foundations: updateFoundationLesson(project, command.lessonId, (lesson) => ({
          ...lesson,
          proposal: null,
          proposalAcceptedAt: null,
        })),
      };
    case "foundations.brief.save":
      return {
        ...base,
        foundations: {
          ...foundationState(project),
          brief: {
            content: command.content,
            savedAt: command.occurredAt,
          },
        },
      };
  }
}
