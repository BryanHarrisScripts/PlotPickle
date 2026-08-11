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
  const text = sources.map((lesson, index) => [
    `${index + 1}. ${lesson.title}`,
    lesson.overview,
    `Try: ${lesson.exercise}`,
  ].join("\n")).join("\n\n");

  return {
    text: `The PlotPickle curriculum connects your question to:\n\n${text}`,
    sourceLessonIds: sources.map((lesson) => lesson.id),
  };
};
