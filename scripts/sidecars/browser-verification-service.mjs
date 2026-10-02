#!/usr/bin/env node

import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseSidecarArgs, publishSidecarStatus } from "./service-process.mjs";
import { fileURLToPath } from "node:url";
import { WEBMCP_ACCEPTANCE_JOURNEYS, normalizeWebMcpAcceptanceRequest, runWebMcpAcceptanceJourney } from "../../core/sidecars/webmcp-acceptance-sidecar.mjs";
import { validateVerificationRequest } from "../../core/sidecars/contract.ts";
import {
  claimServiceRequests,
  completeServiceRequest,
  writeServiceStatus,
} from "../../core/sidecars/runtime/service-bus.mjs";

export const BROWSER_VERIFICATION_RUNTIME_SERVICE_ID = "browser-verification";

function evidence(kind, summary) {
  return Object.freeze({ kind, summary, observedAt: new Date().toISOString() });
}

export function browserVerificationRuntimeDescriptor() {
  return Object.freeze({
    state: "ready",
    evidence: Object.freeze([
      evidence("broker-loaded", `Browser Verification broker loaded with ${Object.keys(WEBMCP_ACCEPTANCE_JOURNEYS).length} named journey(s).`),
      evidence("execution-policy", "Playwright/browser execution is lazy and begins only for a bounded named rendered-acceptance request."),
      evidence("profile-isolation", "Runtime verification uses a synthetic browser state, never the Human browser profile."),
      evidence("startup-side-effects", "Startup launches no browser journey, Full QA profile, or provider/model request."),
    ]),
  });
}

async function exists(file) {
  return access(file).then(() => true, () => false);
}

export async function executeBrowserRuntimeRequest({
  home,
  server,
  rawRequest,
  toolRoot,
  runner = runWebMcpAcceptanceJourney,
}) {
  const request = validateVerificationRequest(rawRequest);
  if (request.operation === "health") {
    return Object.freeze({ requestId: request.requestId, state: "ready", evidence: browserVerificationRuntimeDescriptor().evidence });
  }
  if (request.operation !== "rendered-acceptance") {
    return Object.freeze({
      requestId: request.requestId,
      state: "failed",
      evidence: [evidence("operation-rejected", "Browser Verification accepts health or rendered-acceptance requests only.")],
    });
  }

  const normalized = normalizeWebMcpAcceptanceRequest(request);
  const resolvedToolRoot = path.resolve(toolRoot || path.join(home, "verification-tools", "webmcp-surface-uat"));
  const packageManifest = path.join(resolvedToolRoot, "package.json");
  if (!await exists(packageManifest)) {
    return Object.freeze({
      requestId: normalized.requestId,
      state: "unavailable",
      evidence: [evidence("tooling-unavailable", "Pinned browser verification tooling is not installed; normal PlotPickle remains unaffected.")],
    });
  }

  const syntheticHome = path.join(home, "full-verification", "runtime-sidecar");
  const storageStatePath = path.join(syntheticHome, "verification-browser", "storage-state.json");
  await mkdir(path.dirname(storageStatePath), { recursive: true });
  if (!await exists(storageStatePath)) {
    return Object.freeze({
      requestId: normalized.requestId,
      state: "unavailable",
      evidence: [evidence("synthetic-profile-unprepared", "Synthetic verification browser state is not prepared; Human profile reuse is forbidden.")],
    });
  }

  const result = await runner({
    request: normalized,
    serverUrl: server,
    toolRoot: resolvedToolRoot,
    storageStatePath,
    artifactRoot: path.join(home, "node", "runtime", "sidecars", "browser-evidence"),
  });
  return Object.freeze({
    requestId: normalized.requestId,
    state: result.status === "PASS" ? "ready" : "failed",
    evidence: [
      evidence("rendered-acceptance", `${normalized.target}: ${result.status}`),
      evidence("artifact", result.reportPath),
    ],
  });
}

export async function runBrowserVerificationRuntimeService({ home, server, toolRoot, signal = () => false } = {}) {
  if (!home || !server) throw new Error("Browser Verification runtime requires PlotPickle home and server URL.");
  const descriptor = browserVerificationRuntimeDescriptor();
  await writeServiceStatus(home, BROWSER_VERIFICATION_RUNTIME_SERVICE_ID, descriptor);
  publishSidecarStatus(descriptor);
  process.stdout.write("[SIDECAR:WEBMCP] ready (browser execution lazy)\n");

  while (!signal()) {
    const claimed = await claimServiceRequests(home, BROWSER_VERIFICATION_RUNTIME_SERVICE_ID);
    for (const item of claimed) {
      let result;
      try {
        result = await executeBrowserRuntimeRequest({ home, server, toolRoot, rawRequest: item.request });
      } catch (error) {
        result = {
          requestId: String(item.request?.requestId || "invalid-request"),
          state: "failed",
          evidence: [evidence("request-error", error instanceof Error ? error.message : String(error))],
        };
      }
      await completeServiceRequest(home, BROWSER_VERIFICATION_RUNTIME_SERVICE_ID, item, result);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

const direct = Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (direct) {
  const args = parseSidecarArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runBrowserVerificationRuntimeService({
    home: args.home,
    server: args.server,
    toolRoot: process.env.PLOTPICKLE_WEBMCP_TOOL_ROOT || "",
    signal: () => stopped,
  }).catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    const status = { state: "degraded", evidence: [evidence("startup-error", message)] };
    publishSidecarStatus(status);
    if (args.home) await writeServiceStatus(args.home, BROWSER_VERIFICATION_RUNTIME_SERVICE_ID, status).catch(() => {});
    console.error(`[SIDECAR:WEBMCP] degraded: ${message}`);
  });
}
