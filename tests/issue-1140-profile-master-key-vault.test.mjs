import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PROFILE_VAULT_STATES,
  createInMemoryAuthStateStore,
  createJsonFileAuthStateStore,
  createPlotPickleAuthService,
  toPublicAuthError,
} from "../core/auth/plotpickle-auth-core.mjs";
import {
  ARGON2ID_SECURITY_FLOOR,
  unwrapProfileMasterKeyWithPassword,
  unwrapProfileMasterKeyWithRecovery,
} from "../core/auth/profile-crypto-contract-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const nodeId = "node_profile_vault_fixture";
const passwordA = "Profile A vault passphrase";
const passwordB = "Profile B independent passphrase";
const replacementPassword = "Replacement vault passphrase β";

function serviceOptions(stateStore, overrides = {}) {
  return {
    nodeId,
    accessMode: "desktop-loopback",
    stateStore,
    passwordParameters: ARGON2ID_SECURITY_FLOOR,
    ...overrides,
  };
}

function recoveryBytes(value) {
  const encoded = value.startsWith("pprec1.") ? value.split(".")[1] : value;
  return new Uint8Array(Buffer.from(encoded, "base64url"));
}

function mutateBase64Url(value) {
  const bytes = Buffer.from(value, "base64url");
  bytes[bytes.length - 1] ^= 1;
  return bytes.toString("base64url");
}

async function createFixture(overrides = {}) {
  const stateStore = overrides.stateStore || createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore, overrides.options));
  const created = await auth.createFirstProfile({ displayName: "Profile A", password: passwordA, avatarRef: null });
  return { auth, created, stateStore };
}

test("central vault creates independent PMKs and exposes only session-bound secret capabilities", async () => {
  const { auth, created, stateStore } = await createFixture();
  const second = await auth.createProfile({ displayName: "Profile B", password: passwordB, avatarRef: null }, created.authContext);
  const state = await stateStore.read();
  const pmkA = await unwrapProfileMasterKeyWithPassword(state.credentials[created.profile.profileId].passwordEnvelope, passwordA, created.profile.profileId);
  const pmkB = await unwrapProfileMasterKeyWithPassword(state.credentials[second.profile.profileId].passwordEnvelope, passwordB, second.profile.profileId);
  try {
    assert.equal(pmkA.byteLength, 32);
    assert.equal(pmkB.byteLength, 32);
    assert.notDeepEqual(pmkA, pmkB);
  } finally {
    pmkA.fill(0);
    pmkB.fill(0);
  }

  const capabilityA = auth.createProfileVaultCapability(created.authContext);
  const capabilityB = auth.createProfileVaultCapability(second.authContext);
  const envelopeA = await capabilityA.wrapSecret({ secretId: "project-key", secret: "Profile A private fixture" });
  const envelopeB = await capabilityB.wrapSecret({ secretId: "project-key", secret: "Profile B private fixture" });
  assert.equal(new TextDecoder().decode(await capabilityA.unwrapSecret({ envelope: envelopeA, secretId: "project-key" })), "Profile A private fixture");
  assert.equal(new TextDecoder().decode(await capabilityB.unwrapSecret({ envelope: envelopeB, secretId: "project-key" })), "Profile B private fixture");
  await assert.rejects(capabilityB.unwrapSecret({ envelope: envelopeA, secretId: "project-key" }), (error) => error?.code === "AUTHENTICATION_FAILED");
  assert.equal("profileMasterKey" in capabilityA, false);
  assert.equal(JSON.stringify({ capabilityA, status: auth.getAuthStatus(created.authContext) }).includes("Profile A private fixture"), false);
  auth.close();
});

