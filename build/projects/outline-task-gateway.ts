import path from "node:path";
import { createHash } from "node:crypto";
import type { AuthContext } from "../../core/auth/plotpickle-auth";
import type { ProfilePrivateStorageService } from "../../core/storage/profile-private/profile-private-storage";
import { createOutlineTaskController, type OutlineExecution } from "./outline-task-controller";
import { resolveStoryArchitectExecutionProfile } from "../writing-assistant-gateway";
import { askPlotPickleAgent, storyArchitectTokenUpperBound } from "../mastra-agent-runtime";
import { resolveAgentProfileCapabilities } from "../../lib/agents/agent-profiles";
import { managedPiDurableRoot, probeManagedPiDurable } from "../../scripts/pi-durable-managed-install.mjs";
import { importPiDurableModule } from "../../core/sidecars/pi-durable-adapter.mjs";
import { registerAgentCheckpointTasks } from "../../core/sidecars/tasks/agent-checkpoint-task.mjs";

type Controller = ReturnType<typeof createOutlineTaskController>;
type Input = Awaited<ReturnType<Controller["activate"]>>;
export type OutlineScheduler = {
  run(input: Input): Promise<boolean>;
  close(): Promise<void>;
};
type Runtime = {
  auth: Parameters<typeof createOutlineTaskController>[0]["auth"];
  privateStorage: ProfilePrivateStorageService;
  home: string;
};

/** Quotes are host-owned encrypted settings for the exact provider/model/endpoint.
 * Unknown cloud prices fail closed; OpenAI-compatible does not mean free.
 * The token reservation covers two attempts (Mastra maxRetries=1), bounded
 * input including instructions/schema, and 1800 output tokens per attempt.
 */
export async function configuredOutlineExecution(runtime: Runtime, auth: AuthContext): Promise<OutlineExecution> {
  const { profile, source } = await resolveStoryArchitectExecutionProfile();
  const grants = resolveAgentProfileCapabilities({ profileId: "elowen-mapweaver", hostGrantedCapabilities: ["project-context-read", "proposal-draft"] });
  const quote = await runtime.privateStorage.readPrivateJson(auth, { domain: "settings", objectId: "outline-provider-quote-v1" }) as {
    provider?: string; model?: string; baseUrl?: string; expiresAt?: string; maxCostPerAttemptUsd?: number;
  } | null;
  const local = (profile.provider === "local" || profile.provider === "ollama")
    && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(profile.baseUrl).hostname);
  const cost = local ? 0 : quote?.provider === profile.provider && quote.model === profile.textModel && quote.baseUrl === profile.baseUrl
    && Date.parse(quote.expiresAt || "") > Date.now() && Number.isFinite(quote.maxCostPerAttemptUsd) && Number(quote.maxCostPerAttemptUsd) > 0
    ? Number(quote.maxCostPerAttemptUsd) : null;
  if (cost === null || cost > 1) throw new Error("Story Architect recovery requires a current host-approved provider cost quote of at most $1 per attempt. Select a local loopback provider or configure the exact cloud route quote first.");
  const receipt = createHash("sha256").update(JSON.stringify({ provider: profile.provider, runtime: profile.runtime, model: profile.textModel,
    baseUrl: profile.baseUrl, contextTokens: profile.contextTokens, source, grants, quote: local ? null : quote,
    // Credentials remain only in the configured host store; the digest detects rotation.
    credentialDigest: createHash("sha256").update(profile.apiKey || "").digest("hex") })).digest("hex");
  return { provider: profile.provider, model: profile.textModel, receipt, grantedCapabilities: grants,
    tokenUpperBound: storyArchitectTokenUpperBound(), cloudCostUpperBoundUsd: cost,
    execute: (input) => askPlotPickleAgent({ profile, ...input }),
  };
}

async function nativeScheduler(home: string, id: string, controller: Controller): Promise<OutlineScheduler> {
  const root = (managedPiDurableRoot as (options: { home: string }) => string)({ home });
  const ready = await probeManagedPiDurable({ root });
  if (!ready.ready) throw new Error("Pi Durable is not ready. Wait for startup readiness before starting or resuming Story Architect.");
  const [durable, jsonl, chord, ai] = await Promise.all([
    importPiDurableModule(root, "@earendil-works/pi-durable"),
    importPiDurableModule(root, "@earendil-works/pi-durable/storage/jsonl/node"),
    importPiDurableModule(root, "@earendil-works/chord/context"),
    importPiDurableModule(root, "@earendil-works/pi-ai/models"),
  ]);
  const context = chord.BACKGROUND_CONTEXT;
  const registry = durable.createRegistry();
  const registration = registerAgentCheckpointTasks({ durable,
    authorize: (scope: Input["scope"], step: Input["steps"][number], context: { abortSignal?: AbortSignal }) => controller.authorize(scope, step, context),
    executeStep: (scope: Input["scope"], step: Input["steps"][number], context: { abortSignal?: AbortSignal }) => controller.executeStep(scope, step, context),
  });
  registry.install(registration.extension);
  // A task-local scheduler prevents activation of another task/profile's queue.
  const storage = await jsonl.openNodeJsonlStorage(path.join(home, "runtime", "outline-checkpoints", id), context);
  const harness = await durable.Harness.open(storage, { models: ai.createModels(), registry }, context);
  return {
    async run(input) {
      const piId = await registration.admit(await harness.root(context), input, context);
      const result = await harness.waitForTask(piId, context);
      return result.state.outcome.status === "completed";
    },
    close: () => harness.close(context),
  };
}

