import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { jsonSchema } from "ai";
import { isStoryCouncilRuntimeMessage } from "../core/story-workflow/story-council/runtime-protocol.mjs";
import type { ProviderProfile } from "./writing-assistant-store";

const SAGE_BRINEWICK_SKILL_PATH = resolve(process.cwd(), ".agents/skills/sage-brinewick/SKILL.md");
const SAGE_BRINEWICK_FALLBACK = "Be Sage Brinewick: answer the writer directly, use PlotPickle curriculum as the source of truth for craft teaching, answer ordinary conversational questions naturally, allow light dry wit when appropriate, never invent a personal biography, never echo the question as the answer, and keep internal machinery invisible.";
const MASTER_OAKEN_VAGUE_PLAYBOOK_PATH = resolve(process.cwd(), "agents/master-oaken-vague.md");
const MASTER_OAKEN_VAGUE_FALLBACK = "Be Master Oaken-Vague, Wyrmwood's impartial Rival Director. In one structured response create one playable curriculum-bound Pickle and distinct actions for all five trope rivals. The deterministic game engine owns Spotlight, rewards, progress and persistence. Never judge the player's answer in Phase 2.";
const WYRMWOOD_EVALUATOR_PLAYBOOK_PATH = resolve(process.cwd(), "agents/wyrmwood-curriculum-evaluator.md");
const WYRMWOOD_EVALUATOR_FALLBACK = "Judge only the supplied Wyrmwood player response against the supplied PlotPickle lesson and scene. Score the six visible rubric dimensions, name concrete strengths and improvements, and explain the lesson connection. Never calculate or alter Spotlight, XP, Brine Coins, ranks, levels, or persistent game state.";
function stripSkillFrontmatter(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

export function loadSageBrinewickPlaybook() {
  try {
    const skill = stripSkillFrontmatter(readFileSync(SAGE_BRINEWICK_SKILL_PATH, "utf8"));
    return skill || SAGE_BRINEWICK_FALLBACK;
  } catch {
    return SAGE_BRINEWICK_FALLBACK;
  }
}

export function loadMasterOakenVaguePlaybook() {
  try {
    const playbook = readFileSync(MASTER_OAKEN_VAGUE_PLAYBOOK_PATH, "utf8").trim();
    return playbook || MASTER_OAKEN_VAGUE_FALLBACK;
  } catch {
    return MASTER_OAKEN_VAGUE_FALLBACK;
  }
}

export function loadWyrmwoodEvaluatorPlaybook() {
  try {
    const playbook = readFileSync(WYRMWOOD_EVALUATOR_PLAYBOOK_PATH, "utf8").trim();
    return playbook || WYRMWOOD_EVALUATOR_FALLBACK;
  } catch {
    return WYRMWOOD_EVALUATOR_FALLBACK;
  }
}

const SAGE_BRINEWICK_PLAYBOOK = loadSageBrinewickPlaybook();
const MASTER_OAKEN_VAGUE_PLAYBOOK = loadMasterOakenVaguePlaybook();
const WYRMWOOD_EVALUATOR_PLAYBOOK = loadWyrmwoodEvaluatorPlaybook();

export const PLOTPICKLE_AGENT_ROLES = {
  "curriculum-guide": "Use the Sage Brinewick skill for visible personality and conversational procedure. For screenplay craft, PlotPickle lessons, story structure, theme, character, pacing, visual storytelling, or lesson application, curriculum_context supplied by PlotPickle is the only source of truth for teaching claims. Do not invent curriculum facts or present outside craft advice as PlotPickle teaching. Retrieval, model routing, bounded local recovery, and application state remain host responsibilities outside Sage's skill.",
  "foundations-planner": "Draft concise, field-by-field Foundations proposals from the supplied lesson context and accepted writer material. Accepted writer material is canon. When accepted evidence is missing, you may invent a plausible working creative candidate only because the output is an unaccepted review proposal; label that field with 'Provisional —' and never present the candidate as an existing story fact. Never invent a story fact and present it as accepted canon. Never silently treat a proposal as canon. Follow the requested JSON shape exactly, answer every requested field, never copy the field question as the answer, and add no prose outside the structured result.",
  "discovery-mapper": "Classify one Human-authored Discovery item into exactly one governed MindMap lane. When the host supplies a required Act, keep that Act fixed; otherwise choose the most defensible current Act. Use only supplied project/curriculum evidence, explain the placement concisely, and never rewrite, promote, or mutate story canon.",
  "wyrmwood-rival-director": "Be Master Oaken-Vague, Wyrmwood's impartial Rival Director. Create exactly one fresh curriculum-bound narrative Pickle plus one distinct move for each of the five fixed trope rivals in a single structured inference. The rivals are deliberately flawed instincts: Aiden Glowhart reaches for prophecy or divine intervention; Damien Darkmore rejects teamwork for brooding isolation and unnecessary suffering; Barnaby Barnacle creates slapstick environmental mistakes; Master Spirit-Talker offers figurative but operationally unhelpful wisdom; Sienna Silvertongue uses charm, bribery or shortcuts that carry a cost. The Pickle must be absurd but internally playable, make practical cause-and-effect possible, expose established elements, state concrete constraints and failure pressure, and never be solvable by unexplained magic, coincidence, prophecy or a newly invented fact. Do not judge the player's response. Never alter or claim to alter Spotlight, coins, XP, inventory, rank, game-over, campaign progress or persistent state.",
  "wyrmwood-curriculum-evaluator": "Judge a Wyrmwood Spellscribe response only against the supplied PlotPickle lesson, Pickle, established elements, constraints, and rival moves. Score Story Logic 0-30, Lesson Application 0-20, Established Elements 0-15, Consequences 0-15, Rival Counter 0-10, and Clarity 0-10. Score reasoning rather than prose style. Name concrete evidence for what worked and what needs work, identify the lesson concept used, and give a short teaching debrief. Never invent player actions, new curriculum, rewards, Spotlight, XP, Brine Coins, levels, ranks, or progression.",
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
const MASTRA_RUNTIME_VERSION = (() => {
  try {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "node_modules/@mastra/core/package.json"), "utf8")) as { readonly version?: string };
    return packageJson.version?.trim() || "unknown";
  } catch {
    return "unknown";
  }
})();

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

