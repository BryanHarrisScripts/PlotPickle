import curriculumIndex from "./plotpickle-curriculum-index.json";

type CurriculumModule = {
  id: string;
  title: string;
  overview: string;
  objectives: string[];
  sections: Array<{ heading: string; paragraphs: string[]; points?: string[] }>;
  definitions: Array<{ term: string; meaning: string }>;
  checklist: string[];
  mistakes: string[];
  exercise: string;
  tags: string[];
};

export const PLOTPICKLE_CURRICULUM = curriculumIndex as CurriculumModule[];

function searchable(module: CurriculumModule) {
  return [
    module.title,
    module.overview,
    ...module.objectives,
    ...module.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]),
    ...module.definitions.flatMap((definition) => [definition.term, definition.meaning]),
    ...module.checklist,
    ...module.mistakes,
    module.exercise,
    ...module.tags,
  ].join(" ");
}

const indexedCurriculum = PLOTPICKLE_CURRICULUM.map((module) => ({
  module,
  search: searchable(module).toLowerCase(),
}));

function terms(query: string) {
  return [...new Set(query.toLowerCase().match(/[a-z0-9'-]{3,}/g) ?? [])]
    .filter((term) => !["about", "active", "block", "plotpickle", "story", "writer", "with", "this", "that", "from"].includes(term));
}

export function retrieveCurriculum(query: string, limit = 5) {
  const queryTerms = terms(query);
  return indexedCurriculum
    .map(({ module, search }) => ({
      module,
      score: queryTerms.reduce((total, term) => total + (search.includes(term) ? (module.title.toLowerCase().includes(term) ? 5 : 1) : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ module }) => ({
      id: module.id,
      title: module.title,
      overview: module.overview,
      objectives: module.objectives.slice(0, 3),
      lesson: module.sections.slice(0, 2).map((section) => `${section.heading}: ${section.paragraphs.join(" ")}`).join("\n"),
      exercise: module.exercise,
    }));
}

export function curriculumContext(query: string) {
  const matches = retrieveCurriculum(query);
  const selected = matches.length ? matches : PLOTPICKLE_CURRICULUM.slice(0, 3).map((module) => ({
    id: module.id,
    title: module.title,
    overview: module.overview,
    objectives: module.objectives.slice(0, 3),
    lesson: module.sections.slice(0, 1).map((section) => `${section.heading}: ${section.paragraphs.join(" ")}`).join("\n"),
    exercise: module.exercise,
  }));
  return selected.map((module, index) => [
    `Curriculum source ${index + 1}: ${module.title} (${module.id})`,
    module.overview,
    `Objectives: ${module.objectives.join(" | ")}`,
    module.lesson,
    `Exercise: ${module.exercise}`,
  ].join("\n")).join("\n\n");
}
