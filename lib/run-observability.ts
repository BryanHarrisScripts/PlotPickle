import type { AgentProfileCapabilityRole } from "./agent-profiles";

export const RUNTIME_HEALTH_STATES = [
  "healthy",
  "unavailable",
  "timeout",
  "rate-limited",
  "circuit-open",
  "recovering",
] as const;

export type RuntimeHealthState = (typeof RUNTIME_HEALTH_STATES)[number];
export type RunExecutionRoute = "local" | "cloud/BYOK";
export type RunCostConfidence = "exact" | "estimated" | "unknown";
export type RunTelemetryEventType =
  | "run.created"
  | "run.started"
  | "run.paused"
  | "run.resumed"
  | "run.cancelled"
  | "run.completed"
  | "run.failed"
  | "model.selected"
  | "model.completed"
  | "context.attached"
  | "tool.called"
  | "verification.recorded"
  | "writer.approval"
  | "runtime.health"
  | "graph.node.started"
  | "graph.node.completed";

export type RunTelemetryEvent = {
  id: string;
  runId: string;
  parentRunId: string;
  graphNodeId: string;
  type: RunTelemetryEventType;
  at: string;
  profileId: string;
  skillUris: string[];
  capabilityRole: AgentProfileCapabilityRole | "";
  provider: string;
  runtime: string;
  model: string;
  route: RunExecutionRoute | "";
  contextPacketId: string;
  contextCharacters: number;
  inputTokens: number;
  outputTokens: number;
  tokenUsageKnown: boolean;
  cloudCostUsd: number;
  cloudCostConfidence: RunCostConfidence;
  latencyMs: number;
  attemptNumber: number;
  connectorId: string;
  verificationRef: string;
  writerApprovalState: "" | "pending" | "accepted" | "rejected" | "revise";
  healthState: RuntimeHealthState | "";
  errorCategory: string;
  summary: string;
};

export type RunTelemetryLedger = {
  version: 1;
  runId: string;
  events: RunTelemetryEvent[];
  updatedAt: string;
};

export type RunTelemetrySummary = {
  runId: string;
  totalTokens: number;
  tokenUsageKnown: boolean;
  totalContextCharacters: number;
  cloudCostUsd: number;
  cloudCostConfidence: RunCostConfidence;
  route: RunExecutionRoute | "";
  capabilityRole: AgentProfileCapabilityRole | "";
  provider: string;
  runtime: string;
  model: string;
  latencyMs: number;
  contextSourceCount: number;
  healthState: RuntimeHealthState | "";
  verificationRef: string;
  writerApprovalState: RunTelemetryEvent["writerApprovalState"];
  plainLanguage: string;
};

const MAX_EVENTS = 500;
const ALLOWED_EVENT_TYPES = new Set<RunTelemetryEventType>([
  "run.created", "run.started", "run.paused", "run.resumed", "run.cancelled", "run.completed", "run.failed",
  "model.selected", "model.completed", "context.attached", "tool.called", "verification.recorded", "writer.approval",
  "runtime.health", "graph.node.started", "graph.node.completed",
]);
const ALLOWED_HEALTH_STATES = new Set<RuntimeHealthState>(RUNTIME_HEALTH_STATES);
const ALLOWED_ROUTES = new Set<RunExecutionRoute>(["local", "cloud/BYOK"]);
const ALLOWED_COST_CONFIDENCE = new Set<RunCostConfidence>(["exact", "estimated", "unknown"]);

function boundedText(value: unknown, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function boundedStrings(value: unknown, maximum = 32, itemMaximum = 180) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => boundedText(item, itemMaximum)).filter(Boolean))].slice(0, maximum)
    : [];
}

function nonNegativeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function nonNegativeMoney(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(6))) : 0;
}

function iso(value: unknown) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function eventId(runId: string, index: number) {
  return `${runId}:telemetry:${index}`;
}

export function createRunTelemetryLedger(runId: string, now = new Date().toISOString()): RunTelemetryLedger {
  const cleanRunId = boundedText(runId, 180);
  if (!cleanRunId) throw new Error("Run telemetry requires a Responsibility Run ID.");
  return { version: 1, runId: cleanRunId, events: [], updatedAt: iso(now) };
}

