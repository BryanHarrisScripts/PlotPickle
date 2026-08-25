import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeBuzzAgentIdentityBindings,
  resolveBuzzAgentIdentityBinding,
} from "../core/story-workflow/buzz/agent-identity-binding.mjs";

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
