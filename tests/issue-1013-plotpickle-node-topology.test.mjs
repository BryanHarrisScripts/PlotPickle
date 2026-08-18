import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createLocalDesktopPlotPickleNode,
  normalizePlotPickleNodeDescriptor,
  normalizePlotPickleNodeEndpoint,
  selectPlotPickleNode,
} from "../lib/plotpickle-node-topology-core.mjs";

const root = path.resolve(import.meta.dirname, "..");

function node(overrides = {}) {
  return normalizePlotPickleNodeDescriptor({
    id: "node-a",
    label: "Node A",
    mode: "compute",
    trustScope: "lan",
    endpoint: "http://192.168.1.30:4173",
    enabled: true,
    readiness: "ready",
    capabilities: ["text"],
    hardware: null,
    ...overrides,
  });
}

test("node endpoints keep local, LAN, and Internet scopes distinct", () => {
  assert.equal(normalizePlotPickleNodeEndpoint("http://127.0.0.1:4173", "local"), "http://127.0.0.1:4173");
  assert.equal(normalizePlotPickleNodeEndpoint("http://spark.local:4173", "lan"), "http://spark.local:4173");
  assert.equal(normalizePlotPickleNodeEndpoint("http://192.168.10.20:4173", "lan"), "http://192.168.10.20:4173");
  assert.equal(normalizePlotPickleNodeEndpoint("https://studio.example.com", "internet"), "https://studio.example.com");

  assert.throws(() => normalizePlotPickleNodeEndpoint("http://192.168.1.20:4173", "local"), /loopback/i);
  assert.throws(() => normalizePlotPickleNodeEndpoint("http://example.com", "lan"), /private\/local-network/i);
  assert.throws(() => normalizePlotPickleNodeEndpoint("http://studio.example.com", "internet"), /require HTTPS/i);
  assert.throws(() => normalizePlotPickleNodeEndpoint("https://user:secret@studio.example.com", "internet"), /credentials/i);
  assert.throws(() => normalizePlotPickleNodeEndpoint("https://studio.example.com/internal", "internet"), /origin only/i);
});

test("private LAN placement never becomes implicit local trust", () => {
  const lan = node({ id: "lan-text", capabilities: ["text", "image"] });
  const local = normalizePlotPickleNodeDescriptor({
    id: "local-text",
    label: "Local",
    mode: "desktop",
    trustScope: "local",
    endpoint: "http://127.0.0.1:4173",
    enabled: true,
    readiness: "ready",
    capabilities: ["text"],
    hardware: null,
  });

  assert.equal(selectPlotPickleNode([lan, local], { capabilities: ["text"], allowedTrustScopes: ["local"] })?.id, "local-text");
  assert.equal(selectPlotPickleNode([lan], { capabilities: ["text"], allowedTrustScopes: ["local"] }), null);
  assert.equal(selectPlotPickleNode([lan], { capabilities: ["text"], allowedTrustScopes: ["lan"] })?.id, "lan-text");
});

test("routing requires every requested capability and never adds Internet egress silently", () => {
  const localText = normalizePlotPickleNodeDescriptor({
    id: "local-text",
    label: "Local text",
    mode: "desktop",
    trustScope: "local",
    endpoint: "http://127.0.0.1:4173",
    enabled: true,
    readiness: "ready",
    capabilities: ["text"],
    hardware: null,
  });
  const lanMedia = node({ id: "lan-media", capabilities: ["text", "image", "video"] });
  const internetMedia = normalizePlotPickleNodeDescriptor({
    id: "internet-media",
    label: "Hosted media",
    mode: "hybrid",
    trustScope: "internet",
    endpoint: "https://studio.example.com",
    enabled: true,
    readiness: "ready",
    capabilities: ["text", "image", "video"],
    hardware: null,
  });

  assert.equal(selectPlotPickleNode([localText, lanMedia, internetMedia], { capabilities: ["text"] })?.id, "local-text");
  assert.equal(selectPlotPickleNode([localText, lanMedia, internetMedia], { capabilities: ["image", "video"] })?.id, "lan-media");
  assert.equal(selectPlotPickleNode([internetMedia], { capabilities: ["image"], allowedTrustScopes: ["internet"] }), null);
  assert.equal(selectPlotPickleNode([internetMedia], { capabilities: ["image"], allowedTrustScopes: ["internet"], allowInternet: true })?.id, "internet-media");
  assert.equal(selectPlotPickleNode([localText], { capabilities: ["text", "vision"] }), null);
});

test("disabled, offline, and degraded nodes do not become compute routes by default", () => {
  const disabled = node({ id: "disabled", enabled: false });
  const offline = node({ id: "offline", readiness: "offline" });
  const degraded = node({ id: "degraded", readiness: "degraded" });
  assert.equal(selectPlotPickleNode([disabled, offline, degraded], { capabilities: ["text"] }), null);
  assert.equal(selectPlotPickleNode([degraded], { capabilities: ["text"], allowDegraded: true })?.id, "degraded");
});

test("the default desktop node reports hardware per node without claiming unavailable media compute", () => {
  const desktop = createLocalDesktopPlotPickleNode({
    endpoint: "http://localhost:4173",
    textReady: true,
    visionReady: false,
    retrievalReady: true,
    hardware: {
      platform: "win32",
      architecture: "x64",
      cpuModel: "Example CPU",
      ramGb: 32,
      gpuName: "Example GPU",
      gpuGeneration: "pascal",
      gpuMemoryGb: 8,
      memoryModel: "discrete",
    },
  });
  assert.equal(desktop.mode, "desktop");
  assert.equal(desktop.trustScope, "local");
  assert.deepEqual(desktop.capabilities, ["client", "host", "agents", "community", "text", "retrieval"]);
  assert.equal(desktop.hardware.memoryModel, "discrete");
});

test("the node-topology gateway is local-only and does not expose raw runtimes", () => {
  const gateway = fs.readFileSync(path.join(root, "build", "node-topology-gateway.ts"), "utf8");
  const registry = fs.readFileSync(path.join(root, "build", "local-ai-gateway.ts"), "utf8");
  const architecture = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-NODE-TOPOLOGY.md"), "utf8");

  assert.match(gateway, /\/api\/system\/node-topology/);
  assert.match(gateway, /isLocalTopologyRequest/);
  assert.match(gateway, /403/);
  assert.match(gateway, /internetEgressAutomatic:\s*false/);
  assert.match(gateway, /directRuntimeExposureAllowed:\s*false/);
  assert.match(gateway, /hostedStudio:[\s\S]*state:\s*"contract-only"/);
  assert.match(registry, /registerPlotPickleNodeTopologyGateway/);
  assert.match(architecture, /does not receive direct network access to ComfyUI, Ollama, llama\.cpp/);
  assert.match(architecture, /Compute supplies capability, not authority/);
});
