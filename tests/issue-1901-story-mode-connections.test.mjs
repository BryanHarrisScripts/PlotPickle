import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

function inOrder(source, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${label}: expected ${token} after the previous item`);
    cursor = next;
  }
}

test("#1901 Local and Cloud Story Mode use the same Capabilities / Connections information architecture", async () => {
  const [local, cloud] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
  ]);

  for (const source of [local, cloud]) {
    assert.match(source, /group: "CAPABILITIES"/u);
    assert.match(source, /group: "CONNECTIONS"/u);
    assert.doesNotMatch(source, /group: "TASKS"|group: "ENGINES"|group: "CLOUD RESOURCES"/u);
    inOrder(source, ['id: "writing"', 'id: "images"', 'id: "video"', 'id: "agents"'], "capability order");
  }

  inOrder(local, ['id: "ollama"', 'id: "comfyui"', 'id: "ltx"', 'id: "h3"'], "local connection order");
  inOrder(cloud, ['id: "openai"', 'id: "comfy-cloud"', 'id: "gemini"', 'id: "minimax"'], "cloud connection order");

  assert.match(local, /comfyui: "ComfyUI"/u);
  assert.match(cloud, /"comfy-cloud": "ComfyUI"/u);
  assert.match(local, /h3: "MiniMax H3"/u);
  assert.match(cloud, /minimax: "MiniMax"/u);
});

test("#1901 one shared compact capability surface is used by both Story Modes", async () => {
  const [local, cloud, shared] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/story-mode-capability-connections.tsx"),
  ]);

  assert.match(local, /import StoryModeCapabilityConnections/u);
  assert.match(cloud, /import StoryModeCapabilityConnections/u);
  assert.match(local, /<StoryModeCapabilityConnections[\s\S]*mode="local"/u);
  assert.match(cloud, /<StoryModeCapabilityConnections[\s\S]*mode="cloud"/u);

  for (const state of ["Ready", "Needs test", "Set up", "Error"]) assert.ok(shared.includes(`"${state}"`));
  assert.match(shared, /data-story-mode-connection=/u);
  assert.match(shared, /Current:/u);
  assert.match(shared, /connection\.active \? <p/u);
  assert.match(shared, /connection\.setupLabel/u);
  assert.match(shared, /connection\.useLabel/u);
});

test("#1901 Cloud capability UX puts cost/data consent before connection rows and removes the duplicate legacy stack", async () => {
  const [cloud, shared] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/story-mode-capability-connections.tsx"),
  ]);

  const billing = shared.indexOf("I understand remote provider API requests may incur charges.");
  const list = shared.indexOf("data-story-mode-connection-list");
  assert.ok(billing >= 0 && billing < list, "billing acknowledgement must appear before cloud connection rows");
  assert.match(shared, /capability === "video"/u);
  assert.match(shared, /cloud video prompt and selected reference media may leave this computer/u);

  assert.doesNotMatch(cloud, /CloudModelCatalogPanel/u);
  assert.doesNotMatch(cloud, /AiRoutingPanel/u);
  assert.doesNotMatch(cloud, /Choose a model after you connect the provider/u);
  assert.doesNotMatch(cloud, /Active source:/u);
  assert.doesNotMatch(cloud, /Refresh current configuration/u);
  assert.match(cloud, /paidAcknowledged: true/u);
  assert.match(cloud, /dataSharingAcknowledged: capabilityId === "video"/u);
});

test("#1901 Local capability UX stays local, adds Agents, and keeps hardware-aware video setup", async () => {
  const [local, shared] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/story-mode-capability-connections.tsx"),
  ]);

  assert.match(shared, /Runs on this computer · no cloud provider charges\./u);
  assert.match(local, /agents: "Agents"/u);
  assert.doesNotMatch(local, /AiRoutingPanel|LocalVideoPanel/u);
  assert.match(local, /fetch\("\/api\/local-ai\/plugins\/video"/u);
  assert.match(local, /LTX_PLUGIN_ID = "video\.ltx-video-2b-0\.9\.8-distilled"/u);
  assert.match(local, /H3_PLUGIN_ID = "video\.minimax-h3"/u);
  assert.match(local, /videoRuntimeConnection\(\), videoPluginConnection\("ltx"\), videoPluginConnection\("h3"\)/u);
  assert.match(local, /paidAcknowledged: false/u);
  assert.match(local, /dataSharingAcknowledged: false/u);
});

test("#1901 connection explanations are explicit and distinguish local H3 from MiniMax cloud", async () => {
  const [local, cloud] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
  ]);

  for (const phrase of [
    "Runs AI text models on this computer",
    "Runs visual-generation workflows on this computer",
    "LTX-Video runs through the local ComfyUI workflow",
    "It is separate from the MiniMax cloud API",
  ]) assert.ok(local.includes(phrase), `missing local explanation: ${phrase}`);

  for (const phrase of [
    "OpenAI API connection",
    "not a ChatGPT subscription",
    "Google Gemini API credential",
    "MiniMax API credential",
    "separate from the local MiniMax H3 workflow",
  ]) assert.ok(cloud.includes(phrase), `missing cloud explanation: ${phrase}`);
});

test("#1901 detailed Connection pages remain the configuration owners", async () => {
  const [local, cloud] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("app/skin-v1/cloud-story-mode-host.tsx"),
  ]);

  for (const contract of [
    'view === "ollama" ? <LocalRuntimePanel />',
    'view === "comfyui" ? <LocalComfyUiPanel />',
    'view === "ltx" ? <LocalLtxSetupPanel />',
    'view === "h3" ? <LocalH3SetupPanel />',
  ]) assert.ok(local.includes(contract), `missing local setup owner: ${contract}`);

  for (const contract of [
    'view === "openai" ? <CloudProviderSetupPanel provider="openai" />',
    'view === "comfy-cloud" ? <ComfyCloudSetupPanel />',
    'view === "gemini" ? <GeminiProviderSetupPanel />',
    'view === "minimax" ? <CloudProviderSetupPanel provider="minimax" />',
  ]) assert.ok(cloud.includes(contract), `missing cloud setup owner: ${contract}`);
});
