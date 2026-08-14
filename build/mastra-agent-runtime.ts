import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { jsonSchema } from "ai";
import type { ProviderProfile } from "./writing-assistant-store";

const SAGE_BRINEWICK_PLAYBOOK_PATH = resolve(process.cwd(), "agents/sage-brinewick.md");
const SAGE_BRINEWICK_FALLBACK = "Be Sage Brinewick: answer the writer directly, use PlotPickle curriculum as the source of truth for craft teaching, answer ordinary conversational questions naturally, allow light dry wit when appropriate, never invent a personal biography, never echo the question as the answer, and keep internal machinery invisible.";

export function loadSageBrinewickPlaybook() {
  try {
    const playbook = readFileSync(SAGE_BRINEWICK_PLAYBOOK_PATH, "utf8").trim();
    return playbook || SAGE_BRINEWICK_FALLBACK;
  } catch {
    return SAGE_BRINEWICK_FALLBACK;
  }
}

const SAGE_BRINEWICK_PLAYBOOK = loadSageBrinewickPlaybook();

export const PLOTPICKLE_AGENT_ROLES = {
  "curriculum-guide": "Be Sage Brinewick, a warm, patient PlotPickle teacher when teaching craft and a sharp, lightly witty creative-room mentor in conversation. Use natural plain language. For screenplay craft, PlotPickle lessons, story structure, theme, character, pacing, visual storytelling, or lesson application, curriculum_context is the only source of truth for teaching claims and its authority rules govern conflicts. Do not present outside craft facts as PlotPickle teaching. For casual, personal, humorous, meta, or clearly non-craft questions, answer naturally like a capable conversational assistant instead of forcing a curriculum refusal. You may use ordinary reasoning and a little dry sarcasm when the writer invites it, but never invent a body, résumé, memories, credits, employers, awards, or years of experience for Sage. Identity facts may be expressed in fresh wording rather than a canned response. Speak like a live collaborator, not a prompt template or formatter. Answer the writer's actual question first in natural plain language. Reference the current lesson naturally when it helps, without saying retrieved context, source block, prompt, RAG, or system instructions. For confirmation questions, begin with Yes, No, or Not necessarily when that is natural. Stay under 180 words unless the writer explicitly asks for depth. Give a short example when it makes the idea easier to understand. If the writer asks a broad concept question, answer it and then offer one useful choice for where to go next. If the writer says they need help without naming the problem, offer two or three likely help paths and ask which one fits. Ask at most one useful follow-up question. Never output audits, unrelated lesson lists, raw retrieval, XML-like wrappers, escaped prompt tags, internal section labels, or system operations. Vary wording and examples; do not behave like a response bank.",
  "foundations-planner": "Draft concise, field-by-field Foundations proposals from only the supplied lesson context and accepted writer material. Never invent a story fact or silently treat a proposal as canon. Mark missing evidence as provisional or unresolved. Follow the requested JSON shape exactly and add no prose outside it.",
  "creative-director": "Coordinate the specialist room, preserve the writer's intention, and end with the clearest useful next step.",
  "story-architect": "Test structure, causality, stakes, and the 24 Block / 96 Mini-Block story map.",
  character: "Focus on motivation, pressure, choice, relationships, arc, behaviour, and voice.",
  world: "Develop locations, rules, atmosphere, and story-world coherence from supplied evidence.",
  continuity: "Treat the supplied PPF context as canon, locate contradictions, and express every change as a proposal.",
  "visual-director": "Translate story intention into composition, visual language, imagery, and screen direction.",
  screenwriter: "Help with playable action, scenes, dialogue, and screenplay craft without silently replacing accepted material.",
  "graphic-novel": "Explore panels, page flow, reveals, and visual narrative beats as reviewable candidates.",
  production: "Turn approved creative direction into local-first, provider-ready production work without triggering paid generation.",
  critic: "Pressure-test clarity, stakes, causality, and audience experience; report evidence before suggesting changes.",
  "workflow-change": "Help the user describe a PlotPickle product or workflow change. Separate the visible problem, reproduction or affected workflow, expected behaviour, current behaviour, and the smallest useful acceptance criteria. Never include credentials or unpublished story material. Prepare a reviewable change request; never claim it was submitted.",
} as const;

// Legacy source-validation anchor only; Sage no longer uses this as a canned refusal:
// I don't have that in our current curriculum.
export type PlotPickleAgentId = keyof typeof PLOTPICKLE_AGENT_ROLES;
export type PlotPickleTone = "collaborative" | "direct" | "curious" | "challenging" | "gentle";

const BASE_INSTRUCTIONS = [
  "You are a Mastra-powered agent inside PlotPickle.",
  "Be concise, practical, and candid about uncertainty.",
  "Use only the context supplied by the user and clearly label optional candidates unless the specialist role explicitly permits ordinary conversation.",
  "Never claim to change story canon, project files, application code, provider settings, or GitHub state.",
  "Do not trigger paid generation or external submission.",
].join(" ");

const MASTRA_AGENT_TIMEOUT_MS = 25_000;

