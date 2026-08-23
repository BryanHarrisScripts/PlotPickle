import type { ProviderHealthState, RouteClass, UsagePrecision } from "./run-telemetry";

export type ProviderAdapterId = "openai-compatible" | "plotpickle-local";
export type ProviderFailureCategory = "timeout" | "rate-limit" | "unavailable" | "schema" | "protocol" | "cancelled" | "unknown";

export type ProviderAdapterRequest = {
  capabilityRole: string;
  runtime: string;
  provider: string;
  model: string;
  routeClass: RouteClass;
  messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }>;
  toolSchemas: Array<{ id: string; schema: Record<string, unknown> }>;
  maxOutputTokens: number | null;
  temperature: number | null;
  continuationRef: string;
};

export type NormalizedProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  tokenPrecision: UsagePrecision;
  cloudCostUsd: number | null;
  costPrecision: UsagePrecision;
};

export type NormalizedProviderResponse = {
  text: string;
  structured: Record<string, unknown> | null;
  finishReason: string;
  continuationRef: string;
  usage: NormalizedProviderUsage;
};

export type NormalizedProviderFailure = {
  category: ProviderFailureCategory;
  retryable: boolean;
  health: ProviderHealthState;
  message: string;
  retryAfterMs: number | null;
};

export type ProviderAdapter = {
  id: ProviderAdapterId;
  normalizeRequest(input: ProviderAdapterRequest): Record<string, unknown>;
  normalizeResponse(input: unknown, routeClass: RouteClass): NormalizedProviderResponse;
  normalizeFailure(error: unknown): NormalizedProviderFailure;
};

export type ProviderCircuitState = {
  state: ProviderHealthState;
  consecutiveFailures: number;
  openedAt: string;
  recoverAfterMs: number;
  updatedAt: string;
};

const SECRET = /(?:api[_-]?key|authorization|bearer|password|private[_-]?key|secret|credential|token|nsec)/i;

function text(value: unknown, max = 16_384) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeObject(value: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 7 || !value || typeof value !== "object" || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !SECRET.test(key))
    .slice(0, 256)
    .map(([key, child]) => {
      if (typeof child === "string") return [key, text(child)];
      if (Array.isArray(child)) return [key, child.slice(0, 256).map((item) => typeof item === "string" ? text(item) : safeObject(item, depth + 1) ?? item)];
      if (child && typeof child === "object") return [key, safeObject(child, depth + 1)];
      return [key, child];
    }));
}

function extractOpenAiText(body: Record<string, unknown>) {
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = object(choices[0]);
  const message = object(first.message);
  if (typeof message.content === "string") return text(message.content);
  if (Array.isArray(message.content)) {
    return message.content.map((part) => object(part)).filter((part) => part.type === "text").map((part) => text(part.text)).filter(Boolean).join("\n");
  }
  if (typeof first.text === "string") return text(first.text);
  return "";
}

function extractStructured(body: Record<string, unknown>) {
  const choices = Array.isArray(body.choices) ? body.choices : [];
  const first = object(choices[0]);
  const message = object(first.message);
  const parsed = message.parsed;
  return safeObject(parsed);
}

