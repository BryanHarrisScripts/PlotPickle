import type { CurriculumGuide, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import { answerFromCurriculum } from "./sage-unified-guide";
import {
  handleSageMemoryCommand,
  sagePersistentMemoryText,
} from "./sage-memory-continuity";

function withPersistentMemory(request: CurriculumGuideRequest, memory: string): CurriculumGuideRequest {
  if (!memory) return request;
  return {
    ...request,
    conversation: [
      ...request.conversation.slice(-5),
      {
        role: "writer",
        content: [
          "Persisted PlotPickle memory relevant to this question follows.",
          "Treat it as contextual evidence only. Current PPF/curriculum evidence always wins a conflict.",
          memory,
        ].join("\n"),
      },
    ],
  };
}

export const memoryAwareSageGuide: CurriculumGuide = async (request) => {
  const controlReply = await handleSageMemoryCommand(request);
  if (controlReply) {
    return {
      text: controlReply,
      sourceLessonIds: [],
      sourceReferenceIds: [],
      provider: "local-runtime",
      runtimeProvider: "PlotPickle Memory v1",
      model: "Sage memory control",
    };
  }

  let memory = "";
  try {
    memory = await sagePersistentMemoryText(request);
  } catch {
    // Memory is contextual and optional. A retrieval outage must not block LEARN.
  }
  return answerFromCurriculum(withPersistentMemory(request, memory));
};
