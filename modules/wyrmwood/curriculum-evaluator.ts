import type { WyrmwoodCurriculumEvaluation, WyrmwoodDirectorTurn, WyrmwoodTrial } from "./contracts";

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

function prompt(input: { readonly trial: WyrmwoodTrial; readonly director: WyrmwoodDirectorTurn; readonly playerResponse: string }) {
  const rivals = Object.entries(input.director.rivals)
    .map(([id, move]) => `${id}: ${move.action} Complication: ${move.complication}`)
    .join("\n");
  return [
    "EVALUATE ONE WYRMWOOD SPELLSCRIBE RESPONSE.",
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
    "Return the six rubric scores plus concrete whatWorked, whatNeedsWork, conceptUsed, and a short teachingDebrief. Do not calculate Spotlight, coins, XP, rank, level, or progression.",
  ].join("\n\n");
}

type ModelOutput = {
  readonly dimensions?: Record<string, unknown>;
  readonly whatWorked?: unknown;
  readonly whatNeedsWork?: unknown;
  readonly conceptUsed?: unknown;
  readonly teachingDebrief?: unknown;
};

type GatewayResponse = { readonly message?: string; readonly model?: string; readonly text?: string };

function requireNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  return value;
}

function requireText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  return value.trim().slice(0, maximum);
}

function requireList(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`The Wyrmwood evaluator omitted ${label}.`);
  const items = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
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

export async function evaluateWyrmwoodTurn(input: {
  readonly trial: WyrmwoodTrial;
  readonly director: WyrmwoodDirectorTurn;
  readonly playerResponse: string;
}) {
  const role = await chooseRole();
  const response = await fetch("/api/writing-assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-PlotPickle-Model-Role": role },
    body: JSON.stringify({
      agentId: "wyrmwood-curriculum-evaluator",
      provider: "local",
      modelRole: role,
      tone: "direct",
      message: prompt(input),
    }),
    signal: AbortSignal.timeout(35_000),
  });
  const result = await response.json().catch(() => ({})) as GatewayResponse;
  if (!response.ok) throw new Error(result.message || "Wyrmwood could not reach the local curriculum evaluator.");
  return parseResult(result);
}
