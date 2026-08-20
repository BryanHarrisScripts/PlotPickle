import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Community caller is derived from the verified Buzz signer, never the friendly local label", async () => {
  const [community, guard, workspace] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("build/buzz-human-identity-guard.ts"),
    read("app/community-workspace.tsx"),
  ]);

  assert.match(guard, /export async function inspectConnectedHuman/);
  assert.match(community, /inspectConnectedHuman/);
  assert.match(community, /identityLabel: humanIdentity\?\.displayName \|\| ""/);
  assert.match(community, /friendlyIdentityLabel: connection\?\.identityLabel \|\| ""/);
  assert.match(community, /callerPubkey: humanIdentity\?\.pubkey \|\| ""/);
  assert.match(community, /humanCommunityAllowed/);
  assert.match(community, /identityVerified: buzzIdentityVerified && humanCommunityAllowed/);
  assert.match(community, /if \(!connection \|\| !buzzIdentityVerified \|\| !humanCommunityAllowed\) return base/);

  assert.match(workspace, /<small>CALLER<\/small><br \/><strong>\{community\?\.identityLabel \|\| "UNVERIFIED WRITER"\}<\/strong>/);
  assert.match(workspace, /const connected = Boolean\(community\?\.identityVerified && community\.greatHall\)/);
  assert.match(workspace, /disabled=\{!connected \|\| !hallDraft\.trim\(\) \|\| Boolean\(busy\)\}/);
});

test("an agent signer fails closed for human Community while retaining the separate friendly label", async () => {
  const [community, guard] = await Promise.all([
    read("build/buzz-community-gateway.ts"),
    read("build/buzz-human-identity-guard.ts"),
  ]);

  assert.match(guard, /kind: "agent"/);
  assert.match(guard, /humanCommunityAllowed: false/);
  assert.match(guard, /Sage is your PlotPickle guide; Sage is not your Community identity/);
  assert.match(community, /message: humanIdentity && !humanCommunityAllowed/);
  assert.match(community, /\? humanIdentity\.message/);
  assert.doesNotMatch(community, /identityLabel: connection\?\.identityLabel \|\| ""/);
});
