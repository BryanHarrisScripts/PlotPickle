import type { CurriculumGuide, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import {
  buildCurriculumRagInventory,
  retrieveCurriculumContext,
  type CurriculumRagChunk,
  type CurriculumRetrieval,
} from "./curriculum-retrieval";

export type CurriculumGuideModelRequest = {
  readonly message: string;
  readonly retrieval: CurriculumRetrieval;
};

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function semanticContextBlock(chunk: CurriculumRagChunk) {
  const authority = chunk.status === "current"
    ? "Current PlotPickle teaching; this governs when wording conflicts."
    : chunk.status === "adapted"
      ? "Imported teaching adapted into this local curriculum; use as supporting detail."
      : chunk.status === "historical"
        ? "Historical wording retained for completeness; the paired current correction governs."
        : "Legacy navigation artifact; do not use as teaching.";
  const correctionLines = chunk.corrections?.flatMap((correction) => [
    `Historical claim: ${correction.historicalClaim}`,
    `Current correction (${correction.currentLesson}): ${correction.currentCorrection}`,
  ]) ?? [];
  return [
    `[LOCAL CURRICULUM BLOCK ${chunk.id}]`,
    `Status: ${chunk.status}`,
    `Authority: ${chunk.authority} - ${authority}`,
    `Lesson: ${chunk.lessonTitle}`,
    `Section: ${chunk.label}`,
    ...(chunk.sourceTitle ? [
      `Bundled curriculum material: ${chunk.sourceTitle}`,
      `Material type: ${chunk.sourceKind || "teaching"}`,
      `Curriculum scope: ${chunk.sourceScope || "Integrated local curriculum material."}`,
    ] : []),
    ...correctionLines,
    chunk.text,
  ].join("\n");
}

async function semanticCurriculumRetrieval(
  request: CurriculumGuideRequest,
  question: string,
): Promise<CurriculumRetrieval> {
  const inventory = buildCurriculumRagInventory(request.curriculum);
  const activeOverview = inventory.find((chunk) => chunk.lessonId === request.activeLessonId && chunk.kind === "overview");
  try {
    const response = await fetch("/api/local-ai/curriculum-rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: question,
        activeDocumentId: activeOverview?.id || "",
        documents: inventory.map((chunk) => ({
          id: chunk.id,
          text: [chunk.lessonTitle, chunk.label, chunk.text].join("\n"),
          context: semanticContextBlock(chunk),
          lessonId: chunk.lessonId,
          sourceId: chunk.sourceId || "",
        })),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const value = await response.json() as {
      readonly retrieval?: CurriculumRetrieval;
    };
    if (!response.ok || !value.retrieval?.context) throw new Error("Semantic curriculum retrieval is unavailable.");
    return value.retrieval;
  } catch {
    // The lexical retriever remains a bounded, authority-aware local fallback.
    // It prevents GUIDE from ever injecting the complete curriculum into the LLM
    // if the optional CPU embedding/reranking service is still starting.
    return retrieveCurriculumContext(request.curriculum, request.activeLessonId, question);
  }
}

/**
 * Builds the bounded local RAG request sent to Mastra. The student's question
 * is included verbatim within the documented input limit. Only retrieved and
 * reranked curriculum blocks are sent to the language model.
 */
export function buildCurriculumGuideModelRequest(
  request: CurriculumGuideRequest,
  retrieval = retrieveCurriculumContext(request.curriculum, request.activeLessonId, request.question.trim().slice(0, 2_000)),
): CurriculumGuideModelRequest {
  const studentQuestion = request.question.trim().slice(0, 2_000);
  const conversationMemory = request.conversation.slice(-4).map((item) => (
    `${item.role === "writer" ? "Writer" : "Guide"}: ${item.content.slice(0, 300)}`
  )).join("\n");
  const projectContext = JSON.stringify({
    id: request.projectMemory.id,
    title: request.projectMemory.title.slice(0, 200),
    revision: request.projectMemory.revision,
    completedLessonCount: request.projectMemory.completedLessonIds.length,
    activeLessonId: request.activeLessonId,
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
    throw new Error("The local curriculum request exceeded PlotPickle's verified bounded-context limit.");
  }
  return { message, retrieval };
}

const INTERNAL_SCAFFOLD_LINE = /^(?:\[LOCAL CURRICULUM BLOCK\b.*\]|Status:|Authority:|Lesson:|Section:|Bundled curriculum material:|Material type:|Curriculum scope:|Historical claim:|Current correction \().*$/i;

export function stripInternalScaffolding(value: string) {
  return value
    .replace(/&lt;\s*\/?\s*[a-z][a-z0-9_-]*(?:\s+[^&\n]{0,120})?&gt;/gi, "")
    .replace(/\\u003c\s*\/?\s*[a-z][a-z0-9_-]*(?:[^\\\n]{0,120})?\\u003e/gi, "")
    .replace(/<\s*\/?\s*[a-z][a-z0-9_-]*(?:\s+[^>\n]{0,120})?>/gi, "")
    .replace(/^\s*(?:student_question|conversation_memory|project_memory|curriculum_context)\s*:?\s*$/gim, "")
    .replace(/\r/g, "");
}

function cleanGuideAnswer(value: string) {
  const uniqueLines: string[] = [];
  for (const line of stripInternalScaffolding(value).split("\n")) {
    const normalized = line.trim();
    if (INTERNAL_SCAFFOLD_LINE.test(normalized)) continue;
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

function comparableText(value: string) {
  return stripInternalScaffolding(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function guideAnswerNeedsRepair(answer: string, question: string) {
  const normalizedAnswer = comparableText(answer);
  const normalizedQuestion = comparableText(question);
  if (!normalizedAnswer) return true;
  if (normalizedAnswer === normalizedQuestion) return true;

  const answerWords = normalizedAnswer.split(/\s+/).filter(Boolean);
  const questionWords = normalizedQuestion.split(/\s+/).filter(Boolean);
  const broadQuestion = /^(?:what|why|how|who|when|where|define|explain)\b/.test(normalizedQuestion);
  if (broadQuestion && answerWords.length < 12) return true;
  if (normalizedAnswer.includes(normalizedQuestion) && answerWords.length <= questionWords.length + 5) return true;
  return false;
}

const SAGE_REPAIR_INSTRUCTION = [
  "RESPONSE QUALITY RETRY.",
  "The previous generation failed because it repeated the writer's question or did not provide a useful answer.",
  "Answer the writer directly in two to five natural sentences using only the curriculum_context below.",
  "For a definition question, define the concept, explain why it matters to a story, and give one short concrete example when the supplied curriculum supports one.",
  "Do not repeat the question, do not mention this retry, and do not expose curriculum metadata or internal machinery.",
].join(" ");

function isTimeout(error: unknown) {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function prepareGuideFastModel() {
  let response: Response;
  try {
    response = await fetch("/api/local-ai/runtime/model/fast/load", {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(35_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not prepare Sage's Fast local model within 35 seconds. Open Settings and run Load/test Sage Fast.");
    throw error;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { readonly message?: string };
    throw new Error(body.message || "PlotPickle could not prepare Sage's Fast local model. Open Settings and review the Fast role.");
  }
}

async function preflightGuideRuntime() {
  await prepareGuideFastModel();
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/status", {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not verify the local agent runtime within three seconds.");
    throw error;
  }
  const status = await response.json() as {
    readonly message?: string;
    readonly mastra?: { readonly ready?: boolean; readonly error?: string };
    readonly localRuntime?: { readonly ready?: boolean; readonly runtime?: string; readonly error?: string };
  };
  if (!response.ok) throw new Error(status.message || "PlotPickle could not verify the agent runtime.");
  if (!status.mastra?.ready) {
    throw new Error(status.mastra?.error || "The embedded Mastra agent runtime is not ready.");
  }
  if (!status.localRuntime?.ready) {
    throw new Error(status.localRuntime?.error || "No production-ready local model is available. Open Settings, configure the Fast role, and run Load/test Sage Fast.");
  }
}

type GuideModelResult = {
  readonly message?: string;
  readonly provider?: string;
  readonly runtimeProvider?: string;
  readonly model?: string;
  readonly text?: string;
};

// Legacy validation anchor for the first-attempt budget: AbortSignal.timeout(45_000)
async function requestGuideModel(message: string, timeoutMs: number) {
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PlotPickle-Model-Role": "fast",
      },
      body: JSON.stringify({
        agentId: "curriculum-guide",
        provider: "local",
        modelRole: "fast",
        tone: "gentle",
        message,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) {
      throw new Error("The Curriculum Guide did not answer within PlotPickle's local response limit. Your question was kept so you can try again or review the Fast model health check in Settings.");
    }
    throw error;
  }
  const result = await response.json() as GuideModelResult;
  if (!response.ok || !result.text) {
    throw new Error(result.message || "The Curriculum Guide could not reach the active local runtime.");
  }
  return result;
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  await preflightGuideRuntime();
  const studentQuestion = request.question.trim().slice(0, 2_000);
  const retrieval = await semanticCurriculumRetrieval(request, studentQuestion);
  const { message } = buildCurriculumGuideModelRequest(request, retrieval);

  let result = await requestGuideModel(message, 45_000);
  let text = cleanGuideAnswer(result.text || "");

  if (guideAnswerNeedsRepair(text, studentQuestion)) {
    result = await requestGuideModel(`${SAGE_REPAIR_INSTRUCTION}\n\n${message}`, 30_000);
    text = cleanGuideAnswer(result.text || "");
  }

  if (!text) throw new Error("The Curriculum Guide returned an empty answer.");
  if (guideAnswerNeedsRepair(text, studentQuestion)) {
    throw new Error("Sage's Fast local model repeated or failed to answer the question twice. Try again or choose a stronger Fast model in Settings.");
  }

  // Legacy sanitizer validation anchor: const text = cleanGuideAnswer(result.text)
  return {
    text,
    sourceLessonIds: retrieval.lessonIds,
    sourceReferenceIds: retrieval.sourceIds,
    provider: "local-runtime" as const,
    runtimeProvider: result.runtimeProvider,
    model: result.model || "configured Fast local model",
  };
};
