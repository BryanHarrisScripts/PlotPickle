import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1462 moves the native H3 gateway into the AI domain without moving its provider yet", async () => {
  await assert.rejects(access(new URL("build/comfyui-h3-native-gateway.ts", root)));
  await access(new URL("build/ai/comfyui-h3-native-gateway.ts", root));
  await access(new URL("build/comfyui-h3-native-provider.ts", root));

  const [gateway, localGateway] = await Promise.all([
    source("build/ai/comfyui-h3-native-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  assert.match(gateway, /from "\.\.\/comfyui-h3-native-provider"/);
  assert.match(localGateway, /from "\.\/ai\/comfyui-h3-native-gateway"/);
  assert.doesNotMatch(localGateway, /from "\.\/comfyui-h3-native-gateway"/);
});

test("#1462 preserves native H3 local-only authority and reviewed request bounds", async () => {
  const gateway = await source("build/ai/comfyui-h3-native-gateway.ts");
  assert.match(gateway, /const API = "\/api\/media-routing\/comfyui\/h3\/native"/);
  assert.match(gateway, /const MAX_REQUEST_BYTES = 4 \* 1024 \* 1024/);
  assert.match(gateway, /value === "127\.0\.0\.1"/);
  assert.match(gateway, /http:\/\/127\.0\.0\.1:8188/);
  assert.match(gateway, /installsWeights: false/);
  assert.match(gateway, /installsCustomNodes: false/);
  assert.match(gateway, /executesDownloadedCode: false/);
  assert.doesNotMatch(gateway, /child_process|spawn\(|exec\(|git clone|pip install/i);
});

test("#1462 keeps build/ai at the ratified direct-source ceiling rather than moving the H3 provider early", async () => {
  const inventory = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.match(inventory, /16/);
  const provider = await source("build/comfyui-h3-native-provider.ts");
  assert.match(provider, /minimax-h3-native/);
});
