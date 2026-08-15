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

function isTimeout(error: unknown) {
  return error instanceof DOMException
    && (error.name === "TimeoutError" || error.name === "AbortError");
}

async function prepareFastModel() {
  try {
    const response = await fetch("/api/local-ai/runtime/model/fast/load", {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { readonly message?: string };
      throw new Error(body.message || "PlotPickle could not prepare Wyrmwood's Fast local model.");
    }
  } catch (error) {
    if (isTimeout(error)) throw new Error("Wyrmwood could not prepare the Fast local model within 30 seconds. Open Settings and test the Fast role.");
    throw error;
  }
}

function directorPrompt(trial: WyrmwoodTrial, pickleNumber: number) {
  return [
    "DIRECT ONE WYRMWOOD PLAYER TURN.",
    `This is Pickle ${pickleNumber} of 5 for the Foundations match “${trial.lessonTitle}”.`,
    `Lesson reminder: ${trial.lessonReminder}`,
    `Learning targets: ${trial.learningTargets.join(" | ")}`,
    `Challenge seed: ${trial.pickleSeed}`,
    "Create a genuinely playable Pickle, not a paraphrase of the lesson.",
    "Master Oaken-Vague opens the turn in one or two short sentences.",
    "Then give all five rivals one short action and one concrete complication each.",
    "Aiden Glowhart: prophecy/divine intervention. Damien Darkmore: rejects teamwork for brooding isolation or unnecessary suffering. Barnaby Barnacle: slapstick environmental mistake. Master Spirit-Talker: figurative but operationally unhelpful wisdom. Sienna Silvertongue: charm, bribe or shortcut with a cost.",
    "Do not score, judge, award, alter Spotlight, grant coins or XP, or decide whether the player wins. The deterministic engine owns all game truth.",
  ].join("\n");
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
  return value.trim().slice(0, maximum);
}

function requireList(value: unknown, label: string, maximumItems: number) {
  if (!Array.isArray(value)) throw new Error(`Master Oaken-Vague omitted ${label}.`);
  const values = value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
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

export async function directWyrmwoodTurn(input: {
  readonly trial: WyrmwoodTrial;
  readonly pickleNumber: number;
}) {
  await prepareFastModel();
  let response: Response;
  try {
    response = await fetch("/api/writing-assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PlotPickle-Model-Role": "fast",
      },
      body: JSON.stringify({
        agentId: "wyrmwood-rival-director",
        provider: "local",
        modelRole: "fast",
        tone: "challenging",
        message: directorPrompt(input.trial, input.pickleNumber),
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    if (isTimeout(error)) throw new Error("Master Oaken-Vague did not finish this Pickle within Wyrmwood's 30-second local limit.");
    throw error;
  }
  const result = await response.json().catch(() => ({})) as DirectorResponse;
  if (!response.ok) throw new Error(result.message || "Wyrmwood could not reach the local Rival Director.");
  return parseDirectorTurn(result, input.trial, input.pickleNumber);
}
