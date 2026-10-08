import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(file, "utf8");

test("PP-WRITE-001 T4-T6: test request verifies the exact Local Quality model used by Bubble", async () => {
  const [gateway, route, runtimePanel] = await Promise.all([
    read("build/writing-assistant-gateway.ts"),
    read("app/api/previs/narration/route.ts"),
    read("app/local-runtime-panel.tsx"),
  ]);
  assert.match(gateway, /const localRole = body\.modelRole === "quality" \? "quality" : "fast"/u);
  assert.match(gateway, /if \(provider === "local"\) await refreshLocalProfile\(store, localRole\)/u);
  assert.match(gateway, /const result = await testAssistantProfile\(store, provider\)/u);
  assert.match(route, /resolveConfiguredLocalNarrationProfile\(\)/u);
  assert.match(runtimePanel, /body: JSON\.stringify\(\{ provider: "local", modelRole: "quality" \}\)/u);
  assert.match(runtimePanel, /"\/api\/writing-assistant\/test"/u);
  assert.match(runtimePanel, /if \(!response\.ok \|\| !result\.ok \|\| !result\.verifiedAt \|\| !result\.model\)/u);
  assert.doesNotMatch(runtimePanel, /writingTest\.ready = true/u);
});

test("PP-WRITE-001 T4/T7: Local Writing distinguishes automatic Quality and Ollama; media catalog does not verify Writing", async () => {
  const [local, readiness] = await Promise.all([
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("core/contracts/compute/compute-readiness.mjs"),
  ]);
  assert.match(local, /return \[automaticLocalWritingConnection\(capability\), ollamaConnection\(capability\)\]/u);
  assert.match(local, /options\.local/u);
  assert.match(local, /options\.ollama/u);
  assert.match(readiness, /configured && verifiedAt && available && !error/u);
});

test("PP-WRITE-001 T1-T10: human contract persists as executable traceable truths", async () => {
  const contract = await read("docs/behavioral-contracts/PP-WRITE-001.md");
  for (let n = 1; n <= 10; n++) assert.match(contract, new RegExp(`\\*\\*T${n} \\—`));
  assert.match(contract, /Collect comprehensively/u);
  assert.match(contract, /Retrieve selectively/u);
  assert.match(contract, /Decide precisely/u);
});
