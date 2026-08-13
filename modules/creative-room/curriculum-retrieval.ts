import type { CurriculumLesson, CurriculumSource } from "../../core/contracts/curriculum";
import {
  FOUNDATION_SOURCE_CORRECTIONS,
  type FoundationSourceCorrection,
} from "../../adapters/curriculum/foundation-content-coverage";

export type CurriculumRagChunkKind =
  | "overview"
  | "objective"
  | "teaching"
  | "definition"
  | "example"
  | "checklist"
  | "mistake"
  | "exercise"
  | "apply"
  | "correction"
  | "source";

export type CurriculumRagStatus = "current" | "adapted" | "historical" | "navigation";

export type CurriculumRagAuthority =
  | "governing-course"
  | "supporting-curriculum"
  | "superseded-context"
  | "non-teaching-artifact";

export type CurriculumRagChunk = {
  readonly id: string;
  readonly kind: CurriculumRagChunkKind;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly topic: string;
  readonly label: string;
  readonly text: string;
  readonly status: CurriculumRagStatus;
  readonly authority: CurriculumRagAuthority;
  readonly sourceId?: string;
  readonly sourceTitle?: string;
  readonly sourceKind?: string;
  readonly sourceScope?: string;
  readonly corrections?: readonly FoundationSourceCorrection[];
};

export type CurriculumRetrieval = {
  readonly context: string;
  readonly lessonIds: readonly string[];
  readonly lessonChunkIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly sourceChunkIds: readonly string[];
};

const MAX_CHUNK_CHARACTERS = 900;
const MAX_CONTEXT_CHARACTERS = 6_500;
const MAX_LESSON_CHUNKS = 12;
const MAX_SOURCE_CHUNKS = 4;

