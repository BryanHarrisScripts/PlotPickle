#!/usr/bin/env node

import process from "node:process";
import {
  MANAGED_PI_DURABLE_MINIMUM_NODE,
  MANAGED_PI_DURABLE_PACKAGE,
  MANAGED_PI_DURABLE_VERSION,
  ensureManagedPiDurable,
  openManagedPiDurableHarness,
} from "../../core/sidecars/runtime/pi-durable-managed.mjs";
import { validateVerificationRequest } from "../../core/sidecars/contract.ts";
import {
  claimServiceRequests,
  completeServiceRequest,
  writeServiceStatus,
} from "../../core/sidecars/runtime/service-bus.mjs";
import { resolveActiveNpmCommand, runPortableCommand } from "../pi-worker-runtime.mjs";

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

function startingDescriptor() {
  return Object.freeze({
    state: "starting",
    evidence: Object.freeze([
      evidence("runtime", `Preparing ${MANAGED_PI_DURABLE_PACKAGE}@${MANAGED_PI_DURABLE_VERSION} behind the PlotPickle adapter.`),
      evidence("provider-policy", "Startup initializes durable storage only; it performs zero model/provider requests."),
    ]),
  });
}

export function piDurableReadyDescriptor(active) {
  return Object.freeze({
    state: "ready",
    evidence: Object.freeze([
      evidence("runtime-active", `Pi Durable ${active.version} is loaded with persistent JSONL state.`),
      evidence("durable-root", `Persistent conversation root is active: ${active.rootConversationId}`),
      evidence("provider-policy", "No model/provider request is made until governed work is explicitly submitted."),
      evidence("authority", "Pi Durable is execution/recovery infrastructure only; DSDD, Human authority, canon, and exact-head merge gates remain unchanged."),
      evidence("replay-policy", "Replay-safe work may resume; non-replayable mutations require fresh Human authorization."),
    ]),
  });
}

export async function initializePiDurableRuntime(home, {
  install = async ({ root, packageSpec }) => runPortableCommand(resolveActiveNpmCommand(), [
    "install",
    "--prefix", root,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--save-exact",
    packageSpec,
  ], { timeout: 15 * 60_000 }),
  allowInstall = process.env.PLOTPICKLE_PI_DURABLE_AUTO_INSTALL !== "0",
} = {}) {
  await ensureManagedPiDurable(home, { install, allowInstall });
  return openManagedPiDurableHarness(home);
}

export async function executePiDurableRuntimeRequest(active, rawRequest) {
  const request = validateVerificationRequest(rawRequest);
  if (request.operation !== "health") {
    return Object.freeze({
      requestId: request.requestId,
      state: "failed",
      evidence: [evidence("operation-rejected", "Pi Durable service startup surface exposes bounded health only; governed durable task execution remains behind the PlotPickle adapter.")],
    });
  }
  return Object.freeze({
    requestId: request.requestId,
    state: "ready",
    evidence: piDurableReadyDescriptor(active).evidence,
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
    const starting = startingDescriptor();
    await writeServiceStatus(home, PI_DURABLE_RUNTIME_SERVICE_ID, starting);
    publishRuntimeStatus(starting);

    let active;
    try {
      active = await initializePiDurableRuntime(home);
      const ready = piDurableReadyDescriptor(active);
      await writeServiceStatus(home, PI_DURABLE_RUNTIME_SERVICE_ID, ready);
      publishRuntimeStatus(ready);
      process.stdout.write(`[SIDECAR:PI] ready (${active.version})\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const degraded = {
        state: "degraded",
        evidence: [
          evidence("runtime-unavailable", message),
          evidence("minimum-node", `Pi Durable requires Node >= ${MANAGED_PI_DURABLE_MINIMUM_NODE}.`),
          evidence("core-independent", "Core PlotPickle and deterministic verification remain available."),
        ],
      };
      await writeServiceStatus(home, PI_DURABLE_RUNTIME_SERVICE_ID, degraded);
      publishRuntimeStatus(degraded);
      process.stderr.write(`[SIDECAR:PI] degraded: ${message}\n`);
      for (let index = 0; index < 100 && !signal(); index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      continue;
    }

    try {
      while (!signal()) {
        const claimed = await claimServiceRequests(home, PI_DURABLE_RUNTIME_SERVICE_ID);
        for (const item of claimed) {
          let result;
          try {
            result = await executePiDurableRuntimeRequest(active, item.request);
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
    } finally {
      await active.close().catch(() => {});
    }
  }
}

const direct = process.argv[1] && new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/u, "") === process.argv[1].replaceAll("\\", "/");
if (direct) {
  const args = parseArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runPiDurableRuntimeService({ home: args.home, signal: () => stopped }).catch((error) => {
    console.error(`[SIDECAR:PI] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 0;
  });
}
