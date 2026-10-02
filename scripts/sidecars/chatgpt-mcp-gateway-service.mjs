#!/usr/bin/env node

import process from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CHATGPT_GATEWAY_AUTHORITY,
  assertNoPrivilegedGatewayCapability,
  minimalChatGptGatewayPrototype,
} from "../../core/sidecars/chatgpt-mcp-gateway-contract.mjs";
import { claimServiceRequests, completeServiceRequest, writeServiceStatus } from "../../core/sidecars/runtime/service-bus.mjs";
import { parseSidecarArgs, publishSidecarStatus } from "./service-process.mjs";

const ID = "chatgpt-mcp-gateway";
const now = () => new Date().toISOString();
const evidence = (kind, summary) => ({ kind, summary, observedAt: now() });

export function chatGptMcpGatewayRuntimeDescriptor() {
  const prototype = minimalChatGptGatewayPrototype();
  for (const tool of prototype.tools) assertNoPrivilegedGatewayCapability(tool.action);
  return Object.freeze({
    state: "ready",
    externalTransport: "disconnected",
    evidence: Object.freeze([
      evidence("mcp-contract", `${prototype.tools.length} read-only PlotPickle gateway tools are registered locally.`),
      evidence("mcp-transport", "External ChatGPT/MCP transport is disconnected until explicitly configured."),
      evidence("mcp-authority", `Canon mutation=${CHATGPT_GATEWAY_AUTHORITY.canonMutation}; repository mutation=${CHATGPT_GATEWAY_AUTHORITY.repositoryMutation}; merge authority=${CHATGPT_GATEWAY_AUTHORITY.mergeAuthority}.`),
      evidence("startup-side-effects", "Startup opens no tunnel, authentication flow, browser control, or provider request."),
    ]),
  });
}

async function handleRequest(request) {
  const requestId = String(request?.requestId || "");
  if (!requestId) throw new Error("MCP gateway runtime requestId is required.");
  if (request.operation === "health") return { requestId, ...chatGptMcpGatewayRuntimeDescriptor() };
  return {
    requestId,
    state: "failed",
    evidence: [evidence("operation-rejected", "Runtime sidecar accepts health only; governed read actions are exposed through the separate authenticated gateway contract.")],
  };
}

export async function runChatGptMcpGatewayRuntimeService({ home, signal = () => false } = {}) {
  if (!home) throw new Error("ChatGPT/MCP Gateway requires PlotPickle home.");
  const descriptor = chatGptMcpGatewayRuntimeDescriptor();
  await writeServiceStatus(home, ID, descriptor);
  publishSidecarStatus(descriptor);
  process.stdout.write("[SIDECAR:MCP] ready (external transport disconnected)\n");
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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

const direct = Boolean(process.argv[1]) && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (direct) {
  const args = parseSidecarArgs(process.argv.slice(2));
  let stopped = false;
  process.on("SIGINT", () => { stopped = true; });
  process.on("SIGTERM", () => { stopped = true; });
  runChatGptMcpGatewayRuntimeService({ home: args.home, signal: () => stopped }).catch(async (error) => {
    const status = { state: "degraded", evidence: [evidence("startup-error", error instanceof Error ? error.message : String(error))] };
    publishSidecarStatus(status);
    if (args.home) await writeServiceStatus(args.home, ID, status).catch(() => {});
  });
}
