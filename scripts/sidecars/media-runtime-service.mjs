#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { probeLiveMediaRuntime } from "../../core/media/live-media-runtime.ts";
import { claimServiceRequests, completeServiceRequest, writeServiceStatus } from "../../core/sidecars/runtime/service-bus.mjs";
import { parseSidecarArgs, publishSidecarStatus } from "./service-process.mjs";

const ID = "media-runtime";
const now = () => new Date().toISOString();
const evidence = (kind, summary) => ({ kind, summary, observedAt: now() });

export async function mediaRuntimeDescriptor(repositoryRoot = process.cwd()) {
  const runtime = await probeLiveMediaRuntime(repositoryRoot);
  return Object.freeze({
    state: runtime.state,
    evidence: Object.freeze([
      evidence("media-engine", `${runtime.primaryEngine}: ${runtime.capability.state} — ${runtime.capability.reason}`),
      evidence("fallback", `Built-in fallback remains available: ${runtime.fallbackModes.join(", ")}.`),
      evidence("install-policy", "Optional FFrames is capability-probed only and is never auto-installed at startup."),
      evidence("startup-side-effects", "Startup performs no render and no cloud/provider request."),
    ]),
  });
}

async function handleRequest(request, repositoryRoot) {
  const requestId = String(request?.requestId || "");
  if (!requestId) throw new Error("Media runtime requestId is required.");
  if (request.operation !== "health") {
    return { requestId, state: "failed", evidence: [evidence("operation-rejected", "Media runtime sidecar accepts health requests only; renders use the governed media-engine API boundary.")] };
  }
  const descriptor = await mediaRuntimeDescriptor(repositoryRoot);
  return { requestId, ...descriptor };
}

export async function runMediaRuntimeService({ home, repositoryRoot = process.cwd(), signal = () => false } = {}) {
  if (!home) throw new Error("Media Runtime requires PlotPickle home.");
  const descriptor = await mediaRuntimeDescriptor(repositoryRoot);
  await writeServiceStatus(home, ID, descriptor);
  publishSidecarStatus(descriptor);
  process.stdout.write(`[SIDECAR:MEDIA] ${descriptor.state}\n`);
  while (!signal()) {
    const claimed = await claimServiceRequests(home, ID);
    for (const item of claimed) {
      let result;
      try { result = await handleRequest(item.request, repositoryRoot); }
      catch (error) {
        result = { requestId: String(item.request?.requestId || "invalid"), state: "failed", evidence: [evidence("request-error", error instanceof Error ? error.message : String(error))] };
      }
      await completeServiceRequest(home, ID, item, result);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const direct = Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (direct) {
  const args = parseSidecarArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runMediaRuntimeService({ home: args.home, signal: () => stopped }).catch(async (error) => {
    const status = { state: "degraded", evidence: [evidence("startup-error", error instanceof Error ? error.message : String(error))] };
    publishSidecarStatus(status);
    if (args.home) await writeServiceStatus(args.home, ID, status).catch(() => {});
  });
}
