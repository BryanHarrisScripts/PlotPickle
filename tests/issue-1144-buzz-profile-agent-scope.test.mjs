import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService, profileStoragePaths } from "../core/storage/profile-private/profile-private-storage-core.mjs";
import { createProfileAgentScopeService } from "../core/agents/profile-agent-scope-core.mjs";

const PASSWORD_A = "Bryan BUZZ profile scope passphrase 2026";
const PASSWORD_B = "Jane BUZZ profile scope passphrase 2026";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1144-"));
  const auth = await createPlotPickleAuthService({
    nodeId: "node-1144-profile-agent-scope",
    accessMode: "desktop-loopback",
    stateStore: createInMemoryAuthStateStore(),
  });
  const bryan = await auth.createFirstProfile({ displayName: "Bryan", password: PASSWORD_A, avatarRef: null });
  const jane = await auth.createProfile({ displayName: "Jane", password: PASSWORD_B, avatarRef: null }, bryan.authContext);
  const storage = createProfilePrivateStorageService({ root, authService: auth });
  const scope = createProfileAgentScopeService({ authService: auth, privateStorage: storage });
  return {
    root,
    auth,
    storage,
    scope,
    bryan,
    jane,
    async close() {
      storage.close();
      auth.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function buzzIdentity(label, privateKey) {
  return {
    version: 1,
    mode: "existing-relay",
    relayUrl: "wss://community.example.test",
    community: "PlotPickle Community",
    identityLabel: label,
    cliPath: "buzz",
    privateKey,
    verifiedAt: "2026-08-20T20:00:00.000Z",
    verificationVersion: 2,
  };
}

const sage = { agentDefinitionId: "sage", projectId: "afterglow", conversationId: "creative-room-1" };

test("#1144 stores distinct Human BUZZ signers in the authenticated profile vault and never in clear text", async () => {
  const setup = await fixture();
  try {
    const bryanSecret = "synthetic-bryan-buzz-private-key";
    const janeSecret = "synthetic-jane-buzz-private-key";
    await setup.scope.writeHumanBuzzIdentity(setup.bryan.authContext, buzzIdentity("Bryan BUZZ", bryanSecret));
    await setup.scope.writeHumanBuzzIdentity(setup.jane.authContext, buzzIdentity("Jane BUZZ", janeSecret));

    assert.equal((await setup.scope.readHumanBuzzIdentity(setup.bryan.authContext)).privateKey, bryanSecret);
    assert.equal((await setup.scope.readHumanBuzzIdentity(setup.jane.authContext)).privateKey, janeSecret);

    const bryanFile = path.join(profileStoragePaths(setup.root, setup.bryan.profile.profileId).credentials, "buzz-connection.json");
    const janeFile = path.join(profileStoragePaths(setup.root, setup.jane.profile.profileId).credentials, "buzz-connection.json");
    const [bryanEnvelope, janeEnvelope] = await Promise.all([readFile(bryanFile, "utf8"), readFile(janeFile, "utf8")]);
    assert.match(bryanEnvelope, /plotpickle-profile-private-object/);
    assert.match(janeEnvelope, /plotpickle-profile-private-object/);
    assert.doesNotMatch(bryanEnvelope, new RegExp(bryanSecret));
    assert.doesNotMatch(janeEnvelope, new RegExp(janeSecret));
    assert.notEqual(bryanEnvelope, janeEnvelope);
  } finally {
    await setup.close();
  }
});

test("#1144 keeps no-BUZZ profiles usable and logout of one Human does not disconnect another signer", async () => {
  const setup = await fixture();
  try {
    assert.equal(await setup.scope.readHumanBuzzIdentity(setup.bryan.authContext), null);
    assert.equal(await setup.scope.readHumanBuzzIdentity(setup.jane.authContext), null);
    await setup.storage.writePrivateJson(setup.bryan.authContext, { domain: "settings", objectId: "local-only", value: { learnWorks: true } });
    assert.deepEqual(await setup.storage.readPrivateJson(setup.bryan.authContext, { domain: "settings", objectId: "local-only" }), { learnWorks: true });

    await setup.scope.writeHumanBuzzIdentity(setup.bryan.authContext, buzzIdentity("Bryan BUZZ", "synthetic-bryan-key"));
    await setup.scope.writeHumanBuzzIdentity(setup.jane.authContext, buzzIdentity("Jane BUZZ", "synthetic-jane-key"));
    assert.equal(setup.auth.lock(setup.bryan.authContext), true);
    await assert.rejects(setup.scope.readHumanBuzzIdentity(setup.bryan.authContext), (error) => error?.code === "SESSION_REJECTED");
    assert.equal((await setup.scope.readHumanBuzzIdentity(setup.jane.authContext)).identityLabel, "Jane BUZZ");
  } finally {
    await setup.close();
  }
});

test("#1144 keys creative-agent instances and memory by Human, definition, project and conversation", async () => {
  const setup = await fixture();
  try {
    const bryanInstance = setup.scope.resolveInstance(setup.bryan.authContext, sage);
    const janeInstance = setup.scope.resolveInstance(setup.jane.authContext, sage);
    const otherProject = setup.scope.resolveInstance(setup.bryan.authContext, { ...sage, projectId: "wyrmwood" });
    const otherThread = setup.scope.resolveInstance(setup.bryan.authContext, { ...sage, conversationId: "creative-room-2" });
    assert.notEqual(bryanInstance.instanceId, janeInstance.instanceId);
    assert.notEqual(bryanInstance.instanceId, otherProject.instanceId);
    assert.notEqual(bryanInstance.instanceId, otherThread.instanceId);
    assert.equal(bryanInstance.humanCommunityAuthority, false);
    assert.equal(bryanInstance.authorship, "agent");

    const bryanMemory = "Bryan-only Sage story memory";
    const janeMemory = "Jane-only Sage story memory";
    await setup.scope.writeMemory(setup.bryan.authContext, { ...sage, value: bryanMemory });
    await setup.scope.writeMemory(setup.jane.authContext, { ...sage, value: janeMemory });
    assert.equal(await setup.scope.readMemory(setup.bryan.authContext, sage), bryanMemory);
    assert.equal(await setup.scope.readMemory(setup.jane.authContext, sage), janeMemory);
    assert.equal(await setup.scope.readMemory(setup.bryan.authContext, { ...sage, conversationId: "creative-room-2" }), null);
  } finally {
    await setup.close();
  }
});

test("#1144 grants agent BUZZ access narrowly by Human instance, room and action without Human signer substitution", async () => {
  const setup = await fixture();
  try {
    const grant = await setup.scope.grantBuzz(setup.bryan.authContext, {
      ...sage,
      roomId: "guildhall-story-craft",
      actions: ["read", "post"],
    });
    assert.equal(grant.authorship, "agent");
    assert.equal(grant.humanSignerSubstitution, false);
    assert.equal(grant.inheritedAcrossRooms, false);
    assert.equal(grant.projectPrivateData, false);
    assert.equal(await setup.scope.authorizeBuzz(setup.bryan.authContext, { ...sage, roomId: "guildhall-story-craft", action: "post" }), true);
    assert.equal(await setup.scope.authorizeBuzz(setup.bryan.authContext, { ...sage, roomId: "guildhall-story-craft", action: "moderate" }), false);
    assert.equal(await setup.scope.authorizeBuzz(setup.bryan.authContext, { ...sage, roomId: "guildhall-visuals", action: "post" }), false);
    assert.equal(await setup.scope.authorizeBuzz(setup.jane.authContext, { ...sage, roomId: "guildhall-story-craft", action: "post" }), false);
  } finally {
    await setup.close();
  }
});

test("#1144 bounds Merrin to granted room content and gives Node operational agents no Human vault authority", async () => {
  const setup = await fixture();
  try {
    const merrin = { agentDefinitionId: "merrin", projectId: null, conversationId: "moderation-room-thread" };
    const grant = await setup.scope.grantBuzz(setup.bryan.authContext, {
      ...merrin,
      roomId: "community-main",
      actions: ["read", "moderate"],
    });
    assert.equal(grant.contentAccess, "room-content-only");
    assert.equal(grant.projectPrivateData, false);
    assert.equal(await setup.scope.authorizeBuzz(setup.bryan.authContext, { ...merrin, roomId: "community-main", action: "moderate" }), true);
    assert.equal(await setup.scope.authorizeBuzz(setup.bryan.authContext, { ...merrin, roomId: "private-story-room", action: "read" }), false);

    const operational = setup.scope.describeOperationalAgent("ben-validation");
    assert.equal(operational.scope, "node-operational");
    assert.equal(operational.humanProfileAccess, false);
    assert.equal(operational.humanVaultAccess, false);
    assert.equal(operational.humanBuzzSignerAccess, false);
    assert.equal(operational.inheritedHumanPermissions, false);
  } finally {
    await setup.close();
  }
});

test("#1144 resolves the live Human signer from cookie-backed AuthContext rather than browser-selected profile or process-global caller state", async () => {
  const [contextSource, credentialSource, viteSource] = await Promise.all([
    readFile(new URL("../build/auth/profile-request-context.ts", import.meta.url), "utf8"),
    readFile(new URL("../build/local-credentials.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(contextSource, /AsyncLocalStorage<ProfileRequestContext>/);
  assert.match(contextSource, /boundary\.authorizeRequest\(sessionRequest\(request, origin\)\)/);
  assert.match(contextSource, /getAuthStatus\(authContext\)\.profile\?\.profileId/);
  assert.doesNotMatch(contextSource, /searchParams\.get\(["']profileId["']\)/);
  assert.doesNotMatch(contextSource, /headers\[["']x-plotpickle-profile/i);
  assert.doesNotMatch(contextSource, /let\s+current(?:Profile|Caller|Signer)/);

  assert.match(credentialSource, /PROFILE_SCOPED_BUZZ_CREDENTIAL\s*=\s*["']buzz-connection\.json["']/);
  assert.match(credentialSource, /privateStorage\.readCredential\(profileContext\.authContext, safeName\)/);
  assert.match(credentialSource, /privateStorage\.writeCredential\(profileContext\.authContext, safeName, value\)/);
  assert.match(credentialSource, /if \(name !== PROFILE_SCOPED_BUZZ_CREDENTIAL\) return null/);

  const contextIndex = viteSource.indexOf("profileScopedBuzzRequestContext()");
  const firstBuzzIndex = viteSource.indexOf("buzzBundleNormalizer()");
  assert.ok(contextIndex >= 0 && firstBuzzIndex > contextIndex, "profile AuthContext must be established before every BUZZ gateway");
});

test("#1144 keeps every legacy BUZZ gateway behind the common profile-scoped credential seam", async () => {
  const files = [
    "buzz-gateway.ts",
    "buzz-live-health-gateway.ts",
    "buzz-guildhall-gateway.ts",
    "buzz-agent-roster-gateway.ts",
    "buzz-human-identity-guard.ts",
    "buzz-community-gateway.ts",
    "buzz-story-room-access-gateway.ts",
  ];
  for (const file of files) {
    const source = await readFile(new URL(`../build/${file}`, import.meta.url), "utf8");
    assert.match(source, /readCredentialJson/);
    assert.match(source, /buzz-connection\.json/);
    assert.doesNotMatch(source, /credentialFilePath\(/);
  }
});
