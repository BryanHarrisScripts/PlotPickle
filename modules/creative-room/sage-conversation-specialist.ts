import type { CurriculumGuideAnswer, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";

const CRAFT_TERMS = /\b(?:screenplay|screenwriting|story|storytelling|plot|character|scene|structure|dialogue|pacing|tone|theme|motif|stakes|conflict|logline|visual storytelling|storyboard|act|sequence|protagonist|antagonist|inciting|climax|ending|opening|genre|premise|pitch|foundation|lesson|curriculum)\b/i;
const INTERNAL_MARKERS = /(?:SAGE CONVERSATION SPECIALIST|curriculum_context|project_memory|conversation_memory|student_question|LOCAL CURRICULUM BLOCK|QUALITY MODEL ESCALATION|RESPONSE QUALITY RETRY)/i;

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

function comparableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasRunawayRepetition(value: string) {
  const words = comparableText(value).split(/\s+/).filter(Boolean);
  if (words.length < 16) return false;
  const counts = new Map<string, number>();
  for (let index = 0; index <= words.length - 4; index += 1) {
    const phrase = words.slice(index, index + 4).join(" ");
    const count = (counts.get(phrase) || 0) + 1;
    if (count >= 3) return true;
    counts.set(phrase, count);
  }
  return false;
}

export function sageConversationAnswerUsable(answer: string, question: string) {
  const text = answer.replace(/\s+/g, " ").trim();
  if (text.length < 12 || INTERNAL_MARKERS.test(text)) return false;
  const normalized = comparableText(text);
  const normalizedQuestion = comparableText(question);
  if (!normalized || normalized === normalizedQuestion || hasRunawayRepetition(text)) return false;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 8 && new Set(words).size / words.length < 0.42) return false;
  const letters = (text.match(/[a-z]/gi) || []).length;
  if (letters < Math.max(8, Math.floor(text.length * 0.45))) return false;
  return true;
}

function recentConversation(request: CurriculumGuideRequest) {
  return request.conversation.slice(-6).map((item) => (
    `${item.role === "writer" ? "Writer" : "Sage"}: ${item.content.replace(/\s+/g, " ").trim().slice(0, 600)}`
  )).join("\n");
}

function conversationPrompt(request: CurriculumGuideRequest, repair = false) {
  return [
    repair ? "SAGE CONVERSATION QUALITY REPAIR." : "SAGE CONVERSATION SPECIALIST.",
    repair
      ? "The previous local answer was garbled, repetitive, empty, or otherwise not useful. Produce one clean final reply now."
      : "Reply as Sage Brinewick, the same person the writer sees in the Creative Room.",
    "This is ordinary conversation, not a curriculum lookup. Answer like a capable, warm, lightly witty human collaborator who is ready to chat.",
    "Use ordinary reasoning for casual, strange, humorous, meta, or general questions. Never invent a human body, career history, memories, credentials, or private experiences for Sage.",
    "Answer the writer's actual question directly in 2 to 4 complete sentences. Use plain English. Do not echo the question, repeat phrases, lecture, list internal sources, mention routing, or expose system machinery.",
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

async function askRole(request: CurriculumGuideRequest, role: "fast" | "quality", repair = false) {
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
        message: conversationPrompt(request, repair),
      }),
      signal: AbortSignal.timeout(role === "fast" ? 30_000 : 45_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error(`Sage's ${role} conversation specialist timed out.`);
    throw error;
  }
  const result = await response.json() as SpecialistResult;
  if (!response.ok || !result.text?.trim()) throw new Error(result.message || "Sage's conversation specialist did not return an answer.");
  if (!sageConversationAnswerUsable(result.text, request.question)) {
    throw new Error(`Sage's ${role} conversation answer was not coherent enough to show.`);
  }
  return result;
}

function safeConversationFallback(request: CurriculumGuideRequest): CurriculumGuideAnswer {
  const topic = request.question.replace(/\s+/g, " ").trim().slice(0, 120);
  return {
    text: topic
      ? `That local reply came out garbled, so I’m not going to pretend it was useful. Ask me “${topic}” once more and I’ll keep the answer short and direct.`
      : "That local reply came out garbled, so I dropped it instead of showing you nonsense. Ask me again and I’ll keep the answer short and direct.",
    sourceLessonIds: [],
    sourceReferenceIds: [],
    provider: "local-runtime",
    runtimeProvider: "PlotPickle conversation safety boundary",
    model: "Sage deterministic conversation fallback",
  };
}

export async function answerAsSageConversationSpecialist(request: CurriculumGuideRequest): Promise<CurriculumGuideAnswer> {
  const attempts: Array<{ role: "fast" | "quality"; repair: boolean }> = [
    { role: "fast", repair: false },
    { role: "quality", repair: true },
    { role: "fast", repair: true },
  ];
  for (const attempt of attempts) {
    try {
      const result = await askRole(request, attempt.role, attempt.repair);
      return {
        text: result.text?.trim() || "",
        sourceLessonIds: [],
        sourceReferenceIds: [],
        provider: "local-runtime",
        runtimeProvider: result.runtimeProvider,
        model: result.model || `${attempt.role} Sage conversation model`,
      };
    } catch {
      // Bounded local-only recovery. Never expose a weak generation to the writer.
    }
  }
  return safeConversationFallback(request);
}
