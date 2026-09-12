import type { CurriculumGuide } from "../../core/contracts/curriculum-guide";
import type { LearningApplicationView } from "../../core/contracts/learning-application";
import { answerFromCurriculum } from "./curriculum-guide";

function compactVisibleView(view: LearningApplicationView) {
  return JSON.stringify({
    project: view.project,
    lesson: view.lesson,
    craftModule: view.craftModule,
    facts: view.facts,
    authority: view.authority,
  });
}

export const answerWithEducationalAssistance: CurriculumGuide = async (request) => {
  if (request.interactionMode !== "ea-reflection" || !request.applicationView) {
    return answerFromCurriculum(request);
  }

  const reflectionRequest = [
    "EDUCATIONAL ASSISTANT REFLECTION MODE.",
    "Reflect on the writer's story through the current lesson; do not test, grade, score, certify mastery, or act as creative authority.",
    "Use only project facts present in deterministic_application_view. Never claim to have seen a scene, character fact, story decision, or project material that is absent from that view.",
    "Make one or two useful story-specific observations that connect the visible project facts to the lesson, then ask whether the observation matches the writer's intention.",
    "It is valid to say the current choice already appears to serve the lesson and may not need changing.",
    "Do not mutate canon, prescribe a mandatory revision, create an unlock condition, or imply that continuing depends on agreeing with you.",
    `<deterministic_application_view>${compactVisibleView(request.applicationView)}</deterministic_application_view>`,
    request.question.trim() || "Reflect this lesson against the visible story context and return the decision to me.",
  ].join("\n");

  return answerFromCurriculum({
    ...request,
    question: reflectionRequest,
  });
};
