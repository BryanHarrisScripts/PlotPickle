import { randomUUID } from "node:crypto";

export type AgentTraceStatus = "running" | "success" | "error";

export type AgentTraceEvent = {
  readonly at: string;
  readonly type: string;
  readonly label: string;
  readonly detail?: string;
};

export type AgentTrace = {
  readonly id: string;
  readonly agentId: string;
  readonly provider: string;
  readonly runtimeProvider: string;
  readonly model: string;
  readonly modelRole: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
  readonly status: AgentTraceStatus;
  readonly inputChars: number;
  readonly historyMessages: number;
  readonly outputChars: number;
  readonly structured: boolean;
  readonly error: string;
  readonly events: readonly AgentTraceEvent[];
};

type MutableAgentTrace = {
  id: string;
  agentId: string;
  provider: string;
  runtimeProvider: string;
  model: string;
  modelRole: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: AgentTraceStatus;
  inputChars: number;
  historyMessages: number;
  outputChars: number;
  structured: boolean;
  error: string;
  events: AgentTraceEvent[];
};

const MAX_SESSION_TRACES = 100;
const traces: MutableAgentTrace[] = [];

function now() {
  return new Date().toISOString();
}

function safeDetail(value: string | undefined) {
  return String(value || "").replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 240);
}

function findTrace(id: string) {
  return traces.find((trace) => trace.id === id);
}

export function startAgentTrace(input: {
  agentId: string;
  provider: string;
  runtimeProvider: string;
  model: string;
  modelRole: string;
  inputChars: number;
  historyMessages: number;
  structured: boolean;
}) {
  const trace: MutableAgentTrace = {
    id: randomUUID(),
    agentId: input.agentId,
    provider: input.provider,
    runtimeProvider: input.runtimeProvider,
    model: input.model,
    modelRole: input.modelRole,
    startedAt: now(),
    finishedAt: "",
    durationMs: 0,
    status: "running",
    inputChars: Math.max(0, input.inputChars),
    historyMessages: Math.max(0, input.historyMessages),
    outputChars: 0,
    structured: input.structured,
    error: "",
    events: [],
  };
  traces.unshift(trace);
  if (traces.length > MAX_SESSION_TRACES) traces.length = MAX_SESSION_TRACES;
  appendAgentTraceEvent(trace.id, {
    type: "request.accepted",
    label: "Request accepted",
    detail: trace.inputChars ? `${trace.inputChars} request bytes` : "Local agent request started",
  });
  return trace.id;
}

export function updateAgentTraceMetadata(id: string, input: Partial<Pick<MutableAgentTrace,
  "agentId" | "provider" | "runtimeProvider" | "model" | "modelRole" | "structured" | "historyMessages"
>>) {
  const trace = findTrace(id);
  if (!trace || trace.status !== "running") return;
  if (typeof input.agentId === "string" && input.agentId) trace.agentId = safeDetail(input.agentId);
  if (typeof input.provider === "string" && input.provider) trace.provider = safeDetail(input.provider);
  if (typeof input.runtimeProvider === "string" && input.runtimeProvider) trace.runtimeProvider = safeDetail(input.runtimeProvider);
  if (typeof input.model === "string" && input.model) trace.model = safeDetail(input.model);
  if (typeof input.modelRole === "string" && input.modelRole) trace.modelRole = safeDetail(input.modelRole);
  if (typeof input.structured === "boolean") trace.structured = input.structured;
  if (typeof input.historyMessages === "number" && Number.isFinite(input.historyMessages)) trace.historyMessages = Math.max(0, Math.floor(input.historyMessages));
}

export function appendAgentTraceEvent(id: string, event: Omit<AgentTraceEvent, "at"> & { at?: string }) {
  const trace = findTrace(id);
  if (!trace || trace.status !== "running") return;
  trace.events.push({
    at: event.at || now(),
    type: safeDetail(event.type),
    label: safeDetail(event.label),
    detail: safeDetail(event.detail),
  });
  if (trace.events.length > 40) trace.events.splice(0, trace.events.length - 40);
}

export function finishAgentTrace(id: string, outputChars: number) {
  const trace = findTrace(id);
  if (!trace) return;
  const finishedAt = Date.now();
  trace.status = "success";
  trace.finishedAt = new Date(finishedAt).toISOString();
  trace.durationMs = Math.max(0, finishedAt - Date.parse(trace.startedAt));
  trace.outputChars = Math.max(0, outputChars);
  trace.error = "";
  trace.events.push({
    at: trace.finishedAt,
    type: "request.completed",
    label: "Response completed",
    detail: `${trace.outputChars} output characters · ${trace.durationMs} ms`,
  });
}

export function failAgentTrace(id: string, error: unknown) {
  const trace = findTrace(id);
  if (!trace) return;
  const finishedAt = Date.now();
  const message = error instanceof Error ? error.message : String(error || "Agent request failed.");
  trace.status = "error";
  trace.finishedAt = new Date(finishedAt).toISOString();
  trace.durationMs = Math.max(0, finishedAt - Date.parse(trace.startedAt));
  trace.error = safeDetail(message);
  trace.events.push({
    at: trace.finishedAt,
    type: "request.failed",
    label: "Request failed",
    detail: trace.error,
  });
}

export function recentAgentTraces(limit = 40): readonly AgentTrace[] {
  const bounded = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.floor(limit) : 40));
  return traces.slice(0, bounded).map((trace) => ({
    ...trace,
    events: trace.events.map((event) => ({ ...event })),
  }));
}

export function clearAgentTraces() {
  traces.length = 0;
}

export function agentObservabilityStatus() {
  const recent = recentAgentTraces(100);
  const completed = recent.filter((trace) => trace.status !== "running");
  const failures = completed.filter((trace) => trace.status === "error").length;
  const averageLatencyMs = completed.length
    ? Math.round(completed.reduce((total, trace) => total + trace.durationMs, 0) / completed.length)
    : 0;
  return {
    schemaVersion: 1,
    retention: "session-memory",
    maximumTraces: MAX_SESSION_TRACES,
    privacy: {
      promptsStored: false,
      responsesStored: false,
      hiddenReasoningStored: false,
      operationalMetadataOnly: true,
    },
    summary: {
      traces: recent.length,
      running: recent.filter((trace) => trace.status === "running").length,
      failures,
      averageLatencyMs,
    },
  };
}
