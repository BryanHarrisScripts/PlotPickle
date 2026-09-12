import type { CurriculumLesson } from "../contracts/curriculum";
import type {
  LearningApplicationCourse,
  LearningApplicationFact,
  LearningApplicationView,
} from "../contracts/learning-application";
import type { PPFProject } from "../project/project";

const MAX_FACTS = 2;
const MAX_FACT_LENGTH = 180;

function bounded(value: string, limit = MAX_FACT_LENGTH) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, Math.max(0, limit - 1)).trim()}…`;
}

function answerFacts(
  answers: Readonly<Record<string, string>> | undefined,
  sourcePrefix: string,
  labelPrefix: string,
): readonly LearningApplicationFact[] {
  if (!answers) return [];
  return Object.entries(answers)
    .filter(([, value]) => Boolean(value?.trim()))
    .slice(0, MAX_FACTS)
    .map(([key, value]) => ({
      id: `${sourcePrefix}:${key}`,
      label: bounded(`${labelPrefix} ${key}`, 60),
      value: bounded(value),
      source: `${sourcePrefix}.${key}`,
    }));
}

function briefFact(
  id: string,
  label: string,
  value: string | undefined,
  source: string,
): LearningApplicationFact | null {
  if (!value?.trim()) return null;
  return { id, label: bounded(label, 60), value: bounded(value), source };
}

function uniqueFacts(facts: readonly (LearningApplicationFact | null)[]) {
  const seen = new Set<string>();
  return facts
    .filter((fact): fact is LearningApplicationFact => Boolean(fact))
    .filter((fact) => {
      const key = `${fact.source}\u0000${fact.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_FACTS);
}

export function buildLearningApplicationView(input: {
  readonly project: PPFProject;
  readonly lesson: CurriculumLesson;
  readonly course: LearningApplicationCourse;
}): LearningApplicationView {
  const { project, lesson, course } = input;
  const directFacts = lesson.topic === "foundations"
    ? answerFacts(
      project.foundations.lessons[lesson.id]?.answers,
      `PPFProject.foundations.lessons.${lesson.id}.answers`,
      "Saved Foundations answer",
    )
    : lesson.topic === "world"
      ? answerFacts(
        project.world.lessons[lesson.id]?.answers,
        `PPFProject.world.lessons.${lesson.id}.answers`,
        "Saved World answer",
      )
      : [];

  const contextualFacts = uniqueFacts([
    ...directFacts,
    briefFact(
      "foundations-brief",
      "Current Foundations brief",
      project.foundations.brief.content,
      "PPFProject.foundations.brief.content",
    ),
    briefFact(
      "world-brief",
      "Current World brief",
      project.world.brief.content,
      "PPFProject.world.brief.content",
    ),
  ]);

  return {
    schemaVersion: "phase-7-ea-reflection-v1",
    project: {
      id: project.id,
      title: bounded(project.title, 120),
      revision: project.revision,
    },
    lesson: {
      id: lesson.id,
      title: bounded(lesson.title, 100),
      topic: lesson.topic,
      applyInstruction: bounded(lesson.apply, 200),
    },
    craftModule: {
      id: course.id,
      title: bounded(course.title, 80),
      applicationTargets: course.applicationTargets.slice(0, 3).map((target) => bounded(target, 80)),
    },
    facts: contextualFacts,
    authority: {
      deterministicFactsOnly: true,
      eaMayReflect: true,
      eaMayGrade: false,
      eaMayMutateCanon: false,
      humanDecides: true,
    },
  };
}