/** No scheduler is opened on construction, discovery or status reads. */
export function createOutlineTaskGateway(runtime: Runtime, ports: {
  resolveExecution?: (auth: AuthContext) => Promise<OutlineExecution>;
  openScheduler?: (id: string, controller: Controller) => Promise<OutlineScheduler>;
} = {}) {
  const controller = createOutlineTaskController({ auth: runtime.auth, storage: runtime.privateStorage,
    resolveExecution: ports.resolveExecution || ((auth) => configuredOutlineExecution(runtime, auth)),
    limits: { maxAttempts: 12, maxTokens: 2_000_000, maxCloudCostUsd: 12, timeoutMs: 24 * 60 * 60_000, maxContextCharacters: 12_000 },
  });
  const running = new Map<string, Promise<void>>();
  const errors = new Map<string, string>();
  const schedulers = new Map<string, { scheduler: OutlineScheduler; profileId: string }>();
  let closed = false;
  const cleanup = runtime.auth.registerVaultCleanupHook((event) => {
    // Controller revokes profile leases immediately. Closing the harness preserves
    // its last committed checkpoint for explicit activation with new credentials.
    for (const { scheduler, profileId } of schedulers.values()) {
      if (profileId === event.profileId) void scheduler.close().catch(() => {});
    }
  });
  async function view(auth: AuthContext, id: string) {
    const record = await controller.status(auth, id);
    const project = await runtime.privateStorage.loadActiveProject(auth) as { id?: string } | null;
    if (project?.id !== record.scope.projectId) throw new Error("Outline task requires its approved active project.");
    return { ...record, running: running.has(id), error: errors.get(id) || null };
  }
  async function activate(auth: AuthContext, id: string) {
    if (closed) throw new Error("Outline task gateway is closed.");
    // Authorization still runs for duplicate requests; IDs are never authority.
    await view(auth, id);
    if (running.has(id)) return view(auth, id);
    // Fail stale, cancelled and exhausted actions synchronously at the protected
    // boundary. The controller serializes activation; duplicate callers then
    // reuse the first running promise instead of opening another scheduler.
    const input = await controller.activate(auth, id);
    if (running.has(id)) return view(auth, id);
    const work = (async () => {
      let scheduler: OutlineScheduler | undefined;
      try {
        scheduler = await (ports.openScheduler?.(id, controller) || nativeScheduler(runtime.home, id, controller));
        schedulers.set(id, { scheduler, profileId: auth.profileId });
        errors.delete(id);
        if (!await scheduler.run(input)) throw new Error("The scheduler stopped before completing this review. Cancel this run and start a new review; saved findings remain available.");
        await controller.finish(auth, id);
      } catch (error) {
        // Never expose provider response bodies, prompts or credentials via polling.
        errors.set(id, error instanceof Error && /^(Outline |Story Architect recovery|Pi Durable|The scheduler)/u.test(error.message)
          ? error.message.slice(0, 500) : "Story Architect stopped. Check profile access, unchanged story material, configured compute and remaining budget before resuming.");
      } finally {
        controller.deactivate(id);
        await scheduler?.close().catch(() => {});
        schedulers.delete(id);
        running.delete(id);
      }
    })();
    running.set(id, work);
    return view(auth, id);
  }
  return {
    controller,
    async list(auth: AuthContext) {
      const records = await controller.list(auth);
      const active = records.filter((record) => ["queued", "preparing-context", "working", "verifying", "revising"].includes(record.run.state));
      const settled = records.filter((record) => !active.includes(record)).slice(-8);
      return Promise.all([...active, ...settled].map((record) => view(auth, record.scope.runId)));
    },
    status: view,
    async start(auth: AuthContext, blocks: number[]) {
      const record = await controller.create(auth, blocks);
      return activate(auth, record.scope.runId);
    },
    resume: activate,
    async cancel(auth: AuthContext, id: string) {
      await view(auth, id);
      await controller.cancel(auth, id);
      await schedulers.get(id)?.scheduler.close().catch(() => {});
      return view(auth, id);
    },
    async close() {
      closed = true;
      cleanup();
      controller.close();
      await Promise.all([...schedulers.values()].map(({ scheduler }) => scheduler.close().catch(() => {})));
      await Promise.all(running.values());
    },
  };
}
