import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1502 moves the BUZZ Story Bridge core pair to its ratified owner", async () => {
  await assert.rejects(access(new URL("core/story-workflow/buzz-story-bridge-core.mjs", root)));
  await assert.rejects(access(new URL("core/story-workflow/buzz-story-bridge-core.d.ts", root)));
  const implementation = await source("core/story-workflow/buzz/buzz-story-bridge-core.mjs");
  const contract = await source("core/story-workflow/buzz/buzz-story-bridge-core.d.ts");
  assert.ok(implementation.includes('from "../story-workflow-core.mjs"'));
  assert.ok(implementation.includes('from "../../buzz/nostr-event-verification.mjs"'));
  assert.ok(contract.includes('from "../story-workflow-core.mjs"'));
});

test("#1502 retargets all known live and CI consumers without a root compatibility shim", async () => {
  const checks = [
    ["build/story-workflow-buzz-bridge-gateway.ts", "../core/story-workflow/buzz/buzz-story-bridge-core.mjs"],
    ["modules/story-workflow/bridge/buzz-story-bridge.ts", "../../../core/story-workflow/buzz/buzz-story-bridge-core.mjs"],
    ["tests/issue-1422-buzz-story-bridge-hardening.test.mjs", "../core/story-workflow/buzz/buzz-story-bridge-core.mjs"],
    ["tests/issue-1422-buzz-story-bridge.test.mjs", "../core/story-workflow/buzz/buzz-story-bridge-core.mjs"],
  ];
  for (const [path, expected] of checks) {
    const content = await source(path);
    assert.ok(content.includes(expected), `${path} is not retargeted to the BUZZ core owner`);
    assert.ok(!content.includes("core/story-workflow/buzz-story-bridge-core.mjs"), `${path} still references the retired core root`);
  }
  const workflow = await source(".github/workflows/story-bridge.yml");
  assert.ok(workflow.includes('core/story-workflow/buzz/buzz-story-bridge-core.mjs'));
  assert.ok(workflow.includes('core/story-workflow/buzz/buzz-story-bridge-core.d.ts'));
  assert.ok(!workflow.includes('core/story-workflow/buzz-story-bridge-core.mjs'));
  assert.ok(!workflow.includes('core/story-workflow/buzz-story-bridge-core.d.ts'));
});

test("#1502 preserves BUZZ provenance-only and revision-safe authority boundaries", async () => {
  const implementation = await source("core/story-workflow/buzz/buzz-story-bridge-core.mjs");
  for (const boundary of [
    'authority: "proposal-evidence-only"',
    'BUZZ transport and signatures prove provenance only. Do not mutate PPF/canon',
    'verifyNostrEventSignature(input.rawEvent)',
    'The signed BUZZ contribution was authored by a different identity than the approved Agent binding.',
    'The BUZZ specialist result attempted to escape the Story Work Item target boundary.',
    'state: stale ? "stale" : "accepted"',
    'accepted: !stale',
  ]) assert.ok(implementation.includes(boundary), `BUZZ Story Bridge core lost boundary: ${boundary}`);
});

test("#1502 records exact completion while preserving the Phase 0 historical map", async () => {
  const architecture = JSON.parse(await source("config/repository-architecture-target.json"));
  const batch = architecture.moveBatches.find((item) => item.id === "phase2-core-story-buzz");
  assert.equal(batch?.sourceRoot, "core/story-workflow");
  assert.equal(batch?.targetRoot, "core/story-workflow/buzz");
  assert.equal(batch?.status, "completed");
  assert.deepEqual(batch?.completedSources, [
    "core/story-workflow/buzz-story-bridge-core.d.ts",
    "core/story-workflow/buzz-story-bridge-core.mjs",
  ]);
  assert.deepEqual(batch?.completedTargets, [
    "core/story-workflow/buzz/buzz-story-bridge-core.d.ts",
    "core/story-workflow/buzz/buzz-story-bridge-core.mjs",
  ]);
  const history = await source("docs/architecture/REPOSITORY-ARCHITECTURE-TARGET.md");
  assert.ok(history.includes('legacy root `core/story-workflow/buzz-story-bridge-core.*` → existing `core/story-workflow/buzz/`'));
});