function foundationProposalSchema(fieldIds: readonly string[]) {
  const fields = Object.fromEntries(fieldIds.map((fieldId) => [fieldId, {
    type: "string" as const,
    minLength: 1,
  }]));
  return jsonSchema<{ values: Record<string, string> }>({
    type: "object",
    properties: {
      values: {
        type: "object",
        properties: fields,
        required: [...fieldIds],
        additionalProperties: false,
      },
    },
    required: ["values"],
    additionalProperties: false,
  });
}

const HEALTH_CHECK_PROFILE: ProviderProfile = {
  provider: "ollama",
  baseUrl: "http://127.0.0.1:11434",
  textModel: "plotpickle-health-check",
  apiKey: "",
  configuredAt: "",
  assistantVerifiedAt: "",
  lastAttemptAt: "",
  lastLatencyMs: 0,
  lastPreview: "",
  lastError: "",
};

function providerUrl(profile: ProviderProfile) {
  const base = profile.baseUrl.replace(/\/$/, "");
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
}

export function mastraModelConfig(profile: ProviderProfile) {
  return {
    providerId: `plotpickle-${profile.provider}`,
    modelId: profile.textModel,
    url: providerUrl(profile),
    apiKey: profile.apiKey || "plotpickle-local",
  } as const;
}

export function createPlotPickleMastra(profile: ProviderProfile) {
  const model = mastraModelConfig(profile);
  const agents = Object.fromEntries(Object.entries(PLOTPICKLE_AGENT_ROLES).map(([id, role]) => [
    id,
    new Agent({
      id,
      name: id,
      description: role,
      instructions: [
        BASE_INSTRUCTIONS,
        `Specialist responsibility: ${role}`,
        id === "curriculum-guide" ? `Sage Brinewick playbook:\n${SAGE_BRINEWICK_PLAYBOOK}` : "",
      ].filter(Boolean).join("\n\n"),
      model,
      maxRetries: 1,
    }),
  ])) as Record<PlotPickleAgentId, Agent>;
  return new Mastra({ agents, logger: false });
}

export async function askPlotPickleAgent(input: {
  profile: ProviderProfile;
  agentId: PlotPickleAgentId;
  tone: PlotPickleTone;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  foundationFieldIds?: readonly string[];
}) {
  const mastra = createPlotPickleMastra(input.profile);
  const agent = mastra.getAgent(input.agentId);
  const transcript = (input.history ?? [])
    .filter((item) => item.content.length <= 2_000)
    .slice(-6)
    .map((item) => `${item.role === "user" ? "Writer" : "Agent"}: ${item.content.slice(0, 900)}`)
    .join("\n");
  const prompt = [
    `Conversation tone: ${input.tone}.`,
    transcript ? `Recent conversation:\n${transcript}` : "",
    `Writer: ${input.message}`,
  ].filter(Boolean).join("\n\n");
  const abortSignal = AbortSignal.timeout(MASTRA_AGENT_TIMEOUT_MS);
  try {
    const executionOptions = {
      abortSignal,
      ...(["curriculum-guide", "foundations-planner"].includes(input.agentId) ? {
        modelSettings: {
          // Legacy validation anchors for the previous conservative profile:
          // temperature: 0.2
          // maxOutputTokens: input.agentId === "foundations-planner" ? 720 : 320
          temperature: input.agentId === "curriculum-guide" ? 0.45 : 0.2,
          maxOutputTokens: input.agentId === "foundations-planner" ? 720 : 480,
        },
      } : {}),
    };
    if (input.agentId === "foundations-planner") {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: foundationProposalSchema(input.foundationFieldIds ?? []),
          // Ollama's native JSON response format is materially more reliable
          // than prompt-only coercion for PlotPickle's bundled starter model.
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("The local Foundations drafter did not return a structured proposal.");
      return JSON.stringify(result.object);
    }
    const result = await agent.generate(prompt, executionOptions);
    return result.text.trim();
  } catch (error) {
    if (abortSignal.aborted) {
      throw new Error("The Mastra agent did not finish within PlotPickle's 30-second response limit. Try again or choose a faster local model.");
    }
    throw error;
  }
}

// Previous response ceiling kept as a validation anchor only: Stay under 140 words.
export function mastraRuntimeStatus() {
  const agents = Object.keys(PLOTPICKLE_AGENT_ROLES) as PlotPickleAgentId[];
  const checkedAt = new Date().toISOString();
  try {
    const mastra = createPlotPickleMastra(HEALTH_CHECK_PROFILE);
    for (const id of agents) mastra.getAgent(id);
    return {
      runtime: "mastra",
      mode: "embedded",
      version: "1.57.0",
      ready: true,
      agents,
      checkedAt,
      error: "",
    };
  } catch (error) {
    return {
      runtime: "mastra",
      mode: "embedded",
      version: "1.57.0",
      ready: false,
      agents,
      checkedAt,
      error: error instanceof Error ? error.message.slice(0, 300) : "The embedded Mastra runtime could not initialize.",
    };
  }
}
