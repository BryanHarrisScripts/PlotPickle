const STATES = new Set(["queued","running","waiting","completed","failed","cancelled","unavailable"]);

function clean(value, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeDurableTask(input = {}) {
  const id = clean(input.id, 180);
  const prompt = clean(input.prompt, 24000);
  const humanApprovalRef = clean(input.humanApprovalRef, 1000);
  if (!id || !prompt || !humanApprovalRef) throw new Error("Durable execution requires task id, bounded prompt, and Human approval reference.");
  const replayPolicy = input.replayPolicy === "safe" ? "safe" : "non-replayable";
  return Object.freeze({
    id,
    prompt,
    replayPolicy,
    humanApprovalRef,
    cwd: clean(input.cwd, 4000),
    extensions: Object.freeze([...(input.extensions ?? [])].map((v) => clean(v, 180)).filter(Boolean)),
    tools: Object.freeze([...(input.tools ?? [])].map((v) => clean(v, 180)).filter(Boolean)),
    metadata: Object.freeze({ ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}) }),
  });
}

export function normalizeDurableStatus(input = {}) {
  const state = STATES.has(input.state) ? input.state : "unavailable";
  return Object.freeze({
    taskId: clean(input.taskId, 180),
    state,
    runtime: clean(input.runtime, 180) || "unknown",
    resumable: Boolean(input.resumable),
    humanApprovalRef: clean(input.humanApprovalRef, 1000),
    updatedAt: clean(input.updatedAt, 100) || new Date(0).toISOString(),
  });
}

export function assertReplayAllowed(task, { interrupted = false } = {}) {
  const normalized = normalizeDurableTask(task);
  if (interrupted && normalized.replayPolicy !== "safe") {
    throw new Error("Interrupted non-replayable operation requires explicit Human re-authorization; silent replay is forbidden.");
  }
  return normalized;
}

export function deterministicAuthorityEnvelope(result = {}) {
  return Object.freeze({
    ...result,
    canApproveCanon: false,
    canMergeCode: false,
    canOverrideDeterministicFailure: false,
  });
}

export class DurableExecutionAdapter {
  async start() { throw new Error("Not implemented."); }
  async resume() { throw new Error("Not implemented."); }
  async cancel() { throw new Error("Not implemented."); }
  async status() { throw new Error("Not implemented."); }
  async result() { throw new Error("Not implemented."); }
  async evidence() { throw new Error("Not implemented."); }
}
