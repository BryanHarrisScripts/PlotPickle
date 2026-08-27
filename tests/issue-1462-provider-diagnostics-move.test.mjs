import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const exists = async (path) => access(new URL(path, root)).then(() => true, () => false);

test("#1462 moves provider diagnostics into the AI domain without changing its local recovery boundary", async () => {
  assert.equal(await exists("build/provider-diagnostics-gateway.ts"), false);
  assert.equal(await exists("build/ai/provider-diagnostics-gateway.ts"), true);

  const [gateway, host] = await Promise.all([
    source("build/ai/provider-diagnostics-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);

  assert.match(host, /from "\.\/ai\/provider-diagnostics-gateway"/);
  assert.match(host, /registerProviderDiagnosticsGateway\(server\)/);

  for (const contract of [
    'const API_ROOT = "/api/provider-diagnostics"',
    'const COMFYUI_PATH = `${API_ROOT}/comfyui`',
    "isLocalRequest(request)",
    "maximum = 64 * 1024",
    "normalizeLocalComfyUrl(body.baseUrl ?? store.comfyui.baseUrl)",
    "diagnoseComfyUI(baseUrl, store.comfyui.h3Workflow)",
    "store.comfyui.imageVerifiedAt = \"\"",
    "writeMediaRoutingStore(store)",
  ]) assert.ok(gateway.includes(contract), `Missing preserved provider diagnostics contract: ${contract}`);

  assert.doesNotMatch(gateway, /0\.0\.0\.0|Invoke-Expression|\biex\b/i);
});
