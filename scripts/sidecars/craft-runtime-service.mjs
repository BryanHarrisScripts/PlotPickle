#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LIVE_CRAFT_RUNTIME, liveCraftRoute } from "../../core/learning/live-craft-runtime.ts";
import { PILOT_CRAFT_CAPABILITIES } from "../../core/learning/pilot-craft-capabilities.ts";
import { claimServiceRequests, completeServiceRequest, writeServiceStatus } from "../../core/sidecars/runtime/service-bus.mjs";
import { parseSidecarArgs, publishSidecarStatus } from "./service-process.mjs";

const ID = "craft-runtime";
const now = () => new Date().toISOString();
const evidence = (kind, summary) => ({ kind, summary, observedAt: now() });

export function craftRuntimeDescriptor() {
  const route = liveCraftRoute({ mode: "learn", context: ["theme", "character", "dialogue"] });
  return Object.freeze({
    state: route.primary && route.supporting.length <= 2 ? "ready" : "degraded",
    evidence: Object.freeze([
      evidence("craft-capabilities", `${PILOT_CRAFT_CAPABILITIES.length} governed pilot craft capabilities are registered.`),
      evidence("craft-routing", `Primary ${route.primary?.id || "baseline-learn"} with ${route.supporting.length} supporting capability(ies).`),
      evidence("craft-authority", "Craft runtime is advisory/proposal-only; canonical mutation remains forbidden."),
      evidence("startup-side-effects", "Startup performs no model/provider request."),
    ]),
  });
}

async function handleRequest(request) {
  const requestId = String(request?.requestId || "");
  if (!requestId) throw new Error("Craft runtime requestId is required.");
  if (request.operation === "health") {
    return { requestId, state: "ready", evidence: craftRuntimeDescriptor().evidence };
  }
  return {
    requestId,
    state: "failed",
    evidence: [evidence("operation-rejected", "Craft runtime startup service accepts health requests only; Learn/Ask Agent invokes the in-process governed router.")],
  };
}

export async function runCraftRuntimeService({ home, signal = () => false } = {}) {
  if (!home) throw new Error("Craft Runtime requires PlotPickle home.");
  const descriptor = craftRuntimeDescriptor();
  await writeServiceStatus(home, ID, descriptor);
  publishSidecarStatus(descriptor);
  process.stdout.write("[SIDECAR:CRAFT] ready\n");
  while (!signal()) {
    const claimed = await claimServiceRequests(home, ID);
    for (const item of claimed) {
      let result;
      try { result = await handleRequest(item.request); }
      catch (error) {
        result = { requestId: String(item.request?.requestId || "invalid"), state: "failed", evidence: [evidence("request-error", error instanceof Error ? error.message : String(error))] };
      }
      await completeServiceRequest(home, ID, item, result);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

const direct = Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (direct) {
  const args = parseSidecarArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runCraftRuntimeService({ home: args.home, signal: () => stopped }).catch(async (error) => {
    const status = { state: "degraded", evidence: [evidence("startup-error", error instanceof Error ? error.message : String(error))] };
    publishSidecarStatus(status);
    if (args.home) await writeServiceStatus(args.home, ID, status).catch(() => {});
  });
}
