import { randomUUID } from "node:crypto";
import type { AuthContext, PlotPickleAuthService } from "../../core/auth/plotpickle-auth";
import type { ProfilePrivateStorageService } from "../../core/storage/profile-private/profile-private-storage";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import type { OutlineAgentAssessment } from "../../core/contracts/imported-screenplay-evidence/outline-agent-assessment";
import { normalizeAgentTaskScope as normalizeScope } from "../../core/sidecars/tasks/agent-checkpoint-task.mjs";
import { buildOutlineAgentAssessmentRequest, outlineAssessmentMaterialReceipt, validateOutlineAgentAssessment } from "../../modules/plan/outline-agent-assessment";
import { RESPONSIBILITY_RUN_STATES, addResponsibilityArtifact, beginResponsibilityAttempt, cancelResponsibilityRun, createCreativeResponsibilityRun, prepareResponsibilityRun, requestWriterApproval } from "../../lib/agents/responsibility/responsibility-runs";
import type { ResponsibilityRun, ResponsibilityRunLimits } from "../../lib/agents/responsibility/responsibility-runs";

type Usage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
type Scope = Readonly<{
  humanProfileId: string; projectId: string; projectRevision: string;
  agentProfileId: string; roleId: string; runId: string; objectiveRevision: number;
  contextReceipt: string; provider: string; model: string; humanApprovalRef: string;
  grantedCapabilities: readonly string[];
}>;
const normalizeAgentTaskScope = normalizeScope as (input: unknown) => Scope;
type Step = { id: string; kind: "review"; replayPolicy: "safe" };
export type OutlineExecution = {
  provider: string;
  model: string;
  /** Opaque identity of the host-selected route, configuration and grants. Never credentials. */
  receipt: string;
  grantedCapabilities: string[];
  /** Conservative host quote covering the complete request, output and runtime retries. */
  tokenUpperBound: number;
  cloudCostUpperBoundUsd: number | null;
  execute(input: ReturnType<typeof buildOutlineAgentAssessmentRequest> & { signal: AbortSignal; onAssessmentUsage(usage: Usage): Promise<void> }): Promise<string>;
};
type Attempt = { id: string; stepId: string; tokens: number; cloudCostUsd: number; usage: Usage | null; status: "reserved" | "reported" };
type Proposal = { stepId: string; artifactRef: string; assessment: OutlineAgentAssessment };
export type OutlineTaskRecord = {
  version: 1;
  scope: Scope;
  steps: Step[];
  computeReceipt: string;
  run: ResponsibilityRun;
  attempts: Attempt[];
  proposals: Proposal[];
};

const GRANTS = ["project-context-read", "proposal-draft"];
const ACTIVE = new Set(["queued", "preparing-context", "working", "verifying", "revising"]);
const taskIdPattern = /^outline-task-[a-f0-9-]{36}$/u;
const objectId = (id: string) => {
  if (!taskIdPattern.test(id)) throw new Error("Invalid Outline task identity.");
  return id;
};
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const finite = (value: number) => Number.isFinite(value) && value >= 0;

/**
 * Authenticated host kernel. The route and Pi adapter must supply trusted ports,
 * never browser-provided execution profiles, limits, capabilities or task scopes.
 * Construction/status/reopen perform no inference. Only explicit activation leases
 * enable callbacks; leases and session credentials are deliberately not persisted.
 */
