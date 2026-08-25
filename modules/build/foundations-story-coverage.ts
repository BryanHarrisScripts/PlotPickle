import type { CurriculumLesson } from "../../core/contracts/curriculum";
import {
  buildFoundationPlanLessons,
  isUsableFoundationAnswer,
  type FoundationPlanField,
  type FoundationPlanLesson,
} from "../../core/contracts/foundation-plan";
import type { PPFProject } from "../../core/project/project";

export type FoundationsStoryEvidenceState = "defined" | "observed" | "emerging" | "missing";

type ReferenceAwareProject = PPFProject & {
  readonly sourceEvidence?: {
    readonly referenceFixture?: {
      readonly sourceLabel?: string;
      readonly fields?: readonly {
        readonly key?: string;
        readonly lessonId?: string;
        readonly fieldId?: string;
        readonly kind?: "observed" | "synthetic-reference";
        readonly acceptanceState?: "reference-defined" | "proposed";
        readonly reason?: string;
        readonly sourceRefs?: readonly string[];
      }[];
    } | null;
  };
};

export type FoundationsStoryDecisionEvidence = {
  readonly id: string;
  readonly lessonId: string;
  readonly lessonNumber: number;
  readonly lessonTitle: string;
  readonly fieldId: string;
  readonly prompt: string;
  readonly state: FoundationsStoryEvidenceState;
  readonly reason: string;
  readonly sourceLabel: string;
  readonly excerpt: string;
};

export type FoundationsStoryLessonEvidence = {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly state: FoundationsStoryEvidenceState;
  readonly defined: number;
  readonly observed: number;
  readonly emerging: number;
  readonly missing: number;
  readonly total: number;
  readonly decisions: readonly FoundationsStoryDecisionEvidence[];
};

export type FoundationsStoryCoverage = {
  readonly percent: number;
  readonly defined: number;
  readonly observed: number;
  readonly emerging: number;
  readonly missing: number;
  readonly total: number;
  readonly lessons: readonly FoundationsStoryLessonEvidence[];
};

function excerpt(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 177).trimEnd()}…`;
}

function referenceField(project: ReferenceAwareProject, lessonId: string, fieldId: string) {
  return project.sourceEvidence?.referenceFixture?.fields?.find((field) => (
    field.key === `${lessonId}:${fieldId}`
    || (field.lessonId === lessonId && field.fieldId === fieldId)
  ));
}

function decisionEvidence(
  project: ReferenceAwareProject,
  lesson: FoundationPlanLesson,
  field: FoundationPlanField,
): FoundationsStoryDecisionEvidence {
  const lessonState = project.foundations.lessons[lesson.id];
  const savedAnswer = lessonState?.answers[field.id];
  const proposalAnswer = lessonState?.proposal?.values[field.id];
  const reference = referenceField(project, lesson.id, field.id);

  if (isUsableFoundationAnswer(savedAnswer)) {
    if (reference?.acceptanceState === "reference-defined" && reference.kind === "observed") {
      return {
        id: `${lesson.id}:${field.id}`,
        lessonId: lesson.id,
        lessonNumber: lesson.number,
        lessonTitle: lesson.title,
        fieldId: field.id,
        prompt: field.prompt,
        state: "observed",
        reason: reference.reason || "The immutable reference source directly supports this working answer.",
        sourceLabel: project.sourceEvidence?.referenceFixture?.sourceLabel || "Observed reference evidence",
        excerpt: excerpt(savedAnswer),
      };
    }
    if (reference?.acceptanceState === "reference-defined" && reference.kind === "synthetic-reference") {
      return {
        id: `${lesson.id}:${field.id}`,
        lessonId: lesson.id,
        lessonNumber: lesson.number,
        lessonTitle: lesson.title,
        fieldId: field.id,
        prompt: field.prompt,
        state: "defined",
        reason: reference.reason || "This deterministic reference decision completes the current fixture without claiming to be source evidence.",
        sourceLabel: "Synthetic reference decision · not screenplay evidence",
        excerpt: excerpt(savedAnswer),
      };
    }
    return {
      id: `${lesson.id}:${field.id}`,
      lessonId: lesson.id,
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      fieldId: field.id,
      prompt: field.prompt,
      state: "defined",
      reason: "A usable Human-approved PLAN answer is saved in the canonical PPF and is available to BUILD.",
      sourceLabel: "Saved PLAN decision",
      excerpt: excerpt(savedAnswer),
    };
  }

  if (isUsableFoundationAnswer(proposalAnswer)) {
    return {
      id: `${lesson.id}:${field.id}`,
      lessonId: lesson.id,
      lessonNumber: lesson.number,
      lessonTitle: lesson.title,
      fieldId: field.id,
      prompt: field.prompt,
      state: "emerging",
      reason: "A draft proposal exists, but it has not become a saved story decision in the canonical PPF.",
      sourceLabel: lessonState?.proposal?.model || "Draft proposal",
      excerpt: excerpt(proposalAnswer),
    };
  }

  return {
    id: `${lesson.id}:${field.id}`,
    lessonId: lesson.id,
    lessonNumber: lesson.number,
    lessonTitle: lesson.title,
    fieldId: field.id,
    prompt: field.prompt,
    state: "missing",
    reason: "No usable saved answer or reviewable proposal currently supports this Foundations decision.",
    sourceLabel: "No supporting decision yet",
    excerpt: "",
  };
}

function lessonEvidence(
  project: ReferenceAwareProject,
  lesson: FoundationPlanLesson,
): FoundationsStoryLessonEvidence {
  const decisions = lesson.fields.map((field) => decisionEvidence(project, lesson, field));
  const defined = decisions.filter((decision) => decision.state === "defined").length;
  const observed = decisions.filter((decision) => decision.state === "observed").length;
  const emerging = decisions.filter((decision) => decision.state === "emerging").length;
  const missing = decisions.filter((decision) => decision.state === "missing").length;
  const supported = defined + observed;
  const state: FoundationsStoryEvidenceState = decisions.length > 0 && supported === decisions.length
    ? defined > 0 ? "defined" : "observed"
    : supported > 0 || emerging > 0
      ? "emerging"
      : "missing";
  return {
    id: lesson.id,
    number: lesson.number,
    title: lesson.title,
    state,
    defined,
    observed,
    emerging,
    missing,
    total: decisions.length,
    decisions,
  };
}

export function deriveFoundationsStoryCoverage(
  curriculum: readonly CurriculumLesson[],
  project: ReferenceAwareProject,
): FoundationsStoryCoverage {
  const lessons = buildFoundationPlanLessons(curriculum).map((lesson) => lessonEvidence(project, lesson));
  const defined = lessons.reduce((total, lesson) => total + lesson.defined, 0);
  const observed = lessons.reduce((total, lesson) => total + lesson.observed, 0);
  const emerging = lessons.reduce((total, lesson) => total + lesson.emerging, 0);
  const missing = lessons.reduce((total, lesson) => total + lesson.missing, 0);
  const total = defined + observed + emerging + missing;
  const supported = defined + observed;
  return {
    percent: total ? Math.round((supported / total) * 100) : 0,
    defined,
    observed,
    emerging,
    missing,
    total,
    lessons,
  };
}
