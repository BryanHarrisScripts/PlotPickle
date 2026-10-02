import assert from "node:assert/strict";
import test from "node:test";
import { CliCraftAdapter, LocalHostCraftAdapter, executeCraftRuntime, governedCraftRuntimeRequest } from "../core/learning/craft-runtime-adapters.ts";

test("#2678 two runtimes execute the same provider-neutral craft contract", async () => {
  const request = governedCraftRuntimeRequest({ capabilityId: "craft-theme", mode: "learn", input: "What is the controlling idea?", supportingCapabilityIds: [] });
  const host = await executeCraftRuntime(new LocalHostCraftAdapter(async () => "host answer"), request);
  const cli = await executeCraftRuntime(new CliCraftAdapter(async () => "cli answer"), request);
  assert.equal(host.mode, "learn");
  assert.equal(cli.mode, "learn");
  assert.equal(host.capabilityId, cli.capabilityId);
  assert.equal(host.canonical, false);
  assert.equal(cli.canonical, false);
});

test("#2678 adapters cannot expand bounded supporting capability fan-out", () => {
  assert.throws(() => governedCraftRuntimeRequest({ capabilityId: "craft-theme", mode: "learn", input: "x", supportingCapabilityIds: ["a", "b", "c"] }), /fan-out/);
});

test("#2678 runtime cannot change invocation mode or capability identity", async () => {
  const bad = { kind: "sidecar", hostSelected: true, async execute() { return { capabilityId: "craft-character", mode: "authoring-proposal", text: "bad", runtime: "sidecar", canonical: false }; } };
  await assert.rejects(() => executeCraftRuntime(bad, { capabilityId: "craft-theme", mode: "learn", input: "x", supportingCapabilityIds: [] }), /changed the governed invocation contract/);
});
