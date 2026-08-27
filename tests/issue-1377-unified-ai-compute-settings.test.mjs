import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1377 replaces provider-first Settings navigation with Local Compute and Cloud Compute", async () => {
  const settings = await read("app/sage-settings-workspace.tsx");

  assert.match(settings, /label: "AI COMPUTE"/);
  assert.match(settings, /id: "local-compute", label: "Local Compute"/);
  assert.match(settings, /id: "cloud-compute", label: "Cloud Compute"/);
  assert.match(settings, /<AiComputeWorkspace mode="local" \/>/);
  assert.match(settings, /<AiComputeWorkspace mode="cloud" \/>/);
  assert.doesNotMatch(settings, /label: "LOCAL AI"|label: "MODEL PROVIDERS"/);
  assert.doesNotMatch(settings, /label: "Sage Setup"|label: "PLAN Setup"|label: "LLM Routing"|label: "Images Setup"|label: "Video Setup"/);
});

test("#1377 Local and Cloud use one shared Writing Images Video workspace", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /type ComputeMode = "local" \| "cloud"/);
  assert.match(compute, /type ComputeCapability = "writing" \| "images" \| "video"/);
  assert.match(compute, /id: "writing"/);
  assert.match(compute, /id: "images"/);
  assert.match(compute, /id: "video"/);
  assert.match(compute, /data-ai-compute-mode=\{mode\}/);
  assert.match(compute, /data-ai-compute-capability=\{activeCapability\}/);
  assert.match(compute, /data-compute-tab=\{item\.id\}/);
  assert.match(compute, /aria-current=\{activeCapability === item\.id \? "page" : undefined\}/);
  assert.match(compute, /<AiRoutingPanel[\s\S]*capability=\{capability\.routingCapability\}[\s\S]*locality=\{mode\}/);
});

test("#1377 routing authority filters by capability and locality rather than duplicating provider state", async () => {
  const routing = await read("app/ai-routing-panel.tsx");

  assert.match(routing, /type AiRoutingPanelProps/);
  assert.match(routing, /capability\?: Capability/);
  assert.match(routing, /locality\?: Locality/);
  assert.match(routing, /AI_SOURCE_GROUPS\.filter/);
  assert.match(routing, /option\.locality === locality/);
  assert.match(routing, /data-routing-locality=\{locality \|\| "all"\}/);
  assert.match(routing, /data-routing-capability=\{capabilityFilter \|\| "all"\}/);
  assert.match(routing, /\/api\/ai-routing/);
  assert.doesNotMatch(routing, /localStorage|indexedDB/, "the shared UI must not invent a second routing store");
});

test("#1377 beginner view keeps expert detail behind one Advanced Options disclosure", async () => {
  const [compute, css] = await Promise.all([
    read("app/settings/compute/ai-compute-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.module.css"),
  ]);

  assert.match(compute, />Advanced Options<\/button>/);
  assert.match(compute, /<details id=\{`\$\{mode\}-compute-advanced`\}/);
  assert.match(compute, /<SageFastModelSetup \/>/);
  assert.match(compute, /<LocalRuntimePanel \/>/);
  assert.doesNotMatch(compute, /<MediaRoutingPanel/);
  assert.match(compute, /<AiProviderSetupPanel provider="openai" \/>/);
  assert.match(compute, /<AiProviderSetupPanel provider="minimax" \/>/);
  assert.match(css, /\.tabs/);
  assert.match(css, /grid-template-columns:\s*repeat\(3/);
  assert.match(css, /@media \(max-width: 780px\)/);
});

test("#1377 and #1525 present remote connection methods truthfully without inventing MCP support", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /<strong>Provider API<\/strong>/);
  assert.match(compute, /<strong>OpenAI-Compatible API<\/strong>/);
  assert.match(compute, /<strong>MCP<\/strong>/);
  assert.match(compute, /MCP is a connection mechanism for tools\/services, not an AI model identity/);
  assert.match(compute, /It remains unavailable until a real MCP adapter is registered/);
  assert.match(compute, /protected user-owned credential/);
});

test("#1377 preserves old Settings links while moving their destination into the current focused owner", async () => {
  const [settings, compute] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);

  for (const legacy of ["settings-models", "settings-routing", "settings-ollama", "settings-images", "settings-video"]) {
    assert.match(settings, new RegExp(`"${legacy}": "local-compute"`));
  }
  for (const legacy of ["settings-sage", "settings-plan"]) {
    assert.match(settings, new RegExp(`"${legacy}": "sage-plan"`));
  }
  assert.match(settings, /"settings-comfyui": "comfyui"/);
  for (const legacy of ["settings-openai", "settings-minimax"]) {
    assert.match(settings, new RegExp(`"${legacy}": "cloud-compute"`));
  }
  assert.match(settings, /url\.searchParams\.delete\("compute"\)/);
  assert.match(compute, /"settings-images": "images"/);
  assert.match(compute, /"settings-video": "video"/);
  assert.match(compute, /"settings-routing": "writing"/);
  assert.doesNotMatch(compute, /"settings-comfyui": "images"/);
});

test("#1344 model catalogs extend the shared Compute workspace instead of restoring provider-first navigation", async () => {
  const [settings, compute, localCatalog, cloudCatalog, gateway] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
    read("app/settings/compute/local-model-catalog-panel.tsx"),
    read("app/settings/compute/cloud-model-catalog-panel.tsx"),
    read("build/ai/provider-model-catalog-gateway.ts"),
  ]);

  assert.match(compute, /<LocalModelCatalogPanel \/>/);
  assert.match(compute, /<CloudModelCatalogPanel capability=\{activeCapability\} \/>/);
  assert.doesNotMatch(settings, /label: "PLOTPICKLE SETUP"|label: "LOCAL MODELS"|label: "CLOUD MODELS"/);
  assert.match(localCatalog, />Search models</);
  assert.match(localCatalog, /filtered\.length} of \{total}/);
  assert.match(cloudCatalog, /status\?\.count/);
  assert.match(gateway, /readSynchronizedAssistantStore/);
  assert.match(gateway, /readMediaRoutingStore/);
  assert.match(gateway, /count: models\.length/);
  assert.doesNotMatch(`${localCatalog}\n${cloudCatalog}\n${gateway}`, /\b640\b/);
});
