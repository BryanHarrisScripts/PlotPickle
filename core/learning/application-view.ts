import type { CurriculumLesson } from "../contracts/curriculum";
import type { PPFProject } from "../project/project";

export type LearningApplicationCourse = Readonly<{
  id: string;
  title: string;
  applicationTargets: readonly string[];
}>;

export type LearningApplicationFact = Readonly<{
  id: string;
  label: string;
  value: string;
  source: string;
}>;

export type LearningApplicationView = Readonly<{
  schemaVersion: "phase-7-ea-reflection-v1";
  project: Readonly<{
    id: string;
    title: string;
    revision: number;
  }>;
  lesson: Readonly<{
    id: string;
    title: string;
    topic: string;
    applyInstruction: string;
  }>;
  craftModule: Readonly<{
    id: string;
    title: string;
    applicationTargets: readonly string[];
  }>;
  facts: readonly LearningApplicationFact[];
  authority: Readonly<{
    deterministicFactsOnly: true;
    eaMayReflect: true;
    eaMayGrade: false;
    eaMayMutateCanon: false;
    humanDecides: true;
  }>;
}>;

const MAX_FACTS = 8;
const MAX_FACT_LENGTH = 1_600;

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
      label: `${labelPrefix} ${key}`,
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
  return { id, label, value: bounded(value), source };
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
      title: project.title,
      revision: project.revision,
    },
    lesson: {
      id: lesson.id,
      title: lesson.title,
      topic: lesson.topic,
      applyInstruction: bounded(lesson.apply, 1_000),
    },
    craftModule: {
      id: course.id,
      title: course.title,
      applicationTargets: course.applicationTargets.map((target) => bounded(target, 240)),
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