export function isRunTelemetryLedger(value: unknown): value is RunTelemetryLedger {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const ledger = value as Partial<RunTelemetryLedger>;
  return ledger.version === 1 && typeof ledger.runId === "string" && Array.isArray(ledger.events) && typeof ledger.updatedAt === "string";
}

export function recordRunTelemetryEvent(
  ledger: RunTelemetryLedger,
  input: Partial<Omit<RunTelemetryEvent, "id" | "runId">> & { type: RunTelemetryEventType },
): RunTelemetryLedger {
  if (!ALLOWED_EVENT_TYPES.has(input.type)) throw new Error("Unsupported Run telemetry event type.");
  const route = ALLOWED_ROUTES.has(input.route as RunExecutionRoute) ? input.route as RunExecutionRoute : "";
  const healthState = ALLOWED_HEALTH_STATES.has(input.healthState as RuntimeHealthState) ? input.healthState as RuntimeHealthState : "";
  const cloudCostConfidence = ALLOWED_COST_CONFIDENCE.has(input.cloudCostConfidence as RunCostConfidence)
    ? input.cloudCostConfidence as RunCostConfidence
    : "unknown";
  const at = iso(input.at);
  const event: RunTelemetryEvent = {
    id: eventId(ledger.runId, ledger.events.length + 1),
    runId: ledger.runId,
    parentRunId: boundedText(input.parentRunId, 180),
    graphNodeId: boundedText(input.graphNodeId, 180),
    type: input.type,
    at,
    profileId: boundedText(input.profileId, 180),
    skillUris: boundedStrings(input.skillUris),
    capabilityRole: boundedText(input.capabilityRole, 40) as AgentProfileCapabilityRole | "",
    provider: boundedText(input.provider, 120),
    runtime: boundedText(input.runtime, 120),
    model: boundedText(input.model, 240),
    route,
    contextPacketId: boundedText(input.contextPacketId, 180),
    contextCharacters: nonNegativeInteger(input.contextCharacters),
    inputTokens: nonNegativeInteger(input.inputTokens),
    outputTokens: nonNegativeInteger(input.outputTokens),
    tokenUsageKnown: input.tokenUsageKnown === true,
    cloudCostUsd: nonNegativeMoney(input.cloudCostUsd),
    cloudCostConfidence,
    latencyMs: nonNegativeInteger(input.latencyMs),
    attemptNumber: nonNegativeInteger(input.attemptNumber),
    connectorId: boundedText(input.connectorId, 180),
    verificationRef: boundedText(input.verificationRef, 300),
    writerApprovalState: ["pending", "accepted", "rejected", "revise"].includes(String(input.writerApprovalState))
      ? input.writerApprovalState as RunTelemetryEvent["writerApprovalState"]
      : "",
    healthState,
    errorCategory: boundedText(input.errorCategory, 120),
    summary: boundedText(input.summary, 800),
  };
  return {
    ...ledger,
    events: [...ledger.events, event].slice(-MAX_EVENTS),
    updatedAt: at,
  };
}

export function telemetryUsageDelta(event: RunTelemetryEvent) {
  return {
    tokens: event.inputTokens + event.outputTokens,
    contextCharacters: event.contextCharacters,
    cloudCostUsd: event.cloudCostUsd,
  };
}

export function runtimeRouteAllowed(input: {
  requestedRoute: RunExecutionRoute;
  cloudExplicitlyEnabled: boolean;
  cloudBudgetUsd: number;
  healthState: RuntimeHealthState;
}) {
  if (input.requestedRoute === "cloud/BYOK" && (!input.cloudExplicitlyEnabled || input.cloudBudgetUsd <= 0)) {
    return { allowed: false, reason: "paid-cloud-not-explicitly-enabled" } as const;
  }
  if (input.healthState === "circuit-open") return { allowed: false, reason: "runtime-circuit-open" } as const;
  if (["unavailable", "timeout", "rate-limited"].includes(input.healthState)) return { allowed: false, reason: `runtime-${input.healthState}` } as const;
  return { allowed: true, reason: "" } as const;
}

