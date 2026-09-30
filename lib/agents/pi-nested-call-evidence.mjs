const STATUS_MAP = Object.freeze({
  running: "running",
  ok: "success",
  error: "error",
  cancelled: "cancelled",
  unfinished: "unfinished",
});

function parentToolCallIdFor(callId, rootParentId) {
  const value = String(callId || "");
  const separator = value.lastIndexOf("/");
  if (separator > 0) return value.slice(0, separator);
  return rootParentId || null;
}

function safeErrorCode(call) {
  if (typeof call?.errorCode === "string" && call.errorCode.trim()) return call.errorCode.trim().slice(0, 120);
  if (typeof call?.error?.code === "string" && call.error.code.trim()) return call.error.code.trim().slice(0, 120);
  if (call?.status === "error") return "PI_NESTED_TOOL_ERROR";
  if (call?.status === "cancelled") return "PI_NESTED_TOOL_CANCELLED";
  return undefined;
}

export function normalizePiNestedCallEvidence({
  nestedCalls,
  parentToolCallId,
  sessionId,
  turnId,
  agentRunId,
  providerId,
  modelId,
} = {}) {
  const sourceCalls = Array.isArray(nestedCalls?.calls) ? nestedCalls.calls.slice(0, 256) : [];
  const events = [];

  for (const call of sourceCalls) {
    const callId = String(call?.id || "").trim();
    const toolId = String(call?.name || "").trim();
    if (!callId || !toolId) continue;
    const nestedParentId = parentToolCallIdFor(callId, parentToolCallId);
    const mappedStatus = STATUS_MAP[call.status] || "unfinished";
    const common = {
      sessionId,
      turnId,
      agentRunId,
      toolCallId: callId,
      toolId,
      providerId,
      modelId,
      parentToolCallId: nestedParentId,
    };

    events.push({
      id: callId,
      kind: "tool-call",
      parentId: agentRunId || null,
      ...common,
      status: mappedStatus === "running" ? "running" : "completed",
      ...(Number.isFinite(call.durationMs) ? { durationMs: Math.max(0, call.durationMs) } : {}),
    });

    if (mappedStatus !== "running") {
      const errorCode = safeErrorCode(call);
      events.push({
        id: `${callId}:result`,
        kind: "tool-result",
        parentId: callId,
        ...common,
        status: mappedStatus,
        ...(errorCode ? { errorCode } : {}),
        ...(Number.isFinite(call.durationMs) ? { durationMs: Math.max(0, call.durationMs) } : {}),
      });
    }
  }

  return {
    complete: nestedCalls?.complete !== false && sourceCalls.length <= 256,
    events,
  };
}
