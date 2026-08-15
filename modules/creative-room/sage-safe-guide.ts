import type { CurriculumGuide, CurriculumGuideAnswer } from "../../core/contracts/curriculum-guide";
import { answerFromCurriculum as answerFromCurriculumUnsafe } from "./curriculum-guide";

const INTERNAL_PROMPT_MARKERS = /(?:QUALITY MODEL ESCALATION|RESPONSE QUALITY RETRY|CONVERSATION MODE:|STARTUP HEALTH(?: QUALITY FALLBACK| RETRY)?|curriculum_context|project_memory|conversation_memory|student_question|LOCAL CURRICULUM BLOCK|Produce one clean final response to the writer now|Follow Sage'?s identity and conversational role)/i;
const PROJECT_MEMORY_KEY = /"(?:id|title|revision|completedLessonCount|activeLessonId)"\s*:/g;

function normalizedQuestion(question: string) {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  if (isSageNameMeaningQuestion(request.question)) return safeNameMeaningAnswer();
  if (isSageIdentityQuestion(request.question)) return safeIdentityAnswer();
  if (isSageWellbeingQuestion(request.question)) return safeWellbeingAnswer();
  if (isSageHelpQuestion(request.question)) return safeHelpAnswer();
  if (isSageShortenRequest(request.question)) return safeShorterAnswer(request.conversation);

  const result = await answerFromCurriculumUnsafe(request);
  if (sageAnswerLeaksInternalScaffolding(result.text)) return safeLeakRecoveryAnswer();
  return result;
};
