import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1222 hardwires the official PlotPickle Community descriptor and default relay", async () => {
  const community = await source("lib/buzz-default-community.ts");
  assert.match(community, /name:\s*["']PlotPickle Community BBS["']/);
  assert.match(community, /displayName:\s*["']PlotPickle Playhouse["']/);
  assert.match(community, /relayUrl:\s*["']wss:\/\/plotpickleplayhouse\.communities\.buzz\.xyz["']/);
  assert.match(community, /plotpickle-community-bbs-ad08e6622fce447297d2f893774d654d/);
  assert.match(community, /greatHallName:\s*["']great-hall["']/);
  assert.match(community, /requiredConnection:\s*true/);
  assert.match(community, /removableByHuman:\s*false/);
});

test("#1222 Profile uses the built-in Community and does not ask the Human to type the default relay", async () => {
  const profile = await source("app/profile-access/profile-identity-panel.tsx");
  assert.match(profile, /PLOTPICKLE_BUZZ_COMMUNITY\.relayUrl/);
  assert.match(profile, /PLOTPICKLE_BUZZ_COMMUNITY\.displayName/);
  assert.match(profile, /Get BUZZ Identity/);
  assert.match(profile, /Connect Existing Identity/);
  assert.doesNotMatch(profile, /<span>BUZZ community address<\/span>/i);
  assert.doesNotMatch(profile, /setRelayUrl/);
  assert.doesNotMatch(profile, /Create BUZZ Identity/);
});

test("#1222 keeps Human signer setup in Profile and Settings limited to transport/runtime diagnostics", async () => {
  const [settings, profile] = await Promise.all([
    source("app/buzz-settings-panel.tsx"),
    source("app/profile-access/profile-identity-panel.tsx"),
  ]);
  assert.match(settings, /PLOTPICKLE_BUZZ_COMMUNITY\.relayUrl/);
  assert.match(settings, /BUZZ creates identities; Profile connects\/disconnects the Human signer/);
  assert.match(settings, /BUZZ owns Human identity creation; Profile owns connect\/disconnect/);
  assert.match(settings, /Save & test transport/);
  assert.doesNotMatch(settings, /Signer creation\/import\/disconnect belongs to Profile/);
  assert.doesNotMatch(settings, /Buzz private identity key/);
  assert.doesNotMatch(settings, /Community name \(optional\)/);
  assert.doesNotMatch(settings, /Remove connection and identity/);
  assert.match(profile, /Get BUZZ Identity/);
  assert.match(profile, /Connect Existing Identity/);
  assert.match(profile, /Private identity key/);
});

test("#1222 imported signer validates locally and persists even when Community admission is pending", async () => {
  const gateway = await source("build/buzz-profile-identity-gateway.ts");
  const importStart = gateway.indexOf('if (action === "import")');
  const disconnectStart = gateway.indexOf('if (action === "disconnect")');
  assert.ok(importStart >= 0 && disconnectStart > importStart);
  const block = gateway.slice(importStart, disconnectStart);
  const localValidationIndex = block.indexOf("privateKeyHex(privateKey)");
  const remoteVerifyIndex = block.indexOf("await verifyConnectedSigner(connection)");
  const writeIndex = block.indexOf("await writeCredentialJson(CONNECTION_FILE, connection)");
  assert.ok(localValidationIndex >= 0, "import must cryptographically validate the candidate signer locally");
  assert.ok(remoteVerifyIndex > localValidationIndex, "Community verification happens only after local identity validation");
  assert.ok(writeIndex > remoteVerifyIndex, "the validated Human identity must be persisted after the bounded Community attempt");
  assert.match(block, /pendingCommunityIdentity\(connection, localPubkey, detail\)/);
  assert.match(block, /communityReady = false/);
  assert.match(block, /communityReady,/);
  assert.match(block, /verificationVersion = 2/);
  assert.match(block, /identityPubkey = verification\.pubkey/);
  assert.match(block, /identityRole = "human"/);
  assert.match(block, /if \(\/PlotPickle agent identity\/i\.test\(detail\)\) throw error/);
});

test("#1222 Profile distinguishes connected identity from Community readiness", async () => {
  const profile = await source("app/profile-access/profile-identity-panel.tsx");
  assert.match(profile, /communityReady\?: boolean/u);
  assert.match(profile, /action: "import"/u);
  assert.match(profile, /if \(body\.communityReady === false\)/u);
  assert.match(profile, /Connected · Community access pending/u);
  assert.match(profile, /validates the signer locally, stores it securely for this Human, then checks access to PlotPickle Playhouse/u);
  assert.match(profile, /busy === "import" \? "Working…" : "Connect identity"/u);
});

test("#1222 maps BUZZ CLI exit classes, membership failures and redacts private identity material", async () => {
  const failure = await source("build/buzz-cli-failure.ts");
  assert.match(failure, /case 1:/);
  assert.match(failure, /case 2:[\s\S]*relay could not be reached/i);
  assert.match(failure, /case 3:[\s\S]*relay rejected signed authentication/i);
  assert.match(failure, /Community membership or relay authorization may still be required/i);
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