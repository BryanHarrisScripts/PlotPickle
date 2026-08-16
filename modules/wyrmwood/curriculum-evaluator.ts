import type { WyrmwoodCurriculumEvaluation, WyrmwoodDirectorTurn, WyrmwoodTrial } from "./contracts";

const INTERNAL_MARKERS = /(?:EVALUATE ONE WYRMWOOD SPELLSCRIBE RESPONSE|structuredOutput|json schema|system prompt|modelRole|agentId)/i;

async function prepareRole(role: "quality" | "fast") {
  const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
    method: "POST",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { readonly message?: string };
    throw new Error(body.message || `PlotPickle could not prepare Wyrmwood's ${role} local model.`);
  }
}

async function chooseRole(): Promise<"quality" | "fast"> {
  try {
    await prepareRole("quality");
    return "quality";
  } catch {
    await prepareRole("fast");
    return "fast";
  }
}

function prompt(input: { readonly trial: WyrmwoodTrial; readonly director: WyrmwoodDirectorTurn; readonly playerResponse: string }, repair = false) {
  const rivals = Object.entries(input.director.rivals)
    .map(([id, move]) => `${id}: ${move.action} Complication: ${move.complication}`)
    .join("\n");
  return [
    repair ? "REPAIR ONE WYRMWOOD CURRICULUM EVALUATION." : "EVALUATE ONE WYRMWOOD SPELLSCRIBE RESPONSE.",
    repair ? "The previous local evaluation was empty, malformed, repetitive, or unclear. Return one clean structured evaluation in plain English." : "",
    `LEARN stage: Foundations`,
    `Lesson: ${input.trial.lessonTitle}`,
    `Lesson reminder: ${input.trial.lessonReminder}`,
    `Objectives: ${input.trial.learningTargets.join(" | ")}`,
    `Key concepts: ${input.trial.keyConcepts.join(" | ")}`,
    `Pickle: ${input.director.pickle.title}`,
    `Situation: ${input.director.pickle.situation}`,
    `Immediate goal: ${input.director.pickle.goal}`,
    `Established elements: ${input.director.pickle.establishedElements.join(" | ")}`,
    `Constraints: ${input.director.pickle.constraints.join(" | ")}`,
    `Failure pressure: ${input.director.pickle.failurePressure}`,
    `Rival moves:\n${rivals}`,
    `Spellscribe response:\n${input.playerResponse}`,
    "Score only the visible response against the supplied lesson and scene. Do not invent actions the player did not take.",
    "Use short, ordinary sentences the player can understand immediately.",
    "Return the six rubric scores plus concrete whatWorked, whatNeedsWork, conceptUsed, and a short teachingDebrief. Do not calculate Spotlight, coins, XP, rank, level, or progression.",
  ].filter(Boolean).join("\n\n");
}

type ModelOutput = {
  readonly dimensions?: Record<string, unknown>;
  readonly whatWorked?: unknown;
  readonly whatNeedsWork?: unknown;
  readonly conceptUsed?: unknown;
  readonly teachingDebrief?: unknown;
};

type GatewayResponse = { readonly message?: string; readonly model?: string; readonly text?: string };

function comparableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function textLooksGarbled(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 8 || INTERNAL_MARKERS.test(text)) return true;
  const words = comparableText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  if (words.length >= 8 && new Set(words).size / words.length < 0.42) return true;
  const letters = (text.match(/[a-z]/gi) || []).length;
  return letters < Math.max(6, Math.floor(text.length * 0.42));
}

function requireNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  return value;
}

function requireText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  const text = value.trim().slice(0, maximum);
  if (textLooksGarbled(text)) throw new Error(`The Wyrmwood evaluator returned unusable ${label}.`);
  return text;
}

function requireList(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  const items = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()) && !textLooksGarbled(item))
    .map((item) => item.trim().slice(0, 360)).slice(0, 3);
  if (!items.length) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  return items;
}

function parseResult(result: GatewayResponse): WyrmwoodCurriculumEvaluation {
  if (!result.text) throw new Error(result.message || "The Wyrmwood evaluator returned no result.");
  let parsed: ModelOutput;
  try { parsed = JSON.parse(result.text) as ModelOutput; }
  catch { throw new Error("The Wyrmwood evaluator returned unreadable structured feedback."); }
  if (!parsed.dimensions) throw new Error("The Wyrmwood evaluator returned no rubric scores.");
  return {
    dimensions: {
      storyLogic: requireNumber(parsed.dimensions.storyLogic, "Story Logic"),
      lessonApplication: requireNumber(parsed.dimensions.lessonApplication, "Lesson Application"),
      establishedElements: requireNumber(parsed.dimensions.establishedElements, "Established Elements"),
      consequences: requireNumber(parsed.dimensions.consequences, "Consequences"),
      rivalCounter: requireNumber(parsed.dimensions.rivalCounter, "Rival Counter"),
      clarity: requireNumber(parsed.dimensions.clarity, "Clarity"),
    },
    whatWorked: requireList(parsed.whatWorked, "what worked"),
    whatNeedsWork: requireList(parsed.whatNeedsWork, "what needs work"),
    conceptUsed: requireText(parsed.conceptUsed, "the concept used", 240),
    teachingDebrief: requireText(parsed.teachingDebrief, "the teaching debrief", 900),
    model: result.model || "local curriculum evaluator",
    evaluatedAt: new Date().toISOString(),
  };
}