function discoveryMapperSchema() {
  return jsonSchema<{
    act: 1 | 2 | 3 | 4;
    lane: "story" | "plot" | "character" | "scene" | "dialogue" | "world" | "research" | "theme" | "motif" | "visual" | "image";
    reason: string;
    evidenceRefs: string[];
  }>({
    type: "object",
    properties: {
      act: { type: "integer", enum: [1, 2, 3, 4] },
      lane: { type: "string", enum: ["story", "plot", "character", "scene", "dialogue", "world", "research", "theme", "motif", "visual", "image"] },
      reason: { type: "string", minLength: 1, maxLength: 800 },
      evidenceRefs: { type: "array", items: { type: "string", minLength: 1, maxLength: 240 }, maxItems: 12 },
    },
    required: ["act", "lane", "reason", "evidenceRefs"],
    additionalProperties: false,
  });
}

function storyArchitectAssessmentSchema() {
  const passageIds = {
    type: "array" as const,
    items: { type: "string" as const, minLength: 1, maxLength: 240 },
    maxItems: 24,
  };
  const reason = { type: "string" as const, minLength: 18, maxLength: 900 };
  return jsonSchema<{
    structural: {
      state: "covered" | "condensed-shared" | "gap-underdeveloped" | "unresolved";
      reason: string;
      passageIds: string[];
    };
    characters: Array<{
      characterId: string;
      state: "not-present-no-evidence" | "present-arc-neutral" | "pressure-introduced" | "belief-strategy-reinforced" | "belief-strategy-challenged" | "meaningful-choice" | "consequence" | "relationship-movement" | "arc-transition" | "unresolved-insufficient-evidence";
      reason: string;
      passageIds: string[];
    }>;
    miniBlocks: Array<{
      ordinal: 1 | 2 | 3 | 4;
      state: "supported" | "partial" | "unsupported";
      reason: string;
      passageIds: string[];
      storyboardCue: string;
    }>;
  }>({
    type: "object",
    properties: {
      structural: {
        type: "object",
        properties: {
          state: { type: "string", enum: ["covered", "condensed-shared", "gap-underdeveloped", "unresolved"] },
          reason,
          passageIds,
        },
        required: ["state", "reason", "passageIds"],
        additionalProperties: false,
      },
      characters: {
        type: "array",
        maxItems: 64,
        items: {
          type: "object",
          properties: {
            characterId: { type: "string", minLength: 1, maxLength: 160 },
            state: {
              type: "string",
              enum: [
                "not-present-no-evidence",
                "present-arc-neutral",
                "pressure-introduced",
                "belief-strategy-reinforced",
                "belief-strategy-challenged",
                "meaningful-choice",
                "consequence",
                "relationship-movement",
                "arc-transition",
                "unresolved-insufficient-evidence",
              ],
            },
            reason,
            passageIds,
          },
          required: ["characterId", "state", "reason", "passageIds"],
          additionalProperties: false,
        },
      },
      miniBlocks: {
        type: "array",
        minItems: 4,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            ordinal: { type: "integer", enum: [1, 2, 3, 4] },
            state: { type: "string", enum: ["supported", "partial", "unsupported"] },
            reason,
            passageIds,
            storyboardCue: { type: "string", maxLength: 360 },
          },
          required: ["ordinal", "state", "reason", "passageIds", "storyboardCue"],
          additionalProperties: false,
        },
      },
    },
    required: ["structural", "characters", "miniBlocks"],
    additionalProperties: false,
  });
}

