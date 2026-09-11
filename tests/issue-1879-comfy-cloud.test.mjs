import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1879 Cloud Story Mode exposes ComfyUI Cloud without turning it into Agent text compute", async () => {
  const [cloud, comfy, agents, gateway] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/comfy-cloud-setup-panel.tsx"),
    read("app/skin-v1/plotpickle-agents-host.tsx"),
    read("build/agent-compute-gateway.ts"),
  ]);

  assert.match(cloud, /id: "comfy-cloud", shortcut: "C", label: "COMFYUI CLOUD"/u);
  assert.match(cloud, /<ComfyCloudSetupPanel/u);
  assert.match(comfy, /Local ComfyUI remains in Local Story Mode/u);
  assert.match(comfy, /DIRECT API/u);
  assert.match(comfy, /COMFY MCP/u);
  assert.match(comfy, /COMFY CLI · ADVANCED/u);
  assert.match(comfy, /not competing PlotPickle providers/u);
  assert.doesNotMatch(agents, /ComfyUI Cloud|COMFYUI CLOUD/u);
  assert.doesNotMatch(gateway, /comfy-cloud|ComfyUI Cloud|COMFYUI CLOUD/u);
});

test("#1879 Comfy Cloud authority is Human-profile scoped and tests only non-generative object metadata", async () => {
  const route = await read("app/api/cloud-story-mode/comfy-cloud/route.ts");

  assert.match(route, /CREDENTIAL_NAME = "comfy-cloud\.json"/u);
  assert.match(route, /BASE_URL = "https:\/\/cloud\.comfy\.org"/u);
  assert.match(route, /OBJECT_INFO_PATH = "\/api\/object_info"/u);
  assert.match(route, /"X-API-Key": settings\.apiKey/u);
  assert.match(route, /runtimeState\.privateStorage\.readCredential\(authContext, CREDENTIAL_NAME\)/u);
  assert.match(route, /runtimeState\.privateStorage\.writeCredential\(authContext, CREDENTIAL_NAME, next\)/u);
  assert.match(route, /authorizeRequest/u);
  assert.match(route, /mutation: true/u);
  assert.doesNotMatch(route, /\/api\/prompt/u);
  assert.doesNotMatch(route, /apiKey: settings\.apiKey/u);
  assert.match(route, /No workflow was submitted and no generation credits were used/u);
});

test("#1879 keeps bounded user configuration and curated workflow metadata only", async () => {
  const [panel, catalog, mediaStore] = await Promise.all([
    read("app/skin-v1/comfy-cloud-setup-panel.tsx"),
    read("lib/runtime/ai/comfy-cloud-workflow-catalog.ts"),
    read("build/media-routing-store.ts"),
  ]);

  for (const label of [
    "Browser / Manual",
    "API Automation",
    "PlotPickle submission concurrency cap",
    "Completed output handling",
    "Default workflow lane",
    "CINEMATIC",
    "MARKETING",
    "UTILITY",
  ]) assert.match(panel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  for (const need of [
    "Storyboards & Style Frames",
    "Shot / Image-to-Video",
    "Camera Motion & Prompt Translation",
    "Character / Reference Continuity",
    "Product Photography",
    "Product Placement",
    "Commerce Hero Video",
    "Moodboard & Talent Exploration",
    "Aspect Ratio & Enhancement",
    "Frame Interpolation & Relight",
  ]) assert.match(catalog, new RegExp(need.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));

  assert.match(catalog, /requiresApiWorkflowImport: true/u);
  assert.doesNotMatch(catalog, /workflowJson|promptText|negativePrompt/u);
  assert.match(mediaStore, /LOCAL_COMFYUI_URL = "http:\/\/127\.0\.0\.1:8188"/u);
});
