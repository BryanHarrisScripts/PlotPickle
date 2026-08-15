import type { CurriculumGuide, CurriculumGuideAnswer } from "../../core/contracts/curriculum-guide";
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

function safeIdentityAnswer(): CurriculumGuideAnswer {
  return {
    text: "I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I’m a software mentor here to help you understand the lessons and apply them to your story.",
    sourceLessonIds: [],
    sourceReferenceIds: [],
    provider: "local-runtime",
    runtimeProvider: "PlotPickle safety boundary",
    model: "Sage identity response",
  };
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  if (isSageIdentityQuestion(request.question)) return safeIdentityAnswer();

  const result = await answerFromCurriculumUnsafe(request);
  if (sageAnswerLeaksInternalScaffolding(result.text)) {
    throw new Error("Sage blocked a response because it exposed internal PlotPickle instructions. Please try again.");
  }
  return result;
};
