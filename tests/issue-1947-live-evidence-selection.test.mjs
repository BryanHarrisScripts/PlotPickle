import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { planVerification } from "../lib/verification/verification-core.mjs";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");
const readJson = async (relative) => JSON.parse(await read(relative));

async function configuration() {
  const [architecture, phase0Inventory, vocabulary, catalog, ownership] = await Promise.all([
    readJson("architecture/plotpickle.architecture.json"),
    readJson("config/verification/phase-0-inventory.json"),
    readJson("config/verification/phase-1-vocabulary.json"),
    readJson("config/verification/test-catalog.json"),
    readJson("config/verification/ownership-map.json"),
  ]);
  return { architecture, phase0Inventory, vocabulary, catalog, ownership };
}

function selectedIds(plan, layerId) {
  return plan.layers.find((layer) => layer.layerId === layerId)?.selectedTests.map((entry) => entry.id) ?? [];
}

function skipped(plan, layerId, id) {
  return plan.layers.find((layer) => layer.layerId === layerId)?.skippedTests.find((entry) => entry.id === id) ?? null;
}

test("#1947 registers one live WebMCP observer with a single architecture owner", async () => {
  const catalog = await readJson("config/verification/test-catalog.json");
  const entry = catalog.entries.find((candidate) => candidate.id === "experience.webmcp-live-observer");
  assert.ok(entry);
  assert.equal(entry.ownerLayer, "experience-skins");
  assert.equal(entry.runner.kind, "browser-uat");
  assert.deepEqual(entry.runner.targets, ["scripts/verification-webmcp-live.mjs"]);
  assert.deepEqual(entry.modes, ["impact"]);
  assert.equal(entry.cost, "medium");
  assert.deepEqual(entry.platforms, ["linux"]);
  assert.deepEqual(entry.requirements, { network: true, native: false, secrets: false });
  for (const token of ["mcp", "navigation", "skin", "surface", "visual"]) assert.ok(entry.triggerTokens.includes(token));
  assert.ok(entry.evidence.artifactPaths.includes(".artifacts/webmcp-startup/summary.json"));
  assert.ok(entry.evidence.artifactPaths.includes(".artifacts/visual-readiness/dashboard-canonical.png"));
});

test("#1947 Skin changes deterministically select live rendered WebMCP evidence", async () => {
  const config = await configuration();
  const plan = planVerification({
    ...config,
    changedFiles: ["app/skin-v1/skin-v1-client.tsx"],
    mode: "impact",
    platform: "linux",
    allowNetwork: true,
  });
  assert.equal(plan.status, "ready");
  assert.ok(plan.impactedLayers.includes("experience-skins"));
  assert.ok(selectedIds(plan, "experience-skins").includes("experience.webmcp-live-observer"));
  const selected = plan.layers.find((layer) => layer.layerId === "experience-skins").selectedTests.find((entry) => entry.id === "experience.webmcp-live-observer");
  assert.ok(selected.reasons.some((reason) => reason.kind === "risk-token" && reason.value === "mcp"));
  assert.ok(selected.reasons.some((reason) => reason.kind === "risk-token" && reason.value === "visual"));
});

test("#1947 Experience surface changes trigger the single-owned Layer 1 observer without duplicating ownership", async () => {
  const config = await configuration();
  const plan = planVerification({
    ...config,
    changedFiles: ["lib/experience/surface-registry.ts"],
    mode: "impact",
    platform: "linux",
    allowNetwork: true,
  });
  assert.equal(plan.status, "ready");
  assert.ok(plan.impactedLayers.includes("experience-contract"));
  assert.equal(plan.impactedLayers.includes("experience-skins"), false);
  assert.ok(selectedIds(plan, "experience-skins").includes("experience.webmcp-live-observer"));
  assert.equal(selectedIds(plan, "experience-contract").includes("experience.webmcp-live-observer"), false);
});

test("#1947 live evidence remains permission-gated and docs-only changes stay cheap", async () => {
  const config = await configuration();
  const denied = planVerification({
    ...config,
    changedFiles: ["lib/experience/surface-registry.ts"],
    mode: "impact",
    platform: "linux",
    allowNetwork: false,
  });
  assert.equal(skipped(denied, "experience-skins", "experience.webmcp-live-observer")?.reasonCode, "network-not-authorized");

  const docs = planVerification({
    ...config,
    changedFiles: ["docs/developer-briefs/1947-phase-5-live-evidence.md"],
    mode: "impact",
    platform: "linux",
    allowNetwork: true,
  });
  assert.equal(selectedIds(docs, "experience-skins").includes("experience.webmcp-live-observer"), false);
});

test("#1947 WebMCP verifier changes select their own live observer evidence", async () => {
  const config = await configuration();
  const plan = planVerification({
    ...config,
    changedFiles: ["scripts/verification-webmcp-live.mjs"],
    mode: "impact",
    platform: "linux",
    allowNetwork: true,
  });
  assert.equal(plan.status, "ready");
  assert.ok(plan.impactedLayers.includes("verification"));
  assert.ok(plan.riskTokens.includes("mcp"));
  assert.ok(selectedIds(plan, "experience-skins").includes("experience.webmcp-live-observer"));
});

test("#1947 architecture shadow authorizes verification-tool network only for Layer 1", async () => {
  const workflow = await read(".github/workflows/architecture-shadow.yml");
  assert.match(workflow, /name: Layer 1 Experience Skins\s+allow_network: true/u);
  for (const name of [
    "Layer 2 Experience Contract",
    "Layer 3 Production Orchestration",
    "Layer 4 Agent & Skill Mesh",
    "Layer 5 Story / Canon / Evidence",
    "Layer 6 Provider Runtime",
    "Layer 7 Validation & Operations",
  ]) {
    assert.match(workflow, new RegExp(`name: ${name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s+allow_network: false`, "u"));
  }
  assert.match(workflow, /--allow-network "\$\{\{ matrix\.allow_network \}\}"/u);
  assert.match(workflow, /\.artifacts\/webmcp-startup\/summary\.json/u);
  assert.match(workflow, /\.artifacts\/visual-readiness\/\*\.png/u);
});

test("#1947 browser-UAT runner is bounded, read-only and repair-free", async () => {
  const [shadow, live, startup, policy] = await Promise.all([
    read("scripts/verification-shadow.mjs"),
    read("scripts/verification-webmcp-live.mjs"),
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("lib/verification/webmcp-uat-skills.mjs"),
  ]);
  assert.match(shadow, /"browser-uat"/u);
  assert.match(shadow, /target\.startsWith\("scripts\/"\)/u);
  assert.match(shadow, /allowNetwork/u);
  assert.match(live, /read-only-observer/u);
  assert.match(live, /externalProviderCalls: false/u);
  assert.match(live, /secretsAccessed: false/u);
  assert.match(live, /run-webmcp-startup-uat\.mjs/u);
  assert.doesNotMatch(live, /--repair/u);
  assert.match(startup, /WEBMCP_UAT_SKILL_POLICY/u);
  assert.match(policy, /WEBMCP_FORBIDDEN_CAPABILITIES/u);
  assert.match(policy, /mayFixCode: false/u);
  assert.match(policy, /mayMutateCanon: false/u);
  assert.match(policy, /mayInvokeProviders: false/u);
});
