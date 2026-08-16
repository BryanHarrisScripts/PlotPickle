import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { CurriculumGuide, CurriculumGuideAnswer, CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import { retrieveCurriculumContext, type CurriculumRetrieval } from "./curriculum-retrieval";

const CRAFT_TERMS = /\b(?:screenplay|screenwriting|story|storytelling|plot|character|scene|structure|dialogue|pacing|tone|theme|motif|stakes|conflict|logline|visual storytelling|storyboard|act|sequence|protagonist|antagonist|inciting|climax|ending|opening|genre|premise|pitch|foundation|lesson|curriculum)\b/i;
const INTERNAL_MARKERS = /(?:LOCAL CURRICULUM BLOCK|curriculum_context|conversation_memory|student_question|QUALITY MODEL ESCALATION|RESPONSE QUALITY RETRY|SAGE CONVERSATION SPECIALIST|STARTUP HEALTH|system prompt|hidden reasoning)/i;
const EMPTY_RETRIEVAL: CurriculumRetrieval = {
  context: "",
  lessonIds: [],
  lessonChunkIds: [],
  sourceIds: [],
  sourceChunkIds: [],
};

type ModelRole = "fast" | "quality";
type ModelResult = {
  readonly text?: string;
  readonly message?: string;
  readonly runtimeProvider?: string;
  readonly model?: string;
};

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function isSageCraftQuestion(question: string) {
  return CRAFT_TERMS.test(question);
}

function isIdentityQuestion(question: string) {
  const value = normalized(question);
  return /\b(?:who are you|what are you|what is your name|whats your name|tell me about yourself|your background|are you human|do you have a brain|who am i talking to|who is this|whos this|what should i call you)\b/.test(value)
    && !isNameMeaningQuestion(question);
}

function isNameMeaningQuestion(question: string) {
  return /\b(?:what does (?:your|the) name mean|what does sage brinewick mean|meaning of (?:your|the) name|why (?:are you|were you) called sage brinewick)\b/.test(normalized(question));
}

function isWellbeingQuestion(question: string) {
  return /^(?:are you ok|are you okay|you ok|you okay|how are you|how are you doing|everything okay|everything ok)$/.test(normalized(question));
}

function isHelpQuestion(question: string) {
  return /^(?:can you help(?: me)?|could you help(?: me)?|will you help(?: me)?|help me|i need help|what can you do)$/.test(normalized(question));
}

function isShortenRequest(question: string) {
  const value = normalized(question);
  return /^(?:can you |could you |please )?(?:give me )?(?:a )?(?:shorter|short|briefer|more concise)(?: version)?(?: of that)?$/.test(value)
    || /^(?:can you |could you |please )?(?:shorten|condense|trim)(?: that| it| your answer)?$/.test(value);
}

function answer(text: string, model: string, retrieval: CurriculumRetrieval = EMPTY_RETRIEVAL): CurriculumGuideAnswer {
  return {
    text,
    sourceLessonIds: retrieval.lessonIds,
    sourceReferenceIds: retrieval.sourceIds,
    provider: "local-runtime",
    runtimeProvider: "PlotPickle Sage boundary",
    model,
  };
}

function compactSentences(value: string, maximumSentences = 4, maximumCharacters = 680) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [clean];
  const selected = sentences.slice(0, maximumSentences).join(" ").trim();
  if (selected.length <= maximumCharacters) return selected;
  const clipped = selected.slice(0, maximumCharacters);
  const boundary = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, boundary > maximumCharacters * 0.65 ? boundary : maximumCharacters).trim()}…`;
}

function deterministicAnswer(request: CurriculumGuideRequest): CurriculumGuideAnswer | null {
  if (isNameMeaningQuestion(request.question)) {
    return answer("‘Sage’ fits the guide-and-teacher role. ‘Brinewick’ is simply a fictional PlotPickle lore name with a slightly old-world, pickle-adjacent flavor — no secret ancestry involved.", "Sage name response");
  }
  if (isIdentityQuestion(request.question)) {
    return answer("I’m Sage Brinewick, PlotPickle’s Curriculum Guide. I help you understand the lessons, think through story problems, and apply what you learn to the story you’re building.", "Sage identity response");
  }
  if (isWellbeingQuestion(request.question)) {
    return answer("I’m here and working. What are we wrestling with?", "Sage conversation response");
  }
  if (isHelpQuestion(request.question)) {
    return answer("Yes. I can explain a lesson, help untangle a story problem, or talk through how to apply what you’re learning without taking the story away from you.", "Sage help response");
  }
  if (isShortenRequest(request.question)) {
    const previous = [...request.conversation].reverse().find((item) => item.role === "guide" && item.content.trim());
    return answer(previous ? compactSentences(previous.content, 2, 320) : "Sure. Tell me what you want shortened and I’ll tighten it up.", "Sage response editor");
  }
  return null;
}

function recentConversation(request: CurriculumGuideRequest) {
  return request.conversation.slice(-6).map((item) => (
    `${item.role === "writer" ? "Writer" : "Sage"}: ${item.content.replace(/\s+/g, " ").trim().slice(0, 500)}`
  )).join("\n");
}

function buildPrompt(request: CurriculumGuideRequest, retrieval: CurriculumRetrieval, repair = false) {
  const craft = isSageCraftQuestion(request.question);
  return [
    repair ? "The previous local reply was unusable. Answer once, directly and without repetition." : "Answer the writer directly.",
    craft
      ? "Use the relevant PlotPickle curriculum below for craft teaching. Give the answer first, then one practical implication or example if useful."
      : "This is ordinary conversation. Respond naturally; do not force it into a screenplay lesson.",
    recentConversation(request) ? `Recent conversation:\n${recentConversation(request)}` : "",
    craft ? `Relevant PlotPickle curriculum:\n${retrieval.context}` : "",
    `Writer: ${request.question.trim().slice(0, 2_000)}`,
  ].filter(Boolean).join("\n\n").slice(0, 10_500);
}

function hasRunawayRepetition(value: string) {
  const words = normalized(value).split(/\s+/).filter(Boolean);
  if (words.length < 18) return false;
  const counts = new Map<string, number>();
  for (let index = 0; index <= words.length - 4; index += 1) {
    const phrase = words.slice(index, index + 4).join(" ");
    const count = (counts.get(phrase) || 0) + 1;
    if (count >= 3) return true;
    counts.set(phrase, count);
  }
  return false;
}

export function sageUnifiedAnswerUsable(value: string, question: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 10 || INTERNAL_MARKERS.test(text) || hasRunawayRepetition(text)) return false;
  const answerText = normalized(text);
  const questionText = normalized(question);
  if (!answerText || answerText === questionText) return false;
  const answerWords = answerText.split(/\s+/).filter(Boolean);
  const questionWords = questionText.split(/\s+/).filter(Boolean);
  if (answerText.includes(questionText) && answerWords.length <= questionWords.length + 6) return false;
  const letters = (text.match(/[a-z]/gi) || []).length;
  return letters >= Math.max(8, Math.floor(text.length * 0.42));
}

async function prepareRole(role: ModelRole) {
  const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
    method: "POST",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(role === "fast" ? 30_000 : 45_000),
  });
  if (!response.ok) throw new Error(`Sage could not prepare the ${role} local model.`);
}

async function askModel(request: CurriculumGuideRequest, retrieval: CurriculumRetrieval, role: ModelRole, repair: boolean) {
  await prepareRole(role);
  const response = await fetch("/api/writing-assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PlotPickle-Model-Role": role },
    body: JSON.stringify({
      agentId: "curriculum-guide",
      provider: "local",
      modelRole: role,
      tone: "collaborative",
      message: buildPrompt(request, retrieval, repair),
    }),
    signal: AbortSignal.timeout(role === "fast" ? 25_000 : 45_000),
  });
  const result = await response.json() as ModelResult;
  if (!response.ok || !result.text?.trim()) throw new Error(result.message || "Sage returned no usable local reply.");
  if (!sageUnifiedAnswerUsable(result.text, request.question)) throw new Error("Sage returned a weak local reply.");
  return result;
}

function matchingLesson(request: CurriculumGuideRequest) {
  const active = request.curriculum.find((lesson) => lesson.id === request.activeLessonId);
  const terms = normalized(request.question).split(/\s+/).filter((term) => term.length >= 4);
  const ranked = request.curriculum.map((lesson, index) => ({
    lesson,
    index,
    score: terms.reduce((score, term) => score + (lessonText(lesson).includes(term) ? 1 : 0), 0) + (lesson.id === request.activeLessonId ? 1 : 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked[0]?.score ? ranked[0].lesson : active ?? request.curriculum[0];
}

function lessonText(lesson: CurriculumLesson) {
  return [lesson.title, lesson.topic, lesson.overview, ...lesson.objectives, ...lesson.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]), ...lesson.definitions.flatMap((definition) => [definition.term, definition.meaning]), lesson.apply].join(" ").toLowerCase();
}

function craftFallback(request: CurriculumGuideRequest, retrieval: CurriculumRetrieval) {
  const lesson = matchingLesson(request);
  if (!lesson) return answer("I couldn’t match that cleanly to the local PlotPickle curriculum. Try asking it another way and I’ll keep the answer direct.", "Sage curriculum fallback", retrieval);
  const definition = lesson.definitions.find((item) => normalized(request.question).includes(normalized(item.term)));
  const text = compactSentences([definition?.meaning, lesson.overview, lesson.apply].filter(Boolean).join(" "), 4, 680);
  return answer(text || lesson.overview, "Sage curriculum fallback", retrieval);
}

function conversationFallback() {
  return answer("That local reply didn’t come through cleanly, so I dropped it instead of showing you nonsense. Ask me again and I’ll keep it short and direct.", "Sage conversation fallback");
}

export const answerFromCurriculum: CurriculumGuide = async (request) => {
  const fixed = deterministicAnswer(request);
  if (fixed) return fixed;

  const craft = isSageCraftQuestion(request.question);
  const retrieval = craft
    ? retrieveCurriculumContext(request.curriculum, request.activeLessonId, request.question.trim().slice(0, 2_000))
    : EMPTY_RETRIEVAL;

  const attempts: readonly { role: ModelRole; repair: boolean }[] = [
    { role: "fast", repair: false },
    { role: "quality", repair: true },
  ];
  for (const attempt of attempts) {
    try {
      const result = await askModel(request, retrieval, attempt.role, attempt.repair);
      return {
        text: compactSentences(result.text || ""),
        sourceLessonIds: craft ? retrieval.lessonIds : [],
        sourceReferenceIds: craft ? retrieval.sourceIds : [],
        provider: "local-runtime",
        runtimeProvider: result.runtimeProvider,
        model: result.model || `${attempt.role} Sage model`,
      };
    } catch {
      // Bounded local-only recovery. A weak generation never reaches the writer.
    }
  }

  return craft ? craftFallback(request, retrieval) : conversationFallback();
};
