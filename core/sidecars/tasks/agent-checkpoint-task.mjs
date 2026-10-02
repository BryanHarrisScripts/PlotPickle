import { createHash } from "node:crypto";
import { deterministicAuthorityEnvelope } from "../durable-execution-contract.mjs";

const SCOPE_FIELDS = ["humanProfileId", "projectId", "projectRevision", "agentProfileId", "roleId", "runId", "contextReceipt", "provider", "model", "humanApprovalRef"];
const ACTIVE_STATES = new Set(["queued", "preparing-context", "working", "verifying", "revising"]);

function identifier(value, field) {
  if (typeof value !== "string" || !value || value.length > 180 || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid durable task ${field}.`);
  }
  return value;
}

export function normalizeAgentTaskScope(input = {}) {
  const scope = {};
  for (const field of SCOPE_FIELDS) scope[field] = identifier(input[field], field);
  if (!Number.isSafeInteger(input.objectiveRevision) || input.objectiveRevision < 1) throw new Error("Invalid durable objective revision.");
  scope.objectiveRevision = input.objectiveRevision;
  if (!Array.isArray(input.grantedCapabilities) || input.grantedCapabilities.length > 64) throw new Error("Invalid durable task capability snapshot.");
  scope.grantedCapabilities = Object.freeze([...new Set(input.grantedCapabilities.map((value) => identifier(value, "capability")))].sort());
  return Object.freeze(scope);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeAgentCheckpointInput(input = {}) {
  const scope = normalizeAgentTaskScope(input.scope);
  if (!Array.isArray(input.steps) || !input.steps.length || input.steps.length > 96) throw new Error("Durable agent tasks require 1–96 bounded steps.");
  const seen = new Set();
  const steps = input.steps.map((step) => {
    const id = identifier(step?.id, "step ID");
    if (seen.has(id)) throw new Error("Duplicate durable step ID.");
    seen.add(id);
    if (!["review", "proposal"].includes(step.kind) || step.replayPolicy !== "safe") {
      throw new Error("This checkpoint bridge accepts replay-safe reviews and proposals only.");
    }
    return Object.freeze({ id, kind: step.kind, replayPolicy: "safe" });
  });
  return Object.freeze({ scope, steps: Object.freeze(steps), identity: `agent-task:${digest({ scope, steps })}` });
}

export function assertAgentTaskAuthorization(expectedScope, authorization) {
  if (!authorization || !ACTIVE_STATES.has(authorization.state) || authorization.budgetAvailable !== true) {
    throw new Error("Durable agent task requires an active, authorized responsibility run with remaining budget.");
  }
  if (JSON.stringify(normalizeAgentTaskScope(expectedScope)) !== JSON.stringify(normalizeAgentTaskScope(authorization.scope))) {
    throw new Error("Durable agent task scope is stale or mismatched; resume was denied.");
  }
}

function checkpointFor(input, checkpoint) {
  if (!checkpoint || checkpoint.identity !== input.identity || checkpoint.phase !== "step"
      || !Number.isInteger(checkpoint.nextIndex) || checkpoint.nextIndex < 0 || checkpoint.nextIndex >= input.steps.length
      || !Array.isArray(checkpoint.artifacts) || checkpoint.artifacts.length !== checkpoint.nextIndex) {
    throw new Error("Durable agent checkpoint failed integrity validation.");
  }
  checkpoint.artifacts.forEach((artifact, index) => {
    if (artifact.stepId !== input.steps[index].id) throw new Error("Durable agent checkpoint step order is corrupt.");
    artifactReference(artifact.ref);
  });
  return checkpoint;
}

function artifactReference(value) {
  if (typeof value !== "string" || !/^responsibility-artifact:[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/.test(value)) {
    throw new Error("Worker must return a protected responsibility artifact reference.");
  }
  return value;
}

/** Host callbacks keep profile/context/provider selection and budgets outside Pi. */
export function defineAgentCheckpointTask({ defineTask, authorize, executeStep, checkpointDelayMs = 0 }) {
  if (typeof defineTask !== "function" || typeof authorize !== "function" || typeof executeStep !== "function") {
    throw new Error("Agent checkpoints require host-owned task registration, authorization and execution callbacks.");
  }
  if (!Number.isInteger(checkpointDelayMs) || checkpointDelayMs < 0 || checkpointDelayMs > 5000) throw new Error("Invalid checkpoint pacing.");
  return defineTask({
    name: "plotpickle.agent-checkpoints",
    version: 1,
    initial: (rawInput) => {
      const input = normalizeAgentCheckpointInput(rawInput);
      return { phase: "step", identity: input.identity, nextIndex: 0, artifacts: [] };
    },
    phases: {
      step: async (task, runtime, context) => {
        const input = normalizeAgentCheckpointInput(task.input);
        const checkpoint = checkpointFor(input, task.state.checkpoint);
        const step = input.steps[checkpoint.nextIndex];
        assertAgentTaskAuthorization(input.scope, await authorize(input.scope, step, context));
        const result = await executeStep(input.scope, step, context);
        // Recheck after worker execution too: cancellation/context change cannot admit a result.
        assertAgentTaskAuthorization(input.scope, await authorize(input.scope, step, context));
        const artifact = { stepId: step.id, ref: artifactReference(result?.artifactRef) };
        const artifacts = [...checkpoint.artifacts, artifact];
        await runtime.commit(() => artifacts.length === input.steps.length
          ? { status: "terminal", outcome: { status: "completed", result: deterministicAuthorityEnvelope({ identity: input.identity, artifacts, canonical: false }) } }
          : { status: "running", checkpoint: { phase: "step", identity: input.identity, nextIndex: artifacts.length, artifacts } }, context);
        if (artifacts.length < input.steps.length && checkpointDelayMs) await runtime.sleep(Date.now() + checkpointDelayMs, context);
      },
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(() => ({ status: "terminal", outcome: { status: "aborted" } }), context);
    },
  });
}

/** Admission identity and scheduler checkpoints share Pi's atomic storage boundary. */
export function registerAgentCheckpointTasks({ durable, authorize, executeStep, checkpointDelayMs = 0 }) {
  const Task = defineAgentCheckpointTask({ defineTask: durable.defineTask, authorize, executeStep, checkpointDelayMs });
  const Index = durable.defineDoc({
    kind: "plotpickle.agent-checkpoint-index",
    version: 1,
    scope: "conversation",
    history: "latest",
    fork: "initial",
    initial: () => ({ tasks: {} }),
  });
  const extension = durable.defineExtension({ name: "plotpickle-agent-checkpoints", tasks: [Task] });
  return {
    Task,
    extension,
    async admit(conversation, rawInput, context) {
      const input = normalizeAgentCheckpointInput(rawInput);
      assertAgentTaskAuthorization(input.scope, await authorize(input.scope, input.steps[0], context));
      return conversation.commit(async (tx) => {
        const index = await tx.doc(Index, conversation.id);
        const existing = index.tasks[input.identity];
        if (existing) {
          const task = await tx.task(existing);
          if (!task || normalizeAgentCheckpointInput(task.input).identity !== input.identity) {
            throw new Error("Durable agent admission index failed integrity validation.");
          }
          return existing;
        }
        const id = await tx.createTask(Task, input, { ownership: { kind: "conversation" } });
        index.tasks[input.identity] = id;
        return id;
      }, context);
    },
  };
}
