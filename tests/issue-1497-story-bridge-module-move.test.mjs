import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1497 moves the Story Bridge adapter to its ratified module owner", async () => {
  await assert.rejects(access(new URL("modules/story-workflow/buzz-story-bridge.ts", root)));
  const bridge = await source("modules/story-workflow/bridge/buzz-story-bridge.ts");
  assert.match(bridge, /from "\.\.\/\.\.\/\.\.\/core\/story-workflow\/buzz\/agent-identity-binding\.mjs"/);
  assert.match(bridge, /from "\.\.\/\.\.\/\.\.\/core\/story-workflow\/buzz-story-bridge-core\.mjs"/);
  assert.match(bridge, /from "\.\.\/\.\.\/\.\.\/core\/story-workflow\/story-workflow-core\.mjs"/);
  assert.match(bridge, /from "\.\.\/\.\.\/\.\.\/lib\/agents\/agent-profiles"/);
});

test("#1497 retargets the only runtime consumer without a compatibility shim", async () => {
  const gateway = await source("build/story-workflow-buzz-bridge-gateway.ts");
  assert.match(gateway, /\.\.\/modules\/story-workflow\/bridge\/buzz-story-bridge/);
  assert.doesNotMatch(gateway, /\.\.\/modules\/story-workflow\/buzz-story-bridge["']/);
});

test("#1497 preserves Story Bridge evidence-only and Human-authority boundaries", async () => {
  const bridge = await source("modules/story-workflow/bridge/buzz-story-bridge.ts");
  assert.match(bridge, /privacyClass: "private-project"/);
  assert.match(bridge, /federation: "private-only"/);
  assert.match(bridge, /agentExecutionContexts\(profile\.id\)\.includes\("public-buzz"\)/);
  assert.match(bridge, /signatureVerified: contribution\.provenance\.signatureVerified/);
  assert.match(bridge, /signature proves authorship, never truth and never permission to mutate PPF/);
});

test("#1497 preserves the Phase 0 record and marks the machine-readable move complete", async () => {
  const target = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.match(target, /`modules\/story-workflow\/buzz-story-bridge\.ts` → `modules\/story-workflow\/bridge\/`/);

  const contract = JSON.parse(await source("config/repository-architecture-target.json"));
  const batch = contract.moveBatches.find((item) => item.id === "phase2-modules-story-bridge");
  assert.equal(batch?.sourceRoot, "modules/story-workflow");
  assert.equal(batch?.targetRoot, "modules/story-workflow/bridge");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, ["modules/story-workflow/buzz-story-bridge.ts"]);
  assert.deepEqual(batch?.completedTargets, ["modules/story-workflow/bridge/buzz-story-bridge.ts"]);
});