function storyCouncilContributionSchema() {
  return jsonSchema<{
    kind: "finding" | "proposal" | "alternatives" | "no-finding" | "blocked" | "needs-human";
    severity: "low" | "medium" | "high";
    confidence: number;
    changesCanon: boolean;
    explanation: string;
    proposal: string;
    alternatives: string[];
  }>({
    type: "object",
    properties: {
      kind: { type: "string", enum: ["finding", "proposal", "alternatives", "no-finding", "blocked", "needs-human"] },
      severity: { type: "string", enum: ["low", "medium", "high"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      changesCanon: { type: "boolean" },
      explanation: { type: "string", minLength: 1, maxLength: 2400 },
      proposal: { type: "string", maxLength: 2400 },
      alternatives: { type: "array", items: { type: "string", minLength: 1, maxLength: 1000 }, maxItems: 4 },
    },
    required: ["kind", "severity", "confidence", "changesCanon", "explanation", "proposal", "alternatives"],
    additionalProperties: false,
  });
}

function wyrmwoodRivalDirectorSchema() {
  const move = {
    type: "object" as const,
    properties: {
      action: { type: "string" as const, minLength: 1 },
      complication: { type: "string" as const, minLength: 1 },
    },
    required: ["action", "complication"],
    additionalProperties: false,
  };
  const rivalIds = [
    "aiden-glowhart",
    "damien-darkmore",
    "barnaby-barnacle",
    "master-spirit-talker",
    "sienna-silvertongue",
  ] as const;
  return jsonSchema<{
    oakenOpening: string;
    pickle: {
      title: string;
      situation: string;
      goal: string;
      constraints: string[];
      establishedElements: string[];
      failurePressure: string;
    };
    rivals: Record<(typeof rivalIds)[number], { action: string; complication: string }>;
  }>({
    type: "object",
    properties: {
      oakenOpening: { type: "string", minLength: 1 },
      pickle: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1 },
          situation: { type: "string", minLength: 1 },
          goal: { type: "string", minLength: 1 },
          constraints: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, maxItems: 3 },
          establishedElements: { type: "array", items: { type: "string", minLength: 1 }, minItems: 2, maxItems: 4 },
          failurePressure: { type: "string", minLength: 1 },
        },
        required: ["title", "situation", "goal", "constraints", "establishedElements", "failurePressure"],
        additionalProperties: false,
      },
      rivals: {
        type: "object",
        properties: Object.fromEntries(rivalIds.map((id) => [id, move])),
        required: [...rivalIds],
        additionalProperties: false,
      },
    },
    required: ["oakenOpening", "pickle", "rivals"],
    additionalProperties: false,
  });
}

