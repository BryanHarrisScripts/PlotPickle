import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importPiDurableModule } from "../../core/sidecars/pi-durable-adapter.mjs";
import { registerAgentCheckpointTasks, normalizeAgentTaskScope } from "../../core/sidecars/tasks/agent-checkpoint-task.mjs";
import { managedPiDurableRoot, probeManagedPiDurable } from "../pi-durable-managed-install.mjs";
import { engineeringObservation, engineeringHandoff } from "./contract.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const HASH = /^[a-f0-9]{64}$/i;
const MAX_STEP_BYTES = 96 * 1024;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const stepName = (index) => "role-" + index + ".json";
const startedName = (index) => "role-" + index + ".started.json";

function validateInput(campaign, options) {
  if (campaign?.schemaVersion !== 1 || !SHA.test(campaign.exactSha || "")
    || !HASH.test(campaign.scopeHash || "") || !Array.isArray(campaign.roles)
    || !campaign.roles.includes("tester") || !campaign.roles.includes("challenger")
    || !options || !path.isAbsolute(options.runDir || "")
    || typeof options.getExactHead !== "function") {
    throw new Error("Engineering Durable requires an admitted exact-head team and private run directory.");
  }
  if (campaign.roles.length > campaign.budget.maxRoleRuns) {
    throw new Error("Engineering Durable role budget is insufficient.");
  }
}

