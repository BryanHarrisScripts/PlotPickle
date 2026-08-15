import type { CurriculumGuideAnswer, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";

const CRAFT_TERMS = /\b(?:screenplay|screenwriting|story|storytelling|plot|character|scene|structure|dialogue|pacing|tone|theme|motif|stakes|conflict|logline|visual storytelling|storyboard|act|sequence|protagonist|antagonist|inciting|climax|ending|opening|genre|premise|pitch|foundation|lesson|curriculum)\b/i;

type SpecialistResult = {
  readonly message?: string;
  readonly runtimeProvider?: string;
  readonly model?: string;
  readonly text?: string;
};

function isTimeout(error: unknown) {
  return error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError");
}

export function isSageCraftQuestion(question: string) {
  return CRAFT_TERMS.test(question);
}

function recentConversation(request: CurriculumGuideRequest) {
  return request.conversation.slice(-6).map((item) => (
    `${item.role === "writer" ? "Writer" : "Sage"}: ${item.content.replace(/\s+/g, " ").trim().slice(0, 600)}`
  )).join("\n");
}

function conversationPrompt(request: CurriculumGuideRequest) {
  return [
    "SAGE CONVERSATION SPECIALIST.",
    "Reply as Sage Brinewick, the same person the writer sees in the Creative Room.",
    "This is ordinary conversation, not a curriculum lookup. Answer like a capable, warm, lightly witty human collaborator who is ready to chat.",
    "Use ordinary reasoning for casual, strange, humorous, meta, or general questions. Never invent a human body, career history, memories, credentials, or private experiences for Sage.",
    "Answer directly in 2 to 4 sentences. Do not lecture, list internal sources, mention routing, or expose system machinery.",
    recentConversation(request) ? `Recent conversation:\n${recentConversation(request)}` : "No earlier conversation is needed.",
    `Writer: ${request.question.trim().slice(0, 2_000)}`,
  ].join("\n\n");
}

async function prepareRole(role: "fast" | "quality") {
  const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
    method: "POST",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(role === "fast" ? 35_000 : 45_000),
  });
  if (!response.ok) throw new Error(`Sage could not prepare the ${role} local model.`);
}

async function askRole(request: CurriculumGuideRequest, role: "fast" | "quality") {
  await prepareRole(role);
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PlotPickle-Model-Role": role,
      },
      body: JSON.stringify({
        agentId: "curriculum-guide",
        provider: "local",
        modelRole: role,
        tone: "collaborative",
        message: conversationPrompt(request),
      }),
      signal: AbortSignal.timeout(role === "fast" ? 30_000 : 45_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error(`Sage's ${role} conversation specialist timed out.`);
    throw error;
  }
  const result = await response.json() as SpecialistResult;
  if (!response.ok || !result.text?.trim()) throw new Error(result.message || "Sage's conversation specialist did not return an answer.");
  return result;
}

export async function answerAsSageConversationSpecialist(request: CurriculumGuideRequest): Promise<CurriculumGuideAnswer> {
  let result: SpecialistResult;
  let role: "fast" | "quality" = "fast";
  try {
    result = await askRole(request, role);
  } catch {
    role = "quality";
    result = await askRole(request, role);
  }
  return {
    text: result.text?.trim() || "",
    sourceLessonIds: [],
    sourceReferenceIds: [],
    provider: "local-runtime",
    runtimeProvider: result.runtimeProvider,
    model: result.model || `${role} Sage conversation model`,
  };
}
