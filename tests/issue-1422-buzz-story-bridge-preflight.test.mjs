import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gateway = await readFile(new URL("../build/story-workflow-buzz-bridge-gateway.ts", import.meta.url), "utf8");
const buzzGateway = await readFile(new URL("../build/buzz-gateway.ts", import.meta.url), "utf8");

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

test("#1422 Story Bridge targets the approved Agent signer as an explicit BUZZ recipient", () => {
  assert.match(gateway, /mentionPubkeys:\s*\[bridge\.expectedAgentPubkey\]/,
    "The Story Bridge dispatch must carry the approved signer pubkey to the BUZZ transport instead of relying on ambiguous display-name text.");
  assert.match(buzzGateway, /messageMentionPubkeys\(body\.mentionPubkeys\)/,
    "The local BUZZ message gateway must parse the bounded explicit recipient list.");
  assert.match(buzzGateway, /args\.push\(\"--mention\", pubkey\)/,
    "The local BUZZ gateway must translate each approved recipient to BUZZ CLI --mention semantics.");
  assert.match(buzzGateway, /Buzz explicit mentions must be 64-character hexadecimal public keys\./,
    "Explicit Agent recipients must stay public-key scoped and validated before reaching the CLI.");
  assert.doesNotMatch(gateway, /8fc7aacfa646d49b08f3667fa951269acfbedc7cf8dd18c1144de535d7d1cfa6/i,
    "The live Tamsin signer must come from the approved local binding and must never be hard-coded into production Story Bridge source.");
});