function words(value: string) {
  return new Set(comparableText(value).split(/\s+/).filter((word) => word.length >= 3));
}

function mentionsAny(response: Set<string>, value: string) {
  return comparableText(value).split(/\s+/).some((word) => word.length >= 4 && response.has(word));
}

function clamp(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

export function deterministicWyrmwoodEvaluation(input: {
  readonly trial: WyrmwoodTrial;
  readonly director: WyrmwoodDirectorTurn;
  readonly playerResponse: string;
}): WyrmwoodCurriculumEvaluation {
  const responseWords = words(input.playerResponse);
  const responseLength = input.playerResponse.trim().length;
  const conceptHits = input.trial.keyConcepts.filter((concept) => mentionsAny(responseWords, concept)).length;
  const establishedHits = input.director.pickle.establishedElements.filter((element) => mentionsAny(responseWords, element)).length;
  const hasCausality = /\b(?:because|therefore|so that|which means|causes?|leads? to|if .* then|consequence|result)\b/i.test(input.playerResponse);
  const hasAction = /\b(?:choose|decide|do|make|move|tell|ask|refuse|accept|leave|stay|use|take|give|stop|start|change|protect|reveal|hide|confront)\b/i.test(input.playerResponse);
  const hasRivalCounter = /\b(?:prophecy|destiny|alone|team|shortcut|bribe|charm|wisdom|mentor|barnaby|aiden|damien|sienna|spirit)\b/i.test(input.playerResponse);
  const clarityBase = responseLength >= 60 && responseLength <= 900 ? 8 : responseLength >= 25 ? 6 : 3;

  const dimensions = {
    storyLogic: clamp(12 + (hasAction ? 8 : 0) + (hasCausality ? 8 : 0), 30),
    lessonApplication: clamp(6 + conceptHits * 6, 20),
    establishedElements: clamp(4 + establishedHits * 4, 15),
    consequences: clamp(5 + (hasCausality ? 8 : 0), 15),
    rivalCounter: clamp(hasRivalCounter ? 7 : 3, 10),
    clarity: clamp(clarityBase, 10),
  };

  const whatWorked = [
    hasAction ? "You gave the scene a concrete action or decision." : "You gave Wyrmwood a response it can evaluate instead of leaving the Pickle unanswered.",
    establishedHits > 0 ? "You used at least one established element from the Pickle." : "Your answer creates a starting point that can be made more specific.",
  ];
  const whatNeedsWork = [
    hasCausality ? "Make the consequence even more specific: show what changes immediately after the choice." : "Connect the choice to a visible consequence using clear cause and effect.",
    conceptHits > 0 ? "Push the lesson concept harder so it changes the scene, not just the wording." : `Name or demonstrate one idea from ${input.trial.lessonTitle} directly in the choice.`,
  ];

  return {
    dimensions,
    whatWorked,
    whatNeedsWork,
    conceptUsed: conceptHits > 0 ? input.trial.keyConcepts.find((concept) => mentionsAny(responseWords, concept)) || input.trial.lessonTitle : input.trial.lessonTitle,
    teachingDebrief: `The point of this Pickle is to practice ${input.trial.lessonTitle}. Make one concrete choice, use something already established in the scene, and show the consequence that follows; that will make the response easier to judge and stronger as story logic.`,
    model: "Wyrmwood deterministic curriculum fallback",
    evaluatedAt: new Date().toISOString(),
  };
}

async function requestEvaluation(role: "quality" | "fast", message: string) {
  await prepareRole(role);
  const response = await fetch("/api/writing-assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PlotPickle-Model-Role": role },
    body: JSON.stringify({
      agentId: "wyrmwood-curriculum-evaluator",
      provider: "local",
      modelRole: role,
      tone: "direct",
      message,
    }),
    signal: AbortSignal.timeout(role === "quality" ? 35_000 : 30_000),
  });
  const result = await response.json().catch(() => ({})) as GatewayResponse;
  if (!response.ok) throw new Error(result.message || "Wyrmwood could not reach the local curriculum evaluator.");
  return result;
}

export async function evaluateWyrmwoodTurn(input: {
  readonly trial: WyrmwoodTrial;
  readonly director: WyrmwoodDirectorTurn;
  readonly playerResponse: string;
}) {
  let preferred: "quality" | "fast";
  try {
    preferred = await chooseRole();
  } catch {
    return deterministicWyrmwoodEvaluation(input);
  }
  const alternate: "quality" | "fast" = preferred === "quality" ? "fast" : "quality";
  for (const attempt of [
    { role: preferred, repair: false },
    { role: preferred, repair: true },
    { role: alternate, repair: true },
  ] as const) {
    try {
      const result = await requestEvaluation(attempt.role, prompt(input, attempt.repair));
      return parseResult(result);
    } catch {
      // Keep recovery local and bounded. The deterministic evaluator is the final safety net.
    }
  }
  return deterministicWyrmwoodEvaluation(input);
}
