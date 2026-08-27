import type { ViteDevServer } from "vite";
import type { BuzzGuildhallEventInput } from "../../lib/buzz/buzz-guildhall";

type ActivityDefinition = Pick<BuzzGuildhallEventInput, "type" | "actorId"> & { label: string };

const AGENT_ACTIVITY: Record<string, ActivityDefinition> = {
  "curriculum-guide": { type: "curriculum.note", actorId: "sage-brinewick", label: "Sage completed a Creative Room turn" },
  "foundations-planner": { type: "story.proposal", actorId: "tamsin-hearthquill", label: "Tamsin prepared a Foundations proposal turn" },
  "wyrmwood-rival-director": { type: "wyrmwood.result", actorId: "master-oaken-vague", label: "Master Oaken-Vague completed a Wyrmwood Rival Director turn" },
  "wyrmwood-curriculum-evaluator": { type: "wyrmwood.result", actorId: "rowan-scalequill", label: "Rowan Scalequill completed a Wyrmwood curriculum evaluation" },
  "creative-director": { type: "agent.note", actorId: "quillan-reedcloak", label: "Quillan completed a Creative Room coordination turn" },
  "story-architect": { type: "agent.note", actorId: "elowen-mapweaver", label: "Elowen completed a story-structure turn" },
  continuity: { type: "agent.note", actorId: "mira-threadmere", label: "Mira completed a continuity turn" },
};

export function buzzActivityForAgent(agentId: string) {
  return AGENT_ACTIVITY[agentId] ?? null;
}

/**
 * Agent runtime activity is deliberately not mirrored through the Human message gateway.
 * That endpoint signs as the connected Human. An official PlotPickle Agent may publish
 * Community speech only when its own BUZZ signer is available. Until then the runtime
 * trace remains local and the connected Human signer is never used as an Agent fallback.
 */
export function registerBuzzAgentActivityMirror(_server: ViteDevServer) {
  return;
}
