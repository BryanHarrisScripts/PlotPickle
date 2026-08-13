import type { CurriculumLesson } from "./curriculum";

export const FOUNDATION_PROJECT_STORAGE_KEY = "plotpickle.foundation.project.v1";

export interface FoundationPlanField {
  readonly id: string;
  readonly prompt: string;
}

export interface FoundationPlanLesson {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly overview: string;
  readonly fields: readonly FoundationPlanField[];
}

export interface FoundationDraftProposal {
  readonly values: Readonly<Record<string, string>>;
  readonly model: string;
  readonly generatedAt: string;
}

export interface FoundationLessonAnswers {
  readonly answers: Readonly<Record<string, string>>;
  readonly proposal: FoundationDraftProposal | null;
  readonly proposalAcceptedAt: string | null;
  readonly updatedAt: string | null;
}

export interface FoundationPlanState {
  readonly activeLessonId: string | null;
  readonly lessons: Readonly<Record<string, FoundationLessonAnswers>>;
  readonly brief: {
    readonly content: string;
    readonly savedAt: string | null;
  };
}

export function createEmptyFoundationLessonAnswers(): FoundationLessonAnswers {
  return {
    answers: {},
    proposal: null,
    proposalAcceptedAt: null,
    updatedAt: null,
  };
}

export function createEmptyFoundationPlanState(): FoundationPlanState {
  return {
    activeLessonId: null,
    lessons: {},
    brief: {
      content: "",
      savedAt: null,
    },
  };
}

function applicationPrompts(lesson: CurriculumLesson) {
  const application = [...lesson.sections].reverse().find(
    (section) => section.heading.trim().toLowerCase() === "apply this to your story",
  );
  const prompts = application?.points?.filter((point) => point.trim()) ?? [];
  return prompts.length ? prompts : [lesson.exercise];
}

/**
 * Derive PLAN from the presented LEARN curriculum. Lesson names, sequence and
 * writer prompts intentionally have no second copy in PLAN.
 */
export function buildFoundationPlanLessons(
  curriculum: readonly CurriculumLesson[],
): readonly FoundationPlanLesson[] {
  return curriculum
    .filter((lesson) => lesson.topic === "foundations")
    .sort((left, right) => left.number - right.number)
    .map((lesson) => ({
      id: lesson.id,
      number: lesson.number,
      title: lesson.title,
      overview: lesson.overview,
      fields: applicationPrompts(lesson).map((prompt, index) => ({
        id: `output-${index + 1}`,
        prompt,
      })),
    }));
}

export function countFoundationAnswers(
  lessons: readonly FoundationPlanLesson[],
  state: FoundationPlanState,
) {
  return lessons.reduce((total, lesson) => (
    total + lesson.fields.filter((field) => (
      Boolean(state.lessons[lesson.id]?.answers[field.id]?.trim())
    )).length
  ), 0);
}

export function assembleFoundationsBrief(input: {
  readonly projectTitle: string;
  readonly lessons: readonly FoundationPlanLesson[];
  readonly state: FoundationPlanState;
}) {
  const sections = input.lessons.map((lesson) => {
    const saved = input.state.lessons[lesson.id]?.answers ?? {};
    const answers = lesson.fields.map((field) => {
      const value = saved[field.id]?.trim();
      return [`### ${field.prompt}`, value || "Unresolved — add a working answer in PLAN."].join("\n");
    });
    return [`## ${String(lesson.number).padStart(2, "0")} — ${lesson.title}`, ...answers].join("\n\n");
  });

  return [
    `# ${input.projectTitle.trim() || "Untitled Story"} — Foundations Brief`,
    "",
    "This brief records the writer's current decisions and visible unknowns. Revise it when later story evidence earns a change.",
    "",
    ...sections,
  ].join("\n");
}
