import type { CurriculumGuide, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import { retrieveCurriculumContext, type CurriculumRetrieval } from "./curriculum-retrieval";

export type CurriculumGuideModelRequest = {
  readonly message: string;
  readonly retrieval: CurriculumRetrieval;
};

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * Builds the bounded, local-only RAG request sent to Mastra. The student's
 * question is always included verbatim (within the documented input limit),
 * after the complete structured context. No answer or suggested response is
 * selected here; the local Ollama model generates the answer.
 */
export function buildCurriculumGuideModelRequest({
  curriculum,
  activeLessonId,
  question,
  conversation,
  projectMemory,
}: CurriculumGuideRequest): CurriculumGuideModelRequest {
  const studentQuestion = question.trim().slice(0, 2_000);
  const retrieval = retrieveCurriculumContext(curriculum, activeLessonId, studentQuestion);
  const conversationMemory = conversation.slice(-4).map((item) => (
    `${item.role === "writer" ? "Writer" : "Guide"}: ${item.content.slice(0, 300)}`
  )).join("\n");
  const projectContext = JSON.stringify({
    id: projectMemory.id,
    title: projectMemory.title.slice(0, 200),
    revision: projectMemory.revision,
    completedLessonCount: projectMemory.completedLessonIds.length,
    activeLessonId,
  });

  const message = [
    "<conversation_memory>",
    xmlText(conversationMemory || "No previous conversation."),
    "</conversation_memory>",
    "<project_memory>",
    xmlText(projectContext),
    "</project_memory>",
    "<curriculum_context>",
    xmlText(retrieval.context),
    "</curriculum_context>",
    "<student_question>",
    xmlText(studentQuestion),
    "</student_question>",
  ].join("\n\n");

  if (message.length > 12_000) {
    throw new Error("The local curriculum request exceeded PlotPickle's verified context boundary.");
  }
  return { message, retrieval };
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

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  await preflightGuideRuntime();
  const { message, retrieval } = buildCurriculumGuideModelRequest(request);

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
    sourceLessonIds: retrieval.lessonIds,
    sourceReferenceIds: retrieval.sourceIds,
    provider: "ollama" as const,
    model: result.model || "configured Ollama model",
  };
};
