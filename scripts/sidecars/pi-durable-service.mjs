#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateVerificationRequest } from "../../core/sidecars/contract.ts";
import {
  inspectPiDurableRecoveryCandidates,
  probePiDurableRuntime,
  PI_DURABLE_MINIMUM_NODE,
  PI_DURABLE_RUNTIME_VERSION,
} from "../../core/sidecars/pi-durable-adapter.mjs";
import {
  ensureManagedPiDurableInstalled,
  managedPiDurableRoot,
  PLOTPICKLE_PI_DURABLE_PACKAGE,
} from "../pi-durable-managed-install.mjs";
import {
  claimServiceRequests,
  completeServiceRequest,
  writeServiceStatus,
} from "../../core/sidecars/runtime/service-bus.mjs";

export const PI_DURABLE_RUNTIME_SERVICE_ID = "pi-durable";

function evidence(kind, summary) {
  return Object.freeze({ kind, summary, observedAt: new Date().toISOString() });
}

function publishRuntimeStatus(status) {
  if (typeof process.send !== "function") return;
  process.send({
    kind: "status",
    state: status.state,
    evidence: Array.isArray(status.evidence) ? status.evidence : [],
  });
}

async function persistAndPublish(home, status) {
  await writeServiceStatus(home, PI_DURABLE_RUNTIME_SERVICE_ID, status);
  publishRuntimeStatus(status);
  return status;
}

function startingDescriptor() {
  return Object.freeze({
    state: "starting",
    evidence: Object.freeze([
      evidence("managed-runtime", `Preparing ${PLOTPICKLE_PI_DURABLE_PACKAGE} in PlotPickle-owned storage.`),
      evidence("provider-policy", "Startup initializes durable storage only; it performs zero model/provider requests."),
    ]),
  });
}

export async function initializePiDurableRuntime(home, {
  ensure = ensureManagedPiDurableInstalled,
  probe = probePiDurableRuntime,
  inspectRecovery = inspectPiDurableRecoveryCandidates,
} = {}) {
  if (!home) throw new Error("Pi Durable runtime requires PlotPickle home.");
  const moduleRoot = managedPiDurableRoot({ home });
  const runtimeRoot = path.join(home, "node", "runtime", "sidecars", "pi-durable");
  const taskRoot = path.join(runtimeRoot, "tasks");
  const installed = await ensure({ home, root: moduleRoot });
  const readiness = await probe({
    moduleRoot: installed.root,
    storageRoot: path.join(runtimeRoot, "system"),
  });
  const recovery = await inspectRecovery(taskRoot);

  return Object.freeze({
    state: "ready",
    version: installed.version || PI_DURABLE_RUNTIME_VERSION,
    moduleRoot: installed.root,
    taskRoot,
    rootConversationId: readiness.rootId,
    recovery,
    evidence: Object.freeze([
      evidence("runtime-active", `Pi Durable ${installed.version || PI_DURABLE_RUNTIME_VERSION} is loaded from PlotPickle's managed runtime.`),
      evidence("durable-root", `Persistent JSONL root reopened successfully: ${readiness.rootId}.`),
      evidence("provider-policy", "No model/provider request is made until governed work is explicitly submitted."),
      evidence("safe-recovery", `${recovery.safeResume.length} replay-safe interrupted task(s) are available for governed resume.`),
      evidence("human-reauthorization", `${recovery.humanReauthorizationRequired.length} non-replayable interrupted task(s) require fresh Human authorization.`),
      evidence("authority", "Pi Durable is execution/recovery infrastructure only; DSDD, Human authority, canon, and exact-head merge gates remain unchanged."),
    ]),
  });
}

export async function executePiDurableRuntimeRequest(descriptor, rawRequest) {
  const request = validateVerificationRequest(rawRequest);
  if (request.operation !== "health") {
    return Object.freeze({
      requestId: request.requestId,
      state: "failed",
      evidence: [evidence("operation-rejected", "Pi Durable service exposes health only; durable task execution remains behind the PlotPickle-owned adapter contract.")],
    });
  }
  return Object.freeze({
    requestId: request.requestId,
    state: descriptor?.state === "ready" ? "ready" : "degraded",
    evidence: descriptor?.evidence || [evidence("health", "Pi Durable has not completed initialization.")],
  });
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    values[argv[index].slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "1";
  }
  return values;
}

export async function runPiDurableRuntimeService({ home, signal = () => false } = {}) {
  if (!home) throw new Error("Pi Durable runtime requires PlotPickle home.");

  while (!signal()) {
    await persistAndPublish(home, startingDescriptor());

    let descriptor;
    try {
      descriptor = await initializePiDurableRuntime(home);
      await persistAndPublish(home, descriptor);
      process.stdout.write(`[SIDECAR:PI-DURABLE] ready (${descriptor.version})\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      descriptor = {
        state: "degraded",
        evidence: [
          evidence("runtime-unavailable", message),
          evidence("minimum-node", `Pi Durable requires Node >= ${PI_DURABLE_MINIMUM_NODE}.`),
          evidence("core-independent", "Core PlotPickle and deterministic verification remain available."),
        ],
      };
      await persistAndPublish(home, descriptor);
      process.stderr.write(`[SIDECAR:PI-DURABLE] degraded: ${message}\n`);
      for (let index = 0; index < 100 && !signal(); index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      continue;
    }

    while (!signal()) {
      const claimed = await claimServiceRequests(home, PI_DURABLE_RUNTIME_SERVICE_ID);
      for (const item of claimed) {
        let result;
        try {
          result = await executePiDurableRuntimeRequest(descriptor, item.request);
        } catch (error) {
          result = {
            requestId: String(item.request?.requestId || "invalid-request"),
            state: "failed",
            evidence: [evidence("request-error", error instanceof Error ? error.message : String(error))],
          };
        }
        await completeServiceRequest(home, PI_DURABLE_RUNTIME_SERVICE_ID, item, result);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

const direct = Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (direct) {
  const args = parseArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runPiDurableRuntimeService({ home: args.home, signal: () => stopped }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    publishRuntimeStatus({ state: "degraded", evidence: [evidence("fatal-runtime-error", message)] });
    console.error(`[SIDECAR:PI-DURABLE] degraded: ${message}`);
    process.exitCode = 0;
  });
}
