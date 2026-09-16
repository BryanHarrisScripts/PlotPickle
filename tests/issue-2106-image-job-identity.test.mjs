import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#2106 image jobs have provider-neutral Fast/Draft and Precision/Edit identities", async () => {
  const source = await read("build/media-provider-common.ts");

  assert.match(source, /export type ImageStoryJobClass = "image-fast-draft" \| "image-precision-edit"/u);
  assert.match(source, /jobClass\?: unknown/u);
  assert.match(source, /input\.jobClass === "image-fast-draft" \|\| input\.jobClass === "image-precision-edit"/u);
  assert.match(source, /input\.quality === "high"/u);
  for (const intent of [
    "referenceImages",
    "approvedCharacterReferences",
    "environmentReferences",
    "identityLocks",
    "wardrobeLookIds",
    "continuityMetadata",
  ]) assert.ok(source.includes(`input.${intent}`), `missing precision/edit intent: ${intent}`);
  assert.match(source, /return precisionIntent \? "image-precision-edit" : "image-fast-draft"/u);
});

test("#2106 both real image provider paths report the resolved job identity", async () => {
  const [cloud, comfy] = await Promise.all([
    read("build/cloud-media-provider.ts"),
    read("build/ai/comfyui-media-provider.ts"),
  ]);

  for (const [name, source] of [["cloud", cloud], ["comfyui", comfy]]) {
    assert.match(source, /resolveImageStoryJobClass\(input\)/u, `${name} must resolve the shared image job class`);
    assert.match(source, /jobClass/u, `${name} generation result must expose the resolved job class`);
  }
});

test("#2106 job identity does not create provider ownership, preference persistence or another router", async () => {
  const source = await read("build/media-provider-common.ts");
  const resolver = source.slice(source.indexOf("export function resolveImageStoryJobClass"), source.indexOf("export function assetsDirectory"));

  assert.doesNotMatch(resolver, /ollama|openai|minimax|comfyui/iu);
  assert.doesNotMatch(resolver, /preference|provider|route|registry|store|persist/iu);
});
