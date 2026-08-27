import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1525 keeps execution location separate from connection method and provider identity", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /title: "Remote Compute"/);
  assert.match(compute, />My Private Server</);
  assert.match(compute, />Cloud Server Farm</);
  assert.match(compute, /such as AtlasCloud/);
  assert.match(compute, />Provider Cloud</);
  assert.match(compute, /Google Gemini, OpenAI or MiniMax/);

  assert.match(compute, />Provider API</);
  assert.match(compute, />OpenAI-Compatible API</);
  assert.match(compute, />MCP</);
  assert.match(compute, /MCP is a connection mechanism for tools\/services, not an AI model identity/);
});

test("#1525 preserves explicit local and paid-cloud authority boundaries", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /badge: "THIS COMPUTER"/);
  assert.match(compute, /badge: "REMOTE \/ CLOUD"/);
  assert.match(compute, /No local failure silently promotes work to a paid provider/);
  assert.match(compute, /credentials and paid-use consent stay explicit/);
});

test("#1525 adds Gemini as an independent Writing provider instead of replacing OpenAI", async () => {
  const [store, provider, gateway, routing, registry, compute, panel, consoleUi] = await Promise.all([
    read("build/writing-assistant-store.ts"),
    read("build/writing-assistant-provider.ts"),
    read("build/writing-assistant-gateway.ts"),
    read("build/ai-routing-gateway.ts"),
    read("config/ai-source-registry.json"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
    read("app/settings/ai-provider/gemini-provider-setup-panel.tsx"),
    read("app/writing-assistant-console.tsx"),
  ]);

  assert.match(store, /"local" \| "ollama" \| "openai" \| "minimax" \| "gemini"/);
  assert.match(store, /TEXT_PROVIDERS: TextProvider\[\] = \["local", "ollama", "openai", "minimax", "gemini"\]/);
  assert.match(provider, /profile\.provider === "gemini"/);
  assert.match(provider, /return "Google Gemini"/);
  assert.match(gateway, /const PROVIDER_PATH = `\$\{API_ROOT\}\/provider`/);
  assert.match(gateway, /gemini: publicProfile\(store\.profiles\.gemini/);
  assert.match(routing, /TextRoute = "ollama" \| "openai" \| "minimax" \| "gemini" \| "off"/);
  assert.match(routing, /settingsTarget: "gemini"/);
  assert.match(registry, /"id": "text\.gemini"/);
  assert.match(compute, /<GeminiProviderSetupPanel \/>/);
  assert.match(panel, /DEFAULT_BASE_URL = "https:\/\/generativelanguage\.googleapis\.com\/v1beta\/openai"/);
  assert.match(panel, /DEFAULT_MODEL = "gemini-3\.7-flash"/);
  assert.match(panel, /This first slice enables Writing\/Reasoning only/);
  assert.match(consoleUi, /type ProviderId = "ollama" \| "openai" \| "gemini" \| "minimax"/);
  assert.match(consoleUi, /providerOrder: ProviderId\[\] = \["ollama", "openai", "gemini", "minimax"\]/);
  assert.match(consoleUi, /label: "Google Gemini"/);
  assert.match(consoleUi, /settingsTarget: "Google Gemini"/);
});

test("#1525 Gemini setup keeps cloud activation explicit", async () => {
  const [gateway, routing, panel] = await Promise.all([
    read("build/writing-assistant-gateway.ts"),
    read("build/ai-routing-gateway.ts"),
    read("app/settings/ai-provider/gemini-provider-setup-panel.tsx"),
  ]);

  assert.match(gateway, /Enter the \$\{providerLabel\(provider\)\} API key owned by the current user/);
  assert.match(routing, /route === "gemini"\) requirePaidConsent\(body\)/);
  assert.match(panel, /Choosing Gemini as the active Writing route remains a separate explicit action/);
  assert.doesNotMatch(panel, /\/api\/writing-assistant\/active/);
});