export function classifyRuntimeHealth(input: { ok: boolean; errorCategory?: string; previous?: RuntimeHealthState }): RuntimeHealthState {
  if (input.ok) return input.previous && input.previous !== "healthy" ? "recovering" : "healthy";
  const category = boundedText(input.errorCategory, 80).toLowerCase();
  if (category.includes("rate")) return "rate-limited";
  if (category.includes("timeout")) return "timeout";
  if (category.includes("circuit")) return "circuit-open";
  return "unavailable";
}

function lastNonEmpty<T>(events: readonly RunTelemetryEvent[], read: (event: RunTelemetryEvent) => T | "") {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = read(events[index]);
    if (value !== "") return value;
  }
  return "" as const;
}

function strongestCostConfidence(events: readonly RunTelemetryEvent[]): RunCostConfidence {
  const costEvents = events.filter((event) => event.cloudCostUsd > 0);
  if (!costEvents.length) return "exact";
  if (costEvents.some((event) => event.cloudCostConfidence === "unknown")) return "unknown";
  if (costEvents.some((event) => event.cloudCostConfidence === "estimated")) return "estimated";
  return "exact";
}

export function summarizeRunTelemetry(ledger: RunTelemetryLedger): RunTelemetrySummary {
  const totalTokens = ledger.events.reduce((sum, event) => sum + event.inputTokens + event.outputTokens, 0);
  const tokenEvents = ledger.events.filter((event) => event.inputTokens > 0 || event.outputTokens > 0);
  const totalContextCharacters = Math.max(0, ...ledger.events.map((event) => event.contextCharacters));
  const cloudCostUsd = Number(ledger.events.reduce((sum, event) => sum + event.cloudCostUsd, 0).toFixed(6));
  const contextSourceCount = new Set(ledger.events.map((event) => event.contextPacketId).filter(Boolean)).size;
  const latencyMs = ledger.events.reduce((sum, event) => sum + event.latencyMs, 0);
  const route = lastNonEmpty(ledger.events, (event) => event.route) as RunExecutionRoute | "";
  const capabilityRole = lastNonEmpty(ledger.events, (event) => event.capabilityRole) as AgentProfileCapabilityRole | "";
  const provider = lastNonEmpty(ledger.events, (event) => event.provider) as string;
  const runtime = lastNonEmpty(ledger.events, (event) => event.runtime) as string;
  const model = lastNonEmpty(ledger.events, (event) => event.model) as string;
  const healthState = lastNonEmpty(ledger.events, (event) => event.healthState) as RuntimeHealthState | "";
  const verificationRef = lastNonEmpty(ledger.events, (event) => event.verificationRef) as string;
  const writerApprovalState = lastNonEmpty(ledger.events, (event) => event.writerApprovalState) as RunTelemetryEvent["writerApprovalState"];
  const routeLabel = route === "local" ? "local" : route === "cloud/BYOK" ? "cloud/BYOK" : "runtime not recorded";
  const roleLabel = capabilityRole ? `${capabilityRole} model` : "model role not recorded";
  const sourceLabel = `${contextSourceCount} context source${contextSourceCount === 1 ? "" : "s"}`;
  const costLabel = cloudCostUsd > 0
    ? `${strongestCostConfidence(ledger.events)} cloud cost $${cloudCostUsd.toFixed(4)}`
    : "no cloud cost";
  const latencyLabel = latencyMs > 0 ? `${(latencyMs / 1000).toFixed(1)}s` : "timing not recorded";
  return {
    runId: ledger.runId,
    totalTokens,
    tokenUsageKnown: tokenEvents.length > 0 && tokenEvents.every((event) => event.tokenUsageKnown),
    totalContextCharacters,
    cloudCostUsd,
    cloudCostConfidence: strongestCostConfidence(ledger.events),
    route,
    capabilityRole,
    provider,
    runtime,
    model,
    latencyMs,
    contextSourceCount,
    healthState,
    verificationRef,
    writerApprovalState,
    plainLanguage: `${latencyLabel} · ${routeLabel} ${roleLabel} · ${sourceLabel} · ${costLabel}`,
  };
}
