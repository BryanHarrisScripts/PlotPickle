import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1222 hardwires the official PlotPickle Community descriptor and default relay", async () => {
  const community = await source("lib/buzz-default-community.ts");
  assert.match(community, /name:\s*["']PlotPickle Community BBS["']/);
  assert.match(community, /relayUrl:\s*["']wss:\/\/plotpickleplayhouse\.communities\.buzz\.xyz["']/);
  assert.match(community, /plotpickle-community-bbs-ad08e6622fce447297d2f893774d654d/);
  assert.match(community, /greatHallName:\s*["']great-hall["']/);
});

test("#1222 Profile uses the built-in Community and does not ask the Human to type the default relay", async () => {
  const profile = await source("app/profile-access/profile-identity-panel.tsx");
  assert.match(profile, /PLOTPICKLE_BUZZ_COMMUNITY\.relayUrl/);
  assert.match(profile, /PLOTPICKLE_BUZZ_COMMUNITY\.name/);
  assert.doesNotMatch(profile, /<span>BUZZ community address<\/span>/i);
  assert.doesNotMatch(profile, /setRelayUrl/);
});

test("#1222 keeps Human signer setup in Profile and Settings limited to transport/runtime diagnostics", async () => {
  const [settings, profile] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("app/profile-access/profile-identity-panel.tsx"),
  ]);
  assert.match(settings, /PLOTPICKLE_BUZZ_COMMUNITY\.relayUrl/);
  assert.match(settings, /Profile owns Human signer creation\/import\/disconnect/);
  assert.match(settings, /Save & test transport/);
  assert.doesNotMatch(settings, /Buzz private identity key/);
  assert.doesNotMatch(settings, /Community name \(optional\)/);
  assert.doesNotMatch(settings, /Remove connection and identity/);
  assert.match(profile, /Connect Existing Identity/);
  assert.match(profile, /Private identity key/);
});

test("#1222 imported signer is verified before it is persisted", async () => {
  const gateway = await source("build/buzz-profile-identity-gateway.ts");
  const importStart = gateway.indexOf('if (action === "import")');
  const disconnectStart = gateway.indexOf('if (action === "disconnect")');
  assert.ok(importStart >= 0 && disconnectStart > importStart);
  const block = gateway.slice(importStart, disconnectStart);
  const verifyIndex = block.indexOf("await verifyConnectedSigner(connection)");
  const writeIndex = block.indexOf("await writeCredentialJson(CONNECTION_FILE, connection)");
  assert.ok(verifyIndex >= 0, "import must verify the candidate signer against BUZZ");
  assert.ok(writeIndex > verifyIndex, "candidate signer must not be persisted before verification succeeds");
  assert.match(block, /if \(!identity\.humanCommunityAllowed\) throw new Error\(identity\.message\)/);
  assert.match(block, /verificationVersion = 2/);
});

test("#1222 maps BUZZ CLI exit classes, membership failures and redacts private identity material", async () => {
  const failure = await source("build/buzz-cli-failure.ts");
  assert.match(failure, /case 1:/);
  assert.match(failure, /case 2:[\s\S]*relay could not be reached/i);
  assert.match(failure, /case 3:[\s\S]*private identity key/i);
  assert.match(failure, /case 5:[\s\S]*write conflict/i);
  assert.match(failure, /relay\[_ -\]\?membership/);
  assert.match(failure, /not a member of the PlotPickle Community/i);
  assert.match(failure, /replace\(NSEC, "\[redacted-nsec\]"\)/);
  assert.match(failure, /replace\(HEX_SECRET, "\[redacted-secret\]"\)/);

  const gateway = await source("build/buzz-profile-identity-gateway.ts");
  assert.match(gateway, /buzzCliFailure\(code, stderr \|\| stdout\)/);
  assert.doesNotMatch(gateway, /reject\(new Error\(stderr \|\| stdout/);
});

test("#1222 uses a generic lore glyph only when no custom Human avatar exists", async () => {
  const [community, profile] = await Promise.all([
    source("lib/buzz-default-community.ts"),
    source("app/profile-access/profile-identity-panel.tsx"),
  ]);
  assert.match(community, /DEFAULT_HUMAN_LORE_GLYPH/);
  assert.match(profile, /presentation\.avatarUrl \? <img/);
  assert.match(profile, /data-default-lore-glyph=["']true["']/);
  assert.match(profile, /DEFAULT_HUMAN_LORE_GLYPH/);
});