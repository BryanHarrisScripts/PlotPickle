import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DurableExecutionAdapter,
  assertReplayAllowed,
  deterministicAuthorityEnvelope,
  normalizeDurableStatus,
  normalizeDurableTask,
} from "./durable-execution-contract.mjs";

const RUNTIME_ID = "pi-durable";
const REQUIRED_NODE = [22, 19, 0];

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

export async function createNativePiDurableDriver({
  storageRoot,
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

  let durable;
  let jsonl;
  try {
    durable = await import("@earendil-works/pi-durable");
    jsonl = await import("@earendil-works/pi-durable/storage/jsonl/node");
  } catch (error) {
    const wrapped = new Error("Pi Durable is optional and is not installed or compatible on this host.");
    wrapped.cause = error;
    throw wrapped;
  }

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
        assertReplayAllowed(metadata.task, { interrupted: metadata.state === "interrupted" });
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

export class PiDurableAdapter extends DurableExecutionAdapter {
  constructor(driver) {
    super();
    this.driver = driver;
  }
  start(task) { return this.driver.start(normalizeDurableTask(task)); }
  resume(taskId) { return this.driver.resume(taskId); }
  cancel(taskId) { return this.driver.cancel(taskId); }
  status(taskId) { return this.driver.status(taskId); }
  result(taskId) { return this.driver.result(taskId); }
  evidence(taskId) { return this.driver.evidence(taskId); }
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
