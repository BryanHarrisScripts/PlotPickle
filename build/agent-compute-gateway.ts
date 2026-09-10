import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { AGENT_PROFILES } from "../lib/agents/agent-profiles";
import { PLOTPICKLE_AGENT_ROLES } from "./mastra-agent-runtime";
import { localRuntimeSnapshot } from "./local-runtime-manager";
import { readAgentComputeStore, writeAgentComputeStore } from "./agent-compute-store";
import { isTextProvider, readSynchronizedAssistantStore, type TextProvider } from "./writing-assistant-store";

const PATH = "/api/writing-assistant/agent-compute";
const LABELS: Record<TextProvider, string> = {
  local: "Local Runtime",
  ollama: "Ollama",
  openai: "OpenAI",
  minimax: "MiniMax",
  gemini: "Google Gemini",
};

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  let hostUrl: URL;
  try { hostUrl = new URL(`http://${host}`); } catch { return false; }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === hostUrl.host; } catch { return false; }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 16 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The Agent compute request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
}

function plotPickleAgents() {
  const supportedRoles = new Set(Object.keys(PLOTPICKLE_AGENT_ROLES));
  return AGENT_PROFILES
    .filter((profile) => profile.execution.kind === "embedded-mastra" && supportedRoles.has(profile.execution.roleId))
    .map((profile) => ({
      roleId: profile.execution.roleId,
      profileId: profile.id,
      displayName: profile.displayName,
      title: profile.title,
      requestedCapabilityRole: profile.requestedCapabilityRole,
    }));
}

async function snapshot() {
  const [{ store }, compute, localRuntime] = await Promise.all([
    readSynchronizedAssistantStore(),
    readAgentComputeStore(),
    localRuntimeSnapshot(),
  ]);
  const providers = (["local", "ollama", "openai", "minimax", "gemini"] as const).map((id) => {
    const stored = store.profiles[id];
    const localReady = id === "local" && localRuntime.activeRuntime.reachable && localRuntime.roles.fast.available;
    const model = id === "local"
      ? localRuntime.roles.quality.selected || localRuntime.roles.fast.selected || stored?.textModel || "Hardware optimized"
      : stored?.textModel || "";
    return {
      id,
      label: LABELS[id],
      configured: id === "local" ? localRuntime.activeRuntime.reachable : Boolean(stored?.textModel),
      ready: id === "local" ? localReady : Boolean(stored?.assistantVerifiedAt),
      model,
      locality: id === "local" || id === "ollama" ? "local" as const : "cloud" as const,
    };
  });
  return {
    ok: true,
    defaultProvider: compute.defaultProvider,
    activeProvider: store.activeProvider,
    overrides: compute.overrides,
    providers,
    agents: plotPickleAgents(),
  };
}

async function requireReadyProvider(provider: TextProvider) {
  const state = await snapshot();
  const option = state.providers.find((item) => item.id === provider);
  if (!option?.ready) throw new Error(`${LABELS[provider]} is not ready. Configure and test it in Local Story Mode or Cloud Story Mode before assigning it to an Agent.`);
}

async function handlePost(request: IncomingMessage) {
  const body = await readBody(request);
  const compute = await readAgentComputeStore();
  if (body.scope === "default") {
    const provider = body.provider;
    if (provider !== "active" && !isTextProvider(provider)) throw new Error("Choose the active Story Mode route or a supported provider for the PlotPickle default.");
    if (provider !== "active") await requireReadyProvider(provider);
    compute.defaultProvider = provider;
  } else if (body.scope === "agent") {
    const agentId = typeof body.agentId === "string" ? body.agentId : "";
    if (!(agentId in PLOTPICKLE_AGENT_ROLES)) throw new Error("Choose a supported PlotPickle Agent.");
    const profile = AGENT_PROFILES.find((item) => item.execution.kind === "embedded-mastra" && item.execution.roleId === agentId);
    if (!profile) throw new Error("That Agent is not owned by the PlotPickle Agent runtime. BUZZ-managed Agents are configured in BUZZ.");
    if (body.provider === "default") {
      delete compute.overrides[agentId];
    } else {
      if (!isTextProvider(body.provider)) throw new Error("Choose Default or a supported provider for this Agent.");
      await requireReadyProvider(body.provider);
      compute.overrides[agentId] = body.provider;
    }
  } else {
    throw new Error("Choose a PlotPickle Agent compute assignment scope.");
  }
  await writeAgentComputeStore(compute);
  return snapshot();
}

export function registerAgentComputeGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== PATH) { next(); return; }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "PlotPickle Agent compute accepts requests only from this PlotPickle server." });
      return;
    }
    if (request.method !== "GET" && request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "Method not allowed." });
      return;
    }
    void (request.method === "POST" ? handlePost(request) : snapshot())
      .then((body) => sendJson(response, 200, body))
      .catch((error) => sendJson(response, 400, { ok: false, message: error instanceof Error ? error.message : "PlotPickle Agent compute failed." }));
  });
}