const ignoredTerms = new Set([
  "about",
  "correct",
  "does",
  "from",
  "have",
  "into",
  "lesson",
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
  character: ["protagonist", "motivation", "choice", "arc"],
  ending: ["payoff", "resolution", "closing", "consequence"],
  event: ["change", "turn", "inciting", "catalyst", "disruption"],
  first: ["opening", "setup", "early"],
  happens: ["change", "turn", "event", "consequence"],
  image: ["visual", "composition", "motif", "opening", "closing"],
  minutes: ["timing", "pace", "opening", "pages"],
  start: ["opening", "setup", "hook", "inciting"],
};

function queryTerms(value: string) {
  const direct = (value.toLowerCase().match(/[a-z0-9'-]{3,}/g) ?? [])
    .filter((term) => !ignoredTerms.has(term));
  return [...new Set(direct.flatMap((term) => [term, ...(relatedTerms[term] ?? [])]))];
}

function withoutRemoteAddresses(value: string) {
  return value
    .replace(/(?:https?:\/\/|www\.)[^\s<>()\]]+/gi, " ")
    .replace(/mailto:[^\s<>()\]]+/gi, " ");
}

/**
 * Imported documents remain exact in learn/*.json while their teaching is
 * incorporated into the local curriculum. Retrieval uses a readable local
 * form so historical repository addresses never become guidance to leave
 * PlotPickle.
 */
export function bundledSourcePlainText(source: CurriculumSource) {
  return withoutRemoteAddresses(source.content)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/[#*_>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitLongText(value: string, maximum = MAX_CHUNK_CHARACTERS) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maximum) return [normalized];

  const sentences = normalized.match(/[^.!?]+[.!?]+(?:[\"')\]]+)?|[^.!?]+$/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";
  for (const sentenceValue of sentences) {
    const sentence = sentenceValue.trim();
    if (!sentence) continue;
    if (sentence.length > maximum) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      const words = sentence.split(/\s+/);
      let wordChunk = "";
      for (const word of words) {
        const candidate = wordChunk ? `${wordChunk} ${word}` : word;
        if (candidate.length > maximum && wordChunk) {
          chunks.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = candidate;
        }
      }
      if (wordChunk) chunks.push(wordChunk);
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maximum && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function matchingSourceCorrections(source: CurriculumSource, text: string) {
  const normalized = text.toLowerCase();
  return FOUNDATION_SOURCE_CORRECTIONS.filter((correction) => (
    correction.sourceIds.includes(source.id)
    && correction.matchPhrases.some((phrase) => normalized.includes(phrase.toLowerCase()))
  ));
}

function isNavigationArtifact(text: string) {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^(?:home )?table of contents\b/.test(normalized)) return true;
  if (/^(?:home |back to top |table of contents )+$/.test(normalized)) return true;
  const navigationMarkers = normalized.match(/\b(?:home|table of contents|back to top)\b/g)?.length ?? 0;
  const sentenceMarkers = normalized.match(/[.!?](?:\s|$)/g)?.length ?? 0;
  return navigationMarkers >= 3 && sentenceMarkers <= 1;
}

function sourceAuthority(source: CurriculumSource, text: string) {
  const corrections = matchingSourceCorrections(source, text);
  if (corrections.length) {
    return {
      status: "historical" as const,
      authority: "superseded-context" as const,
      corrections,
    };
  }
  if (isNavigationArtifact(text)) {
    return {
      status: "navigation" as const,
      authority: "non-teaching-artifact" as const,
      corrections: [] as const,
    };
  }
  return {
    status: "adapted" as const,
    authority: "supporting-curriculum" as const,
    corrections: [] as const,
  };
}

function addChunks(
  target: CurriculumRagChunk[],
  lesson: CurriculumLesson,
  id: string,
  kind: CurriculumRagChunkKind,
  label: string,
  value: string,
  source?: CurriculumSource,
) {
  splitLongText(value).forEach((text, index, chunks) => {
    const sourceProfile = source ? sourceAuthority(source, text) : undefined;
    target.push({
      id: `${lesson.id}:${id}${chunks.length > 1 ? `:part-${index + 1}` : ""}`,
      kind,
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      topic: lesson.topic,
      label,
      text,
      status: sourceProfile?.status ?? "current",
      authority: sourceProfile?.authority ?? "governing-course",
      ...(source ? {
        sourceId: source.id,
        sourceTitle: source.title,
        sourceKind: source.kind,
        sourceScope: source.scopeNote,
        corrections: sourceProfile?.corrections ?? [],
      } : {}),
    });
  });
}

/** Build the complete local retrieval inventory. No lesson field or bundled
 * curriculum passage is omitted from this inventory. */
export function buildCurriculumRagInventory(curriculum: readonly CurriculumLesson[]) {
  const chunks: CurriculumRagChunk[] = [];
  for (const lesson of curriculum) {
    addChunks(chunks, lesson, "overview", "overview", "Overview", lesson.overview);
    lesson.objectives.forEach((objective, index) => {
      addChunks(chunks, lesson, `objective-${index + 1}`, "objective", "Learning objective", objective);
    });
    lesson.sections.forEach((section, sectionIndex) => {
      if (!section.paragraphs.length && !section.points?.length) {
        addChunks(chunks, lesson, `section-${sectionIndex + 1}`, "teaching", section.heading, section.heading);
      }
      section.paragraphs.forEach((paragraph, paragraphIndex) => {
        addChunks(
          chunks,
          lesson,
          `section-${sectionIndex + 1}-paragraph-${paragraphIndex + 1}`,
          "teaching",
          section.heading,
          paragraph,
        );
      });
      section.points?.forEach((point, pointIndex) => {
        addChunks(
          chunks,
          lesson,
          `section-${sectionIndex + 1}-point-${pointIndex + 1}`,
          "teaching",
          section.heading,
          point,
        );
      });
    });
    lesson.definitions.forEach((definition, index) => {
      addChunks(chunks, lesson, `definition-${index + 1}`, "definition", definition.term, definition.meaning);
    });
    addChunks(chunks, lesson, "example", "example", lesson.example.title, lesson.example.text);
    lesson.checklist.forEach((item, index) => {
      addChunks(chunks, lesson, `checklist-${index + 1}`, "checklist", "Lesson checklist", item);
    });
    lesson.mistakes.forEach((mistake, index) => {
      addChunks(chunks, lesson, `mistake-${index + 1}`, "mistake", "Common mistake", mistake);
    });
    addChunks(chunks, lesson, "exercise", "exercise", "Practice", lesson.exercise);
    addChunks(chunks, lesson, "apply", "apply", "Save this work to", lesson.apply);
    FOUNDATION_SOURCE_CORRECTIONS
      .filter((correction) => lesson.title === correction.currentLesson)
      .forEach((correction) => {
        addChunks(
          chunks,
          lesson,
          `correction-${correction.id}`,
          "correction",
          "Current curriculum correction",
          `Historical wording: ${correction.historicalClaim} Current curriculum: ${correction.currentCorrection}`,
        );
      });
    lesson.sources.forEach((source) => {
      addChunks(
        chunks,
        lesson,
        `source-${source.id}`,
        "source",
        `${source.title} - integrated curriculum material`,
        bundledSourcePlainText(source),
        source,
      );
    });
  }
  return chunks;
}

function scoreChunk(chunk: CurriculumRagChunk, terms: readonly string[], normalizedQuestion: string) {
  const label = chunk.label.toLowerCase();
  const title = chunk.lessonTitle.toLowerCase();
  const text = chunk.text.toLowerCase();
  const lexicalScore = terms.reduce((total, term) => (
    total
    + (title.includes(term) ? 12 : 0)
    + (label.includes(term) ? 9 : 0)
    + (text.includes(term) ? 3 : 0)
  ), 0);
  const exactMatch = normalizedQuestion.length >= 8 && text.includes(normalizedQuestion);
  if (!lexicalScore && !exactMatch) return 0;

  // Current PlotPickle teaching governs. Adapted material can deepen it,
  // historical wording can be retrieved only with its correction, and old
  // table-of-contents residue never competes as ordinary teaching.
  const lexicalMultiplier: Readonly<Record<CurriculumRagStatus, number>> = {
    current: 4,
    adapted: 2,
    historical: 1,
    navigation: 0,
  };
  const relevanceBonus: Readonly<Record<CurriculumRagStatus, number>> = {
    current: 100,
    adapted: 40,
    historical: 5,
    navigation: 0,
  };
  const exactMatchBonus: Readonly<Record<CurriculumRagStatus, number>> = {
    current: 10_000,
    adapted: 6_000,
    historical: 2_000,
    navigation: 1_000,
  };
  return lexicalScore * lexicalMultiplier[chunk.status]
    + relevanceBonus[chunk.status]
    + (chunk.kind === "correction" ? 120 : 0)
    + (chunk.corrections?.length ? 240 : 0)
    + (exactMatch ? exactMatchBonus[chunk.status] : 0);
}

function renderChunk(chunk: CurriculumRagChunk) {
  const authorityNotes: Readonly<Record<CurriculumRagStatus, string>> = {
    current: "Current PlotPickle teaching; this governs when wording conflicts.",
    adapted: "Imported teaching adapted into this local curriculum; use as supporting detail.",
    historical: "Historical wording retained for completeness; the paired current correction governs.",
    navigation: "Legacy navigation artifact retained for completeness; do not use as teaching.",
  };
  const sourceDetails = chunk.sourceTitle ? [
    `Bundled curriculum material: ${chunk.sourceTitle}`,
    `Material type: ${chunk.sourceKind || "teaching"}`,
    `Curriculum scope: ${chunk.sourceScope || "Integrated local curriculum material."}`,
  ] : [];
  const corrections = chunk.corrections?.flatMap((correction) => [
    `Historical claim: ${correction.historicalClaim}`,
    `Current correction (${correction.currentLesson}): ${correction.currentCorrection}`,
  ]) ?? [];
  return [
    `[LOCAL CURRICULUM BLOCK ${chunk.id}]`,
    `Status: ${chunk.status}`,
    `Authority: ${chunk.authority} - ${authorityNotes[chunk.status]}`,
    `Lesson: ${chunk.lessonTitle}`,
    `Section: ${chunk.label}`,
    ...sourceDetails,
    ...corrections,
    chunk.text,
  ].join("\n");
}

/**
 * Selects complete, stable blocks in response to the student's live question.
 * The active overview is always present; every other block competes by
 * relevance across the full bundled curriculum rather than a hard two-lesson
 * limit. Nothing is cut mid-block.
 */
export function retrieveCurriculumContext(
  curriculum: readonly CurriculumLesson[],
  activeLessonId: string,
  question: string,
): CurriculumRetrieval {
  const inventory = buildCurriculumRagInventory(curriculum);
  const normalizedQuestion = question.toLowerCase().replace(/\s+/g, " ").trim();
  const terms = queryTerms(question);
  const scored = inventory.map((chunk, order) => ({
    chunk,
    order,
    score: scoreChunk(chunk, terms, normalizedQuestion),
  }));
  const activeOverview = scored.find(({ chunk }) => (
    chunk.lessonId === activeLessonId && chunk.kind === "overview"
  ));
  const candidates = scored
    .filter(({ chunk, score }) => score > 0 && chunk.id !== activeOverview?.chunk.id)
    .sort((left, right) => (
      right.score - left.score
      || Number(right.chunk.lessonId === activeLessonId) - Number(left.chunk.lessonId === activeLessonId)
      || left.order - right.order
    ));

  const selected: CurriculumRagChunk[] = activeOverview ? [activeOverview.chunk] : [];
  let used = selected.reduce((total, chunk) => total + renderChunk(chunk).length + 2, 0);
  let lessonChunkCount = selected.filter((chunk) => chunk.kind !== "source").length;
  let sourceChunkCount = selected.filter((chunk) => chunk.kind === "source").length;
  for (const { chunk } of candidates) {
    const isSource = chunk.kind === "source";
    if (isSource && sourceChunkCount >= MAX_SOURCE_CHUNKS) continue;
    if (!isSource && lessonChunkCount >= MAX_LESSON_CHUNKS) continue;
    const rendered = renderChunk(chunk);
    if (used + rendered.length + 2 > MAX_CONTEXT_CHARACTERS) continue;
    selected.push(chunk);
    used += rendered.length + 2;
    if (isSource) sourceChunkCount += 1;
    else lessonChunkCount += 1;
  }

  const lessonChunks = selected.filter((chunk) => chunk.kind !== "source");
  const sourceChunks = selected.filter((chunk) => chunk.kind === "source");
  return {
    context: selected.map(renderChunk).join("\n\n---\n\n"),
    lessonIds: [...new Set(lessonChunks.map((chunk) => chunk.lessonId))],
    lessonChunkIds: lessonChunks.map((chunk) => chunk.id),
    sourceIds: [...new Set(sourceChunks.flatMap((chunk) => chunk.sourceId ? [chunk.sourceId] : []))],
    sourceChunkIds: sourceChunks.map((chunk) => chunk.id),
  };
}
