import type { CurriculumLesson } from "./curriculum";

export interface WorldPlanField {
  readonly id: string;
  readonly prompt: string;
}

export interface WorldPlanLesson {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly overview: string;
  readonly fields: readonly WorldPlanField[];
}

export interface WorldLessonAnswers {
  readonly answers: Readonly<Record<string, string>>;
  readonly updatedAt: string | null;
}

export interface WorldPlanState {
  readonly activeLessonId: string | null;
  readonly lessons: Readonly<Record<string, WorldLessonAnswers>>;
  readonly brief: {
    readonly content: string;
    readonly savedAt: string | null;
  };
}

export function createEmptyWorldLessonAnswers(): WorldLessonAnswers {
  return { answers: {}, updatedAt: null };
}

export function createEmptyWorldPlanState(): WorldPlanState {
  return {
    activeLessonId: null,
    lessons: {},
    brief: { content: "", savedAt: null },
  };
}

export function isUsableWorldAnswer(value: string | null | undefined) {
  const text = value?.trim() ?? "";
  return Boolean(text) && text.toLowerCase() !== "provisional";
}

function applicationPrompts(lesson: CurriculumLesson) {
  const application = [...lesson.sections].reverse().find(
    (section) => section.heading.trim().toLowerCase() === "apply this to your story",
  );
  const prompts = application?.points?.filter((point) => point.trim()) ?? [];
  return prompts.length ? prompts : [lesson.exercise];
}

export function buildWorldPlanLessons(curriculum: readonly CurriculumLesson[]): readonly WorldPlanLesson[] {
  return curriculum
    .filter((lesson) => lesson.topic === "world")
    .slice()
    .sort((left, right) => left.number - right.number)
    .map((lesson) => ({
      id: lesson.id,
      number: lesson.number,
      title: lesson.title,
      overview: lesson.overview,
      fields: applicationPrompts(lesson).map((prompt, index) => ({ id: `output-${index + 1}`, prompt })),
    }));
}

export function countWorldAnswers(lessons: readonly WorldPlanLesson[], state: WorldPlanState) {
  return lessons.reduce((total, lesson) => (
    total + lesson.fields.filter((field) => isUsableWorldAnswer(state.lessons[lesson.id]?.answers[field.id])).length
  ), 0);
}

export function worldDecisionKey(lessonId: string, fieldId: string) {
  return `world::${lessonId}::${fieldId}`;
}

export function assembleWorldBrief(input: {
  readonly projectTitle: string;
  readonly lessons: readonly WorldPlanLesson[];
  readonly state: WorldPlanState;
}) {
  const sections = input.lessons.map((lesson) => {
    const saved = input.state.lessons[lesson.id]?.answers ?? {};
    const answers = lesson.fields.map((field) => {
      const value = saved[field.id]?.trim();
      return [`### ${field.prompt}`, isUsableWorldAnswer(value) ? value : "Unresolved — add a working World decision in PLAN."].join("\n");
    });
    return [`## ${String(lesson.number).padStart(2, "0")} — ${lesson.title}`, ...answers].join("\n\n");
  });

  return [
    `# ${input.projectTitle.trim() || "Untitled Story"} — World Brief`,
    "",
    "This brief adds World decisions to the accepted Foundations frontier. It does not replace Foundations truth or invent Character, Theme, Structure, or later-group facts.",
    "",
    ...sections,
  ].join("\n");
}
