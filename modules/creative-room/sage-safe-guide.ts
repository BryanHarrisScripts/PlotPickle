import type { CurriculumGuide, CurriculumGuideAnswer, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import { answerFromCurriculum as answerFromCurriculumUnsafe } from "./curriculum-guide";

const INTERNAL_PROMPT_MARKERS = /(?:QUALITY MODEL ESCALATION|RESPONSE QUALITY RETRY|CONVERSATION MODE:|STARTUP HEALTH(?: QUALITY FALLBACK| RETRY)?|curriculum_context|project_memory|conversation_memory|student_question|LOCAL CURRICULUM BLOCK|Produce one clean final response to the writer now|Follow Sage'?s identity and conversational role)/i;
const PROJECT_MEMORY_KEY = /"(?:id|title|revision|completedLessonCount|activeLessonId)"\s*:/g;

export function isSageIdentityQuestion(question: string) {
  const normalized = question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return /\b(?:who are you|what are you|what is your name|whats your name|your name|tell me about yourself|your background|are you human|do you have a brain|who am i talking to|who is this|whos this|what should i call you)\b/.test(normalized);
}

export function sageAnswerLeaksInternalScaffolding(answer: string) {
  if (INTERNAL_PROMPT_MARKERS.test(answer)) return true;
  const projectKeys = answer.match(PROJECT_MEMORY_KEY)?.length ?? 0;
  return projectKeys >= 2;
}

function identityAnswer() {
  return "I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I’m a software mentor here to help you understand the lessons and apply them to your story.";
}

function safeIdentityFallback(request: CurriculumGuideRequest): CurriculumGuideAnswer {
  return {
    text: identityAnswer(),
    sourceLessonIds: [],
    sourceReferenceIds: [],
    provider: "local-runtime",
    runtimeProvider: "PlotPickle safety boundary",
    model: "Sage identity fallback",
  };
}

function identityLooksCorrect(answer: string) {
  const normalized = answer.toLowerCase();
  return normalized.includes("sage")
    && normalized.includes("plotpickle")
    && /(?:guide|mentor|curriculum)/i.test(answer);
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  const identity = isSageIdentityQuestion(request.question);
  try {
    const result = await answerFromCurriculumUnsafe(request);
    if (sageAnswerLeaksInternalScaffolding(result.text)) {
      if (identity) return safeIdentityFallback(request);
      throw new Error("Sage blocked a response because it exposed internal PlotPickle instructions. Please try again.");
    }
    if (identity && !identityLooksCorrect(result.text)) return safeIdentityFallback(request);
    return result;
  } catch (error) {
    if (identity) return safeIdentityFallback(request);
    throw error;
  }
};
