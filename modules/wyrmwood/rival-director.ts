import type {
  WyrmwoodDirectorTurn,
  WyrmwoodRivalId,
  WyrmwoodRivalMove,
  WyrmwoodTrial,
} from "./contracts";

export const WYRMWOOD_RIVALS = [
  { id: "aiden-glowhart", name: "Aiden Glowhart", trope: "The Chosen One" },
  { id: "damien-darkmore", name: "Damien Darkmore", trope: "The Brooding Anti-Hero" },
  { id: "barnaby-barnacle", name: "Barnaby Barnacle", trope: "The Comic Relief" },
  { id: "master-spirit-talker", name: "Master Spirit-Talker", trope: "The Cryptic Mentor" },
  { id: "sienna-silvertongue", name: "Sienna Silvertongue", trope: "The Charming Rogue" },
] as const satisfies readonly { readonly id: WyrmwoodRivalId; readonly name: string; readonly trope: string }[];

const RIVAL_IDS = WYRMWOOD_RIVALS.map((rival) => rival.id);
const INTERNAL_MARKERS = /(?:DIRECT ONE WYRMWOOD PLAYER TURN|structuredOutput|json schema|system prompt|curriculum_context|modelRole|agentId)/i;

function isTimeout(error: unknown) {
  return error instanceof DOMException
    && (error.name === "TimeoutError" || error.name === "AbortError");
}

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

async function prepareRole(role: "fast" | "quality") {
  try {
    const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(role === "fast" ? 30_000 : 40_000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { readonly message?: string };
      throw new Error(body.message || `PlotPickle could not prepare Wyrmwood's ${role} local model.`);
    }
  } catch (error) {
    if (isTimeout(error)) throw new Error(`Wyrmwood could not prepare the ${role} local model in time.`);
    throw error;
  }
}

function directorPrompt(trial: WyrmwoodTrial, pickleNumber: number, repair = false) {
  return [
    repair ? "REPAIR ONE WYRMWOOD PLAYER TURN." : "DIRECT ONE WYRMWOOD PLAYER TURN.",
    repair ? "The previous local turn was empty, malformed, repetitive, or nonsensical. Produce one clean playable replacement." : "",
    `This is Pickle ${pickleNumber} of 5 for the Foundations match “${trial.lessonTitle}”.`,
    `Lesson reminder: ${trial.lessonReminder}`,
    `Learning targets: ${trial.learningTargets.join(" | ")}`,
    `Challenge seed: ${trial.pickleSeed}`,
    "Create a genuinely playable Pickle, not a paraphrase of the lesson. Use plain English and concrete cause-and-effect.",
    "Master Oaken-Vague opens the turn in one or two short sentences.",
    "Then give all five rivals one short action and one concrete complication each.",
    "Aiden Glowhart: prophecy/divine intervention. Damien Darkmore: rejects teamwork for brooding isolation or unnecessary suffering. Barnaby Barnacle: slapstick environmental mistake. Master Spirit-Talker: figurative but operationally unhelpful wisdom. Sienna Silvertongue: charm, bribe or shortcut with a cost.",
    "Do not score, judge, award, alter Spotlight, grant coins or XP, or decide whether the player wins. The deterministic engine owns all game truth.",
  ].filter(Boolean).join("\n");
}

type DirectorModelOutput = {
  readonly oakenOpening?: unknown;
  readonly pickle?: {
    readonly title?: unknown;
    readonly situation?: unknown;
    readonly goal?: unknown;
    readonly constraints?: unknown;
    readonly establishedElements?: unknown;
    readonly failurePressure?: unknown;
  };
  readonly rivals?: Partial<Record<WyrmwoodRivalId, {
    readonly action?: unknown;
    readonly complication?: unknown;
  }>>;
};

type DirectorResponse = {
  readonly message?: string;
  readonly model?: string;
  readonly text?: string;
};

