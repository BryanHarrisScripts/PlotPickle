import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  agentObservabilityStatus,
  appendAgentTraceEvent,
  clearAgentTraces,
  failAgentTrace,
  finishAgentTrace,
  recentAgentTraces,
  startAgentTrace,
  updateAgentTraceMetadata,
} from "./agent-observability-store";

const TRACE_PATH = "/api/writing-assistant/traces";
const CHAT_PATH = "/api/writing-assistant/chat";
const STRUCTURED_AGENTS = new Set([
  "foundations-planner",
  "wyrmwood-rival-director",
  "wyrmwood-curriculum-evaluator",
]);

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

function responseJson(chunk: unknown) {
  try {
    if (Buffer.isBuffer(chunk)) return JSON.parse(chunk.toString("utf8")) as Record<string, unknown>;
    if (typeof chunk === "string") return JSON.parse(chunk) as Record<string, unknown>;
  } catch {}
  return null;
}

function observeChatResponse(request: IncomingMessage, response: ServerResponse) {
  const requestBytes = Number(request.headers["content-length"] || 0);
  const traceId = startAgentTrace({
    agentId: "pending-agent",
    provider: "pending",
    runtimeProvider: "mastra",
    model: "pending",
    modelRole: "pending",
    inputChars: Number.isFinite(requestBytes) ? requestBytes : 0,
    historyMessages: 0,
    structured: false,
  });
  appendAgentTraceEvent(traceId, {
    type: "mastra.dispatch",
    label: "Mastra agent dispatched",
    detail: "Waiting for the selected local or configured model",
  });

  const originalEnd = response.end.bind(response);
  let observed = false;

  (response as ServerResponse & { end: (...args: unknown[]) => ServerResponse }).end = ((chunk?: unknown, ...args: unknown[]) => {
    if (!observed) {
      observed = true;
      const payload = responseJson(chunk);
      if (payload?.ok === true) {
        const agentId = typeof payload.agentId === "string" ? payload.agentId : "writing-assistant";
        const provider = typeof payload.provider === "string" ? payload.provider : "unknown";
        const runtimeProvider = typeof payload.runtimeProvider === "string" ? payload.runtimeProvider : provider;
        const model = typeof payload.model === "string" ? payload.model : "unknown";
        const modelRole = typeof payload.modelRole === "string" ? payload.modelRole : "unknown";
        const outputChars = typeof payload.text === "string" ? payload.text.length : 0;
        updateAgentTraceMetadata(traceId, {
          agentId,
          provider,
          runtimeProvider,
          model,
          modelRole,
          structured: STRUCTURED_AGENTS.has(agentId),
        });
        appendAgentTraceEvent(traceId, {
          type: "runtime.resolved",
          label: "Runtime and model resolved",
          detail: `${runtimeProvider} · ${model} · ${modelRole}`,
        });
        appendAgentTraceEvent(traceId, {
          type: "mastra.completed",
          label: `${agentId} completed`,
          detail: typeof payload.latencyMs === "number" ? `${payload.latencyMs} ms reported by the agent gateway` : "Agent gateway returned successfully",
        });
        finishAgentTrace(traceId, outputChars);
      } else {
        const message = typeof payload?.message === "string"
          ? payload.message
          : `Agent request ended with HTTP ${response.statusCode}.`;
        failAgentTrace(traceId, message);
      }
    }
    return originalEnd(chunk as never, ...(args as never[]));
  }) as typeof response.end;

  response.once("close", () => {
    if (!observed) {
      observed = true;
      failAgentTrace(traceId, "The agent connection closed before PlotPickle received a complete response.");
    }
  });
}

export function registerAgentObservabilityGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";

    if (pathname === TRACE_PATH) {
      if (!isLocalRequest(request)) {
        sendJson(response, 403, { ok: false, message: "Agent activity is available only from this local PlotPickle server." });
        return;
      }
      if (request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          ...agentObservabilityStatus(),
          traces: recentAgentTraces(40),
        });
        return;
      }
      if (request.method === "DELETE") {
        clearAgentTraces();
        sendJson(response, 200, { ok: true, cleared: true });
        return;
      }
      sendJson(response, 405, { ok: false, message: "Use GET to view agent activity or DELETE to clear this session." });
      return;
    }

    if (pathname === CHAT_PATH && request.method === "POST" && isLocalRequest(request)) {
      observeChatResponse(request, response);
    }
    next();
  });
}
