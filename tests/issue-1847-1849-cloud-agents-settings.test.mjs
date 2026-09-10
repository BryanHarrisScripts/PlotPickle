import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("#1847 Cloud Story Mode exposes only real resources and capability-driven tasks", async () => {
  const [cloud, catalog] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/settings/compute/cloud-model-catalog-panel.tsx"),
  ]);

  for (const label of ["WRITING", "IMAGES", "VIDEO", "AGENTS"]) {
    assert.match(cloud, new RegExp(`label: "${label}"`, "u"));
  }
  for (const label of ["OPENAI", "MINIMAX", "GOOGLE GEMINI"]) {
    assert.match(cloud, new RegExp(`label: "${label}"`, "u"));
  }
  assert.doesNotMatch(cloud, /Remote Compute|PlannedRemoteCompute|id: "remote"/u);
  assert.doesNotMatch(cloud, /Sora|sora/u);
  assert.match(cloud, /<CloudModelCatalogPanel capability=\{task\}/u);
  assert.match(cloud, /view === "writing" \|\| view === "agents" \? "text"/u);

  assert.match(catalog, /capabilities: \["writing", "images", "agents"\]/u);
  assert.match(catalog, /capabilities: \["writing", "images", "video", "agents"\]/u);
  assert.match(catalog, /capability === "agents" \? "writing" : capability/u);
  assert.match(catalog, /PROVIDERS\.filter\(\(provider\) => provider\.capabilities\.includes\(capability\)\)/u);
});

test("#1848 PlotPickle Agent compute has default, per-Agent override and no silent fallback", async () => {
  const [host, store, gateway, writing, localGateway] = await Promise.all([
    read("app/skin-v1/plotpickle-agents-host.tsx"),
    read("build/agent-compute-store.ts"),
    read("build/agent-compute-gateway.ts"),
    read("build/writing-assistant-gateway.ts"),
    read("build/local-ai-gateway.ts"),
  ]);

  assert.match(host, /DEFAULT COMPUTE/u);
  assert.match(host, /PER-AGENT OVERRIDES/u);
  assert.match(host, /Use PlotPickle default/u);
  assert.match(host, /Local Story Mode and Cloud Story Mode supply/u);
  assert.match(host, /BUZZ identity, rooms, presence, keys, provider and model settings remain in BUZZ/u);

  assert.match(store, /defaultProvider: "active"/u);
  assert.match(store, /overrides: Record<string, TextProvider>/u);
  assert.match(store, /resolveAgentComputeProvider/u);
  assert.match(gateway, /profile\.execution\.kind === "embedded-mastra"/u);
  assert.match(gateway, /BUZZ-managed Agents are configured in BUZZ/u);
  assert.match(gateway, /requireReadyProvider/u);
  assert.match(localGateway, /registerAgentComputeGateway\(server\)/u);

  assert.match(writing, /readAgentComputeStore/u);
  assert.match(writing, /resolveAgentComputeProvider/u);
  assert.match(writing, /Update Settings \/ Agents; no fallback provider was used/u);
  assert.match(writing, /computeSource: assigned\.source/u);
});

test("#1849 Skin V1 Settings is a Dashboard-styled keyboard directory", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");

  for (const [id, shortcut] of Object.entries({
    general: "G",
    appearance: "A",
    "project-defaults": "P",
    cloud: "C",
    data: "D",
    deploy: "E",
    repos: "R",
    auth: "U",
    agents: "N",
    "open-source": "O",
  })) {
    const sourceKey = id.includes("-") ? JSON.stringify(id) : id;
    assert.match(dashboard, new RegExp(`${sourceKey}: "${shortcut}"`, "u"));
  }

  assert.match(dashboard, /data-settings-menu="keyboard-directory"/u);
  assert.match(dashboard, /CONNECTED_SETTINGS_ITEMS = new Set\(\["cloud", "agents"\]\)/u);
  assert.doesNotMatch(dashboard, /\sdisabled=\{!connected\}/u);
  assert.match(dashboard, /event\.key === "ArrowDown"/u);
  assert.match(dashboard, /event\.key === "ArrowUp"/u);
  assert.match(dashboard, /event\.key === "Enter" \|\| event\.key === " "/u);
  assert.match(dashboard, /event\.key === "Escape"/u);
  assert.match(dashboard, /data-settings-shortcut=\{item\.shortcut\}/u);
  assert.match(dashboard, /pp-skin-v1-dashboard pp-skin-v1-dashboard-bbs/u);
  assert.match(dashboard, /PlotPickleAgentsHost/u);
});

test("#1852 Agent Setup shows the complete system-sorted roster and edits only PlotPickle-owned LLM routes", async () => {
  const [host, gateway, baseProfiles, communityProfiles, developerStack] = await Promise.all([
    read("app/skin-v1/plotpickle-agents-host.tsx"),
    read("build/agent-compute-gateway.ts"),
    readJson("config/agent-profiles.json"),
    readJson("config/agent-profile-extensions/community.json"),
    readJson("config/developer-agent-stack.json"),
  ]);

  assert.deepEqual(developerStack.requiredAgents.map((agent) => agent.label), ["Pi", "Cline"]);
  assert.equal(baseProfiles.profiles.length + communityProfiles.profiles.length + developerStack.requiredAgents.length, 22);

  assert.match(gateway, /SYSTEM_ORDER = \["PlotPickle", "BUZZ", "External Developer"\]/u);
  assert.match(gateway, /AGENT_PROFILES\.map\(\(profile\) =>/u);
  assert.match(gateway, /developerAgentStack\.requiredAgents\.map\(\(agent\) =>/u);
  assert.match(gateway, /profile\.execution\.kind === "embedded-mastra" && supportedRoles\.has\(profile\.execution\.roleId\)/u);
  assert.match(gateway, /roleId: configurable \? profile\.execution\.roleId : null/u);
  assert.match(gateway, /systemDelta \|\| left\.displayName\.localeCompare\(right\.displayName\)/u);

  for (const label of [
    "Managed in BUZZ",
    "No LLM — deterministic",
    "Local UAT runtime",
    "External developer handoff",
    "External developer config",
  ]) {
    assert.match(gateway, new RegExp(label, "u"));
  }

  assert.match(host, /data-agent-roster="complete"/u);
  for (const heading of ["Agent Name", "Job", "Provider", "System"]) {
    assert.match(host, new RegExp(`>${heading}<`, "u"));
  }
  assert.match(host, /agent\.configurable && roleId \? \(/u);
  assert.match(host, /agent\.providerLabel/u);
  assert.match(host, /data-agent-configurable=\{agent\.configurable \? "true" : "false"\}/u);
  assert.ok(host.includes('aria-label={`${agent.displayName} provider`}'));

  assert.ok(baseProfiles.profiles.some((profile) => profile.execution.kind === "buzz-managed"));
  assert.ok(baseProfiles.profiles.some((profile) => profile.execution.kind === "deterministic-observer"));
  assert.ok(baseProfiles.profiles.some((profile) => profile.execution.kind === "repository-handoff"));
  assert.ok(communityProfiles.profiles.every((profile) => profile.execution.kind === "buzz-managed"));
});