test("wrong passwords, tampered envelopes, and future versions fail without replacing vault state", async () => {
  const { auth, created, stateStore } = await createFixture();
  auth.lock(created.authContext);
  const before = await stateStore.read();
  await assert.rejects(auth.authenticate({ profileId: created.profile.profileId, password: "Incorrect vault passphrase" }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  assert.deepEqual(await stateStore.read(), before);
  assert.equal(auth.getVaultStatus(created.profile.profileId).state, "locked");
  auth.close();

  const tampered = structuredClone(before);
  tampered.credentials[created.profile.profileId].passwordEnvelope.aead.ciphertext = mutateBase64Url(tampered.credentials[created.profile.profileId].passwordEnvelope.aead.ciphertext);
  const tamperedStore = createInMemoryAuthStateStore(tampered);
  const tamperedAuth = await createPlotPickleAuthService(serviceOptions(tamperedStore));
  await assert.rejects(tamperedAuth.authenticate({ profileId: created.profile.profileId, password: passwordA }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  assert.deepEqual(await tamperedStore.read(), tampered);
  tamperedAuth.close();

  const future = structuredClone(before);
  future.credentials[created.profile.profileId].passwordEnvelope.version = 2;
  await assert.rejects(createPlotPickleAuthService(serviceOptions(createInMemoryAuthStateStore(future))), (error) => error?.code === "AUTH_STATE_UNSUPPORTED");
  const malformed = structuredClone(before);
  malformed.credentials[created.profile.profileId].passwordEnvelope.unsupported = true;
  await assert.rejects(createPlotPickleAuthService(serviceOptions(createInMemoryAuthStateStore(malformed))), (error) => error?.code === "AUTH_STATE_CORRUPT");
});

test("Unicode and long password-manager values roundtrip without normalization or truncation", async () => {
  const longPassword = `竜🐉 Café e\u0301 — ${"correct-horse-".repeat(48)}tail-A`;
  const wrongFinalCodePoint = `${longPassword.slice(0, -1)}B`;
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore));
  const created = await auth.createFirstProfile({ displayName: "Unicode Human", password: longPassword, avatarRef: null });
  auth.lock(created.authContext);
  await assert.rejects(auth.authenticate({ profileId: created.profile.profileId, password: wrongFinalCodePoint }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  const login = await auth.authenticate({ profileId: created.profile.profileId, password: longPassword });
  assert.equal(login.authContext.profileId, created.profile.profileId);
  assert.doesNotMatch(JSON.stringify(await stateStore.read()), /correct-horse-/u);
  auth.close();
});

test("password change re-wraps the same PMK, verifies before commit, and rotates profile sessions", async () => {
  const { auth, created, stateStore } = await createFixture();
  const secondSession = await auth.authenticate({ profileId: created.profile.profileId, password: passwordA });
  const capability = auth.createProfileVaultCapability(created.authContext);
  const projectEnvelope = await capability.wrapSecret({ secretId: "project-data-key", secret: "unchanged PMK-backed data" });
  const before = await stateStore.read();
  const beforeCredential = before.credentials[created.profile.profileId];
  const beforePmk = await unwrapProfileMasterKeyWithPassword(beforeCredential.passwordEnvelope, passwordA, created.profile.profileId);
  const cleanupEvents = [];
  auth.registerVaultCleanupHook((event) => cleanupEvents.push(event));
  const changed = await auth.changePassword({ currentPassword: passwordA, newPassword: replacementPassword }, secondSession.authContext);
  const after = await stateStore.read();
  const afterCredential = after.credentials[created.profile.profileId];
  const afterPmk = await unwrapProfileMasterKeyWithPassword(afterCredential.passwordEnvelope, replacementPassword, created.profile.profileId);
  try {
    assert.deepEqual(afterPmk, beforePmk);
  } finally {
    beforePmk.fill(0);
    afterPmk.fill(0);
  }
  assert.notEqual(afterCredential.passwordEnvelope.kdf.salt, beforeCredential.passwordEnvelope.kdf.salt);
  assert.deepEqual(afterCredential.recoveryEnvelope, beforeCredential.recoveryEnvelope);
  assert.equal(after.registry.profiles[created.profile.profileId].vaultVersion, created.profile.vaultVersion + 1);
  assert.throws(() => auth.getAuthStatus(created.authContext), (error) => error?.code === "SESSION_REJECTED");
  assert.throws(() => auth.getAuthStatus(secondSession.authContext), (error) => error?.code === "SESSION_REJECTED");
  await assert.rejects(capability.unwrapSecret({ envelope: projectEnvelope, secretId: "project-data-key" }), (error) => error?.code === "SESSION_REJECTED");
  const changedCapability = auth.createProfileVaultCapability(changed.authContext);
  assert.equal(new TextDecoder().decode(await changedCapability.unwrapSecret({ envelope: projectEnvelope, secretId: "project-data-key" })), "unchanged PMK-backed data");
  await assert.rejects(auth.authenticate({ profileId: created.profile.profileId, password: passwordA }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  assert.equal((await auth.authenticate({ profileId: created.profile.profileId, password: replacementPassword })).profile.profileId, created.profile.profileId);
  assert.deepEqual(cleanupEvents.map(({ reason, invalidatedSessionCount }) => ({ reason, invalidatedSessionCount })), [{ reason: "password-change", invalidatedSessionCount: 2 }]);
  assert.doesNotMatch(JSON.stringify(cleanupEvents), /passphrase|recovery|master.?key|PMK/iu);
  auth.close();
});

test("offline recovery preserves PMK-backed data while replacing password and recovery wraps", async () => {
  const { auth, created, stateStore } = await createFixture();
  const capability = auth.createProfileVaultCapability(created.authContext);
  const projectEnvelope = await capability.wrapSecret({ secretId: "project-key", secret: "offline recovery fixture" });
  const before = await stateStore.read();
  const beforePmk = await unwrapProfileMasterKeyWithRecovery(before.credentials[created.profile.profileId].recoveryEnvelope, recoveryBytes(created.recoverySecret), created.profile.profileId);
  const reset = await auth.resetPasswordWithRecovery({ profileId: created.profile.profileId, recoverySecret: created.recoverySecret, newPassword: replacementPassword });
  const after = await stateStore.read();
  const afterPmk = await unwrapProfileMasterKeyWithRecovery(after.credentials[created.profile.profileId].recoveryEnvelope, recoveryBytes(reset.recoverySecret), created.profile.profileId);
  try {
    assert.deepEqual(afterPmk, beforePmk);
  } finally {
    beforePmk.fill(0);
    afterPmk.fill(0);
  }
  assert.notEqual(reset.recoverySecret, created.recoverySecret);
  assert.match(reset.recoverySecret, /^pprec1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{7}$/u);
  assert.equal(new TextDecoder().decode(await auth.createProfileVaultCapability(reset.authContext).unwrapSecret({ envelope: projectEnvelope, secretId: "project-key" })), "offline recovery fixture");
  await assert.rejects(auth.authenticate({ profileId: created.profile.profileId, password: passwordA }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  await assert.rejects(auth.authenticateWithRecovery({ profileId: created.profile.profileId, recoverySecret: created.recoverySecret }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  const checksumTamper = `${reset.recoverySecret.slice(0, -1)}${reset.recoverySecret.endsWith("A") ? "B" : "A"}`;
  const beforeTamper = await stateStore.read();
  await assert.rejects(auth.resetPasswordWithRecovery({ profileId: created.profile.profileId, recoverySecret: checksumTamper, newPassword: "Another replacement passphrase" }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  assert.deepEqual(await stateStore.read(), beforeTamper);
  auth.close();
});

test("successful unlock upgrades an older supported KDF without changing PMK or data", async () => {
  const { auth, created, stateStore } = await createFixture();
  const envelope = await auth.createProfileVaultCapability(created.authContext).wrapSecret({ secretId: "upgrade-key", secret: "KDF upgrade fixture" });
  auth.close();
  const before = await stateStore.read();
  const beforePmk = await unwrapProfileMasterKeyWithPassword(before.credentials[created.profile.profileId].passwordEnvelope, passwordA, created.profile.profileId);
  const strongerPolicy = { ...ARGON2ID_SECURITY_FLOOR, iterations: ARGON2ID_SECURITY_FLOOR.iterations + 1 };
  const restarted = await createPlotPickleAuthService(serviceOptions(stateStore, { passwordParameters: strongerPolicy }));
  assert.equal(restarted.getVaultStatus(created.profile.profileId).kdfMaintenance, "upgrade-pending");
  const login = await restarted.authenticate({ profileId: created.profile.profileId, password: passwordA });
  assert.equal(login.vaultMaintenance, "upgraded");
  const after = await stateStore.read();
  const afterPmk = await unwrapProfileMasterKeyWithPassword(after.credentials[created.profile.profileId].passwordEnvelope, passwordA, created.profile.profileId);
  try {
    assert.deepEqual(afterPmk, beforePmk);
  } finally {
    beforePmk.fill(0);
    afterPmk.fill(0);
  }
  assert.equal(after.credentials[created.profile.profileId].passwordEnvelope.kdf.iterations, strongerPolicy.iterations);
  assert.equal(new TextDecoder().decode(await restarted.createProfileVaultCapability(login.authContext).unwrapSecret({ envelope, secretId: "upgrade-key" })), "KDF upgrade fixture");
  restarted.close();
});

test("failed opportunistic upgrade and failed password write retain the last verified envelope", async () => {
  const initialStore = createInMemoryAuthStateStore();
  const initialAuth = await createPlotPickleAuthService(serviceOptions(initialStore));
  const created = await initialAuth.createFirstProfile({ displayName: "Write failure", password: passwordA, avatarRef: null });
  initialAuth.close();
  const verifiedState = await initialStore.read();
  let stored = structuredClone(verifiedState);
  let rejectWrites = true;
  const failingStore = {
    async read() { return structuredClone(stored); },
    async write(value) {
      if (rejectWrites) throw new Error("synthetic crash before atomic commit");
      stored = structuredClone(value);
    },
  };
  const strongerPolicy = { ...ARGON2ID_SECURITY_FLOOR, iterations: ARGON2ID_SECURITY_FLOOR.iterations + 1 };
  const auth = await createPlotPickleAuthService(serviceOptions(failingStore, { passwordParameters: strongerPolicy }));
  const login = await auth.authenticate({ profileId: created.profile.profileId, password: passwordA });
  assert.equal(login.vaultMaintenance, "upgrade-deferred");
  assert.deepEqual(stored, verifiedState);
  await assert.rejects(auth.changePassword({ currentPassword: passwordA, newPassword: replacementPassword }, login.authContext), /synthetic crash before atomic commit/u);
  assert.deepEqual(stored, verifiedState);
  rejectWrites = false;
  assert.equal((await auth.authenticate({ profileId: created.profile.profileId, password: passwordA })).profile.profileId, created.profile.profileId);
  auth.close();
});

test("JSON vault writes fsync, retain a verified previous copy, and refuse to overwrite corrupt state", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-profile-vault-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "auth", "state.json");
  const stateStore = createJsonFileAuthStateStore(filePath);
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore));
  const created = await auth.createFirstProfile({ displayName: "Before rename", password: passwordA, avatarRef: null });
  await auth.updateProfilePresentation({ profileId: created.profile.profileId, displayName: "After rename", avatarRef: null }, created.authContext);
  const previous = JSON.parse(await readFile(`${filePath}.previous`, "utf8"));
  assert.equal(previous.registry.profiles[created.profile.profileId].displayName, "Before rename");
  await writeFile(filePath, "{corrupt-existing-vault", "utf8");
  await assert.rejects(stateStore.write(previous), (error) => error?.code === "AUTH_STATE_CORRUPT");
  assert.equal(await readFile(filePath, "utf8"), "{corrupt-existing-vault");
  assert.equal(JSON.parse(await readFile(`${filePath}.previous`, "utf8")).registry.profiles[created.profile.profileId].displayName, "Before rename");
  assert.equal((await readdir(path.dirname(filePath))).some((name) => name.startsWith("state.json.corrupt-") && name.endsWith(".json")), true);
  auth.close();
});

test("profile-scoped lock cleanup leaves another concurrently unlocked Human intact", async () => {
  const { auth, created } = await createFixture();
  const second = await auth.createProfile({ displayName: "Profile B", password: passwordB, avatarRef: null }, created.authContext);
  const capabilityA = auth.createProfileVaultCapability(created.authContext);
  const capabilityB = auth.createProfileVaultCapability(second.authContext);
  const envelopeA = await capabilityA.wrapSecret({ secretId: "authority", secret: "A" });
  const envelopeB = await capabilityB.wrapSecret({ secretId: "authority", secret: "B" });
  const events = [];
  let failingHookCalls = 0;
  const unsubscribe = auth.registerVaultCleanupHook((event) => events.push(event));
  auth.registerVaultCleanupHook(() => {
    failingHookCalls += 1;
    throw new Error("synthetic cleanup observer failure");
  });
  assert.deepEqual(PROFILE_VAULT_STATES, ["uninitialized", "locked", "unlocking", "unlocked", "locking", "recovery-required", "corrupt"]);
  assert.equal(auth.getVaultStatus(created.profile.profileId).state, "unlocked");
  assert.equal(auth.lockProfile(created.profile.profileId, created.authContext), true);
  assert.equal(auth.getVaultStatus(created.profile.profileId).state, "locked");
  assert.equal(auth.getVaultStatus(second.profile.profileId).state, "unlocked");
  await assert.rejects(capabilityA.unwrapSecret({ envelope: envelopeA, secretId: "authority" }), (error) => error?.code === "SESSION_REJECTED");
  assert.equal(new TextDecoder().decode(await capabilityB.unwrapSecret({ envelope: envelopeB, secretId: "authority" })), "B");
  assert.deepEqual(events.map(({ profileId, reason, invalidatedSessionCount }) => ({ profileId, reason, invalidatedSessionCount })), [{
    profileId: created.profile.profileId,
    reason: "lock-profile",
    invalidatedSessionCount: 1,
  }]);
  assert.equal(failingHookCalls, 1);
  assert.equal(unsubscribe(), true);
  assert.equal(unsubscribe(), false);
  auth.close();
});

test("vault ownership is registered in focused UAT, CI, documentation, packaging, and security gates", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(root, "config", "uat-autopilot-registry.json"), "utf8"));
  const startup = registry.areas.find((area) => area.id === "startup");
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "auth-core.yml"), "utf8");
  const architecture = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-PROFILE-VAULT.md"), "utf8");
  assert.equal(packageJson.scripts["test:profile-vault"], "node --test tests/issue-1140-profile-master-key-vault.test.mjs");
  assert.equal(startup.tests.includes("tests/issue-1140-profile-master-key-vault.test.mjs"), true);
  assert.match(workflow, /npm run test:profile-vault/u);
  assert.match(workflow, /npm run audit:credentials[\s\S]*npm run build/u);
  assert.match(architecture, /password change[\s\S]*same PMK/iu);
  assert.match(architecture, /cleanup event[\s\S]*BUZZ/iu);
  assert.match(architecture, /fsync[\s\S]*\.previous/iu);
  assert.match(fs.readFileSync(path.join(root, "scripts", "package-platform.mjs"), "utf8"), /runtimeDirectories[\s\S]*"core"/u);
});
