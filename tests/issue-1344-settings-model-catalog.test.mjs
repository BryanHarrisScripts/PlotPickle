import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL(`../${relative}`, import.meta.url), "utf8");

test("#1344 completes model catalogs inside the newer Local and Cloud Compute IA", async () => {
  const [settings, compute] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
  ]);

  assert.match(settings, /id: "local-compute", label: "Local Compute"/);
  assert.match(settings, /id: "cloud-compute", label: "Cloud Compute"/);
  assert.match(compute, /<LocalModelCatalogPanel \/>/);
  assert.match(compute, /<CloudModelCatalogPanel capability=\{activeCapability\} \/>/);
  assert.match(compute, /type ComputeCapability = "writing" \| "images" \| "video"/);
  assert.doesNotMatch(settings, /label: "PLOTPICKLE SETUP"|label: "LOCAL MODELS"|label: "CLOUD MODELS"/);
});

test("#1344 local catalog is searchable, filtered and writes through canonical local runtime settings", async () => {
  const local = await read("app/settings/compute/local-model-catalog-panel.tsx");

  assert.match(local, /fetch\("\/api\/local-ai\/runtime"/);
  assert.match(local, /modelCatalog/);
  assert.match(local, />Search models</);
  assert.match(local, /Fits this computer/);
  assert.match(local, /Vision capable/);
  assert.match(local, /Coding \/ tools/);
  assert.match(local, /filtered\.length} of \{total}/);
  assert.match(local, /\/api\/local-ai\/runtime\/settings/);
  assert.match(local, /modelOverrides/);
  assert.match(local, /Use for Sage/);
  assert.match(local, /Use for PLAN/);
  assert.doesNotMatch(local, /\b640\b/);
  assert.doesNotMatch(local, /localStorage|indexedDB/);
});

test("#1344 cloud catalog discovers provider models and updates canonical writing/media profiles", async () => {
  const [cloud, gateway, rootGateway] = await Promise.all([
    read("app/settings/compute/cloud-model-catalog-panel.tsx"),
    read("build/provider-model-catalog-gateway.ts"),
    read("build/local-ai-gateway.ts"),
  ]);

  assert.match(cloud, /\/api\/ai-model-catalog\?provider=/);
  assert.match(cloud, /\/api\/ai-model-catalog\/select/);
  assert.match(cloud, /Search \{label} models/);
  assert.match(cloud, /status\?\.count/);
  assert.match(cloud, /first 60 matches/);
  assert.doesNotMatch(cloud, /\b640\b/);

  assert.match(gateway, /readSynchronizedAssistantStore/);
  assert.match(gateway, /readMediaRoutingStore/);
  assert.match(gateway, /writeAssistantStore/);
  assert.match(gateway, /writeMediaRoutingStore/);
  assert.match(gateway, /`\$\{normalizedBaseUrl\(baseUrl\)\}\/models`/);
  assert.match(gateway, /`\$\{normalizedBaseUrl\(baseUrl\)\}\/v1\/models`/);
  assert.match(gateway, /count: models\.length/);
  assert.match(gateway, /assistantVerifiedAt: ""/);
  assert.match(gateway, /imageVerifiedAt: ""/);
  assert.match(gateway, /videoVerifiedAt: ""/);
  assert.match(gateway, /mirrorLegacySelection/);
  assert.doesNotMatch(gateway, /\b640\b/);
  assert.doesNotMatch(gateway, /localStorage|indexedDB/);
  assert.match(rootGateway, /registerProviderModelCatalogGateway\(server\)/);
});

test("#1344 provider connection stays separate from normal model selection", async () => {
  const provider = await read("app/settings/ai-provider/ai-provider-setup-panel.tsx");

  assert.match(provider, /<p>Provider connection<\/p>/);
  assert.match(provider, /Manual model IDs · advanced fallback/);
  assert.match(provider, /searchable model catalog above is the normal selection path/i);
  assert.match(provider, /type="password"/);
  assert.match(provider, /Save & test connection/);
});

test("#1344 model choice itself never changes routing or runs paid generation", async () => {
  const [cloud, gateway] = await Promise.all([
    read("app/settings/compute/cloud-model-catalog-panel.tsx"),
    read("build/provider-model-catalog-gateway.ts"),
  ]);

  assert.match(cloud, /Choosing a model changes configuration only/);
  assert.match(cloud, /does not run a paid generation/);
  assert.match(cloud, /does not.*change the active provider route/);
  assert.doesNotMatch(gateway, /generateText|generateImage|createVideo|writeRoutingChoice/);
});
