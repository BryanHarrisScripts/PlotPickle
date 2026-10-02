import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  DurableExecutionAdapter,
  assertReplayAllowed,
  deterministicAuthorityEnvelope,
  normalizeDurableStatus,
  normalizeDurableTask,
} from "./durable-execution-contract.mjs";

const RUNTIME_ID = "pi-durable";
const REQUIRED_NODE = [22, 19, 0];
const managedLoaders = new Map();

function nodeMeetsMinimum(version = process.versions.node) {
  const actual = String(version).split(".").map((v) => Number(v));
  for (let i = 0; i < REQUIRED_NODE.length; i += 1) {
    const left = Number.isFinite(actual[i]) ? actual[i] : 0;
    if (left > REQUIRED_NODE[i]) return true;
    if (left < REQUIRED_NODE[i]) return false;
  }
  return true;
}

function safeTaskFolder(root, taskId) {
  const id = taskId.replace(/[^a-z0-9_.-]+/giu, "-").slice(0, 180);
  return path.join(root, id);
}

async function loadMetadata(folder) {
  return JSON.parse(await readFile(path.join(folder, "plotpickle-task.json"), "utf8"));
}

async function saveMetadata(folder, metadata) {
  await mkdir(folder, { recursive: true });
  const target = path.join(folder, "plotpickle-task.json");
  await writeFile(target, JSON.stringify(metadata, null, 2) + "\n", "utf8");
  return target;
}

export async function importPiDurableModule(moduleRoot, specifier) {
  if (!moduleRoot) return import(specifier);
  // Native ESM resolution must originate in the managed runtime. require.resolve
  // selects CommonJS export conditions and rejects import-only Chord subpaths.
  const root = path.resolve(moduleRoot);
  if (!managedLoaders.has(root)) {
    managedLoaders.set(root, (async () => {
      const loader = path.join(root, "plotpickle-esm-loader.mjs");
      await writeFile(loader, "export const load = (specifier) => import(specifier);\n", "utf8");
      return import(pathToFileURL(loader).href);
    })());
  }
  const { load } = await managedLoaders.get(root);
  return load(specifier);
}

async function loadPiDurableModules(moduleRoot) {
  try {
    const [durable, jsonl] = await Promise.all([
      importPiDurableModule(moduleRoot, "@earendil-works/pi-durable"),
      importPiDurableModule(moduleRoot, "@earendil-works/pi-durable/storage/jsonl/node"),
    ]);
    return { durable, jsonl };
  } catch (error) {
    const wrapped = new Error("Pi Durable is not installed or compatible with this host.");
    wrapped.cause = error;
    throw wrapped;
  }
}

export async function probePiDurableRuntime({ moduleRoot, storageRoot } = {}) {
  if (!nodeMeetsMinimum()) {
    throw new Error("@earendil-works/pi-durable@1.0.0 requires Node >=22.19.0; this host is below the supported runtime.");
  }
  if (!moduleRoot || !storageRoot) throw new Error("Pi Durable readiness requires managed module and storage roots.");

  const [{ durable, jsonl }, chord, piAi] = await Promise.all([
    loadPiDurableModules(moduleRoot),
    importPiDurableModule(moduleRoot, "@earendil-works/chord/context"),
    importPiDurableModule(moduleRoot, "@earendil-works/pi-ai/models"),
  ]);
  const context = chord.BACKGROUND_CONTEXT;
  const models = piAi.createModels();
  const registry = durable.createRegistry();
  const probeRoot = path.join(storageRoot, "runtime-health");
  await mkdir(probeRoot, { recursive: true });

  const open = async () => {
    const storage = await jsonl.openNodeJsonlStorage(probeRoot, context);
    return durable.Harness.open(storage, { models, registry }, context);
  };

  const first = await open();
  const firstRoot = await first.root(context);
  const rootId = firstRoot.id;
  await first.close(context);

  const second = await open();
  const secondRoot = await second.root(context);
  const reopenedRootId = secondRoot.id;
  await second.close(context);

  if (!rootId || reopenedRootId !== rootId) {
    throw new Error("Pi Durable JSONL readiness probe did not reopen the same persisted root conversation.");
  }

  return deterministicAuthorityEnvelope({
    runtime: RUNTIME_ID,
    version: PI_DURABLE_RUNTIME_VERSION,
    state: "ready",
    storage: "jsonl",
    rootId,
    persistedReopen: true,
    providerRequestIssued: false,
    modelRequestIssued: false,
  });
}

