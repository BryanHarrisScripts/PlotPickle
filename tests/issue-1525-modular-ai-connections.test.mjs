import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1525 keeps execution location separate from connection method and provider identity", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /title: "Remote Compute"/);
  assert.match(compute, />My Private Server</);
  assert.match(compute, />Cloud Server Farm</);
  assert.match(compute, /such as AtlasCloud/);
  assert.match(compute, />Provider Cloud</);
  assert.match(compute, /Google Gemini, OpenAI or MiniMax/);

  assert.match(compute, />Provider API</);
  assert.match(compute, />OpenAI-Compatible API</);
  assert.match(compute, />MCP</);
  assert.match(compute, /MCP is a connection mechanism for tools\/services, not an AI model identity/);
});

test("#1525 preserves explicit local and paid-cloud authority boundaries", async () => {
  const compute = await read("app/settings/compute/ai-compute-workspace.tsx");

  assert.match(compute, /badge: "THIS COMPUTER"/);
  assert.match(compute, /badge: "REMOTE \/ CLOUD"/);
  assert.match(compute, /No local failure silently promotes work to a paid provider/);
  assert.match(compute, /credentials and paid-use consent stay explicit/);
});
