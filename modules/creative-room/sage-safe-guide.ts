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
    "I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I’m a software mentor here to help you understand the lessons and apply them to your story.",
    "Sage identity response",
  );
}

function safeNameMeaningAnswer() {
  return safeAnswer(
    "‘Sage’ signals the guide-and-teacher role. ‘Brinewick’ is a fictional PlotPickle lore name, chosen for its slightly old-world, pickle-adjacent flavor — not a real family history or biography.",
    "Sage name-meaning response",
  );
}

function safeWellbeingAnswer() {
  return safeAnswer(
    "I’m here and working. What would you like to tackle?",
    "Sage conversational safety response",
  );
}

function safeLeakRecoveryAnswer() {
  return safeAnswer(
    "I couldn’t turn that into a clean answer, so I discarded the broken response instead of showing it to you. Ask me again and I’ll take another run at it.",
    "Sage safety recovery response",
  );
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  if (isSageNameMeaningQuestion(request.question)) return safeNameMeaningAnswer();
  if (isSageIdentityQuestion(request.question)) return safeIdentityAnswer();
  if (isSageWellbeingQuestion(request.question)) return safeWellbeingAnswer();

  const result = await answerFromCurriculumUnsafe(request);
  if (sageAnswerLeaksInternalScaffolding(result.text)) return safeLeakRecoveryAnswer();
  return result;
};
