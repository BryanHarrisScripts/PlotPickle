import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { CurriculumGuide, CurriculumGuideAnswer } from "../../core/contracts/curriculum-guide";
import { answerFromCurriculum as answerFromCurriculumUnsafe } from "./curriculum-guide";
import {
  answerAsSageConversationSpecialist,
  isSageCraftQuestion,
} from "./sage-conversation-specialist";

const INTERNAL_PROMPT_MARKERS = /(?:QUALITY MODEL ESCALATION|RESPONSE QUALITY RETRY|CONVERSATION MODE:|STARTUP HEALTH(?: QUALITY FALLBACK| RETRY)?|curriculum_context|project_memory|conversation_memory|student_question|LOCAL CURRICULUM BLOCK|Produce one clean final response to the writer now|Follow Sage'?s identity and conversational role|SAGE CONVERSATION SPECIALIST)/i;
const PROJECT_MEMORY_KEY = /"(?:id|title|revision|completedLessonCount|activeLessonId)"\s*:/g;
const SAGE_CRAFT_RESPONSE_DEADLINE_MS = 20_000;
const FALLBACK_IGNORED_TERMS = new Set([
  "about", "and", "are", "can", "could", "define", "explain", "for", "from", "how", "into", "is", "lesson", "me", "my",
  "of", "plotpickle", "screenplay", "should", "story", "tell", "that", "the", "this", "to", "use", "what", "why", "with", "you", "your",
]);

type GuideRequest = Parameters<CurriculumGuide>[0];

function normalizedQuestion(question: string) {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fallbackQuestionTerms(question: string) {
  return normalizedQuestion(question)
    .split(/\s+/)
    .filter((term) => term.length >= 3 && !FALLBACK_IGNORED_TERMS.has(term));
}

function lessonSearchText(lesson: CurriculumLesson) {
  return [
    lesson.title,
    lesson.topic,
    lesson.overview,
    ...lesson.objectives,
    ...lesson.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]),
    ...lesson.definitions.flatMap((definition) => [definition.term, definition.meaning]),
    lesson.example.title,
    lesson.example.text,
    ...lesson.checklist,
    ...lesson.mistakes,
    lesson.exercise,
    lesson.apply,
    ...lesson.tags,
  ].join(" ");
}

