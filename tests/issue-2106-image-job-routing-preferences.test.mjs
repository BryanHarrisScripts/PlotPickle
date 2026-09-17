import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function storyModeSources() {
  const gateway = await read("build/story-mode-policy-gateway.ts");
  const jobRouting = gateway.slice(
    gateway.indexOf("export type StoryModeJobPreference"),
    gateway.indexOf("function isLoopback"),
  );
  return { gateway, jobRouting };
}

test("#2106 image Job Routing preferences stay provider-neutral and bounded to real job identities", async () => {
  const { jobRouting } = await storyModeSources();

  assert.match(jobRouting, /export type StoryModeJobPreference = "auto" \| "local-first" \| "cloud-first"/u);
  assert.match(jobRouting, /"image-fast-draft"/u);
  assert.match(jobRouting, /"image-precision-edit"/u);
  assert.match(jobRouting, /"image-fast-draft": "auto"/u);
  assert.match(jobRouting, /"image-precision-edit": "auto"/u);
  assert.doesNotMatch(jobRouting, /OpenAI|MiniMax|Ollama|ComfyUI/u);
});

test("#2106 Job Routing persists preferences without mutating provider selection", async () => {
  const { gateway, jobRouting } = await storyModeSources();

  assert.match(jobRouting, /readCredentialJson/u);
  assert.match(jobRouting, /writeCredentialJson/u);
  assert.match(jobRouting, /story-mode-job-routing\.json/u);
  assert.doesNotMatch(gateway, /writeMediaRoutingStore|writeAssistantStore|writeNativeH3Store/u);
});

test("#2106 Job Routing resolver obeys Story Mode locality before user preference", async () => {
  const { jobRouting } = await storyModeSources();
  const resolver = jobRouting.slice(jobRouting.indexOf("export function resolveStoryModeJobRoute"));

  assert.match(resolver, /candidate\.ready && allowedByPolicy\(policy, candidate\.locality\)/u);
  assert.match(resolver, /preference === "auto"/u);
  assert.match(resolver, /preference === "local-first" \? "local" : "cloud"/u);
  assert.match(resolver, /policy === "hybrid"/u);
  assert.match(resolver, /candidate\.selected/u);
});

test("#2106 AUTO is conservative and does not silently change the selected paid route", async () => {
  const { jobRouting } = await storyModeSources();

  assert.match(jobRouting, /AUTO Job Routing keeps the currently selected ready image route/u);
  assert.match(jobRouting, /eligible\.find\(\(candidate\) => candidate\.selected\)/u);
});

test("#2106 Story Mode exposes one protected Job Routing API instead of a second provider router", async () => {
  const { gateway } = await storyModeSources();

  assert.match(gateway, /const JOB_ROUTING_PATH = "\/api\/story-mode\/job-routing"/u);
  assert.match(gateway, /readStoryModeJobRouting/u);
  assert.match(gateway, /writeStoryModeJobRoutingPreference/u);
  assert.match(gateway, /Choose AUTO, LOCAL FIRST or CLOUD FIRST Job Routing/u);
  assert.doesNotMatch(gateway, /job-routing\/select-provider|new ProviderRegistry|Multiplexer/u);
});
