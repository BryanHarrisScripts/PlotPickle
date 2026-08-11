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
  conversation,
  projectMemory,
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
  const sourceLessonIds = sources.map((lesson) => lesson.id);
  const knowledge = sources.map((lesson) => [
    `LESSON: ${lesson.title} (${lesson.id})`,
    `Overview: ${lesson.overview}`,
    `Objectives: ${lesson.objectives.join("; ")}`,
    ...lesson.sections.map((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.points ?? []),
    ].join("\n")),
    `Key terms: ${lesson.definitions.map(({ term, meaning }) => `${term}: ${meaning}`).join("; ")}`,
    `Example — ${lesson.example.title}: ${lesson.example.text}`,
    `Checklist: ${lesson.checklist.join("; ")}`,
    `Common mistakes: ${lesson.mistakes.join("; ")}`,
    `Exercise: ${lesson.exercise}`,
    `Apply: ${lesson.apply}`,
  ].join("\n").slice(0, 3_500)).join("\n\n---\n\n");

  const message = [
    "Use the retrieved PlotPickle curriculum below as your teaching knowledge.",
    "Answer the writer's actual question, explain ideas plainly, and coach rather than merely listing lessons.",
    "When useful, give a concrete story example and numbered steps. End with one focused question that moves the writer forward.",
    "Do not invent curriculum facts. If the excerpts are insufficient, say what is missing and ask a clarifying question.",
    `Active lesson: ${activeLessonId}.`,
    `Project memory: ${projectMemory.title} (${projectMemory.id}), revision ${projectMemory.revision}; completed lessons: ${projectMemory.completedLessonIds.join(", ") || "none"}.`,
    `Retrieved curriculum:\n${knowledge}`,
    `Writer's question: ${question.trim()}`,
  ].join("\n\n");

  return fetch("/api/writing-assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agentId: "curriculum-guide",
      provider: "ollama",
      tone: "gentle",
      message,
      history: conversation.slice(-12).map((item) => ({
        role: item.role === "writer" ? "user" : "assistant",
        content: item.content,
      })),
    }),
  }).then(async (response) => {
    const result = await response.json() as {
      readonly message?: string;
      readonly model?: string;
      readonly provider?: string;
      readonly text?: string;
    };
    if (!response.ok || !result.text) {
      throw new Error(result.message || "The Curriculum Guide could not reach Ollama.");
    }
    return {
      text: result.text,
      sourceLessonIds,
      provider: "ollama" as const,
      model: result.model || "configured Ollama model",
    };
  });
};
