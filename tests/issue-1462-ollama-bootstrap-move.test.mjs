import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

test("#1462 Ollama bootstrap slice retires the root gateway and preserves its bounded local-only contract", async () => {
  await assert.rejects(access(new URL("build/ollama-bootstrap-gateway.ts", root)), "the retired Ollama root path must stay absent");
  await access(new URL("build/ai/ollama-bootstrap-gateway.ts", root));

  const [host, gateway, issue358, configText] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/ai/ollama-bootstrap-gateway.ts"),
    read("tests/issue-358-companion-inventory-ollama-bootstrap.test.mjs"),
    read("config/repository-architecture-target.json"),
  ]);

  assert.match(host, /\.\/ai\/ollama-bootstrap-gateway/);
  assert.doesNotMatch(host, /\.\/ollama-bootstrap-gateway["']/);
  assert.match(gateway, /\.\.\/\.\.\/config\/ollama-starter-model\.json/);
  assert.match(gateway, /const API_PATH = "\/api\/ollama-bootstrap\/starter-model"/);
  assert.match(gateway, /const OLLAMA_BASE_URL = "http:\/\/127\.0\.0\.1:11434"/);
  assert.match(gateway, /PULL_TIMEOUT_MS = 15 \* 60 \* 1_000/);
  assert.match(gateway, /isLocalRequest\(request\)/);
  assert.match(gateway, /request\.method !== "POST"/);
  assert.match(gateway, /JSON\.stringify\(\{ model: STARTER_MODEL, stream: false \}\)/);
  assert.doesNotMatch(gateway, /0\.0\.0\.0|requestedModel|\bbody\.model\b|readBody\s*\(/i);
  assert.match(issue358, /build\/ai\/ollama-bootstrap-gateway\.ts/);

  const config = JSON.parse(configText);
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");
  assert.notEqual(batch?.status, "completed", "the AI batch must remain open while other ratified AI roots remain");
});
