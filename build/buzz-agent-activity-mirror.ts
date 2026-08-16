import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { postBuzzGuildhallEvent, type BuzzGuildhallEventInput } from "../lib/buzz-guildhall";

const CHAT_PATH = "/api/writing-assistant/chat";

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

function loopbackBaseUrl(request: IncomingMessage) {
  const rawHost = request.headers.host || "127.0.0.1:4173";
  try {
    const host = new URL(`http://${rawHost}`);
    const port = host.port ? `:${host.port}` : "";
    return `http://127.0.0.1${port}`;
  } catch {
    return "http://127.0.0.1:4173";
  }
}

function localGatewayFetch(request: IncomingMessage): typeof fetch {
  const baseUrl = loopbackBaseUrl(request);
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const url = new URL(raw, baseUrl);
    return fetch(url, { ...init, signal: AbortSignal.timeout(4_000) });
  }) as typeof fetch;
}

function responseText(chunk: unknown) {
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  return "";
}

function mirrorSuccessfulAgentTurn(request: IncomingMessage, chunk: unknown) {
  let body: Record<string, unknown>;
  try {
    const text = responseText(chunk);
    if (!text) return;
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return;
  }
  if (body.ok !== true || typeof body.agentId !== "string") return;
  const definition = buzzActivityForAgent(body.agentId);
  if (!definition) return;
  const latency = typeof body.latencyMs === "number" && Number.isFinite(body.latencyMs) ? Math.max(0, Math.round(body.latencyMs)) : 0;
  const role = typeof body.modelRole === "string" ? body.modelRole : "";
  const detail = [role ? `${role} model` : "", latency ? `${latency} ms` : ""].filter(Boolean).join(", ");
  const event: BuzzGuildhallEventInput = {
    ...definition,
    summary: `${definition.label}${detail ? ` (${detail})` : ""}.`,
    severity: "info",
    target: body.agentId,
    verified: true,
    actionable: false,
  };
  void postBuzzGuildhallEvent(event, localGatewayFetch(request)).catch(() => {});
}

export function registerBuzzAgentActivityMirror(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== CHAT_PATH || request.method !== "POST") {
      next();
      return;
    }

    const originalEnd = response.end.bind(response);
    const responseWithMutableEnd = response as ServerResponse & { end: (...args: unknown[]) => ServerResponse };
    responseWithMutableEnd.end = (...args: unknown[]) => {
      try { mirrorSuccessfulAgentTurn(request, args[0]); } catch {}
      return (originalEnd as (...values: unknown[]) => ServerResponse)(...args);
    };
    next();
  });
}
