import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2805 gives the provider-neutral media router sole production image ownership", async () => {
  const [sdxlGateway, mediaGateway, composition] = await Promise.all([
    read("build/ai/comfyui-sdxl-local-gateway.ts"),
    read("build/media-routing-gateway.ts"),
    read("build/local-ai-gateway.ts"),
  ]);

  assert.doesNotMatch(sdxlGateway, /\/api\/local-ai\/generate\/image/u);
  assert.match(sdxlGateway, /\/api\/media-routing\/test\/image/u);
  assert.match(mediaGateway, /const IMAGE_PATH = "\/api\/local-ai\/generate\/image"/u);
  assert.match(composition, /registerSdxlLocalImageGateway\(server\)[\s\S]*registerMediaRoutingGateway\(server\)/u);
});

test("#2805 normalizes provider-native image output to requested Storyboard WebP", async () => {
  const [mediaGateway, common, storyboard] = await Promise.all([
    read("build/media-routing-gateway.ts"),
    read("build/media-provider-common.ts"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);

  assert.match(mediaGateway, /if \(input\.outputFormat === "webp"\)[\s\S]*saveWebpFrameCandidate\(result\.assetUrl/u);
  assert.match(common, /saveWebpFrameCandidate/u);
  assert.match(common, /\(png\|jpe\?g\|webp\)/u);
  assert.match(storyboard, /outputFormat: "webp"/u);
  assert.match(storyboard, /assetUrl\?\.endsWith\("\.webp"\)/u);
  assert.doesNotMatch(storyboard, /accept.*\.png|endsWith\("\.png"\)/iu);
});

test("#2805 preserves one-at-a-time Storyboard generation and continuity payloads", async () => {
  const [composition, storyboard] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);

  assert.match(composition, /registerSingleImageBoundary\(server\)/u);
  assert.match(composition, /imageRequestActive/u);
  assert.match(storyboard, /requestCount: 1/u);
  assert.match(storyboard, /approvedCharacterReferences: plan\.brief\.approvedVisualRefs/u);
  assert.match(storyboard, /identityLocks: plan\.brief\.identityLocks/u);
  assert.match(storyboard, /continuityMetadata: \[plan\.brief\.continuityIn, plan\.brief\.continuityOut\]/u);
});
