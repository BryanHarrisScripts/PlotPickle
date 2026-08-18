import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { createLocalDesktopPlotPickleNode, type PlotPickleNodeHardwareSummary } from "../lib/plotpickle-node-topology";
import { localRuntimeSnapshot } from "./local-runtime-manager";

const NODE_TOPOLOGY_PATH = "/api/system/node-topology";

function isLoopbackAddress(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalTopologyRequest(request: IncomingMessage) {
  if (!isLoopbackAddress(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendTopologyJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function requestOrigin(request: IncomingMessage) {
  return `http://${request.headers.host || "127.0.0.1:4173"}`;
}

export function registerPlotPickleNodeTopologyGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== NODE_TOPOLOGY_PATH) {
      next();
      return;
    }
    if (!isLocalTopologyRequest(request)) {
      sendTopologyJson(response, 403, {
        ok: false,
        message: "PlotPickle node topology diagnostics are restricted to this local Studio until hosted authentication and tenant isolation are implemented.",
      });
      return;
    }
    if (request.method !== "GET") {
      sendTopologyJson(response, 405, { ok: false, message: "Method not allowed." });
      return;
    }

    void (async () => {
      const runtime = await localRuntimeSnapshot();
      const hardware: PlotPickleNodeHardwareSummary = {
        platform: process.platform,
        architecture: process.arch,
        cpuModel: runtime.hardware.cpuModel,
        ramGb: runtime.hardware.ramGb,
        gpuName: runtime.hardware.gpuName,
        gpuGeneration: runtime.hardware.gpuGeneration,
        gpuMemoryGb: runtime.hardware.vramGb,
        memoryModel: runtime.hardware.gpuName && runtime.hardware.vramGb > 0 ? "discrete" : "system",
      };
      const currentNode = createLocalDesktopPlotPickleNode({
        endpoint: requestOrigin(request),
        textReady: runtime.activeRuntime.reachable,
        visionReady: runtime.roles.vision.available,
        retrievalReady: true,
        hardware,
      });

      sendTopologyJson(response, 200, {
        ok: true,
        schemaVersion: 1,
        currentNode,
        registeredNodes: [],
        routingPolicy: {
          defaultTrustScopes: ["local", "lan"],
          internetEgressAutomatic: false,
          internetNodesRequireHttps: true,
          privateLanDoesNotGrantTrust: true,
          directRuntimeExposureAllowed: false,
        },
        hostedStudio: {
          state: "contract-only",
          message: "The node contract supports a future authenticated HTTPS Studio host, but this local server remains loopback-only until identity, authorization and tenant isolation are implemented.",
        },
      });
    })().catch((error) => {
      sendTopologyJson(response, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "PlotPickle node topology could not be inspected.",
      });
    });
  });
}