export async function inspectPiDurableRecoveryCandidates(storageRoot) {
  const safeResume = [];
  const humanReauthorizationRequired = [];
  let entries = [];
  try {
    entries = await readdir(storageRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return Object.freeze({ safeResume: Object.freeze([]), humanReauthorizationRequired: Object.freeze([]) });
    }
    throw error;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "runtime-health") continue;
    try {
      const metadata = await loadMetadata(path.join(storageRoot, entry.name));
      if (!["queued", "running", "waiting", "interrupted"].includes(metadata.state)) continue;
      const item = Object.freeze({
        taskId: String(metadata.task?.id || entry.name),
        humanApprovalRef: String(metadata.task?.humanApprovalRef || ""),
        replayPolicy: metadata.task?.replayPolicy === "safe" ? "safe" : "non-replayable",
        state: String(metadata.state || "unknown"),
      });
      if (item.replayPolicy === "safe") safeResume.push(item);
      else humanReauthorizationRequired.push(item);
    } catch {
      // Corrupt/incomplete task folders are ignored here and remain available for explicit diagnostics.
    }
  }

  return Object.freeze({
    safeResume: Object.freeze(safeResume),
    humanReauthorizationRequired: Object.freeze(humanReauthorizationRequired),
  });
}

export async function createNativePiDurableDriver({
  storageRoot,
  moduleRoot,
  models,
  registry,
  context,
  agent,
  resolveExtension = (name) => name,
  resolveTool = (name) => name,
} = {}) {
  if (!nodeMeetsMinimum()) {
    throw new Error("@earendil-works/pi-durable@1.0.0 requires Node >=22.19.0; this host is below the supported runtime.");
  }
  if (!storageRoot || !models || !registry || !context || !agent?.model) {
    throw new Error("Pi Durable driver requires host-owned storage, models, registry, context and host-selected model.");
  }

  const { durable, jsonl } = await loadPiDurableModules(moduleRoot);

  async function open(taskId) {
    const folder = safeTaskFolder(storageRoot, taskId);
    const storage = await jsonl.openNodeJsonlStorage(path.join(folder, "state"), context);
    const harness = await durable.Harness.open(storage, { models, registry }, context);
    return { folder, harness, root: await harness.root(context) };
  }

  return {
    runtime: RUNTIME_ID,
    async start(task) {
      const normalized = normalizeDurableTask(task);
      const { folder, harness, root } = await open(normalized.id);
      try {
        await root.configure({
          ...agent,
          extensions: normalized.extensions.map(resolveExtension),
          tools: normalized.tools.map(resolveTool),
          instructions: "PlotPickle DSDD owns acceptance and authority. Do not approve canon, merge code, or convert deterministic failures to PASS.",
          ...(normalized.cwd ? { cwd: normalized.cwd } : {}),
        }, context);
        const submission = await root.submit({
          type: "input",
          content: normalized.prompt,
          requestId: `plotpickle:${normalized.id}`,
        }, context);
        const metadata = {
          schemaVersion: 1,
          task: normalized,
          submissionId: submission.id,
          runtime: RUNTIME_ID,
          state: "running",
          updatedAt: new Date().toISOString(),
        };
        await saveMetadata(folder, metadata);
        return normalizeDurableStatus({ taskId: normalized.id, state: "running", runtime: RUNTIME_ID, resumable: true, humanApprovalRef: normalized.humanApprovalRef, updatedAt: metadata.updatedAt });
      } finally {
        await harness.close(context);
      }
    },
    async resume(taskId) {
      const { folder, harness } = await open(taskId);
      try {
        const metadata = await loadMetadata(folder);
        assertReplayAllowed(metadata.task, { interrupted: ["queued", "running", "waiting", "interrupted"].includes(metadata.state) });
        harness.resume();
        metadata.state = "running";
        metadata.updatedAt = new Date().toISOString();
        await saveMetadata(folder, metadata);
        return normalizeDurableStatus({ taskId, state: "running", runtime: RUNTIME_ID, resumable: true, humanApprovalRef: metadata.task.humanApprovalRef, updatedAt: metadata.updatedAt });
      } finally {
        await harness.close(context);
      }
    },
    async cancel(taskId) {
      const { folder, harness, root } = await open(taskId);
      try {
        const metadata = await loadMetadata(folder);
        await root.abort(context, { background: true });
        metadata.state = "cancelled";
        metadata.updatedAt = new Date().toISOString();
        await saveMetadata(folder, metadata);
        return normalizeDurableStatus({ taskId, state: "cancelled", runtime: RUNTIME_ID, resumable: false, humanApprovalRef: metadata.task.humanApprovalRef, updatedAt: metadata.updatedAt });
      } finally {
        await harness.close(context);
      }
    },
    async status(taskId) {
      const folder = safeTaskFolder(storageRoot, taskId);
      try {
        const metadata = await loadMetadata(folder);
        return normalizeDurableStatus({ taskId, state: metadata.state, runtime: RUNTIME_ID, resumable: metadata.state !== "cancelled", humanApprovalRef: metadata.task.humanApprovalRef, updatedAt: metadata.updatedAt });
      } catch {
        return normalizeDurableStatus({ taskId, state: "unavailable", runtime: RUNTIME_ID, resumable: false });
      }
    },
    async result(taskId) {
      const { folder, harness } = await open(taskId);
      try {
        const metadata = await loadMetadata(folder);
        assertReplayAllowed(metadata.task, { interrupted: ["queued", "running", "waiting", "interrupted"].includes(metadata.state) });
        const submission = await harness.submission(metadata.submissionId, context);
        if (!submission) throw new Error("Pi Durable submission is missing from persisted state.");
        const settled = await submission.wait(context);
        metadata.state = settled.status === "done" ? "completed" : "failed";
        metadata.updatedAt = new Date().toISOString();
        await saveMetadata(folder, metadata);
        return deterministicAuthorityEnvelope({ taskId, status: settled.status, reason: settled.reason ?? "", runtime: RUNTIME_ID });
      } finally {
        await harness.close(context);
      }
    },
    async evidence(taskId) {
      const { folder, harness } = await open(taskId);
      try {
        const metadata = await loadMetadata(folder);
        const usage = await harness.usage(context);
        return deterministicAuthorityEnvelope({
          taskId,
          runtime: RUNTIME_ID,
          humanApprovalRef: metadata.task.humanApprovalRef,
          replayPolicy: metadata.task.replayPolicy,
          extensions: metadata.task.extensions,
          tools: metadata.task.tools,
          usage,
          metadataPath: path.join(folder, "plotpickle-task.json"),
        });
      } finally {
        await harness.close(context);
      }
    },
  };
}