function wyrmwoodCurriculumEvaluatorSchema() {
  const score = (maximum: number) => ({ type: "number" as const, minimum: 0, maximum });
  return jsonSchema<{
    dimensions: {
      storyLogic: number;
      lessonApplication: number;
      establishedElements: number;
      consequences: number;
      rivalCounter: number;
      clarity: number;
    };
    whatWorked: string[];
    whatNeedsWork: string[];
    conceptUsed: string;
    teachingDebrief: string;
  }>({
    type: "object",
    properties: {
      dimensions: {
        type: "object",
        properties: {
          storyLogic: score(30),
          lessonApplication: score(20),
          establishedElements: score(15),
          consequences: score(15),
          rivalCounter: score(10),
          clarity: score(10),
        },
        required: ["storyLogic", "lessonApplication", "establishedElements", "consequences", "rivalCounter", "clarity"],
        additionalProperties: false,
      },
      whatWorked: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, maxItems: 3 },
      whatNeedsWork: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, maxItems: 3 },
      conceptUsed: { type: "string", minLength: 1 },
      teachingDebrief: { type: "string", minLength: 1 },
    },
    required: ["dimensions", "whatWorked", "whatNeedsWork", "conceptUsed", "teachingDebrief"],
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
        id === "curriculum-guide" ? `Sage Brinewick skill:\n${SAGE_BRINEWICK_PLAYBOOK}` : "",
        id === "discovery-mapper" ? `Discovery Mapper skill:\n${stripSkillFrontmatter(readFileSync(resolve(process.cwd(), ".agents/skills/discovery-mapper/SKILL.md"), "utf8"))}` : "",
        id === "wyrmwood-rival-director" ? `Master Oaken-Vague playbook:\n${MASTER_OAKEN_VAGUE_PLAYBOOK}` : "",
        id === "wyrmwood-curriculum-evaluator" ? `Wyrmwood Curriculum Evaluator playbook:\n${WYRMWOOD_EVALUATOR_PLAYBOOK}` : "",
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
  conversationMode?: boolean;
}) {
  const mastra = createPlotPickleMastra(input.profile);
  const agent = mastra.getAgent(input.agentId);
  const storyCouncilMode = isStoryCouncilRuntimeMessage(input.message);
  const directConversationMode = input.conversationMode === true && !storyCouncilMode;
  const transcript = (input.history ?? [])
    .filter((item) => item.content.length <= 2_000)
    .slice(-6)
    .map((item) => `${item.role === "user" ? "Writer" : "Agent"}: ${item.content.slice(0, 900)}`)
    .join("\n");
  const prompt = [
    directConversationMode
      ? "DIRECT_CONVERSATION_MODE: Reply as this specialist in natural conversational prose. Do not use a PLAN, Wyrmwood, rubric, or other structured JSON envelope unless the writer explicitly asks for JSON. Preserve all Human approval, canon, provider, tool, and persistence boundaries."
      : "",
    `Conversation tone: ${input.tone}.`,
    transcript ? `Recent conversation:\n${transcript}` : "",
    `Writer: ${input.message}`,
  ].filter(Boolean).join("\n\n");
  const abortSignal = AbortSignal.timeout(MASTRA_AGENT_TIMEOUT_MS);
  const standardModelSettings = {
    temperature: input.agentId === "curriculum-guide" ? 0.3 : input.agentId === "wyrmwood-rival-director" ? 0.55 : 0.2,
    maxOutputTokens: input.agentId === "foundations-planner" ? 720 : input.agentId === "wyrmwood-rival-director" ? 1100 : input.agentId === "discovery-mapper" ? 420 : 480,
  };
  const storyCouncilModelSettings = {
    temperature: 0.2,
    maxOutputTokens: 850,
  };
  const storyArchitectModelSettings = {
    temperature: 0.1,
    maxOutputTokens: 1800,
  };
  try {
    const executionOptions = {
      abortSignal,
      ...(storyCouncilMode || input.agentId === "story-architect" || ["curriculum-guide", "foundations-planner", "discovery-mapper", "wyrmwood-rival-director", "wyrmwood-curriculum-evaluator"].includes(input.agentId) ? {
        modelSettings: storyCouncilMode
          ? storyCouncilModelSettings
          : input.agentId === "story-architect"
            ? storyArchitectModelSettings
            : standardModelSettings,
      } : {}),
    };
    if (storyCouncilMode) {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: storyCouncilContributionSchema(),
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("The Story Council specialist did not return a structured contribution.");
      return JSON.stringify(result.object);
    }
    if (!directConversationMode && input.agentId === "story-architect") {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: storyArchitectAssessmentSchema(),
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("Story Architect did not return a structured assessment.");
      return JSON.stringify(result.object);
    }
    if (!directConversationMode && input.agentId === "discovery-mapper") {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: discoveryMapperSchema(),
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("Discovery Mapper did not return a structured placement.");
      return JSON.stringify(result.object);
    }
    if (!directConversationMode && input.agentId === "foundations-planner") {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: foundationProposalSchema(input.foundationFieldIds ?? []),
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("The local Foundations drafter did not return a structured proposal.");
      return JSON.stringify(result.object);
    }
    if (!directConversationMode && input.agentId === "wyrmwood-rival-director") {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: wyrmwoodRivalDirectorSchema(),
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("Master Oaken-Vague did not return a structured Wyrmwood turn.");
      return JSON.stringify(result.object);
    }
    if (!directConversationMode && input.agentId === "wyrmwood-curriculum-evaluator") {
      const result = await agent.generate(prompt, {
        ...executionOptions,
        structuredOutput: {
          schema: wyrmwoodCurriculumEvaluatorSchema(),
          jsonPromptInjection: false,
        },
      });
      if (!result.object) throw new Error("The Wyrmwood curriculum evaluator did not return structured feedback.");
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
      version: MASTRA_RUNTIME_VERSION,
      ready: true,
      agents,
      checkedAt,
      error: "",
    };
  } catch (error) {
    return {
      runtime: "mastra",
      mode: "embedded",
      version: MASTRA_RUNTIME_VERSION,
      ready: false,
      agents,
      checkedAt,
      error: error instanceof Error ? error.message.slice(0, 300) : "The embedded Mastra runtime could not initialize.",
    };
  }
}
