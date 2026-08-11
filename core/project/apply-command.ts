import type { StoryCommand } from "../contracts/story-command";
import type { PPFProject } from "./project";

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
    case "creative-room.thread.attach":
      return {
        ...base,
        creativeRoom: {
          threadId: command.threadId,
        },
      };
  }
}