export function createPiDurableAdapter(driver) {
  const required = ["start", "resume", "cancel", "status", "result", "evidence"];
  for (const method of required) {
    if (typeof driver?.[method] !== "function") throw new Error(`Pi Durable driver is missing required operation: ${method}`);
  }
  return driver;
}

export class DisabledDurableAdapter extends DurableExecutionAdapter {
  async start(task) {
    const normalized = normalizeDurableTask(task);
    return normalizeDurableStatus({ taskId: normalized.id, state: "unavailable", runtime: "disabled", resumable: false, humanApprovalRef: normalized.humanApprovalRef, updatedAt: new Date().toISOString() });
  }
  async resume(taskId) { return normalizeDurableStatus({ taskId, state: "unavailable", runtime: "disabled", resumable: false }); }
  async cancel(taskId) { return normalizeDurableStatus({ taskId, state: "cancelled", runtime: "disabled", resumable: false }); }
  async status(taskId) { return normalizeDurableStatus({ taskId, state: "unavailable", runtime: "disabled", resumable: false }); }
  async result(taskId) { return deterministicAuthorityEnvelope({ taskId, status: "unavailable", runtime: "disabled" }); }
  async evidence(taskId) { return deterministicAuthorityEnvelope({ taskId, runtime: "disabled", evidence: [] }); }
}

export const PI_DURABLE_MINIMUM_NODE = "22.19.0";
export const PI_DURABLE_RUNTIME_VERSION = "1.0.0";
