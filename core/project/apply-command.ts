import {
  createEmptyFoundationLessonAnswers,
  createEmptyFoundationPlanState,
  FOUNDATION_SEQUENCE_SHIFT_METADATA_ID,
  type FoundationLessonAnswers,
  type FoundationPlanState,
} from "../contracts/foundation-plan";
import {
  createEmptyWorldLessonAnswers,
  createEmptyWorldPlanState,
  type WorldLessonAnswers,
  type WorldPlanState,
} from "../contracts/world-plan";
import type { StoryCommand } from "../contracts/story-command";
import type { PPFProject } from "./project";

function foundationState(project: PPFProject): FoundationPlanState {
  return project.foundations ?? createEmptyFoundationPlanState();
}

function worldState(project: PPFProject): WorldPlanState {
  return project.world ?? createEmptyWorldPlanState();
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

function updateWorldLesson(
  project: PPFProject,
  lessonId: string,
  update: (lesson: WorldLessonAnswers) => WorldLessonAnswers,
) {
  const world = worldState(project);
  const lesson = world.lessons[lessonId] ?? createEmptyWorldLessonAnswers();
  return {
    ...world,
    activeLessonId: lessonId,
    lessons: {
      ...world.lessons,
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
    case "foundations.sequence-shift.update": {
      const foundations = foundationState(project);
      const metadata = foundations.lessons[FOUNDATION_SEQUENCE_SHIFT_METADATA_ID]
        ?? createEmptyFoundationLessonAnswers();
      return {
        ...base,
        foundations: {
          ...foundations,
          lessons: {
            ...foundations.lessons,
            [FOUNDATION_SEQUENCE_SHIFT_METADATA_ID]: {
              ...metadata,
              answers: {
                ...metadata.answers,
                [command.sequenceId]: command.shiftId,
              },
              updatedAt: command.occurredAt,
            },
          },
        },
      };
    }
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
    case "foundations.visual.store": {
      const existing = project.build.foundations.visualArtifacts.filter(
        (artifact) => artifact.id !== command.artifact.id,
      );
      return {
        ...base,
        build: {
          ...project.build,
          foundations: {
            ...project.build.foundations,
            visualArtifacts: [{ ...command.artifact, reviewState: command.artifact.reviewState ?? "draft" }, ...existing].slice(0, 75),
          },
        },
      };
    }
    case "foundations.visual.discard":
      return {
        ...base,
        build: {
          ...project.build,
          foundations: {
            visualArtifacts: project.build.foundations.visualArtifacts.map((artifact) => (
              artifact.id === command.artifactId ? { ...artifact, reviewState: "rejected" as const } : artifact
            )),
            acceptedVisualArtifactIds: project.build.foundations.acceptedVisualArtifactIds.filter(
              (artifactId) => artifactId !== command.artifactId,
            ),
          },
        },
      };
    case "foundations.visual.accept": {
      const accepted = project.build.foundations.acceptedVisualArtifactIds;
      const artifactExists = project.build.foundations.visualArtifacts.some(
        (artifact) => artifact.id === command.artifactId && artifact.reviewState !== "rejected",
      );
      const acceptedVisualArtifactIds = artifactExists && !accepted.includes(command.artifactId)
        ? [...accepted, command.artifactId]
        : accepted;
      return {
        ...base,
        build: {
          ...project.build,
          foundations: {
            ...project.build.foundations,
            visualArtifacts: project.build.foundations.visualArtifacts.map((artifact) => (
              artifact.id === command.artifactId && artifactExists
                ? { ...artifact, reviewState: "accepted" as const }
                : artifact
            )),
            acceptedVisualArtifactIds,
          },
        },
      };
    }
    case "foundations.visual.unaccept":
      return {
        ...base,
        build: {
          ...project.build,
          foundations: {
            ...project.build.foundations,
            visualArtifacts: project.build.foundations.visualArtifacts.map((artifact) => (
              artifact.id === command.artifactId && artifact.reviewState === "accepted"
                ? { ...artifact, reviewState: "draft" as const }
                : artifact
            )),
            acceptedVisualArtifactIds: project.build.foundations.acceptedVisualArtifactIds.filter(
              (artifactId) => artifactId !== command.artifactId,
            ),
          },
        },
      };
    case "previs.shot.store": {
      const existing = project.production.shots.filter((shot) => shot.id !== command.shot.id);
      return {
        ...base,
        production: {
          shots: [command.shot, ...existing].slice(0, 500),
        },
      };
    }
    case "previs.shot.remove":
      return {
        ...base,
        production: {
          shots: project.production.shots.filter((shot) => shot.id !== command.shotId),
        },
      };
    case "world.lesson.open":
      return {
        ...base,
        world: {
          ...worldState(project),
          activeLessonId: command.lessonId,
        },
      };
    case "world.answer.update":
      return {
        ...base,
        world: updateWorldLesson(project, command.lessonId, (lesson) => ({
          ...lesson,
          answers: {
            ...lesson.answers,
            [command.fieldId]: command.value,
          },
          updatedAt: command.occurredAt,
        })),
      };
    case "world.brief.save":
      return {
        ...base,
        world: {
          ...worldState(project),
          brief: {
            content: command.content,
            savedAt: command.occurredAt,
          },
        },
      };
    case "world.visual.store": {
      const existing = project.build.world.visualArtifacts.filter((artifact) => artifact.id !== command.artifact.id);
      return {
        ...base,
        build: {
          ...project.build,
          world: {
            ...project.build.world,
            visualArtifacts: [command.artifact, ...existing].slice(0, 100),
          },
        },
      };
    }
    case "world.visual.discard":
      return {
        ...base,
        build: {
          ...project.build,
          world: {
            visualArtifacts: project.build.world.visualArtifacts.map((artifact) => (
              artifact.id === command.artifactId ? { ...artifact, reviewState: "rejected" as const } : artifact
            )),
            acceptedVisualArtifactIds: project.build.world.acceptedVisualArtifactIds.filter(
              (artifactId) => artifactId !== command.artifactId,
            ),
          },
        },
      };
    case "world.visual.accept": {
      const accepted = project.build.world.acceptedVisualArtifactIds;
      const artifactExists = project.build.world.visualArtifacts.some(
        (artifact) => artifact.id === command.artifactId && artifact.reviewState !== "rejected",
      );
      return {
        ...base,
        build: {
          ...project.build,
          world: {
            ...project.build.world,
            visualArtifacts: project.build.world.visualArtifacts.map((artifact) => (
              artifact.id === command.artifactId && artifactExists
                ? { ...artifact, reviewState: "accepted" as const }
                : artifact
            )),
            acceptedVisualArtifactIds: artifactExists && !accepted.includes(command.artifactId)
              ? [...accepted, command.artifactId]
              : accepted,
          },
        },
      };
    }
    case "world.visual.unaccept":
      return {
        ...base,
        build: {
          ...project.build,
          world: {
            ...project.build.world,
            visualArtifacts: project.build.world.visualArtifacts.map((artifact) => (
              artifact.id === command.artifactId && artifact.reviewState === "accepted"
                ? { ...artifact, reviewState: "draft" as const }
                : artifact
            )),
            acceptedVisualArtifactIds: project.build.world.acceptedVisualArtifactIds.filter(
              (artifactId) => artifactId !== command.artifactId,
            ),
          },
        },
      };
  }
}