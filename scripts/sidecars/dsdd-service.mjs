#!/usr/bin/env node

import process from "node:process";
import {
  evaluateDsddConvergence,
  normalizeDsddHeadlessContract,
  requestDsddVerificationJourney,
} from "../../core/sidecars/dsdd-governance-service.ts";
import { validateVerificationRequest } from "../../core/sidecars/contract.ts";
import {
  claimServiceRequests,
  completeServiceRequest,
  enqueueServiceRequest,
  writeServiceStatus,
} from "../../core/sidecars/runtime/service-bus.mjs";

export const DSDD_RUNTIME_SERVICE_ID = "dsdd";

function evidence(kind, summary) {
  return Object.freeze({ kind, summary, observedAt: new Date().toISOString() });
}

export function dsddRuntimeDescriptor() {
  const probe = normalizeDsddHeadlessContract({
    intentId: "runtime-self-check",
    humanIntent: "Load headless DSDD governance without a dedicated Human-facing workspace.",
    developerBrief: "Runtime self-check only; no repository or canon mutation.",
    requirements: [{ id: "runtime", text: "Governance module loads.", status: "UNPROVEN" }],
  });
  return Object.freeze({
    state: evaluateDsddConvergence(probe).state === "unproven" ? "ready" : "degraded",
    evidence: Object.freeze([
      evidence("governance-loaded", "Headless DSDD governance/convergence module is loaded."),
      evidence("authority", "DSDD remains convergence authority; Pi remains advisory and repository mutation authority is unchanged."),
      evidence("startup-side-effects", "Startup performs no model/provider request and no repository or canon mutation."),
    ]),
  });
}

export async function routeDsddRuntimeRequest(home, rawRequest) {
  const request = validateVerificationRequest(rawRequest);
  if (request.operation === "health") {
    return Object.freeze({
      requestId: request.requestId,
      state: "ready",
      evidence: dsddRuntimeDescriptor().evidence,
    });
  }
  if (request.operation !== "verify-contract") {
    return Object.freeze({
      requestId: request.requestId,
      state: "failed",
      evidence: [evidence("operation-rejected", "Headless DSDD accepts health or verify-contract requests only.")],
    });
  }
  if (!request.target) {
    return Object.freeze({
      requestId: request.requestId,
      state: "failed",
      evidence: [evidence("target-required", "A named deterministic browser journey is required.")],
    });
  }

  const contract = normalizeDsddHeadlessContract({
    intentId: request.requestId,
    humanIntent: "Execute the Human-approved named verification journey through the deterministic browser sidecar.",
    developerBrief: "Runtime-routed verification request.",
    affectedSurfaces: [request.target],
    requirements: [{
      id: "rendered-acceptance",
      text: `Named rendered journey ${request.target} must return deterministic evidence.`,
      status: "UNPROVEN",
      requiredEvidence: [`browser:${request.target}`],
    }],
  });
  const browserRequest = requestDsddVerificationJourney(contract, request.target);
  await enqueueServiceRequest(home, "browser-verification", browserRequest);
  return Object.freeze({
    requestId: request.requestId,
    state: "ready",
    evidence: [
      evidence("verification-routed", `Queued bounded browser journey ${request.target}.`),
      evidence("acceptance-authority", "Browser deterministic PASS/FAIL remains evidence; DSDD does not paint failures green."),
    ],
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

export async function runDsddRuntimeService({ home, signal = () => false } = {}) {
  if (!home) throw new Error("Headless DSDD runtime requires PlotPickle home.");
  const descriptor = dsddRuntimeDescriptor();
  await writeServiceStatus(home, DSDD_RUNTIME_SERVICE_ID, descriptor);
  process.stdout.write("[SIDECAR:DSDD] ready\n");

  while (!signal()) {
    const claimed = await claimServiceRequests(home, DSDD_RUNTIME_SERVICE_ID);
    for (const item of claimed) {
      let result;
      try {
        result = await routeDsddRuntimeRequest(home, item.request);
      } catch (error) {
        result = {
          requestId: String(item.request?.requestId || "invalid-request"),
          state: "failed",
          evidence: [evidence("request-error", error instanceof Error ? error.message : String(error))],
        };
      }
      await completeServiceRequest(home, DSDD_RUNTIME_SERVICE_ID, item, result);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

const direct = process.argv[1] && new URL(import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/u, "") === process.argv[1].replaceAll("\\", "/");
if (direct) {
  const args = parseArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runDsddRuntimeService({ home: args.home, signal: () => stopped }).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (args.home) await writeServiceStatus(args.home, DSDD_RUNTIME_SERVICE_ID, {
      state: "degraded",
      evidence: [evidence("startup-error", message)],
    }).catch(() => {});
    console.error(`[SIDECAR:DSDD] degraded: ${message}`);
  });
}
