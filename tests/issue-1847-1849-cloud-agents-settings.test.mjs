import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("#1847 Cloud Story Mode exposes only real resources and capability-driven tasks", async () => {
  const [cloud, shared] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/story-mode-capability-connections.tsx"),
  ]);

  for (const label of ["Writing", "Images", "Video", "Agents"]) {
    assert.match(cloud, new RegExp(`${label.toLowerCase()}: "${label}"`, "u"));
  }
  for (const label of ["OpenAI", "ComfyUI Cloud", "Gemini", "MiniMax"]) {
    assert.ok(cloud.includes(`"${label}"`), `Cloud Story Mode should expose ${label}`);
  }
  assert.match(cloud, /group: "CAPABILITIES"/u);
  assert.match(cloud, /group: "CONNECTIONS"/u);
  assert.match(cloud, /<StoryModeCapabilityConnections/u);
  assert.doesNotMatch(cloud, /<CloudModelCatalogPanel/u);
  assert.doesNotMatch(cloud, /<AiRoutingPanel/u);
  assert.doesNotMatch(cloud, /Remote Compute|PlannedRemoteCompute|id: "remote"/u);
  assert.doesNotMatch(cloud, /Sora|sora/u);
  assert.doesNotMatch(shared, /data-cloud-capability-consent/u);
  assert.match(cloud, /ProviderConsentSetup/u);
});

test("#1848 PlotPickle text Agents follow Hybrid without duplicate provider selectors or silent fallback", async () => {
  const [host, gateway, writing, localGateway] = await Promise.all([
    read("app/skin-v1/plotpickle-agents-host.tsx"), read("build/agent-compute-gateway.ts"),
    read("build/writing-assistant-gateway.ts"), read("build/local-ai-gateway.ts"),
  ]);
  assert.match(host, /WRITING COMPUTE/u);
  assert.match(host, /Hybrid Writing selection/u);
  assert.doesNotMatch(host, /<select|PER-AGENT OVERRIDES|method: "POST"/u);
  assert.match(host, /BUZZ identity, rooms, presence, keys, provider and model settings remain in BUZZ/u);
  assert.match(gateway, /profile\.execution\.kind === "embedded-mastra"/u);
  assert.match(gateway, /activeProvider: choice\.text === "off"/u);
  assert.match(gateway, /Select the Writing resource in Settings → Hybrid/u);
  assert.match(localGateway, /registerAgentComputeGateway\(server\)/u);
  assert.match(writing, /explicit !== selected/u);
  assert.match(writing, /computeSource: assigned\.source/u);
});

test("#1849 Settings keyboard directory opens Local, Cloud, Hybrid and the Agent roster", async () => {
  const dashboard = await read("app/skin-v1/dashboard-bbs-panel.tsx");
  for (const id of ["local", "cloud", "hybrid", "agents"]) assert.match(dashboard, new RegExp(`id: "${id}"`, "u"));
  assert.match(dashboard, /PlotPickleAgentsHost/u);
  assert.match(dashboard, /initialView=\{storyModeView\}/u);
  assert.match(dashboard, /event\.key === "ArrowDown"/u);
  assert.match(dashboard, /event\.key === "ArrowUp"/u);
  assert.match(dashboard, /event\.key === "Escape"/u);
});

test("#1852 Agent Setup shows the complete system-sorted roster and reports Hybrid Writing for PlotPickle-owned LLM routes", async () => {
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
