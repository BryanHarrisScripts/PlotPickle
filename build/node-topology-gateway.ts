import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { ViteDevServer } from "vite";
import { getAutonomousGuestAuthority } from "../core/auth/autonomous-guest/guest-authority";
import { resetProfileExperienceRuntime } from "../core/auth/profile-experience/profile-experience-runtime";
import { createPlotPickleNodeShutdownLifecycle } from "../core/runtime/plotpickle-node-control-core.mjs";
import { createLocalDesktopPlotPickleNode, type PlotPickleNodeHardwareSummary } from "../lib/runtime/plotpickle-node-topology";
import { persistentHome } from "./local-credentials";
import { localRuntimeSnapshot, stopManagedLlama } from "./local-runtime-manager";
import { createStudioIdentity, readPublicStudioIdentity } from "./studio-identity";

const NODE_TOPOLOGY_PATH = "/api/system/node-topology";
const NODE_CONTROL_PATH = "/api/system/node-control";
const NODE_CONTROL_HEADER = "x-plotpickle-node-control";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const LOOPBACK_PEERS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const lifecycle = createPlotPickleNodeShutdownLifecycle();
type NodeIdentity = Readonly<{ nodeId: string; shortId: string }>;
let identityPromise: Promise<NodeIdentity> | null = null;

function isLocalNodeRequest(request: IncomingMessage) {
  if (!LOOPBACK_PEERS.has(String(request.socket.remoteAddress || ""))) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const parsed = new URL(`http://${host}`);
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).origin === parsed.origin;
  } catch { return false; }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  }).end(JSON.stringify(body));
}

function requestOrigin(request: IncomingMessage) {
  return `http://${request.headers.host || "127.0.0.1:4173"}`;
}

async function boundedBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > 16 * 1024) throw new Error("PlotPickle Node control request is too large.");
    chunks.push(value);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> : {};
}

function autonomousAcceptanceNodeIdentity(origin: string): NodeIdentity | null {
  if (process.env.PLOTPICKLE_ACCEPTANCE_MODE !== "1") return null;
  const authority = getAutonomousGuestAuthority(origin, "desktop-loopback");
  if (!authority) return null;
  return Object.freeze({
    nodeId: authority.workspaceId,
    shortId: `AG-${authority.workspaceId.slice(-4).toUpperCase()}`,
  });
}

async function plotPickleNodeIdentity(origin: string) {
  const autonomous = autonomousAcceptanceNodeIdentity(origin);
  if (autonomous) return autonomous;
  if (!identityPromise) {
    identityPromise = (async () => {
      const existing = await readPublicStudioIdentity();
      const identity = existing.configured ? existing : await createStudioIdentity("Local");
      return Object.freeze({ nodeId: identity.studioId, shortId: `PP-${identity.shortCode}` });
    })().catch((error) => {
      identityPromise = null;
      throw error;
    });
  }
  return identityPromise;
}

function shutdownSignalPath() {
  const configured = process.env.PLOTPICKLE_SHUTDOWN_SIGNAL?.trim();
  return configured ? path.resolve(configured) : path.join(persistentHome(), "node", "runtime", "shutdown-request.json");
}

