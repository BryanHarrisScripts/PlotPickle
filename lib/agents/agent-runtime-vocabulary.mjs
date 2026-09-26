export const AGENT_RUNTIME_KINDS = Object.freeze([
  "session",
  "turn",
  "agent-run",
  "provider-request",
  "tool-call",
  "tool-result",
]);

export const AGENT_RUNTIME_PARENT_KIND = Object.freeze({
  turn: "session",
  "agent-run": "turn",
  "provider-request": "agent-run",
  "tool-call": "agent-run",
  "tool-result": "tool-call",
});

export const AGENT_RUNTIME_SAFE_TRACE_FIELDS = Object.freeze([
  "id",
  "kind",
  "parentId",
  "retryOf",
  "sessionId",
  "turnId",
  "agentRunId",
  "providerRequestId",
  "toolCallId",
  "agentId",
  "roleId",
  "providerId",
  "runtimeId",
  "modelId",
  "toolId",
  "status",
  "errorCode",
  "startedAt",
  "completedAt",
  "durationMs",
  "inputTokens",
  "outputTokens",
  "cachedTokens",
  "estimatedCost",
  "evidenceRef",
]);

export const AGENT_RUNTIME_FORBIDDEN_TRACE_CONTENT = Object.freeze([
  "hidden-reasoning",
  "chain-of-thought",
  "full-prompt",
  "full-model-response",
  "private-story-text",
  "credentials",
  "secrets",
  "raw-user-files",
]);

export function parentKindForAgentRuntimeKind(kind) {
  const normalized = String(kind || "").trim();
  if (!AGENT_RUNTIME_KINDS.includes(normalized)) {
    throw new Error(`Unknown PlotPickle agent/runtime kind: ${normalized || "(missing)"}`);
  }
  return AGENT_RUNTIME_PARENT_KIND[normalized] || null;
}

export function isSafeAgentRuntimeTraceField(field) {
  return AGENT_RUNTIME_SAFE_TRACE_FIELDS.includes(String(field || ""));
}
