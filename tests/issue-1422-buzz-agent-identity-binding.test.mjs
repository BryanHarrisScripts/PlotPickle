import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeBuzzAgentIdentityBindings,
  resolveBuzzAgentIdentityBinding,
} from "../core/story-workflow/buzz/agent-identity-binding.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normalizes only valid public BUZZ Agent keys", () => {
  const valid = "A".repeat(64);
  const bindings = normalizeBuzzAgentIdentityBindings({
    tamsin: valid,
    missing: "",
    malformed: "not-a-key",
    object: { pubkey: valid },
  });
  assert.deepEqual(bindings, { tamsin: valid.toLowerCase() });
});

test("uses a machine-local signer when the distributed registry is intentionally unbound", () => {
  const pubkey = "b".repeat(64);
  assert.equal(resolveBuzzAgentIdentityBinding({
    profileId: "tamsin-hearthquill",
    configuredPubkey: "",
    localBindings: { "tamsin-hearthquill": pubkey },
  }), pubkey);
});

test("configured official signer wins when the local binding agrees", () => {
  const pubkey = "c".repeat(64);
  assert.equal(resolveBuzzAgentIdentityBinding({
    profileId: "tamsin-hearthquill",
    configuredPubkey: pubkey.toUpperCase(),
    localBindings: { "tamsin-hearthquill": pubkey },
  }), pubkey);
});

test("fails closed when local and configured signers disagree", () => {
  assert.throws(() => resolveBuzzAgentIdentityBinding({
    profileId: "tamsin-hearthquill",
    configuredPubkey: "d".repeat(64),
    localBindings: { "tamsin-hearthquill": "e".repeat(64) },
  }), /does not match the configured official signer/);
});

test("returns no signer for invalid or absent local state", () => {
  assert.equal(resolveBuzzAgentIdentityBinding({
    profileId: "tamsin-hearthquill",
    localBindings: { "tamsin-hearthquill": "invalid" },
  }), "");
  assert.equal(resolveBuzzAgentIdentityBinding({
    profileId: "tamsin-hearthquill",
    localBindings: {},
  }), "");
});

test("publishes verified local signer bindings into the Vite server runtime consumed by Story Bridge", async () => {
  const [loader, adapter, vite] = await Promise.all([
    read("build/buzz-agent-identity-binding-loader.ts"),
    read("modules/story-workflow/buzz-story-bridge.ts"),
    read("vite.config.ts"),
  ]);
  const runtimeKey = "__PLOTPICKLE_BUZZ_AGENT_IDENTITIES_RUNTIME__";
  assert.ok(loader.includes(runtimeKey), "The local binding loader must publish the verified map to the server runtime.");
  assert.ok(loader.includes("publishRuntimeBindings(normalizeBuzzAgentIdentityBindings(document.bindings))"));
  assert.ok(adapter.includes(runtimeKey), "Story Bridge must consume the server-runtime signer map.");
  assert.ok(adapter.includes("if (runtime && Object.keys(runtime).length) return runtime;"));
  assert.ok(vite.includes("await loadLocalBuzzAgentIdentityBindings()"), "Vite serve startup must load and publish the local signer map before requests arrive.");
});
