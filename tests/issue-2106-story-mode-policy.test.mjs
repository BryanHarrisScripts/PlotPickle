import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2106 Story Mode policy is provider-neutral and defaults to Hybrid", async () => {
  const source = await read("build/story-mode-policy-gateway.ts");

  assert.match(source, /export type StoryModePolicy = "local" \| "cloud" \| "hybrid"/u);
  assert.match(source, /mode: "hybrid"/u);
  assert.match(source, /POLICY_PATH = "\/api\/story-mode\/policy"/u);
  assert.doesNotMatch(source, /ollama-hybrid|Ollama Hybrid|new provider registry|multiplexer/iu);
});

test("#2106 Local, Cloud and Hybrid constrain existing route locality without replacing the router", async () => {
  const source = await read("build/story-mode-policy-gateway.ts");

  for (const path of [
    "/api/local-ai/generate/text",
    "/api/writing-assistant/chat",
    "/api/local-ai/generate/image",
    "/api/local-ai/generate/video",
  ]) assert.ok(source.includes(path), `missing execution boundary for ${path}`);

  assert.match(source, /if \(mode === "hybrid"\) return true/u);
  assert.match(source, /return mode === locality/u);
  assert.match(source, /value === "local" \|\| value === "ollama"/u);
  assert.match(source, /value === "openai" \|\| value === "minimax" \|\| value === "gemini"/u);
  assert.match(source, /value === "comfyui" \|\| value === "ollama-comfyui"/u);
  assert.match(source, /value === "comfyui-native"/u);
  assert.match(source, /readCredentialJson<RoutingChoiceSnapshot>\(ROUTING_FILE\)/u);
  assert.match(source, /readSynchronizedAssistantStore/u);
  assert.match(source, /readMediaRoutingStore/u);
  assert.match(source, /readNativeH3Store/u);
});

test("#2106 policy enforcement fails closed for unclassified or cross-locality execution", async () => {
  const source = await read("build/story-mode-policy-gateway.ts");

  assert.match(source, /locality === "unknown"/u);
  assert.match(source, /cannot classify the selected/u);
  assert.match(source, /selectedLocality: locality/u);
  assert.match(source, /status, 409|sendJson\(response, 409/u);
  assert.match(source, /Choose a \$\{policy\.mode\} route or switch Story Mode policy/u);
});

test("#2106 policy middleware is registered before routing and generation owners", async () => {
  const gateway = await read("build/local-ai-gateway.ts");

  assert.match(gateway, /registerStoryModePolicyGateway/u);
  const policy = gateway.indexOf("registerStoryModePolicyGateway(server)");
  const routing = gateway.indexOf("registerAiRoutingGateway(server)");
  const writing = gateway.indexOf("registerWritingAssistantGateway(server)");
  assert.ok(policy >= 0 && routing > policy, "Story Mode policy must run before AI routing");
  assert.ok(writing > policy, "Story Mode policy must run before Writing Assistant execution");
});
