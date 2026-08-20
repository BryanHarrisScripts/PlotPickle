import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  PLOTPICKLE_PEER_RESOURCE_ROUTING_ENABLED,
  createLocalDesktopPlotPickleNode,
  normalizePlotPickleNodeDescriptor,
  normalizePlotPickleNodeEndpoint,
  selectPlotPickleNode,
} from "../lib/plotpickle-node-topology-core.mjs";

const root = path.resolve(import.meta.dirname, "..");

function node(overrides = {}) {
  return normalizePlotPickleNodeDescriptor({ id: "node-a", label: "Node A", mode: "compute", trustScope: "lan", endpoint: "http://192.168.1.30:4173", enabled: true, readiness: "ready", capabilities: ["text"], hardware: null, ...overrides });
}

test("node endpoints keep local, LAN, and Internet transport scopes distinct", () => {
  assert.equal(normalizePlotPickleNodeEndpoint("http://127.0.0.1:4173", "local"), "http://127.0.0.1:4173");
  assert.equal(normalizePlotPickleNodeEndpoint("http://spark.local:4173", "lan"), "http://spark.local:4173");
  assert.equal(normalizePlotPickleNodeEndpoint("https://studio.example.com", "internet"), "https://studio.example.com");
  assert.throws(() => normalizePlotPickleNodeEndpoint("http://192.168.1.20:4173", "local"), /loopback/i);
  assert.throws(() => normalizePlotPickleNodeEndpoint("http://example.com", "lan"), /private\/local-network/i);
  assert.throws(() => normalizePlotPickleNodeEndpoint("http://studio.example.com", "internet"), /require HTTPS/i);
});

test("Community/LAN/Internet Nodes are never resource routes", () => {
  assert.equal(PLOTPICKLE_PEER_RESOURCE_ROUTING_ENABLED, false);
  const lan = node({ id: "lan-image", capabilities: ["image"] });
  const internet = normalizePlotPickleNodeDescriptor({ id: "internet-image", label: "Internet", mode: "compute", trustScope: "internet", endpoint: "https://studio.example.com", enabled: true, readiness: "ready", capabilities: ["image"], hardware: null });
  assert.equal(selectPlotPickleNode([lan], { capabilities: ["image"], allowedTrustScopes: ["lan"] }), null);
  assert.equal(selectPlotPickleNode([internet], { capabilities: ["image"], allowedTrustScopes: ["internet"], allowInternet: true }), null);
  assert.equal(selectPlotPickleNode([lan, internet], { capabilities: ["image"], allowedTrustScopes: ["local", "lan", "internet"], allowInternet: true }), null);
});

test("local capability routing remains available and truthful", () => {
  const local = normalizePlotPickleNodeDescriptor({ id: "local-text", label: "Local", mode: "desktop", trustScope: "local", endpoint: "http://127.0.0.1:4173", enabled: true, readiness: "ready", capabilities: ["text", "image"], hardware: null });
  const remote = node({ id: "lan-text", capabilities: ["text", "image"] });
  assert.equal(selectPlotPickleNode([remote, local], { capabilities: ["text"] })?.id, "local-text");
  assert.equal(selectPlotPickleNode([local], { capabilities: ["video"] }), null);
  const degraded = normalizePlotPickleNodeDescriptor({ ...local, id: "local-degraded", readiness: "degraded" });
  assert.equal(selectPlotPickleNode([degraded], { capabilities: ["text"] }), null);
  assert.equal(selectPlotPickleNode([degraded], { capabilities: ["text"], allowDegraded: true })?.id, "local-degraded");
});

test("the default desktop node reports local hardware without claiming unavailable media", () => {
  const desktop = createLocalDesktopPlotPickleNode({ endpoint: "http://localhost:4173", textReady: true, visionReady: false, retrievalReady: true, hardware: { platform: "win32", architecture: "x64", cpuModel: "Example CPU", ramGb: 32, gpuName: "Example GPU", gpuGeneration: "pascal", gpuMemoryGb: 8, memoryModel: "discrete" } });
  assert.equal(desktop.trustScope, "local");
  assert.deepEqual(desktop.capabilities, ["client", "host", "agents", "community", "text", "retrieval"]);
});

test("the topology gateway is local-only and explicitly separates Community presence from cloud/resource routing", () => {
  const gateway = fs.readFileSync(path.join(root, "build", "node-topology-gateway.ts"), "utf8");
  const architecture = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-NODE-TOPOLOGY.md"), "utf8");
  assert.match(gateway, /\/api\/system\/node-topology/);
  assert.match(gateway, /403/);
  assert.match(gateway, /peerNodeResourceRouting:\s*false/);
  assert.match(gateway, /cloudServicesUseSeparateRegistry:\s*true/);
  assert.match(gateway, /primaryObjects:\s*\["communities", "people", "rooms", "presence"\]/);
  assert.match(architecture, /Community presence is never compute eligibility/i);
  assert.match(architecture, /managed cloud/i);
});