export function createOutlineTaskController(options: {
  auth: Pick<PlotPickleAuthService, "resolveSession" | "createProfileVaultCapability" | "registerVaultCleanupHook">;
  storage: ProfilePrivateStorageService;
  resolveExecution(): Promise<OutlineExecution>;
  limits: Partial<ResponsibilityRunLimits>;
  now?: () => string;
}) {
  const now = options.now || (() => new Date().toISOString());
  const locks = new Map<string, Promise<unknown>>();
  const leases = new Map<string, { auth: AuthContext; abort: AbortController }>();
  const inFlight = new Set<string>();
  let closed = false;
  const unsubscribe = options.auth.registerVaultCleanupHook((event) => {
    for (const [id, lease] of leases) if (lease.auth.profileId === event.profileId) {
      lease.abort.abort(new Error("Outline task profile authority was revoked."));
      leases.delete(id);
    }
  });
  async function locked<T>(id: string, work: () => Promise<T>): Promise<T> {
    const prior = locks.get(id) || Promise.resolve();
    const next = prior.catch(() => {}).then(work);
    locks.set(id, next);
    try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
  }
  function authenticated(candidate: AuthContext) {
    if (closed) throw new Error("Outline task controller is closed.");
    const fresh = options.auth.resolveSession(candidate.sessionId, { touch: false });
    if (fresh.profileId !== candidate.profileId) throw new Error("Outline task profile mismatch.");
    options.auth.createProfileVaultCapability(fresh);
    return fresh;
  }
  function assertIntegrity(value: unknown, id: string, profileId: string): OutlineTaskRecord {
    const record = value as OutlineTaskRecord;
    if (!record || record.version !== 1 || record.scope?.runId !== id || record.scope.humanProfileId !== profileId
      || !same(normalizeAgentTaskScope(record.scope), record.scope)
      || record.scope.agentProfileId !== "elowen-mapweaver" || record.scope.roleId !== "story-architect"
      || !same(record.scope.grantedCapabilities, GRANTS) || record.scope.objectiveRevision !== 1
      || record.run?.runId !== id || record.run.profileId !== "elowen-mapweaver" || record.run.objectiveRevision !== 1
      || record.run.kind !== "creative-proposal" || record.run.verificationMode !== "writer-approval"
      || !RESPONSIBILITY_RUN_STATES.includes(record.run.state) || record.run.skillUris.length !== 0 || record.run.allowedConnectorIds.length !== 0
      || record.run.context?.taskId !== id || !same(record.run.context.sourceIds, [record.scope.contextReceipt])
      || !same(record.run.allowedScopes, ["read-project-slice", "propose-project-change"])
      || !Array.isArray(record.steps) || !record.steps.length || record.steps.length > 6
      || !Array.isArray(record.attempts) || !Array.isArray(record.proposals) || typeof record.computeReceipt !== "string") {
      throw new Error("Protected Outline task failed integrity validation.");
    }
    const ids = record.steps.map((step) => step.id);
    if (new Set(ids).size !== ids.length || record.steps.some((step) => !/^block-([1-9]|1[0-9]|2[0-4])$/u.test(step.id) || step.kind !== "review" || step.replayPolicy !== "safe")) throw new Error("Corrupt Outline task steps.");
    const limits = record.run.limits;
    if (!limits || !Number.isSafeInteger(limits.maxAttempts) || limits.maxAttempts < 1 || limits.maxAttempts > 24
      || !Number.isSafeInteger(limits.maxTokens) || limits.maxTokens < 1 || !finite(limits.maxCloudCostUsd)
      || !Number.isSafeInteger(limits.timeoutMs) || limits.timeoutMs < 1
      || !Number.isSafeInteger(limits.maxContextCharacters) || limits.maxContextCharacters < 1) throw new Error("Corrupt Outline task budget.");
    if (record.attempts.length !== record.run.usage.attempts || record.attempts.some((attempt, index) => attempt.id !== `${id}:attempt:${index + 1}`
      || !ids.includes(attempt.stepId) || !Number.isSafeInteger(attempt.tokens) || attempt.tokens < 0 || !finite(attempt.cloudCostUsd)
      || !["reserved", "reported"].includes(attempt.status))) throw new Error("Corrupt Outline task accounting.");
    if (record.run.usage.tokens !== record.attempts.reduce((sum, attempt) => sum + attempt.tokens, 0)
      || record.run.usage.cloudCostUsd !== record.attempts.reduce((sum, attempt) => sum + attempt.cloudCostUsd, 0)) throw new Error("Outline run accounting diverged from its reservations.");
    if (new Set(record.proposals.map((proposal) => proposal.stepId)).size !== record.proposals.length
      || record.proposals.some((proposal, index) => proposal.stepId !== ids[index]
        || proposal.artifactRef !== `responsibility-artifact:${id}:${proposal.stepId}`
        || proposal.assessment?.blockNumber !== Number(proposal.stepId.slice(6)))
      || record.run.artifacts.length !== record.proposals.length
      || record.run.artifacts.some((artifact, index) => artifact.canonical !== false || artifact.ref !== record.proposals[index].artifactRef)) throw new Error("Corrupt Outline task artifacts.");
    return record;
  }
  async function read(candidate: AuthContext, id: string) {
    const auth = authenticated(candidate);
    const value = await options.storage.readPrivateJson(auth, { domain: "projects", objectId: objectId(id) });
    if (!value) throw new Error("Outline task was not found in this Human profile.");
    return assertIntegrity(value, id, auth.profileId);
  }
  async function write(auth: AuthContext, record: OutlineTaskRecord) {
    assertIntegrity(record, record.scope.runId, auth.profileId);
    await options.storage.writePrivateJson(authenticated(auth), { domain: "projects", objectId: objectId(record.scope.runId), value: record });
  }
  function budget(record: OutlineTaskRecord, currentAttempt = false) {
    const { run } = record;
    const tokens = record.attempts.reduce((total, attempt) => total + attempt.tokens, 0);
    const cost = record.attempts.reduce((total, attempt) => total + attempt.cloudCostUsd, 0);
    if (run.usage.attempts > run.limits.maxAttempts || (!currentAttempt && run.usage.attempts >= run.limits.maxAttempts)
      || tokens > run.limits.maxTokens || cost > run.limits.maxCloudCostUsd
      || Date.parse(now()) - Date.parse(run.startedAt || run.updatedAt) >= run.limits.timeoutMs) throw new Error("Outline task budget is exhausted.");
    return { tokens, cost };
  }
  async function fresh(auth: AuthContext, record: OutlineTaskRecord) {
    const context = authenticated(auth);
    const project = await options.storage.loadActiveProject(context) as LibraryPPFProject | null;
    if (!project || project.id !== record.scope.projectId) throw new Error("Outline task requires its approved active project.");
    if (await outlineAssessmentMaterialReceipt(project) !== record.scope.contextReceipt) throw new Error("Outline task material is stale. Start a new review after story edits.");
    const execution = await options.resolveExecution();
    const grants = [...new Set(execution.grantedCapabilities)].sort();
    if (execution.receipt !== record.computeReceipt || execution.provider !== record.scope.provider || execution.model !== record.scope.model || !same(grants, GRANTS)) throw new Error("Outline task compute or grants changed; resume denied.");
    if (!ACTIVE.has(record.run.state)) throw new Error(`Outline task cannot execute while ${record.run.state}.`);
    return { context, project, execution };
  }
  function leaseFor(scope: Scope) {
    const lease = leases.get(scope.runId);
    if (!lease || lease.abort.signal.aborted) throw new Error("Outline task requires explicit Human activation or resume.");
    return lease;
  }
  return {
    async create(candidate: AuthContext, blocks: number[]) {
      const auth = authenticated(candidate);
      if (!Array.isArray(blocks) || !blocks.length || blocks.length > 6 || new Set(blocks).size !== blocks.length || blocks.some((block) => !Number.isInteger(block) || block < 1 || block > 24)) throw new Error("Outline task requires 1–6 unique Story Blocks.");
      const project = await options.storage.loadActiveProject(auth) as LibraryPPFProject | null;
      if (!project) throw new Error("Load an active project before reviewing Outline.");
      const execution = await options.resolveExecution();
      if (!same([...new Set(execution.grantedCapabilities)].sort(), GRANTS)) throw new Error("Story Architect grants are unavailable.");
      const id = `outline-task-${randomUUID()}`;
      const timestamp = now();
      const receipt = await outlineAssessmentMaterialReceipt(project);
      const scope = normalizeAgentTaskScope({ humanProfileId: auth.profileId, projectId: project.id, projectRevision: String(project.revision), agentProfileId: "elowen-mapweaver", roleId: "story-architect", runId: id, objectiveRevision: 1, contextReceipt: receipt, provider: execution.provider, model: execution.model, humanApprovalRef: `human-approval:${randomUUID()}`, grantedCapabilities: GRANTS });
      const run = createCreativeResponsibilityRun({ runId: id, profileId: "elowen-mapweaver", goal: "Review approved Outline Blocks; findings remain advisory.", skillUris: [], allowedScopes: ["read-project-slice", "propose-project-change"], allowedConnectorIds: [], context: { taskId: id, sourceIds: [receipt], receiptGeneratedAt: timestamp }, limits: options.limits, createdAt: timestamp });
      const record: OutlineTaskRecord = { version: 1, scope, steps: blocks.map((block) => ({ id: `block-${block}`, kind: "review", replayPolicy: "safe" })), computeReceipt: execution.receipt, run, attempts: [], proposals: [] };
      await write(auth, record);
      return record;
    },
    /** Explicit POST authority must be established by the gateway before calling. */
    async activate(candidate: AuthContext, id: string) {
      return locked(id, async () => {
        const record = await read(candidate, id);
        await fresh(candidate, record);
        budget(record, record.proposals.length === record.steps.length);
        if (!leases.has(id)) leases.set(id, { auth: authenticated(candidate), abort: new AbortController() });
        return { scope: record.scope, steps: record.steps };
      });
    },
    async status(candidate: AuthContext, id: string) {
      return locked(id, async () => {
        const record = await read(candidate, id);
        return { ...record, resumeRequired: ACTIVE.has(record.run.state) && !leases.has(id), accounting: { reservedTokens: record.attempts.reduce((sum, attempt) => sum + attempt.tokens, 0), reservedCloudCostUsd: record.attempts.reduce((sum, attempt) => sum + attempt.cloudCostUsd, 0), unknownAttempts: record.attempts.filter((attempt) => attempt.usage?.totalTokens === undefined).length, cloudCostIsUpperBound: true } };
      });
    },
    async cancel(candidate: AuthContext, id: string) {
      return locked(id, async () => {
        const record = await read(candidate, id);
        record.run = cancelResponsibilityRun(record.run, "Cancelled by the Human; proposals remain advisory.", now());
        // Persist cancellation before acknowledging it. A failed write does not claim success.
        await write(candidate, record);
        leases.get(id)?.abort.abort(new Error("Outline task cancelled by the Human."));
        leases.delete(id);
        return record;
      });
    },
    async authorize(scope: Scope, step: Step, context?: { abortSignal?: AbortSignal }) {
      context?.abortSignal?.throwIfAborted();
      return locked(scope.runId, async () => {
        const lease = leaseFor(scope);
        const record = await read(lease.auth, scope.runId);
        if (!same(record.scope, normalizeAgentTaskScope(scope)) || !record.steps.some((expected) => same(expected, step))) throw new Error("Outline callback scope or step mismatch.");
        await fresh(lease.auth, record);
        // A final permitted attempt may admit its result. It may not authorize a NEW call.
        budget(record, record.proposals.some((proposal) => proposal.stepId === step.id));
        return { scope: record.scope, state: record.run.state, budgetAvailable: true };
      });
    },
    async executeStep(scope: Scope, step: Step, context?: { abortSignal?: AbortSignal }) {
      const lease = leaseFor(scope);
      const signal = context?.abortSignal ? AbortSignal.any([lease.abort.signal, context.abortSignal]) : lease.abort.signal;
      signal.throwIfAborted();
      const key = `${scope.runId}:${step.id}`;
      if (inFlight.has(key)) throw new Error("Outline step is already executing.");
      inFlight.add(key);
      try {
      const prepared = await locked(scope.runId, async () => {
        const record = await read(lease.auth, scope.runId);
        if (!same(record.scope, normalizeAgentTaskScope(scope)) || !record.steps.some((expected) => same(expected, step))) throw new Error("Outline callback scope or step mismatch.");
        const { project, execution } = await fresh(lease.auth, record);
        const committed = record.proposals.find((proposal) => proposal.stepId === step.id);
        if (committed) { budget(record, true); return { committed }; }
        if (record.steps[record.proposals.length]?.id !== step.id) throw new Error("Outline task step order mismatch.");
        const used = budget(record);
        if (!Number.isSafeInteger(execution.tokenUpperBound) || execution.tokenUpperBound < 1
          || execution.cloudCostUpperBoundUsd === null || !finite(execution.cloudCostUpperBoundUsd)
          || used.tokens + execution.tokenUpperBound > record.run.limits.maxTokens
          || used.cost + execution.cloudCostUpperBoundUsd > record.run.limits.maxCloudCostUsd) throw new Error("A bounded host token/cost quote is required before inference.");
        const payload = buildOutlineAgentAssessmentRequest(project, Number(step.id.slice(6)));
        if (payload.message.length > record.run.limits.maxContextCharacters) throw new Error("Outline task context exceeds the host limit.");
        if (record.run.state === "queued") record.run = prepareResponsibilityRun(record.run, payload.message.length, now());
        record.run = beginResponsibilityAttempt(record.run, now());
        if (record.run.state !== "working") throw new Error("Outline attempt was denied by the host budget.");
        const attempt: Attempt = { id: record.run.attemptId, stepId: step.id, tokens: execution.tokenUpperBound, cloudCostUsd: execution.cloudCostUpperBoundUsd, usage: null, status: "reserved" };
        record.attempts.push(attempt);
        record.run.usage = { ...record.run.usage, tokens: used.tokens + attempt.tokens, cloudCostUsd: used.cost + attempt.cloudCostUsd, contextCharacters: Math.max(record.run.usage.contextCharacters, payload.message.length) };
        await write(lease.auth, record); // Crash-safe reservation BEFORE any worker/provider call.
        return { project, execution, payload, attemptId: attempt.id };
      });
      if (prepared.committed) return { artifactRef: prepared.committed.artifactRef };
      // Do not hold the task mutex across inference: cancellation must remain responsive.
      signal.throwIfAborted();
      const output = await prepared.execution!.execute({ ...prepared.payload!, signal, onAssessmentUsage: async (usage) => {
        await locked(scope.runId, async () => {
          const record = await read(lease.auth, scope.runId);
          const attempt = record.attempts.find((item) => item.id === prepared.attemptId);
          if (!attempt || attempt.status !== "reserved") throw new Error("Outline usage was duplicated or lost.");
          for (const value of Object.values(usage)) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error("Invalid Outline token usage.");
          if ((usage.inputTokens || 0) + (usage.outputTokens || 0) > attempt.tokens) throw new Error("Outline partial usage exceeds the host quote.");
          if (usage.totalTokens !== undefined && (usage.totalTokens > attempt.tokens || (usage.inputTokens !== undefined && usage.outputTokens !== undefined && usage.totalTokens !== usage.inputTokens + usage.outputTokens))) throw new Error("Outline usage exceeds or contradicts the host quote.");
          attempt.usage = usage;
          attempt.status = "reported";
          // Retain the reservation: unknown/retry/cloud billing is not silently treated as free.
          await write(lease.auth, record);
        });
      } });
      return await locked(scope.runId, async () => {
        signal.throwIfAborted();
        const record = await read(lease.auth, scope.runId);
        const attempt = record.attempts.find((item) => item.id === prepared.attemptId);
        if (attempt?.status !== "reported") throw new Error("Outline worker did not persist usage before result admission.");
        const { project } = await fresh(lease.auth, record);
        budget(record, true);
        if (record.proposals.some((proposal) => proposal.stepId === step.id)) throw new Error("Concurrent Outline step result denied.");
        const assessment = validateOutlineAgentAssessment(output, project, Number(step.id.slice(6)), scope.model, now());
        const artifactRef = `responsibility-artifact:${scope.runId}:${step.id}`;
        record.proposals.push({ stepId: step.id, artifactRef, assessment });
        record.run = addResponsibilityArtifact(record.run, { id: step.id, kind: "proposal", ref: artifactRef, producedAt: now() });
        await write(lease.auth, record);
        return { artifactRef };
      });
      } finally { inFlight.delete(key); }
    },
    /** Invoke only AFTER Pi independently confirms all checkpoint steps complete. */
    async finish(candidate: AuthContext, id: string) {
      return locked(id, async () => {
        const record = await read(candidate, id);
        await fresh(candidate, record);
        budget(record, true);
        if (record.proposals.length !== record.steps.length) throw new Error("Outline task still has remaining Blocks.");
        record.run = requestWriterApproval(record.run, now());
        await write(candidate, record);
        leases.delete(id);
        return record;
      });
    },
    close() {
      closed = true;
      unsubscribe();
      for (const lease of leases.values()) lease.abort.abort(new Error("Outline task host closed; explicit resume required."));
      leases.clear();
    },
  };
}
