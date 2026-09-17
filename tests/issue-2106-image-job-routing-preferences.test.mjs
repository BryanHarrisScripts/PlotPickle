import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2106 image Job Routing preferences stay provider-neutral and bounded to real job identities", async () => {
  const source = await read("build/story-mode-job-routing.ts");

  assert.match(source, /export type StoryModeJobPreference = "auto" \| "local-first" \| "cloud-first"/u);
  assert.match(source, /"image-fast-draft"/u);
  assert.match(source, /"image-precision-edit"/u);
  assert.match(source, /"image-fast-draft": "auto"/u);
  assert.match(source, /"image-precision-edit": "auto"/u);
  assert.doesNotMatch(source, /OpenAI|MiniMax|Ollama|ComfyUI/u);
});

test("#2106 Job Routing persists preferences without mutating provider or canon authority", async () => {
  const source = await read("build/story-mode-job-routing.ts");

  assert.match(source, /readCredentialJson/u);
  assert.match(source, /writeCredentialJson/u);
  assert.match(source, /story-mode-job-routing\.json/u);
  assert.doesNotMatch(source, /writeMediaRoutingStore|writeAssistantStore|writeNativeH3Store|PPF|canon|foundation/u);
});

test("#2106 Job Routing resolver obeys Story Mode locality before user preference", async () => {
  const source = await read("build/story-mode-job-routing.ts");
  const resolver = source.slice(source.indexOf("export function resolveStoryModeJobRoute"));

  assert.match(resolver, /candidate\.ready && allowedByPolicy\(policy, candidate\.locality\)/u);
  assert.match(resolver, /preference === "auto"/u);
  assert.match(resolver, /preference === "local-first" \? "local" : "cloud"/u);
  assert.match(resolver, /policy === "hybrid"/u);
  assert.match(resolver, /candidate\.selected/u);
});

test("#2106 AUTO is conservative and does not silently change the selected paid route", async () => {
  const source = await read("build/story-mode-job-routing.ts");

  assert.match(source, /AUTO Job Routing keeps the currently selected ready image route/u);
  assert.match(source, /eligible\.find\(\(candidate\) => candidate\.selected\)/u);
});

test("#2106 Story Mode exposes one protected Job Routing API instead of a second provider router", async () => {
  const gateway = await read("build/story-mode-policy-gateway.ts");

  assert.match(gateway, /const JOB_ROUTING_PATH = "\/api\/story-mode\/job-routing"/u);
  assert.match(gateway, /readStoryModeJobRouting/u);
  assert.match(gateway, /writeStoryModeJobRoutingPreference/u);
  assert.match(gateway, /Choose AUTO, LOCAL FIRST or CLOUD FIRST Job Routing/u);
  assert.doesNotMatch(gateway, /job-routing\/select-provider|new ProviderRegistry|Multiplexer/u);
});
