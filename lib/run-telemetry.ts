import type { ResponsibilityRun, ResponsibilityRunEvent, ResponsibilityRunState } from "./responsibility-runs";

export const RUN_TELEMETRY_EVENT_TYPES = [
  "profile.bound",
  "skill.bound",
  "context.bound",
  "model.request",
  "model.response",
  "tool.call",
  "tool.result",
  "policy.decision",
  "verification.result",
  "writer.decision",
  "graph.node",
  "provider.health",
  "context.restart",
  "usage.snapshot",
  "error",
] as const;

export type RunTelemetryEventType = (typeof RUN_TELEMETRY_EVENT_TYPES)[number];
export type UsagePrecision = "exact" | "estimated" | "unknown";
export type RouteClass = "local" | "cloud-byok" | "none";
export type ProviderHealthState = "healthy" | "unavailable" | "timeout" | "rate-limited" | "circuit-open" | "recovering";
export type RunErrorCategory = "policy-denial" | "runtime" | "timeout" | "rate-limit" | "schema" | "verification" | "budget" | "cancelled" | "unknown";

export type ModelRequestBlueprint = {
  requestId: string;
  nodeId: string;
  profileId: string;
  skillIds: string[];
  capabilityRole: string;
  runtime: string;
  provider: string;
  model: string;
  routeClass: RouteClass;
  contextPacketId: string;
  contextSourceIds: string[];
  contextCharacters: number;
  systemInputRef: string;
  userInput: string;
  toolSchemaIds: string[];
  temperature: number | null;
  maxOutputTokens: number | null;
  attempt: number;
};

export type ModelUsage = {
  routeClass: RouteClass;
  inputTokens: number | null;
  outputTokens: number | null;
  contextCharacters: number;
  tokenPrecision: UsagePrecision;
  cloudCostUsd: number | null;
  costPrecision: UsagePrecision;
  timeToFirstTokenMs: number | null;
  completionLatencyMs: number | null;
};

export type RunTelemetryData = {
  nodeId?: string;
  parentRunId?: string;
  profileId?: string;
  skillId?: string;
  skillTrustState?: string;
  skillSourceRevision?: string;
  skillSourceHash?: string;
  evalRevision?: string;
  contextPacketId?: string;
  contextSourceIds?: string[];
  contextCharacters?: number;
  capabilityRole?: string;
  runtime?: string;
  provider?: string;
  model?: string;
  routeClass?: RouteClass;
  requestId?: string;
  requestFingerprint?: string;
  toolId?: string;
  connectorId?: string;
  policyCode?: string;
  policyAllowed?: boolean;
  truncated?: boolean;
  partial?: boolean;
  continuationRef?: string;
  attempt?: number;
  retryCount?: number;
  loopCount?: number;
  reminderLevel?: number;
  verificationResult?: string;
  evidenceRef?: string;
  writerDecision?: string;
  errorCategory?: RunErrorCategory;
  providerHealth?: ProviderHealthState;
  usage?: ModelUsage;
  modelRequest?: ModelRequestBlueprint;
};

export type StructuredRunTelemetryEvent = ResponsibilityRunEvent & {
  readonly telemetry: {
    version: 1;
    type: RunTelemetryEventType;
    runId: string;
    data: RunTelemetryData;
  };
};

export type RunTelemetryTotals = {
  inputTokens: number;
  outputTokens: number;
  estimatedTokenEvents: number;
  unknownTokenEvents: number;
  contextCharacters: number;
  cloudCostUsd: number;
  exactCostEvents: number;
  estimatedCostEvents: number;
  unknownCostEvents: number;
  localModelCalls: number;
  cloudModelCalls: number;
  toolCalls: number;
  policyDenials: number;
  truncatedResults: number;
};

export type RunTelemetrySummary = {
  runId: string;
  state: ResponsibilityRunState;
  profileId: string;
  capabilityRole: string;
  runtime: string;
  provider: string;
  model: string;
  routeClass: RouteClass;
  contextSourceCount: number;
  latencyMs: number | null;
  providerHealth: ProviderHealthState | "unknown";
  totals: RunTelemetryTotals;
  plainLanguage: string;
};