function matchingTermCount(value: string, terms: readonly string[]) {
  const normalized = normalizedQuestion(value);
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

function fallbackLessonForQuestion(request: GuideRequest) {
  const terms = fallbackQuestionTerms(request.question);
  const activeLesson = request.curriculum.find((lesson) => lesson.id === request.activeLessonId);
  if (!terms.length) return activeLesson ?? request.curriculum[0];

  const ranked = request.curriculum.map((lesson, index) => {
    const titleScore = matchingTermCount(`${lesson.title} ${lesson.tags.join(" ")}`, terms) * 8;
    const definitionScore = lesson.definitions.reduce((score, definition) => (
      score + matchingTermCount(definition.term, terms) * 12 + matchingTermCount(definition.meaning, terms) * 2
    ), 0);
    const bodyScore = matchingTermCount(lessonSearchText(lesson), terms);
    const activeBonus = lesson.id === request.activeLessonId ? 1 : 0;
    return { lesson, index, score: titleScore + definitionScore + bodyScore + activeBonus };
  }).sort((left, right) => right.score - left.score || left.index - right.index);

  return ranked[0]?.score > 0 ? ranked[0].lesson : activeLesson ?? request.curriculum[0];
}

function fallbackCurriculumPassages(lesson: CurriculumLesson, question: string) {
  const terms = fallbackQuestionTerms(question);
  const candidates = [
    ...lesson.definitions.map((definition) => ({ text: `${definition.term}: ${definition.meaning}`, base: 8 })),
    { text: lesson.overview, base: 6 },
    ...lesson.sections.flatMap((section) => [
      ...section.paragraphs.map((paragraph) => ({ text: paragraph, base: 4 })),
      ...(section.points ?? []).map((point) => ({ text: point, base: 3 })),
    ]),
    { text: lesson.apply, base: 5 },
    { text: lesson.example.text, base: 2 },
  ].filter((candidate) => candidate.text.trim());

  return candidates
    .map((candidate, index) => ({
      ...candidate,
      index,
      score: candidate.base + matchingTermCount(candidate.text, terms) * 10,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((candidate) => candidate.text);
}

async function withinVisibleReplyDeadline<T>(work: Promise<T>, timeoutMs = SAGE_CRAFT_RESPONSE_DEADLINE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Sage's primary craft path exceeded the visible reply budget.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isSageNameMeaningQuestion(question: string) {
  const normalized = normalizedQuestion(question);
  return /\b(?:what does (?:your|the) name mean|what does sage brinewick mean|meaning of (?:your|the) name|why (?:are you|were you) called sage brinewick)\b/.test(normalized);
}

export function isSageIdentityQuestion(question: string) {
  const normalized = normalizedQuestion(question);
  if (isSageNameMeaningQuestion(question)) return false;
  return /\b(?:who are you|what are you|what is your name|whats your name|tell me about yourself|your background|are you human|do you have a brain|who am i talking to|who is this|whos this|what should i call you)\b/.test(normalized);
}

export function isSageWellbeingQuestion(question: string) {
  const normalized = normalizedQuestion(question);
  return /^(?:are you ok|are you okay|you ok|you okay|how are you|how are you doing|everything okay|everything ok)$/.test(normalized);
}

export function isSageHelpQuestion(question: string) {
  const normalized = normalizedQuestion(question);
  return /^(?:can you help(?: me)?|could you help(?: me)?|will you help(?: me)?|help me|i need help|what can you do)$/.test(normalized);
}

export function isSageShortenRequest(question: string) {
  const normalized = normalizedQuestion(question);
  return /^(?:can you |could you |please )?(?:give me )?(?:a )?(?:shorter|short|briefer|more concise)(?: version)?(?: of that)?$/.test(normalized)
    || /^(?:can you |could you |please )?(?:shorten|condense|trim)(?: that| it| your answer)?$/.test(normalized);
}

export function sageAnswerLeaksInternalScaffolding(answer: string) {
  if (INTERNAL_PROMPT_MARKERS.test(answer)) return true;
  const projectKeys = answer.match(PROJECT_MEMORY_KEY)?.length ?? 0;
  return projectKeys >= 2;
}

function safeAnswer(text: string, model: string): CurriculumGuideAnswer {
  return {
    text,
    sourceLessonIds: [],
    sourceReferenceIds: [],
    provider: "local-runtime",
    runtimeProvider: "PlotPickle safety boundary",
    model,
  };
}

function safeIdentityAnswer() {
  return safeAnswer(
    "I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I’m here to help you understand the lessons, work through story problems, and apply what you learn.",
    "Sage identity response",
  );
}

function safeNameMeaningAnswer() {
  return safeAnswer(
    "‘Sage’ signals the guide-and-teacher role. ‘Brinewick’ is a fictional PlotPickle lore name with a slightly old-world, pickle-adjacent flavor — not a real family history.",
    "Sage name-meaning response",
  );
}

function safeWellbeingAnswer() {
  return safeAnswer(
    "I’m here and working. What would you like to tackle?",
    "Sage conversational safety response",
  );
}

function safeHelpAnswer() {
  return safeAnswer(
    "Yes — I can help. Ask me about a PlotPickle lesson, a story problem you’re wrestling with, or just talk the idea through with me and we’ll find a useful next step.",
    "Sage help response",
  );
}

function compactSentences(value: string, maximumSentences = 2, maximumCharacters = 320) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [clean];
  const selected = sentences.slice(0, maximumSentences).join(" ").trim();
  if (selected.length <= maximumCharacters) return selected;
  const clipped = selected.slice(0, maximumCharacters);
  const boundary = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("? "), clipped.lastIndexOf("! "), clipped.lastIndexOf(" "));
  return `${clipped.slice(0, boundary > maximumCharacters * 0.6 ? boundary : maximumCharacters).trim()}…`;
}

function visibleSageAnswer(result: CurriculumGuideAnswer) {
  return {
    ...result,
    text: compactSentences(result.text, 4, 680),
  };
}

function safeShorterAnswer(conversation: Parameters<CurriculumGuide>[0]["conversation"]) {
  const previous = [...conversation].reverse().find((item) => item.role === "guide" && item.content.trim());
  if (!previous) {
    return safeAnswer(
      "Sure. Tell me what you want shortened and I’ll tighten it up.",
      "Sage response editor",
    );
  }
  return safeAnswer(
    compactSentences(previous.content),
    "Sage response editor",
  );
}

function safeLeakRecoveryAnswer() {
  return safeAnswer(
    "That answer came out garbled, so I dropped it rather than show you the machinery underneath. Ask it another way and I’ll answer cleanly.",
    "Sage safety recovery response",
  );
}

function safeCraftFallbackAnswer(request: GuideRequest): CurriculumGuideAnswer {
  const lesson = fallbackLessonForQuestion(request);
  if (!lesson) {
    return safeAnswer(
      "I couldn’t match that question to the local PlotPickle curriculum cleanly. Open the closest lesson and ask me again from there.",
      "Sage curriculum fallback",
    );
  }

  const passages = fallbackCurriculumPassages(lesson, request.question);
  const primary = compactSentences(passages[0] || lesson.overview, 2, 420);
  const secondary = compactSentences(passages.find((passage) => passage !== passages[0]) || lesson.apply, 1, 240);
  const text = compactSentences([primary, secondary].filter(Boolean).join(" "), 4, 680);

  return {
    text: text || compactSentences(lesson.overview || lesson.apply || lesson.title, 4, 680),
    sourceLessonIds: [lesson.id],
    sourceReferenceIds: lesson.sources.slice(0, 2).map((source) => source.id),
    provider: "local-runtime",
    runtimeProvider: "PlotPickle curriculum safety boundary",
    model: "Sage curriculum-grounded fallback",
  };
}

async function safeCraftAnswer(request: GuideRequest) {
  try {
    return await withinVisibleReplyDeadline(answerFromCurriculumUnsafe(request));
  } catch {
    return safeCraftFallbackAnswer(request);
  }
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  if (isSageNameMeaningQuestion(request.question)) return safeNameMeaningAnswer();
  if (isSageIdentityQuestion(request.question)) return safeIdentityAnswer();
  if (isSageWellbeingQuestion(request.question)) return safeWellbeingAnswer();
  if (isSageHelpQuestion(request.question)) return safeHelpAnswer();
  if (isSageShortenRequest(request.question)) return safeShorterAnswer(request.conversation);

  const result = isSageCraftQuestion(request.question)
    ? await safeCraftAnswer(request)
    : await answerAsSageConversationSpecialist(request);
  if (sageAnswerLeaksInternalScaffolding(result.text)) return safeLeakRecoveryAnswer();
  return visibleSageAnswer(result);
};
