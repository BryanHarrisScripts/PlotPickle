import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1462 gives the native H3 gateway and provider one bounded AI subdomain owner", async () => {
  await assert.rejects(access(new URL("build/comfyui-h3-native-gateway.ts", root)));
  await assert.rejects(access(new URL("build/comfyui-h3-native-provider.ts", root)));
  await assert.rejects(access(new URL("build/ai/comfyui-h3-native-gateway.ts", root)));
  await access(new URL("build/ai/h3/comfyui-h3-native-gateway.ts", root));
  await access(new URL("build/ai/h3/comfyui-h3-native-provider.ts", root));

  const [gateway, provider, localGateway, routingGateway] = await Promise.all([
    source("build/ai/h3/comfyui-h3-native-gateway.ts"),
    source("build/ai/h3/comfyui-h3-native-provider.ts"),
    source("build/local-ai-gateway.ts"),
    source("build/ai-routing-gateway.ts"),
  ]);
  assert.match(gateway, /from "\.\/comfyui-h3-native-provider"/);
  assert.match(provider, /from "\.\.\/\.\.\/local-credentials"/);
  assert.match(provider, /from "\.\.\/\.\.\/media-provider-common"/);
  assert.match(localGateway, /from "\.\/ai\/h3\/comfyui-h3-native-gateway"/);
  assert.match(routingGateway, /from "\.\/ai\/h3\/comfyui-h3-native-provider"/);
});

test("#1462 preserves native H3 local-only authority and reviewed request bounds", async () => {
  const gateway = await source("build/ai/h3/comfyui-h3-native-gateway.ts");
  assert.match(gateway, /const API = "\/api\/media-routing\/comfyui\/h3\/native"/);
  assert.match(gateway, /const MAX_REQUEST_BYTES = 4 \* 1024 \* 1024/);
  assert.match(gateway, /value === "127\.0\.0\.1"/);
  assert.match(gateway, /http:\/\/127\.0\.0\.1:8188/);
  assert.match(gateway, /installsWeights: false/);
  assert.match(gateway, /installsCustomNodes: false/);
  assert.match(gateway, /executesDownloadedCode: false/);
  assert.doesNotMatch(gateway, /child_process|spawn\(|exec\(|git clone|pip install/i);
});

test("#1462 creates AI subdomain capacity without exceeding the ratified direct-source ceiling", async () => {
  const target = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.match(target, /no more than \*\*16 direct source files\*\*/);
  const entries = await readdir(new URL("build/ai/", root), { withFileTypes: true });
  const directSourceCount = entries.filter((entry) => entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)).length;
  assert.ok(directSourceCount <= 16, `build/ai has ${directSourceCount} direct source files`);
  assert.ok(directSourceCount <= 15, `H3 subdomain should create at least one direct-source slot; found ${directSourceCount}`);

  const provider = await source("build/ai/h3/comfyui-h3-native-provider.ts");
  assert.match(provider, /minimax-h3-native/);
});
