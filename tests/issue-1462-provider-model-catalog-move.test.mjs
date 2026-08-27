import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => access(new URL(path, root)).then(() => true, () => false);

test("#1462 moves the provider model catalog gateway into the AI domain without a root shim", async () => {
  assert.equal(await exists("build/provider-model-catalog-gateway.ts"), false);
  assert.equal(await exists("build/ai/provider-model-catalog-gateway.ts"), true);

  const [gateway, host] = await Promise.all([
    source("build/ai/provider-model-catalog-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);

  assert.match(host, /from "\.\/ai\/provider-model-catalog-gateway"/);
  assert.match(host, /registerProviderModelCatalogGateway\(server\)/);

  for (const contract of [
    'const CATALOG_PATH = "/api/ai-model-catalog"',
    'const SELECT_PATH = `${CATALOG_PATH}/select`',
    'const CLOUD_PROVIDERS = ["openai", "minimax"] as const',
    'const CAPABILITIES = ["writing", "images", "video"] as const',
    "LOOPBACK_ADDRESSES",
    "LOOPBACK_HOSTS",
    "length > 32 * 1024",
    "AbortSignal.timeout(15_000)",
    "mirrorLegacySelection",
    "assistantVerifiedAt: \"\"",
    "imageVerifiedAt: \"\"",
    "videoVerifiedAt: \"\"",
  ]) assert.ok(gateway.includes(contract), `Missing preserved model-catalog contract: ${contract}`);

  assert.doesNotMatch(gateway, /generateText|generateImage|createVideo|writeRoutingChoice/);
  assert.doesNotMatch(gateway, /0\.0\.0\.0|Invoke-Expression|\biex\b/i);
});
