import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gateway = await readFile(new URL("../build/story-workflow-buzz-bridge-gateway.ts", import.meta.url), "utf8");

test("#1422 Story Bridge uses the authoritative Human identity guard before real BUZZ transport", () => {
  const identityReady = gateway.match(/function humanIdentityReady\(identity: HumanBuzzIdentity\) \{([\s\S]*?)\n\}/)?.[1] || "";

  assert.match(identityReady, /identity\.ready/);
  assert.match(identityReady, /identity\.identityVerified/);
  assert.match(identityReady, /identity\.humanCommunityAllowed/);
  assert.match(identityReady, /identity\.kind === \"human\"/);
  assert.match(gateway, /\/api\/local-buzz\/human-identity/,
    "Story Bridge must use the same authoritative Human identity guard as Profile, Community, and Settings.");
  assert.doesNotMatch(gateway, /localJson<BuzzStatus>\(request, \"\/api\/local-buzz\/status\"/,
    "Story Bridge must not infer Human signer authority from the generic BUZZ connection summary.");
  assert.match(gateway, /The connected Human BUZZ transport identity is not verified\./);

  for (const realOperation of [
    "/api/local-buzz/rooms?projectPrefix=",
    "/api/local-buzz/rooms/ensure",
    "ensurePrivateBuzzAgentMembership",
    "/api/local-buzz/messages",
  ]) assert.ok(gateway.includes(realOperation), `Story Bridge must still use the real BUZZ operation: ${realOperation}`);
});