function openAiUsage(body: Record<string, unknown>, routeClass: RouteClass): NormalizedProviderUsage {
  const usage = object(body.usage);
  const inputTokens = numberOrNull(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = numberOrNull(usage.completion_tokens ?? usage.output_tokens);
  return {
    inputTokens,
    outputTokens,
    tokenPrecision: inputTokens !== null || outputTokens !== null ? "exact" : "unknown",
    cloudCostUsd: null,
    costPrecision: routeClass === "cloud-byok" ? "unknown" : "exact",
  };
}

function errorFacts(error: unknown) {
  if (error instanceof Error) return { message: text(error.message, 800), status: Number((error as Error & { status?: number }).status) || 0 };
  const value = object(error);
  return { message: text(value.message || value.error || "Provider request failed.", 800), status: Number(value.status || value.statusCode) || 0 };
}

function classifyFailure(error: unknown): NormalizedProviderFailure {
  const { message, status } = errorFacts(error);
  const lower = message.toLowerCase();
  if (status === 429 || /rate.?limit|too many requests/.test(lower)) return { category: "rate-limit", retryable: true, health: "rate-limited", message, retryAfterMs: null };
  if (status === 408 || /timeout|timed out|abortsignal/.test(lower)) return { category: "timeout", retryable: true, health: "timeout", message, retryAfterMs: null };
  if (status === 502 || status === 503 || status === 504 || /unavailable|connection refused|econnrefused/.test(lower)) return { category: "unavailable", retryable: true, health: "unavailable", message, retryAfterMs: null };
  if (status === 400 && /schema|json|structured/.test(lower)) return { category: "schema", retryable: false, health: "healthy", message, retryAfterMs: null };
  if (/cancelled|canceled/.test(lower)) return { category: "cancelled", retryable: false, health: "healthy", message, retryAfterMs: null };
  return { category: "protocol", retryable: false, health: "unavailable", message, retryAfterMs: null };
}

export const openAiCompatibleAdapter: ProviderAdapter = {
  id: "openai-compatible",
  normalizeRequest(input) {
    return {
      model: text(input.model, 180),
      messages: input.messages.map((message) => ({ role: message.role, content: text(message.content) })),
      ...(input.toolSchemas.length ? { tools: input.toolSchemas.map((tool) => ({ type: "function", function: { name: text(tool.id, 120), parameters: safeObject(tool.schema) || {} } })) } : {}),
      ...(input.maxOutputTokens === null ? {} : { max_tokens: input.maxOutputTokens }),
      ...(input.temperature === null ? {} : { temperature: input.temperature }),
      ...(input.continuationRef ? { previous_response_id: text(input.continuationRef, 240) } : {}),
    };
  },
  normalizeResponse(input, routeClass) {
    const body = object(input);
    const choices = Array.isArray(body.choices) ? body.choices : [];
    const first = object(choices[0]);
    return {
      text: extractOpenAiText(body),
      structured: extractStructured(body),
      finishReason: text(first.finish_reason || body.stop_reason, 120),
      continuationRef: text(body.id || body.response_id, 240),
      usage: openAiUsage(body, routeClass),
    };
  },
  normalizeFailure: classifyFailure,
};

export const plotPickleLocalAdapter: ProviderAdapter = {
  id: "plotpickle-local",
  normalizeRequest(input) {
    return {
      model: text(input.model, 180),
      messages: input.messages.map((message) => ({ role: message.role, content: text(message.content) })),
      tools: input.toolSchemas.map((tool) => ({ id: text(tool.id, 120), schema: safeObject(tool.schema) || {} })),
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
    };
  },
  normalizeResponse(input) {
    const body = object(input);
    const usage = object(body.usage);
    return {
      text: text(body.text || body.content),
      structured: safeObject(body.structured || body.parsed),
      finishReason: text(body.finishReason || body.doneReason, 120),
      continuationRef: "",
      usage: {
        inputTokens: numberOrNull(usage.inputTokens ?? usage.promptTokens),
        outputTokens: numberOrNull(usage.outputTokens ?? usage.completionTokens),
        tokenPrecision: usage.inputTokens !== undefined || usage.promptTokens !== undefined ? "exact" : "unknown",
        cloudCostUsd: null,
        costPrecision: "exact",
      },
    };
  },
  normalizeFailure: classifyFailure,
};

export function providerAdapter(adapterId: ProviderAdapterId) {
  return adapterId === "openai-compatible" ? openAiCompatibleAdapter : plotPickleLocalAdapter;
}

export function initialProviderCircuit(now = new Date().toISOString()): ProviderCircuitState {
  return { state: "healthy", consecutiveFailures: 0, openedAt: "", recoverAfterMs: 30_000, updatedAt: now };
}

export function updateProviderCircuit(state: ProviderCircuitState, input: { success: boolean; failure?: NormalizedProviderFailure; now?: string }): ProviderCircuitState {
  const now = input.now || new Date().toISOString();
  if (input.success) return { ...state, state: state.state === "circuit-open" ? "recovering" : "healthy", consecutiveFailures: 0, updatedAt: now };
  const failure = input.failure || classifyFailure(new Error("Provider request failed."));
  const consecutiveFailures = state.consecutiveFailures + 1;
  const circuitOpen = failure.retryable && consecutiveFailures >= 3;
  return {
    ...state,
    state: circuitOpen ? "circuit-open" : failure.health,
    consecutiveFailures,
    openedAt: circuitOpen ? now : state.openedAt,
    updatedAt: now,
  };
}

export function providerCircuitAllowsAttempt(state: ProviderCircuitState, now = new Date().toISOString()) {
  if (state.state !== "circuit-open") return true;
  const opened = Date.parse(state.openedAt);
  const current = Date.parse(now);
  return Number.isFinite(opened) && Number.isFinite(current) && current - opened >= state.recoverAfterMs;
}

export function providerAdapterAuthorityBoundary() {
  return {
    grantsTools: false,
    changesPpfAuthority: false,
    changesContextTrust: false,
    enablesPaidCloudFallback: false,
  } as const;
}
