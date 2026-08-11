import type { CurriculumGuide } from "../../core/contracts/curriculum-guide";
import type { CurriculumLesson } from "../../core/contracts/curriculum";

const ignoredTerms = new Set([
  "about",
  "from",
  "have",
  "plotpickle",
  "story",
  "that",
  "this",
  "what",
  "with",
  "would",
]);

function terms(value: string) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9'-]{3,}/g) ?? [])]
    .filter((term) => !ignoredTerms.has(term));
}

function searchable(lesson: CurriculumLesson) {
  return [
    lesson.title,
    lesson.overview,
    ...lesson.objectives,
    ...lesson.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.points ?? []),
    ]),
    ...lesson.definitions.flatMap((definition) => [definition.term, definition.meaning]),
    lesson.example.title,
    lesson.example.text,
    ...lesson.checklist,
    ...lesson.mistakes,
    lesson.exercise,
    lesson.apply,
    ...lesson.tags,
  ].join(" ").toLowerCase();
}

export const answerFromCurriculum: CurriculumGuide = ({
  curriculum,
  activeLessonId,
  question,
}) => {
  const queryTerms = terms(question);
  const ranked = curriculum
    .map((lesson) => {
      const text = searchable(lesson);
      const title = lesson.title.toLowerCase();
      const relevance = queryTerms.reduce(
        (score, term) => score + (title.includes(term) ? 5 : text.includes(term) ? 1 : 0),
        lesson.id === activeLessonId ? 3 : 0,
      );
      return { lesson, relevance };
    })
    .sort((left, right) => right.relevance - left.relevance)
    .slice(0, 3)
    .map(({ lesson }) => lesson);

  const sources = ranked.length ? ranked : curriculum.slice(0, 3);
  const primary = sources[0];
  const matchedDefinition = primary.definitions.find((definition) => {
    const definitionTerms = terms(definition.term);
    return definitionTerms.some((term) => queryTerms.includes(term));
  });
  const explanation = matchedDefinition?.meaning
    ?? primary.sections[0]?.paragraphs[0]
    ?? primary.overview;
  const nextStep = primary.exercise || primary.apply || primary.checklist[0];

  return {
    text: [
      "Absolutely — let’s work through it together.",
      explanation,
      `Why it matters: ${primary.overview}`,
      nextStep ? `A useful next step: ${nextStep}` : "",
      "What would help most now: a simple example, a step-by-step walkthrough, or help applying this to your story?",
    ].filter(Boolean).join("\n\n"),
    sourceLessonIds: sources.map((lesson) => lesson.id),
  };
};