async function signalOwnedLauncher(identity: NodeIdentity) {
  const signal = shutdownSignalPath();
  await mkdir(path.dirname(signal), { recursive: true, mode: 0o700 });
  await writeFile(signal, `${JSON.stringify({
    format: "plotpickle-graceful-shutdown",
    version: 1,
    nodeId: identity.nodeId,
    requestedAt: new Date().toISOString(),
    closeOwnedBrowserOnly: true,
  }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return signal;
}

function publicNodeControlSnapshot(identity: NodeIdentity) {
  const browserState = process.env.PLOTPICKLE_BROWSER_STATE?.trim();
  return {
    ok: true,
    node: { id: identity.nodeId, shortId: identity.shortId },
    lifecycle: lifecycle.snapshot(),
    launcher: {
      shutdownSignalConfigured: Boolean(process.env.PLOTPICKLE_SHUTDOWN_SIGNAL?.trim()),
      browserOwnership: browserState && existsSync(path.resolve(browserState)) ? "managed-edge-app" : "unmanaged",
    },
  };
}

async function handleTopology(request: IncomingMessage, response: ServerResponse) {
  const [identity, runtime] = await Promise.all([plotPickleNodeIdentity(requestOrigin(request)), localRuntimeSnapshot()]);
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
    id: identity.nodeId,
    endpoint: requestOrigin(request),
    readiness: runtime.activeRuntime.reachable ? "ready" : "degraded",
    textReady: runtime.activeRuntime.reachable,
    visionReady: runtime.roles.vision.available,
    retrievalReady: true,
    hardware,
  });
  sendJson(response, 200, {
    ok: true,
    schemaVersion: 2,
    currentNode,
    registeredNodes: [],
    routingPolicy: {
      defaultTrustScopes: ["local"],
      peerNodeResourceRouting: false,
      communityPresenceCarriesCapabilities: false,
      cloudServicesUseSeparateRegistry: true,
      internetEgressAutomatic: false,
      internetNodesRequireHttps: true,
      privateLanDoesNotGrantTrust: true,
      directRuntimeExposureAllowed: false,
    },
    communityDiscovery: { source: "buzz", primaryObjects: ["communities", "people", "rooms", "presence"], nodeIdentityRole: "provenance-only" },
    hostedStudio: { state: "contract-only", message: "The host contract remains separate from Community peer compute. This local server stays loopback-only until identity, authorization and tenant isolation are implemented." },
  });
}

async function handleNodeControl(request: IncomingMessage, response: ServerResponse, server: ViteDevServer) {
  const identity = await plotPickleNodeIdentity(requestOrigin(request));
  if (request.method === "GET") { sendJson(response, 200, publicNodeControlSnapshot(identity)); return; }
  if (request.method !== "POST") { sendJson(response, 405, { ok: false, message: "Method not allowed." }); return; }
  if (request.headers[NODE_CONTROL_HEADER] !== "confirmed") {
    sendJson(response, 403, { ok: false, message: "Graceful shutdown requires an intentional same-origin confirmation." });
    return;
  }

  const input = await boundedBody(request);
  const action = String(input.action || "");
  if (action === "begin-shutdown") {
    const begun = lifecycle.begin();
    sendJson(response, 200, { ...publicNodeControlSnapshot(identity), shutdownToken: begun.token });
    return;
  }
  if (action === "block-shutdown") {
    lifecycle.block(String(input.shutdownToken || ""), String(input.message || "PlotPickle could not safely persist the current session."));
    sendJson(response, 200, publicNodeControlSnapshot(identity));
    return;
  }
  if (action !== "complete-shutdown") {
    sendJson(response, 400, { ok: false, message: "That PlotPickle Node control action is unavailable." });
    return;
  }

  lifecycle.commit(String(input.shutdownToken || ""));
  try {
    await resetProfileExperienceRuntime();
    await stopManagedLlama();
    const signal = await signalOwnedLauncher(identity);
    response.once("finish", () => {
      void server.close().finally(() => {
        lifecycle.stop();
        process.exit(0);
      });
    });
    sendJson(response, 202, { ...publicNodeControlSnapshot(identity), signal });
  } catch (error) {
    lifecycle.blockCommitted(error);
    sendJson(response, 500, { ...publicNodeControlSnapshot(identity), ok: false, message: error instanceof Error ? error.message : "PlotPickle could not stop its managed services." });
  }
}

export function registerPlotPickleNodeTopologyGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== NODE_TOPOLOGY_PATH && pathname !== NODE_CONTROL_PATH) { next(); return; }
    if (!isLocalNodeRequest(request)) {
      sendJson(response, 403, { ok: false, message: "PlotPickle Node diagnostics and lifecycle control are restricted to this local Node." });
      return;
    }
    void (pathname === NODE_TOPOLOGY_PATH
      ? (request.method === "GET" ? handleTopology(request, response) : Promise.resolve(sendJson(response, 405, { ok: false, message: "Method not allowed." })))
      : handleNodeControl(request, response, server))
      .catch((error) => {
        if (response.headersSent) return;
        sendJson(response, 500, { ok: false, message: error instanceof Error ? error.message : "PlotPickle Node control could not be completed." });
      });
  });
}