const SECRET_KEY = /(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|credential|token|nsec)/i;
const SECRET_VALUE = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bnsec1[a-z0-9]+|\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\bsk-[A-Za-z0-9_-]{12,})/i;
const HIDDEN_REASONING_KEY = /(?:chain[_ -]?of[_ -]?thought|hidden[_ -]?reasoning|scratchpad|internal[_ -]?reasoning)/i;

function text(value: unknown, max = 1_200) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function strings(value: unknown, max = 128, itemMax = 240) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => text(item, itemMax)).filter(Boolean))].slice(0, max)
    : [];
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 7) return "[truncated]";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "[redacted]" : text(value, 16_384);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 256).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return undefined;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !HIDDEN_REASONING_KEY.test(key))
    .slice(0, 256)
    .map(([key, child]) => [key, SECRET_KEY.test(key) ? "[redacted]" : sanitize(child, depth + 1)]));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function fingerprint(value: unknown) {
  const source = stable(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function eventTime(value?: string) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function sanitizeRunTelemetryData(data: RunTelemetryData): RunTelemetryData {
  return sanitize(data) as RunTelemetryData;
}

export function appendRunTelemetryEvent(run: ResponsibilityRun, input: {
  type: RunTelemetryEventType;
  summary: string;
  data?: RunTelemetryData;
  at?: string;
}): ResponsibilityRun {
  const at = eventTime(input.at);
  const telemetry = {
    version: 1 as const,
    type: input.type,
    runId: run.runId,
    data: sanitizeRunTelemetryData(input.data || {}),
  };
  const event: StructuredRunTelemetryEvent = {
    id: `${run.runId}:telemetry:${input.type}:${run.events.length + 1}`,
    type: `telemetry.${input.type}`,
    state: run.state,
    summary: text(input.summary, 500),
    at,
    telemetry,
  };
  return { ...run, updatedAt: at, events: [...run.events, event] };
}

export function runTelemetryEvents(run: Pick<ResponsibilityRun, "runId" | "events">): StructuredRunTelemetryEvent[] {
  return run.events.flatMap((event) => {
    const candidate = event as ResponsibilityRunEvent & { telemetry?: StructuredRunTelemetryEvent["telemetry"] };
    if (!candidate.telemetry || candidate.telemetry.version !== 1 || candidate.telemetry.runId !== run.runId) return [];
    if (!RUN_TELEMETRY_EVENT_TYPES.includes(candidate.telemetry.type)) return [];
    return [candidate as StructuredRunTelemetryEvent];
  });
}

export function normalizeModelRequestBlueprint(input: ModelRequestBlueprint): ModelRequestBlueprint {
  return {
    requestId: text(input.requestId, 180),
    nodeId: text(input.nodeId, 180),
    profileId: text(input.profileId, 180),
    skillIds: strings(input.skillIds, 32, 240),
    capabilityRole: text(input.capabilityRole, 80),
    runtime: text(input.runtime, 120),
    provider: text(input.provider, 120),
    model: text(input.model, 180),
    routeClass: input.routeClass === "cloud-byok" ? "cloud-byok" : input.routeClass === "local" ? "local" : "none",
    contextPacketId: text(input.contextPacketId, 180),
    contextSourceIds: strings(input.contextSourceIds, 256, 240),
    contextCharacters: Math.max(0, Math.floor(Number(input.contextCharacters) || 0)),
    systemInputRef: text(input.systemInputRef, 240),
    userInput: text(input.userInput, 12_000),
    toolSchemaIds: strings(input.toolSchemaIds, 128, 180),
    temperature: input.temperature === null ? null : numberOrNull(input.temperature),
    maxOutputTokens: input.maxOutputTokens === null ? null : numberOrNull(input.maxOutputTokens),
    attempt: Math.max(0, Math.floor(Number(input.attempt) || 0)),
  };
}

export function modelRequestFingerprint(input: ModelRequestBlueprint) {
  return fingerprint(normalizeModelRequestBlueprint(input));
}

export function recordModelRequest(run: ResponsibilityRun, blueprint: ModelRequestBlueprint, at?: string) {
  const modelRequest = normalizeModelRequestBlueprint(blueprint);
  return appendRunTelemetryEvent(run, {
    type: "model.request",
    summary: `${modelRequest.profileId} prepared ${modelRequest.capabilityRole || "model"} request ${modelRequest.requestId}.`,
    data: {
      nodeId: modelRequest.nodeId,
      profileId: modelRequest.profileId,
      capabilityRole: modelRequest.capabilityRole,
      runtime: modelRequest.runtime,
      provider: modelRequest.provider,
      model: modelRequest.model,
      routeClass: modelRequest.routeClass,
      contextPacketId: modelRequest.contextPacketId,
      contextSourceIds: modelRequest.contextSourceIds,
      contextCharacters: modelRequest.contextCharacters,
      requestId: modelRequest.requestId,
      requestFingerprint: modelRequestFingerprint(modelRequest),
      attempt: modelRequest.attempt,
      modelRequest,
    },
    at,
  });
}

export function reconstructModelRequest(run: Pick<ResponsibilityRun, "runId" | "events">, requestId: string) {
  const event = [...runTelemetryEvents(run)].reverse().find((item) => item.telemetry.type === "model.request" && item.telemetry.data.requestId === requestId);
  return event?.telemetry.data.modelRequest ? normalizeModelRequestBlueprint(event.telemetry.data.modelRequest) : null;
}

export function assertModelRequestSynchronized(run: Pick<ResponsibilityRun, "runId" | "events">, actual: ModelRequestBlueprint) {
  const normalized = normalizeModelRequestBlueprint(actual);
  const reconstructed = reconstructModelRequest(run, normalized.requestId);
  if (!reconstructed) throw new Error(`context/request desync: Run ${run.runId} has no recorded model request ${normalized.requestId}.`);
  const expectedFingerprint = modelRequestFingerprint(reconstructed);
  const actualFingerprint = modelRequestFingerprint(normalized);
  if (expectedFingerprint !== actualFingerprint) {
    throw new Error(`context/request desync: reconstructed ${expectedFingerprint} differs from outbound ${actualFingerprint}.`);
  }
  return true;
}

export function normalizeModelUsage(input: Partial<ModelUsage>): ModelUsage {
  const routeClass: RouteClass = input.routeClass === "cloud-byok" ? "cloud-byok" : input.routeClass === "local" ? "local" : "none";
  const precision = (value: unknown): UsagePrecision => value === "exact" || value === "estimated" ? value : "unknown";
  return {
    routeClass,
    inputTokens: numberOrNull(input.inputTokens),
    outputTokens: numberOrNull(input.outputTokens),
    contextCharacters: Math.max(0, Math.floor(Number(input.contextCharacters) || 0)),
    tokenPrecision: precision(input.tokenPrecision),
    cloudCostUsd: numberOrNull(input.cloudCostUsd),
    costPrecision: routeClass === "cloud-byok" ? precision(input.costPrecision) : "exact",
    timeToFirstTokenMs: numberOrNull(input.timeToFirstTokenMs),
    completionLatencyMs: numberOrNull(input.completionLatencyMs),
  };
}

export function recordModelResponseUsage(run: ResponsibilityRun, input: {
  requestId: string;
  nodeId?: string;
  usage: Partial<ModelUsage>;
  at?: string;
}) {
  const usage = normalizeModelUsage(input.usage);
  return appendRunTelemetryEvent(run, {
    type: "model.response",
    summary: `Model request ${text(input.requestId, 180)} completed${usage.completionLatencyMs === null ? "" : ` in ${usage.completionLatencyMs}ms`}.`,
    data: { requestId: text(input.requestId, 180), nodeId: text(input.nodeId, 180), routeClass: usage.routeClass, usage },
    at: input.at,
  });
}

export function runTelemetryTotals(run: Pick<ResponsibilityRun, "runId" | "events">): RunTelemetryTotals {
  const totals: RunTelemetryTotals = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedTokenEvents: 0,
    unknownTokenEvents: 0,
    contextCharacters: 0,
    cloudCostUsd: 0,
    exactCostEvents: 0,
    estimatedCostEvents: 0,
    unknownCostEvents: 0,
    localModelCalls: 0,
    cloudModelCalls: 0,
    toolCalls: 0,
    policyDenials: 0,
    truncatedResults: 0,
  };
  for (const event of runTelemetryEvents(run)) {
    const data = event.telemetry.data;
    if (event.telemetry.type === "tool.call") totals.toolCalls += 1;
    if (event.telemetry.type === "policy.decision" && data.policyAllowed === false) totals.policyDenials += 1;
    if (event.telemetry.type === "tool.result" && (data.truncated || data.partial)) totals.truncatedResults += 1;
    if (event.telemetry.type !== "model.response" || !data.usage) continue;
    const usage = normalizeModelUsage(data.usage);
    if (usage.routeClass === "local") totals.localModelCalls += 1;
    if (usage.routeClass === "cloud-byok") totals.cloudModelCalls += 1;
    totals.inputTokens += usage.inputTokens || 0;
    totals.outputTokens += usage.outputTokens || 0;
    totals.contextCharacters += usage.contextCharacters;
    if (usage.tokenPrecision === "estimated") totals.estimatedTokenEvents += 1;
    if (usage.tokenPrecision === "unknown") totals.unknownTokenEvents += 1;
    if (usage.routeClass === "cloud-byok") {
      totals.cloudCostUsd += usage.cloudCostUsd || 0;
      if (usage.costPrecision === "exact") totals.exactCostEvents += 1;
      else if (usage.costPrecision === "estimated") totals.estimatedCostEvents += 1;
      else totals.unknownCostEvents += 1;
    }
  }
  totals.cloudCostUsd = Number(totals.cloudCostUsd.toFixed(4));
  return totals;
}

export function summarizeRunTelemetry(run: Pick<ResponsibilityRun, "runId" | "state" | "profileId" | "events">): RunTelemetrySummary {
  const events = runTelemetryEvents(run);
  const request = [...events].reverse().find((item) => item.telemetry.type === "model.request")?.telemetry.data || {};
  const response = [...events].reverse().find((item) => item.telemetry.type === "model.response")?.telemetry.data || {};
  const health = [...events].reverse().find((item) => item.telemetry.type === "provider.health")?.telemetry.data.providerHealth || "unknown";
  const usage = response.usage ? normalizeModelUsage(response.usage) : null;
  const totals = runTelemetryTotals(run);
  const profile = request.profileId || run.profileId;
  const role = request.capabilityRole || "unreported capability";
  const route = request.routeClass || "none";
  const routeLabel = route === "local" ? `local ${role} model` : route === "cloud-byok" ? `BYOK cloud ${role} model` : role;
  const latency = usage?.completionLatencyMs ?? null;
  const contextCount = request.contextSourceIds?.length || 0;
  const costLabel = totals.cloudModelCalls === 0 ? "no cloud cost" : totals.unknownCostEvents > 0 ? "cloud cost partly unknown" : `$${totals.cloudCostUsd.toFixed(4)} cloud cost`;
  return {
    runId: run.runId,
    state: run.state,
    profileId: profile,
    capabilityRole: request.capabilityRole || "",
    runtime: request.runtime || "",
    provider: request.provider || "",
    model: request.model || "",
    routeClass: route,
    contextSourceCount: contextCount,
    latencyMs: latency,
    providerHealth: health,
    totals,
    plainLanguage: `${profile} ${run.state}${latency === null ? "" : ` in ${(latency / 1000).toFixed(1)}s`} · ${routeLabel} · ${contextCount} context ${contextCount === 1 ? "source" : "sources"} · ${costLabel}`,
  };
}

export function minimalVerificationRunReference(runId: string, evidenceRef: string) {
  return { runId: text(runId, 180), evidenceRef: text(evidenceRef, 500) };
}

export function minimalBuzzRunReceipt(run: Pick<ResponsibilityRun, "runId" | "state" | "profileId">) {
  return { runId: text(run.runId, 180), profileId: text(run.profileId, 180), state: run.state };
}
