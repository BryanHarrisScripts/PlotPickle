import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contracts = await readFile(new URL("../lib/ai/contracts.ts", import.meta.url), "utf8");
const providers = await readFile(new URL("../lib/ai/providers.ts", import.meta.url), "utf8");
const adapters = await readFile(new URL("../lib/ai/adapters.ts", import.meta.url), "utf8");
const architecture = await readFile(new URL("../docs/ai-architecture.md", import.meta.url), "utf8");
const settings = await readFile(new URL("../lib/ai/settings.ts", import.meta.url), "utf8");

test("AI contracts cover portable knowledge and character consistency", () => {
  assert.match(contracts, /type KnowledgeSource/);
  assert.match(contracts, /type CharacterIdentityLock/);
  assert.match(contracts, /type CharacterLook/);
  assert.match(contracts, /type ContinuityLock/);
  assert.match(contracts, /type GenerationProvenance/);
});

test("provider choices preserve OpenAI focus without provider lock-in", () => {
  for (const provider of ["openai", "openai-compatible", "ollama", "manual", "disabled"]) {
    assert.match(providers, new RegExp(`kind: "${provider}"`));
  }
  assert.match(providers, /testedFocus: true/);
  assert.match(providers, /ChatGPT \/ OpenAI API/);
});

test("OpenAI video is a replaceable unavailable capability", () => {
  assert.match(providers, /OPENAI_VIDEO_SUNSET = "2026-09-24"/);
  assert.doesNotMatch(providers, /capabilities: \[[^\]]*"video-generation"/s);
  assert.match(adapters, /video-provider-unavailable/);
  assert.match(architecture, /replaceable asynchronous video-job contract/);
});

test("provider configuration never contains an API key", () => {
  const configBlock = contracts.slice(contracts.indexOf("export type AiProviderConfig"), contracts.indexOf("export type AiProviderStatus"));
  assert.doesNotMatch(configBlock, /apiKey|secretValue|token/);
  assert.match(architecture, /never written into a `.plotpickle.json` export/);
});

test("OpenAI Responses and image generation are isolated in the adapter", () => {
  assert.match(adapters, /\/responses/);
  assert.match(adapters, /\/images\/generations/);
  assert.match(adapters, /gpt-image-2|models\.image/);
  assert.match(adapters, /extractOpenAiOutputText/);
  assert.match(adapters, /image-editing-not-implemented/);
});

test("advanced AI capabilities stay behind one grouped Settings menu", () => {
  assert.match(architecture, /one grouped Settings menu/);
  assert.match(architecture, /AI Setup/);
  assert.match(architecture, /Music/);
  assert.match(architecture, /Story & Art/);
  assert.match(architecture, /Media & Film Engines/);
  assert.doesNotMatch(architecture, /AI Studio interface with Setup, Knowledge, Character Lab, Image Lab, Video Lab, and Activity/);
  assert.match(settings, /type PlotPickleSettings/);
});
