import type { CurriculumGuide } from "../../core/contracts/curriculum-guide";
import type { CurriculumLesson, CurriculumSource } from "../../core/contracts/curriculum";

const ignoredTerms = new Set([
  "about",
  "correct",
  "does",
  "from",
  "have",
  "plotpickle",
  "should",
  "story",
  "that",
  "this",
  "what",
  "when",
  "with",
  "would",
]);

const relatedTerms: Readonly<Record<string, readonly string[]>> = {
  beginning: ["opening", "setup", "hook", "inciting", "catalyst"],
  event: ["change", "turn", "inciting", "catalyst", "disruption"],
  first: ["opening", "setup", "early"],
  minutes: ["timing", "pace", "opening", "pages"],
  start: ["opening", "setup", "hook", "inciting"],
  happens: ["change", "turn", "event", "consequence"],
  character: ["protagonist", "motivation", "choice", "arc"],
  ending: ["payoff", "resolution", "closing", "consequence"],
  image: ["visual", "composition", "motif", "opening", "closing"],
};

function terms(value: string) {
  const direct = (value.toLowerCase().match(/[a-z0-9'-]{3,}/g) ?? [])
    .filter((term) => !ignoredTerms.has(term));
  return [...new Set(direct.flatMap((term) => [term, ...(relatedTerms[term] ?? [])]))];
}

function lessonFields(lesson: CurriculumLesson) {
  return {
    title: lesson.title.toLowerCase(),
    tags: lesson.tags.join(" ").toLowerCase(),
    definitions: lesson.definitions
      .flatMap((definition) => [definition.term, definition.meaning])
      .join(" ")
      .toLowerCase(),
    body: [
      lesson.overview,
      ...lesson.objectives,
      ...lesson.sections.flatMap((section) => [
        section.heading,
        ...section.paragraphs,
        ...(section.points ?? []),
      ]),
      lesson.example.title,
      lesson.example.text,
      ...lesson.checklist,
      ...lesson.mistakes,
      lesson.exercise,
      lesson.apply,
    ].join(" ").toLowerCase(),
  };
}

function scoreLesson(lesson: CurriculumLesson, queryTerms: readonly string[]) {
  const fields = lessonFields(lesson);
  return queryTerms.reduce((score, term) => (
    score
    + (fields.title.includes(term) ? 8 : 0)
    + (fields.tags.includes(term) ? 5 : 0)
    + (fields.definitions.includes(term) ? 3 : 0)
    + (fields.body.includes(term) ? 1 : 0)
  ), 0);
}

function sourcePlainText(source: CurriculumSource) {
  return source.content
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreSource(source: CurriculumSource, queryTerms: readonly string[]) {
  const title = source.title.toLowerCase();
  const path = source.path.toLowerCase();
  const body = sourcePlainText(source).toLowerCase();
  return queryTerms.reduce((score, term) => (
    score
    + (title.includes(term) ? 8 : 0)
    + (path.includes(term) ? 5 : 0)
    + (body.includes(term) ? 1 : 0)
  ), 0);
}

function selectReferenceSources(
  curriculum: readonly CurriculumLesson[],
  question: string,
) {
  const queryTerms = terms(question);
  return curriculum.flatMap((lesson) => lesson.sources)
    .map((source) => ({ source, score: scoreSource(source, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 1)
    .map(({ source }) => source);
}

function sourceKnowledge(source: CurriculumSource, question: string) {
  const plain = sourcePlainText(source);
  const queryTerms = terms(question);
  const firstMatch = queryTerms
    .map((term) => plain.toLowerCase().indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0] ?? 0;
  const start = Math.max(0, firstMatch - 300);
  const excerpt = plain.slice(start, start + 1_500);
  return [
    `SOURCE: ${source.title}`,
    `Repository: ${source.repository}; path: ${source.path}; classification: ${source.kind}`,
    `Boundary: ${source.scopeNote}`,
    `Excerpt: ${start ? "…" : ""}${excerpt}${start + excerpt.length < plain.length ? "…" : ""}`,
  ].join("\n");
}

function selectSources(
  curriculum: readonly CurriculumLesson[],
  activeLessonId: string,
  question: string,
) {
  const active = curriculum.find((lesson) => lesson.id === activeLessonId);
  const queryTerms = terms(question);
  const relevant = curriculum
    .map((lesson) => ({ lesson, score: scoreLesson(lesson, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ lesson }) => lesson);

  return [...new Map(
    [active, ...relevant].filter((lesson): lesson is CurriculumLesson => Boolean(lesson))
      .map((lesson) => [lesson.id, lesson]),
  ).values()].slice(0, 2);
}

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function lessonKnowledge(lesson: CurriculumLesson) {
  return [
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
  ].join("\n").slice(0, 2_400);
}

function cleanGuideAnswer(value: string) {
  const uniqueLines: string[] = [];
  for (const line of value.replace(/\r/g, "").split("\n")) {
    const normalized = line.trim();
    if (!normalized && !uniqueLines.at(-1)) continue;
    if (normalized && normalized === uniqueLines.at(-1)?.trim()) continue;
    uniqueLines.push(line.trimEnd());
  }
  const clean = uniqueLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= 1_800) return clean;
  const clipped = clean.slice(0, 1_800);
  const sentenceEnd = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "));
  return `${clipped.slice(0, sentenceEnd > 900 ? sentenceEnd + 1 : 1_800).trim()}…`;
}

function isTimeout(error: unknown) {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function preflightGuideRuntime() {
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not verify the Mastra agent runtime within three seconds.");
    throw error;
  }
  const status = await response.json() as {
    readonly message?: string;
    readonly mastra?: { readonly ready?: boolean; readonly error?: string };
    readonly ollama?: { readonly reachable?: boolean; readonly models?: readonly string[]; readonly error?: string };
  };
  if (!response.ok) throw new Error(status.message || "PlotPickle could not verify the agent runtime.");
  if (!status.mastra?.ready) {
    throw new Error(status.mastra?.error || "The embedded Mastra agent runtime is not ready.");
  }
  if (!status.ollama?.reachable) {
    throw new Error(status.ollama?.error || "Ollama is not reachable. Start Ollama, then ask the Curriculum Guide again.");
  }
  if (!status.ollama.models?.length) {
    throw new Error(status.ollama?.error || "Ollama is running, but no installed model is available to the Curriculum Guide.");
  }
}

export const answerFromCurriculum: CurriculumGuide = async ({
  curriculum,
  activeLessonId,
  question,
  conversation,
  projectMemory,
}) => {
  await preflightGuideRuntime();

  const sources = selectSources(curriculum, activeLessonId, question);
  const sourceLessonIds = sources.map((lesson) => lesson.id);
  const knowledge = sources.map(lessonKnowledge).join("\n\n---\n\n");
  const referenceSources = selectReferenceSources(curriculum, question);
  const sourceReferenceIds = referenceSources.map((source) => source.id);
  const referenceKnowledge = referenceSources
    .map((source) => sourceKnowledge(source, question))
    .join("\n\n---\n\n");
  const conversationMemory = conversation.slice(-6).map((item) => (
    `${item.role === "writer" ? "Writer" : "Guide"}: ${item.content.slice(0, 900)}`
  )).join("\n");

  const message = [
    "<conversation_memory>",
    xmlText(conversationMemory || "No previous conversation."),
    "</conversation_memory>",
    "<project_memory>",
    xmlText(JSON.stringify({
      id: projectMemory.id,
      title: projectMemory.title,
      revision: projectMemory.revision,
      completedLessonIds: projectMemory.completedLessonIds,
      activeLessonId,
    })),
    "</project_memory>",
    "<curriculum_context>",
    `<lesson_excerpts>${xmlText(knowledge)}</lesson_excerpts>`,
    referenceKnowledge ? `<supporting_excerpts>${xmlText(referenceKnowledge)}</supporting_excerpts>` : "",
    "</curriculum_context>",
    "<student_question>",
    xmlText(question.trim()),
    "</student_question>",
  ].filter(Boolean).join("\n\n");

  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: "curriculum-guide",
        provider: "ollama",
        tone: "gentle",
        message,
      }),
      signal: AbortSignal.timeout(27_000),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new Error("The Curriculum Guide did not answer within PlotPickle's 30-second response limit. Your question was kept so you can try again or choose a faster Ollama model.");
    }
    throw error;
  }
  const result = await response.json() as {
    readonly message?: string;
    readonly model?: string;
    readonly text?: string;
  };
  if (!response.ok || !result.text) {
    throw new Error(result.message || "The Curriculum Guide could not reach Ollama.");
  }
  const text = cleanGuideAnswer(result.text);
  if (!text) throw new Error("The Curriculum Guide returned an empty answer.");

  return {
    text,
    sourceLessonIds,
    sourceReferenceIds,
    provider: "ollama" as const,
    model: result.model || "configured Ollama model",
  };
};
