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

type GuideModelRole = "fast" | "quality";
type GuideConversationMode = "craft" | "identity" | "help" | "conversation";

const EMPTY_RETRIEVAL: CurriculumRetrieval = {
  context: "",
  lessonIds: [],
  lessonChunkIds: [],
  sourceIds: [],
  sourceChunkIds: [],
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
    const value = await response.json() as { readonly retrieval?: CurriculumRetrieval };
    if (!response.ok || !value.retrieval?.context) throw new Error("Semantic curriculum retrieval is unavailable.");
    return value.retrieval;
  } catch {
    return retrieveCurriculumContext(request.curriculum, request.activeLessonId, question);
  }
}

function normalizedQuestion(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function guideConversationMode(question: string): GuideConversationMode {
  const normalized = normalizedQuestion(question);
  if (/\b(?:who are you|what are you|tell me about yourself|your background|are you human|do you have a brain)\b/.test(normalized)) {
    return "identity";
  }
  if (/^(?:can you help|could you help|will you help|help me|i need help|what can you do)\b/.test(normalized)) {
    return "help";
  }
  if (/\b(?:screenplay|screenwriting|story|storytelling|plot|character|scene|structure|dialogue|pacing|tone|theme|motif|stakes|conflict|logline|visual storytelling|storyboard|act|sequence|protagonist|antagonist|inciting|climax|ending|opening|genre|premise|pitch)\b/.test(normalized)) {
    return "craft";
  }
  return "conversation";
}

function broadCraftQuestion(question: string) {
  const normalized = normalizedQuestion(question);
  return /^(?:what|why|how|define|explain|tell me|what do you know)\b/.test(normalized)
    && /\b(?:story|storytelling|screenplay|screenwriting|plot|character|scene|structure|dialogue|pacing|tone|theme|motif|stakes|conflict|logline|visual)\b/.test(normalized);
}

function modeInstruction(mode: GuideConversationMode, question: string) {
  if (mode === "identity") {
    return [
      "CONVERSATION MODE: identity/meta.",
      "Answer this exact question as Sage Brinewick in fresh natural wording generated now.",
      "The fixed facts are that Sage Brinewick is PlotPickle's Curriculum Guide, a software mentor that helps writers understand lessons and apply them to their stories, and not a human with a real-world career biography.",
      "Never call Sage a student, a year, the question itself, a production professional, or a fictional person with memories or credentials.",
      "Do not turn the question back on the writer. A little dry wit is allowed, but answer first.",
    ].join(" ");
  }
  if (mode === "help") {
    return [
      "CONVERSATION MODE: help request.",
      "Answer the writer directly and positively in complete sentences.",
      "Briefly name two or three useful ways Sage can help with PlotPickle, lessons, or the writer's story, then ask at most one useful follow-up question.",
      "Never answer by rephrasing the writer's question as another question.",
    ].join(" ");
  }
  if (mode === "conversation") {
    return [
      "CONVERSATION MODE: ordinary conversation.",
      "Answer directly as Sage Brinewick without forcing a curriculum lookup.",
      "Use natural reasoning and fresh wording. Light dry wit is fine when appropriate. Never echo the writer's question or invent a personal biography.",
    ].join(" ");
  }
  return [
    "CONVERSATION MODE: PlotPickle/story craft.",
    broadCraftQuestion(question)
      ? "Give a clear 2-5 sentence explanation before any follow-up. Do not answer with a question or a list of source names."
      : "Answer the actual craft question first and keep the explanation practical.",
    "Use curriculum_context as the source of truth for teaching claims. Do not expose retrieval machinery or internal metadata.",
  ].join(" ");
}

export function buildCurriculumGuideModelRequest(
  request: CurriculumGuideRequest,
  retrieval = retrieveCurriculumContext(request.curriculum, request.activeLessonId, request.question.trim().slice(0, 2_000)),
  mode: GuideConversationMode = guideConversationMode(request.question),
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
  const curriculumContext = mode === "craft"
    ? retrieval.context
    : "No curriculum lookup is needed for this conversational question. Follow Sage's identity and conversational role.";

  const message = [
    modeInstruction(mode, studentQuestion),
    "<conversation_memory>",
    xmlText(conversationMemory || "No previous conversation."),
    "</conversation_memory>",
    "<project_memory>",
    xmlText(projectContext),
    "</project_memory>",
    "<curriculum_context>",
    xmlText(curriculumContext),
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
    if (/^(?:Curriculum|Lesson references)\s*:/i.test(normalized)) continue;
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

function contentWords(value: string) {
  const ignored = new Set(["a", "an", "and", "are", "can", "could", "do", "does", "i", "is", "me", "of", "the", "to", "what", "who", "you", "your"]);
  return comparableText(value).split(/\s+/).filter((word) => word && !ignored.has(word));
}

function shortSemanticEcho(answer: string, question: string) {
  const answerWords = comparableText(answer).split(/\s+/).filter(Boolean);
  const questionWords = contentWords(question);
  if (!questionWords.length || answerWords.length > 24) return false;
  const answerSet = new Set(contentWords(answer));
  const overlap = questionWords.filter((word) => answerSet.has(word)).length / questionWords.length;
  return overlap >= 0.8;
}

export function guideAnswerHasRunawayRepetition(answer: string) {
  const words = comparableText(answer).split(/\s+/).filter(Boolean);
  if (words.length < 24) return false;
  const counts = new Map<string, number>();
  for (let index = 0; index <= words.length - 5; index += 1) {
    const phrase = words.slice(index, index + 5).join(" ");
    const next = (counts.get(phrase) || 0) + 1;
    if (next >= 3) return true;
    counts.set(phrase, next);
  }
  return false;
}

export function guideAnswerNeedsRepair(
  answer: string,
  question: string,
  mode: GuideConversationMode = guideConversationMode(question),
) {
  const normalizedAnswer = comparableText(answer);
  const normalizedQuestionText = comparableText(question);
  if (!normalizedAnswer) return true;
  if (normalizedAnswer === normalizedQuestionText) return true;
  if (guideAnswerHasRunawayRepetition(answer)) return true;
  if (shortSemanticEcho(answer, question)) return true;

  const answerWords = normalizedAnswer.split(/\s+/).filter(Boolean);
  const questionWords = normalizedQuestionText.split(/\s+/).filter(Boolean);
  if (normalizedAnswer.includes(normalizedQuestionText) && answerWords.length <= questionWords.length + 8) return true;
  if (answer.trim().endsWith("?") && answerWords.length <= questionWords.length + 10) return true;

  if (mode === "identity") {
    if (!/\bsage\b/.test(normalizedAnswer) || !/\bplotpickle\b/.test(normalizedAnswer) || !/\b(?:guide|mentor|curriculum)\b/.test(normalizedAnswer)) return true;
    if (/\b(?:19|20)\d{2}\b/.test(normalizedAnswer) || /\bstudent of\b/.test(normalizedAnswer) || /\bi am (?:a|an) .*student\b/.test(normalizedAnswer)) return true;
  }
  if (mode === "help") {
    if (!/\b(?:yes|i can|can help|help you|happy to help)\b/.test(normalizedAnswer)) return true;
    if (answerWords.length < 8) return true;
  }
  if (mode === "craft" && broadCraftQuestion(question) && answerWords.length < 18) return true;
  return false;
}

const SAGE_REPAIR_INSTRUCTION = [
  "RESPONSE QUALITY RETRY.",
  "The previous generation echoed the writer, became nonsensical, looped, or failed to provide a useful response.",
  "Answer the writer's exact question directly in fresh natural language.",
  "For identity questions, identify Sage Brinewick as PlotPickle's Curriculum Guide/software mentor without inventing biography.",
  "For simple help requests, answer yes and say how you can help instead of asking the same question back.",
  "For screenplay or PlotPickle craft questions, use only curriculum_context for teaching claims and explain the answer clearly in complete sentences.",
  "For casual or meta conversation, answer naturally instead of forcing curriculum material into the response.",
  "Do not repeat the question, do not repeat phrases, do not mention this retry, and do not expose curriculum metadata or internal machinery.",
].join(" ");

const SAGE_QUALITY_ESCALATION_INSTRUCTION = [
  "QUALITY MODEL ESCALATION.",
  "Produce one clean final response to the writer now. The answer must be coherent, direct, freshly worded, and complete.",
  "Never answer a question with a paraphrase of the same question.",
  "For craft teaching, stay grounded in curriculum_context. For ordinary conversation, simply have the conversation.",
  "Never invent a personal career history, age, school year, physical biography, credits, or memories for Sage, and never mention this escalation.",
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

async function prepareGuideQualityModel() {
  let response: Response;
  try {
    response = await fetch("/api/local-ai/runtime/model/quality/load", {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("PlotPickle could not prepare Sage's Quality local model within 45 seconds.");
    throw error;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { readonly message?: string };
    throw new Error(body.message || "PlotPickle could not prepare Sage's Quality local model.");
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
  if (!status.mastra?.ready) throw new Error(status.mastra?.error || "The embedded Mastra agent runtime is not ready.");
  if (!status.localRuntime?.ready) throw new Error(status.localRuntime?.error || "No production-ready local model is available. Open Settings, configure the Fast role, and run Load/test Sage Fast.");
}

type GuideModelResult = {
  readonly message?: string;
  readonly provider?: string;
  readonly runtimeProvider?: string;
  readonly model?: string;
  readonly text?: string;
};

type CompletedGuideModelResult = GuideModelResult & { readonly text: string };

async function requestGuideModel(message: string, timeoutMs: number, modelRole: GuideModelRole = "fast"): Promise<CompletedGuideModelResult> {
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-PlotPickle-Model-Role": modelRole },
      body: JSON.stringify({
        agentId: "curriculum-guide",
        provider: "local" as const,
        modelRole,
        tone: "gentle" as const,
        message,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error(`The Curriculum Guide's ${modelRole} model did not answer within PlotPickle's local response limit.`);
    throw error;
  }
  const result = await response.json() as GuideModelResult;
  if (!response.ok || !result.text) throw new Error(result.message || "The Curriculum Guide could not reach the active local runtime.");
  return { ...result, text: result.text };
}

async function requestPreferredGuideModel(message: string, mode: GuideConversationMode, question: string) {
  const preferQuality = mode !== "craft" || broadCraftQuestion(question);
  if (preferQuality) {
    try {
      await prepareGuideQualityModel();
      return { result: await requestGuideModel(message, 45_000, "quality"), role: "quality" as const };
    } catch {
      return { result: await requestGuideModel(message, 45_000, "fast"), role: "fast" as const };
    }
  }
  return { result: await requestGuideModel(message, 45_000, "fast"), role: "fast" as const };
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  const studentQuestion = request.question.trim().slice(0, 2_000);
  const mode = guideConversationMode(studentQuestion);
  await preflightGuideRuntime();
  const retrieval = mode === "craft"
    ? await semanticCurriculumRetrieval(request, studentQuestion)
    : EMPTY_RETRIEVAL;
  const { message } = buildCurriculumGuideModelRequest(request, retrieval, mode);

  let { result, role } = await requestPreferredGuideModel(message, mode, studentQuestion);
  let text = cleanGuideAnswer(result.text);

  if (guideAnswerNeedsRepair(text, studentQuestion, mode)) {
    result = await requestGuideModel(`${SAGE_REPAIR_INSTRUCTION}\n\n${message}`, role === "quality" ? 45_000 : 30_000, role);
    text = cleanGuideAnswer(result.text);
  }

  if (guideAnswerNeedsRepair(text, studentQuestion, mode)) {
    const fallbackRole: GuideModelRole = role === "quality" ? "fast" : "quality";
    try {
      if (fallbackRole === "quality") await prepareGuideQualityModel();
      result = await requestGuideModel(`${SAGE_QUALITY_ESCALATION_INSTRUCTION}\n\n${message}`, 45_000, fallbackRole);
      role = fallbackRole;
      text = cleanGuideAnswer(result.text);
    } catch {
      // The final validation below keeps a weak local response from reaching the UI.
    }
  }

  if (!text) throw new Error("The Curriculum Guide returned an empty answer.");
  if (guideAnswerNeedsRepair(text, studentQuestion, mode)) {
    throw new Error("Sage's local models could not produce a coherent answer after repair. Try again or choose a stronger Fast or Quality model in Settings.");
  }

  return {
    text,
    sourceLessonIds: mode === "craft" ? retrieval.lessonIds : [],
    sourceReferenceIds: mode === "craft" ? retrieval.sourceIds : [],
    provider: "local-runtime" as const,
    runtimeProvider: result.runtimeProvider,
    model: result.model || `${role} local model`,
  };
};