async function readStep(file) {
  try {
    const value = await readFile(file, "utf8");
    if (Buffer.byteLength(value, "utf8") > MAX_STEP_BYTES) throw new Error("Engineering Durable step artifact exceeds bounded size.");
    return JSON.parse(value);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export function createEngineeringCheckpointCallbacks(campaign, options) {
  validateInput(campaign, options);
  const { runDir, getExactHead, adapters, signal, onStage } = options;
  const stepFolder = path.join(runDir, "durable-role-artifacts");
  const steps = Object.freeze(campaign.roles.map((role) => Object.freeze({
    id: "engineering-" + role, kind: "review", replayPolicy: "safe",
  })));
  const routeReceipt = hash(JSON.stringify(campaign.roles.map((role) => ({
    role,
    executorId: adapters?.[role]?.executorId || "blocked",
    routeReceipt: adapters?.[role]?.routeReceipt || "unproven-route",
  }))));
  const profileReceipt = hash(os.userInfo().username + ":" + process.platform).slice(0, 24);
  const scope = normalizeAgentTaskScope({
    humanProfileId: "local-os-" + profileReceipt,
    projectId: "engineering-" + hash(campaign.repository).slice(0, 24),
    projectRevision: campaign.exactSha,
    agentProfileId: "engineering-readonly",
    roleId: "engineering-review",
    runId: campaign.campaignId,
    objectiveRevision: 1,
    contextReceipt: campaign.scopeHash + ":" + routeReceipt.slice(0, 24),
    provider: "host-managed-local",
    model: "explicit-readonly-adapters",
    humanApprovalRef: "local-command-" + campaign.campaignId,
    grantedCapabilities: ["source-read", "focused-uat", "advisory-review"],
  });
  const input = Object.freeze({ scope, steps });

  async function checkHead() {
    if (signal?.aborted) throw new Error("Engineering Durable was cancelled; no resumed role execution is authorized.");
    if (String(await getExactHead()).toLowerCase() !== campaign.exactSha) {
      throw new Error("Engineering Durable checkout head changed; recovery is stale.");
    }
  }
  async function loadObservation(index) {
    const raw = await readStep(path.join(stepFolder, stepName(index)));
    if (!raw) return null;
    if (raw.scopeHash !== campaign.scopeHash || raw.exactSha !== campaign.exactSha
      || raw.role !== campaign.roles[index] || raw.routeReceipt !== routeReceipt) {
      throw new Error("Engineering Durable saved role artifact failed scope/route validation.");
    }
    const item = engineeringObservation(campaign, {
      exactSha: raw.exactSha,
      observationId: raw.observationId,
      executorId: raw.executorId,
      role: raw.role,
      state: raw.state,
      findingRef: raw.findingRef,
      summary: raw.summary,
      evidenceRefs: raw.evidenceRefs,
    });
    return item;
  }
  async function authorize(expectedScope, step) {
    await checkHead();
    if (JSON.stringify(expectedScope) !== JSON.stringify(scope)
      || !steps.some((entry) => entry.id === step.id)) {
      throw new Error("Engineering Durable scope/step differs from the admitted local task.");
    }
    return { scope, state: "working", budgetAvailable: !signal?.aborted };
  }
  async function executeStep(expectedScope, step) {
    await checkHead();
    if (JSON.stringify(expectedScope) !== JSON.stringify(scope)) {
      throw new Error("Engineering Durable task scope changed.");
    }
    const index = steps.findIndex((item) => item.id === step.id);
    if (index < 0) throw new Error("Engineering Durable unknown step.");
    const role = campaign.roles[index];
    const artifactRef = "responsibility-artifact:engineering-" + campaign.scopeHash.slice(0, 32) + "-" + index;
    await mkdir(stepFolder, { recursive: true, mode: 0o700 });
    const previousResult = await loadObservation(index);
    // Reopening after a successful artifact save must never repeat provider I/O,
    // even if the task checkpoint itself was interrupted before committing.
    if (previousResult) return { artifactRef };
    const adapter = adapters?.[role];
    if (!adapter || typeof adapter.run !== "function" || !/^[a-z0-9][a-z0-9._:/-]{0,199}$/i.test(adapter.executorId || "")) {
      throw new Error("Engineering Durable required read-only role adapter is unavailable.");
    }
    // 'started' is a write-once uncertainty barrier. A crash after submission
    // but before a complete result cannot trigger an automatic second model call.
    const started = path.join(stepFolder, startedName(index));
    await writeFile(started, JSON.stringify({
      scopeHash: campaign.scopeHash, exactSha: campaign.exactSha,
      role, routeReceipt, state: "started-uncertain-on-crash",
    }) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
    onStage?.("role-started", role);
    const prior = index > 0 ? await loadObservation(index - 1) : null;
    if (index > 0 && !prior) throw new Error("Engineering Durable predecessor receipt is missing.");
    const handoff = prior ? engineeringHandoff(campaign, prior, role) : null;
    onStage?.("role-dispatch", role);
    const raw = await adapter.run(Object.freeze({
      role, exactSha: campaign.exactSha,
      taskRef: campaign.taskRef, scopeHash: campaign.scopeHash,
      handoff,
      permissions: Object.freeze({
        sourceMutationAllowed: false, mergeAllowed: false,
        publicBuzzPostingAllowed: false, humanCredentialAccessAllowed: false,
      }),
    }));
    await checkHead();
    const observation = engineeringObservation(campaign, {
      exactSha: campaign.exactSha, observationId: raw?.observationId,
      executorId: adapter.executorId, role, state: raw?.state,
      findingRef: raw?.findingRef, summary: raw?.summary,
      evidenceRefs: raw?.evidenceRefs,
    });
    const saved = {
      scopeHash: campaign.scopeHash, exactSha: campaign.exactSha,
      routeReceipt, ...observation,
    };
    const json = JSON.stringify(saved) + "\n";
    if (Buffer.byteLength(json) > MAX_STEP_BYTES) throw new Error("Engineering Durable step evidence exceeds size budget.");
    await writeFile(path.join(stepFolder, stepName(index)), json, {
      encoding: "utf8", flag: "wx", mode: 0o600,
    });
    onStage?.("role-saved", role);
    return { artifactRef };
  }

  async function collect() {
    await checkHead();
    const observations = [];
    const handoffs = [];
    const roleResults = [];
    for (let i = 0; i < steps.length; i++) {
      const item = await loadObservation(i);
      if (!item) {
        roleResults.push({ role: campaign.roles[i], status: "blocked", reason: "missing-or-uncertain-step-artifact" });
        continue;
      }
      if (i > 0 && observations.length && observations.at(-1).role === campaign.roles[i - 1]) {
        handoffs.push(engineeringHandoff(campaign, observations.at(-1), campaign.roles[i]));
      }
      observations.push(item);
      roleResults.push({ role: campaign.roles[i], status: "observed", observationId: item.observationId });
    }
    return Object.freeze({
      schemaVersion: 1, campaignId: campaign.campaignId,
      exactSha: campaign.exactSha, scopeHash: campaign.scopeHash,
      status: roleResults.every((item) => item.status === "observed") ? "observed" : "blocked",
      observations, handoffs, roleResults,
      verified: false, mergeEligible: false, publishedExternally: false,
    });
  }
  return Object.freeze({ input, authorize, executeStep, collect, checkHead, routeReceipt });
}

export async function driveEngineeringDurableCheckpoint(campaign, options) {
  const callbacks = createEngineeringCheckpointCallbacks(campaign, options);
  if (!options?.runDir || !path.isAbsolute(options.runDir)) {
    throw new Error("Engineering Durable requires a private absolute task storage root.");
  }
  const openRuntime = options.openRuntime || (async () => {
    const moduleRoot = managedPiDurableRoot();
    const ready = await probeManagedPiDurable({ root: moduleRoot });
    if (!ready.ready) throw new Error("Engineering Durable managed Pi Durable 1.3.0 is unavailable (no automatic install).");
    const [durable, jsonl, chord, ai] = await Promise.all([
      importPiDurableModule(moduleRoot, "@earendil-works/pi-durable"),
      importPiDurableModule(moduleRoot, "@earendil-works/pi-durable/storage/jsonl/node"),
      importPiDurableModule(moduleRoot, "@earendil-works/chord/context"),
      importPiDurableModule(moduleRoot, "@earendil-works/pi-ai/models"),
    ]);
    const context = chord.BACKGROUND_CONTEXT;
    const registry = durable.createRegistry();
    const registration = registerAgentCheckpointTasks({
      durable, authorize: callbacks.authorize, executeStep: callbacks.executeStep,
    });
    registry.install(registration.extension);
    const storeRoot = path.join(options.runDir, "pi-durable-jsonl");
    await mkdir(storeRoot, { recursive: true, mode: 0o700 });
    const storage = await jsonl.openNodeJsonlStorage(storeRoot, context);
    const harness = await durable.Harness.open(storage, { models: ai.createModels(), registry }, context);
    return { harness, registration, context };
  });
  options.onStage?.("native-runtime-open");
  const { harness, registration, context } = await openRuntime(callbacks);
  try {
    await callbacks.checkHead();
    options.onStage?.("native-task-admit");
    const taskId = await registration.admit(await harness.root(context), callbacks.input, context);
    options.onStage?.("native-task-resume");
    await harness.resume();
    options.onStage?.("native-task-wait");
    const result = await harness.waitForTask(taskId, context);
    if (result?.state?.outcome?.status !== "completed") {
      throw new Error("Engineering Durable task did not finish with a completed checkpoint.");
    }
    options.onStage?.("native-receipt-check");
    const collected = await callbacks.collect();
    if (collected.status !== "observed") {
      throw new Error("Engineering Durable completed checkpoint lacks all admitted role receipts.");
    }
    return Object.freeze({ ...collected, durableCheckpointAdmitted: true, durableRecoveryProven: false });
  } finally {
    await harness.close(context);
  }
}
