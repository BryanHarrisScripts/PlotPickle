import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

test("#1462 gives the ComfyUI diagnostics implementation one AI-domain owner and retires the root bridge", async () => {
  await access(new URL("build/ai/comfyui-connection-diagnostics.ts", root));
  await assert.rejects(access(new URL("build/comfyui-connection-diagnostics.ts", root)));
  const [diagnostics, provider, onboarding, routing] = await Promise.all([
    read("build/ai/comfyui-connection-diagnostics.ts"),
    read("build/ai/provider-diagnostics-gateway.ts"),
    read("build/ai/comfyui-onboarding-gateway.ts"),
    read("build/ai-routing-gateway.ts"),
  ]);

  assert.match(provider, /from "\.\/comfyui-connection-diagnostics"/);
  assert.match(onboarding, /from "\.\/comfyui-connection-diagnostics"/);
  assert.match(routing, /from "\.\/ai\/comfyui-connection-diagnostics"/);
  assert.doesNotMatch(routing, /from "\.\/comfyui-connection-diagnostics"/);
  assert.match(diagnostics, /import type \{ ComfyWorkflow \} from "\.\.\/media-routing-store"/);
});

test("#1462 preserves local-only ComfyUI trust and explicit setup authority", async () => {
  const diagnostics = await read("build/ai/comfyui-connection-diagnostics.ts");

  for (const contract of [
    'const DEFAULT_BASE_URL = "http://127.0.0.1:8188"',
    'new Set(["127.0.0.1", "localhost", "[::1]", "::1"])',
    "ComfyUI must use a local loopback address",
    "requiresUserConfirmation: true",
    "PlotPickle still owns provider choice, consent and generation routing",
    "never turn a generation request into an automatic third-party node installation",
  ]) assert.ok(diagnostics.includes(contract), `Missing ComfyUI trust contract: ${contract}`);

  assert.doesNotMatch(diagnostics, /shell:\s*true|partner_generate|auth_login|download_model|run_template/i);
});

test("#1462 keeps the AI target within the ratified direct-source ceiling", async () => {
  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  assert.equal(config.structuralCeilings.maxDirectSourceFiles, 16);
  const aiEntries = await import("node:fs/promises").then(({ readdir }) => readdir(new URL("build/ai/", root), { withFileTypes: true }));
  const directSourceCount = aiEntries.filter((entry) => entry.isFile() && /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)).length;
  assert.ok(directSourceCount <= config.structuralCeilings.maxDirectSourceFiles, `build/ai has ${directSourceCount} direct source files, above the ratified ceiling`);
});