function requireText(value: unknown, label: string, maximum = 800) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Master Oaken-Vague omitted ${label}.`);
  const text = value.trim().slice(0, maximum);
  if (textLooksGarbled(text)) throw new Error(`Master Oaken-Vague returned unusable ${label}.`);
  return text;
}

function requireList(value: unknown, label: string, maximumItems: number) {
  if (!Array.isArray(value)) throw new Error(`Master Oaken-Vague omitted ${label}.`);
  const values = value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()) && !textLooksGarbled(item))
    .map((item) => item.trim().slice(0, 320))
    .slice(0, maximumItems);
  if (!values.length) throw new Error(`Master Oaken-Vague omitted ${label}.`);
  return values;
}

function parseDirectorTurn(
  result: DirectorResponse,
  trial: WyrmwoodTrial,
  pickleNumber: number,
): WyrmwoodDirectorTurn {
  if (!result.text) throw new Error(result.message || "Master Oaken-Vague returned no Wyrmwood turn.");
  let parsed: DirectorModelOutput;
  try {
    parsed = JSON.parse(result.text) as DirectorModelOutput;
  } catch {
    throw new Error("Master Oaken-Vague returned an unreadable Wyrmwood turn.");
  }
  if (!parsed.pickle || !parsed.rivals) throw new Error("Master Oaken-Vague returned an incomplete Wyrmwood turn.");
  const rivals = Object.fromEntries(RIVAL_IDS.map((rivalId) => {
    const move = parsed.rivals?.[rivalId];
    const normalized: WyrmwoodRivalMove = {
      action: requireText(move?.action, `${rivalId} action`, 420),
      complication: requireText(move?.complication, `${rivalId} complication`, 420),
    };
    return [rivalId, normalized];
  })) as WyrmwoodDirectorTurn["rivals"];
  const generatedAt = new Date().toISOString();
  return {
    trialId: trial.id,
    pickleNumber,
    oakenOpening: requireText(parsed.oakenOpening, "his opening", 500),
    pickle: {
      id: `${trial.id}-pickle-${pickleNumber}`,
      title: requireText(parsed.pickle.title, "the Pickle title", 160),
      situation: requireText(parsed.pickle.situation, "the Pickle situation", 900),
      goal: requireText(parsed.pickle.goal, "the Pickle goal", 500),
      constraints: requireList(parsed.pickle.constraints, "the Pickle constraints", 3),
      establishedElements: requireList(parsed.pickle.establishedElements, "the established elements", 4),
      failurePressure: requireText(parsed.pickle.failurePressure, "the failure pressure", 500),
    },
    rivals,
    model: result.model || "local Fast model",
    generatedAt,
  };
}

function fallbackRivalMoves(): WyrmwoodDirectorTurn["rivals"] {
  return {
    "aiden-glowhart": {
      action: "Aiden announces that destiny will solve the problem for everyone.",
      complication: "Nothing practical changes, so the immediate pressure gets worse while the group waits for a miracle.",
    },
    "damien-darkmore": {
      action: "Damien walks off alone and refuses to share what he knows.",
      complication: "The group loses useful information and now has to solve the problem with less coordination.",
    },
    "barnaby-barnacle": {
      action: "Barnaby grabs the nearest object and accidentally knocks part of the environment out of place.",
      complication: "The mistake adds a new physical obstacle that must be handled as part of the scene.",
    },
    "master-spirit-talker": {
      action: "Master Spirit-Talker advises everyone to listen to the shape of the unanswered question.",
      complication: "The advice sounds profound but gives no usable action, so the clock keeps moving.",
    },
    "sienna-silvertongue": {
      action: "Sienna offers a charming shortcut that avoids the hard choice for the moment.",
      complication: "The shortcut creates a clear cost that will have to be paid if the player accepts it.",
    },
  };
}

export function deterministicWyrmwoodTurn(trial: WyrmwoodTrial, pickleNumber: number): WyrmwoodDirectorTurn {
  const targets = trial.learningTargets.filter(Boolean);
  const constraints = [
    targets[0] ? `Use the lesson target: ${targets[0]}` : `Apply ${trial.lessonTitle} to a concrete choice.`,
    targets[1] ? `Also account for: ${targets[1]}` : "Make the consequence of the choice visible.",
    "Do not solve the problem with unexplained magic, prophecy, or coincidence.",
  ].slice(0, 3);
  const establishedElements = [
    trial.pickleSeed,
    trial.lessonTitle,
    ...targets.slice(0, 2),
  ].filter(Boolean).slice(0, 4);
  return {
    trialId: trial.id,
    pickleNumber,
    oakenOpening: `Right then, Spellscribe. This Pickle is about using ${trial.lessonTitle} under pressure, not waiting for a lucky rescue.`,
    pickle: {
      id: `${trial.id}-pickle-${pickleNumber}`,
      title: `${trial.lessonTitle} · Pickle ${pickleNumber}`,
      situation: `${trial.pickleSeed} Treat that as the established situation and make the next story choice change what happens.`,
      goal: `Choose a concrete action that applies ${trial.lessonTitle} and creates a believable next consequence.`,
      constraints,
      establishedElements,
      failurePressure: "If the response dodges the choice, ignores the established situation, or invents an unexplained rescue, the Pickle remains unresolved.",
    },
    rivals: fallbackRivalMoves(),
    model: "Wyrmwood deterministic playable fallback",
    generatedAt: new Date().toISOString(),
  };
}

async function requestDirector(role: "fast" | "quality", message: string) {
  await prepareRole(role);
  const response = await fetch("/api/writing-assistant/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PlotPickle-Model-Role": role,
    },
    body: JSON.stringify({
      agentId: "wyrmwood-rival-director",
      provider: "local",
      modelRole: role,
      tone: "challenging",
      message,
    }),
    signal: AbortSignal.timeout(role === "fast" ? 30_000 : 40_000),
  });
  const result = await response.json().catch(() => ({})) as DirectorResponse;
  if (!response.ok) throw new Error(result.message || "Wyrmwood could not reach the local Rival Director.");
  return result;
}

export async function directWyrmwoodTurn(input: {
  readonly trial: WyrmwoodTrial;
  readonly pickleNumber: number;
}) {
  const attempts: Array<{ role: "fast" | "quality"; repair: boolean }> = [
    { role: "fast", repair: false },
    { role: "fast", repair: true },
    { role: "quality", repair: true },
  ];
  for (const attempt of attempts) {
    try {
      const result = await requestDirector(attempt.role, directorPrompt(input.trial, input.pickleNumber, attempt.repair));
      return parseDirectorTurn(result, input.trial, input.pickleNumber);
    } catch {
      // Keep recovery local and bounded; fall through to the next role/prompt.
    }
  }
  return deterministicWyrmwoodTurn(input.trial, input.pickleNumber);
}
