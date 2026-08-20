import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createJsonFileAuthStateStore,
  createPlotPickleAuthService,
  parseAuthPersistentState,
  toPublicAuthError,
} from "../core/auth/plotpickle-auth-core.mjs";
import { ARGON2ID_SECURITY_FLOOR } from "../core/auth/profile-crypto-contract-core.mjs";

const root = path.resolve(import.meta.dirname, "..");
const password = "PlotPickle Auth Core test passphrase";
const nodeId = "node_auth_core_fixture";
const forbiddenRegistryTerms = /email|cloud|buzz|provider|credential|project|story|path|prompt|memory|thumbnail|master.?key|pmk|passwordEnvelope|recoveryEnvelope/iu;

function serviceOptions(stateStore, overrides = {}) {
  return {
    nodeId,
    accessMode: "desktop-loopback",
    stateStore,
    passwordParameters: ARGON2ID_SECURITY_FLOOR,
    ...overrides,
  };
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

async function createDesktopProfile(overrides = {}) {
  const stateStore = overrides.stateStore || createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore, overrides.options));
  const created = await auth.createFirstProfile({ displayName: "Bryan", password, avatarRef: "avatar:bryan" });
  return { auth, created, stateStore };
}

test("desktop first-run creates a random stable Human profile entirely offline", async () => {
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls += 1;
    throw new Error("Auth bootstrap attempted network access.");
  };
  try {
    const { auth, created, stateStore } = await createDesktopProfile();
    assert.equal(networkCalls, 0);
    assert.deepEqual(sortedKeys(created.profile), ["authMethods", "avatarRef", "createdAt", "displayName", "profileId", "status", "updatedAt", "vaultVersion"]);
    assert.equal(Buffer.from(created.profile.profileId.slice("profile_".length), "base64url").byteLength, 16);
    assert.deepEqual(created.profile.authMethods, ["password", "recovery"]);
    assert.equal(created.profile.status, "active");
    const registry = auth.readRegistrySnapshot();
    assert.doesNotMatch(JSON.stringify(registry), forbiddenRegistryTerms);
    assert.deepEqual(Object.keys(registry.profiles), [created.profile.profileId]);
    auth.close();

    const restarted = await createPlotPickleAuthService(serviceOptions(stateStore));
    assert.equal(restarted.listProfileSummaries()[0].profileId, created.profile.profileId);
    const login = await restarted.authenticate({ profileId: created.profile.profileId, password });
    assert.equal(login.authContext.profileId, created.profile.profileId);
    restarted.close();
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("duplicate display names remain presentation-only while profile ids stay unique", async () => {
  const { auth, created } = await createDesktopProfile();
  const second = await auth.createProfile({ displayName: "Bryan", password, avatarRef: null }, created.authContext);
  assert.notEqual(second.profile.profileId, created.profile.profileId);
  assert.equal(second.profile.displayName, created.profile.displayName);
  const renamed = await auth.updateProfilePresentation({ profileId: second.profile.profileId, displayName: "Bryan H.", avatarRef: "avatar:bryan-2" }, second.authContext);
  assert.equal(renamed.profileId, second.profile.profileId);
  assert.equal(renamed.createdAt, second.profile.createdAt);
  assert.notEqual(renamed.updatedAt, undefined);
  assert.equal(auth.listProfileSummaries().length, 2);
  auth.close();
});

test("one service supports concurrent Humans through explicit independent AuthContexts", async () => {
  const { auth, created } = await createDesktopProfile();
  const second = await auth.createProfile({ displayName: "Avery", password: "Avery independent test passphrase", avatarRef: "avatar:avery" }, created.authContext);
  assert.notEqual(created.authContext.sessionId, second.authContext.sessionId);
  assert.notEqual(created.authContext.profileId, second.authContext.profileId);
  assert.equal(auth.getAuthStatus(created.authContext).profile.displayName, "Bryan");
  assert.equal(auth.getAuthStatus(second.authContext).profile.displayName, "Avery");
  await assert.rejects(
    auth.updateProfilePresentation({ profileId: second.profile.profileId, displayName: "Cross-profile edit", avatarRef: null }, created.authContext),
    (error) => error?.code === "ACCESS_DENIED",
  );
  await assert.rejects(auth.disableProfile(second.profile.profileId, created.authContext), (error) => error?.code === "ACCESS_DENIED");
  assert.throws(() => auth.lockProfile(second.profile.profileId, created.authContext), (error) => error?.code === "ACCESS_DENIED");
  auth.lock(created.authContext);
  assert.equal(auth.getAuthStatus(second.authContext).authenticated, true);
  auth.close();
});

test("server-network first-run requires a one-time high-entropy operator proof", async () => {
  let clock = Date.parse("2026-08-20T12:00:00.000Z");
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore, {
    accessMode: "server-network",
    now: () => clock,
    bootstrapTtlMs: 60_000,
  }));
  assert.deepEqual(auth.listProfileSummaries(), []);
  assert.deepEqual(auth.getAuthStatus(), {
    configured: false,
    accessMode: "server-network",
    authenticated: false,
    profileCountVisible: 0,
    bootstrapRequired: true,
  });
  assert.equal(auth.readRegistrySnapshot(), null);
  await assert.rejects(auth.createFirstProfile({ displayName: "Operator", password, avatarRef: null }), (error) => error?.code === "BOOTSTRAP_PROOF_REJECTED");
  const bootstrap = await auth.createServerBootstrapProof();
  assert.equal(Buffer.from(bootstrap.proof, "base64url").byteLength, 32);
  const beforeCreation = await stateStore.read();
  assert.notEqual(beforeCreation.bootstrap.proofDigest, bootstrap.proof);
  assert.doesNotMatch(JSON.stringify(beforeCreation), new RegExp(bootstrap.proof, "u"));
  const wrongProof = Buffer.alloc(32, 7).toString("base64url");
  await assert.rejects(auth.createFirstProfile({ displayName: "Operator", password, avatarRef: null }, wrongProof), (error) => error?.code === "BOOTSTRAP_PROOF_REJECTED");
  const created = await auth.createFirstProfile({ displayName: "Operator", password, avatarRef: null }, bootstrap.proof);
  assert.equal(created.profile.displayName, "Operator");
  const afterCreation = await stateStore.read();
  assert.equal(afterCreation.bootstrap.proofDigest, null);
  assert.notEqual(afterCreation.bootstrap.consumedAt, null);
  auth.close();

  clock += 1_000;
  const restarted = await createPlotPickleAuthService(serviceOptions(stateStore, { accessMode: "server-network", now: () => clock }));
  await assert.rejects(restarted.createServerBootstrapProof(), (error) => error?.code === "BOOTSTRAP_ALREADY_COMPLETED");
  assert.deepEqual(restarted.listProfileSummaries(), []);
  restarted.close();
});

test("expired bootstrap proofs fail closed without creating or enumerating a profile", async () => {
  let clock = Date.parse("2026-08-20T13:00:00.000Z");
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore, { accessMode: "server-network", now: () => clock, bootstrapTtlMs: 1_000 }));
  const bootstrap = await auth.createServerBootstrapProof();
  clock += 1_001;
  await assert.rejects(auth.createFirstProfile({ displayName: "Late operator", password, avatarRef: null }, bootstrap.proof), (error) => error?.code === "BOOTSTRAP_PROOF_REJECTED");
  assert.deepEqual(auth.listProfileSummaries(), []);
  assert.deepEqual((await stateStore.read()).registry.profiles, {});
  auth.close();
});

test("remote unknown-profile and wrong-password failures are publicly indistinguishable", async () => {
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore, { accessMode: "server-network" }));
  const bootstrap = await auth.createServerBootstrapProof();
  const created = await auth.createFirstProfile({ displayName: "Remote Human", password, avatarRef: null }, bootstrap.proof);
  const failures = [];
  for (const input of [
    { profileId: `profile_${Buffer.alloc(16, 3).toString("base64url")}`, password: "wrong passphrase" },
    { profileId: created.profile.profileId, password: "wrong passphrase" },
  ]) {
    try {
      await auth.authenticate(input);
      assert.fail("Authentication unexpectedly succeeded.");
    } catch (error) {
      failures.push(toPublicAuthError(error));
    }
  }
  assert.deepEqual(failures[0], failures[1]);
  assert.deepEqual(failures[0], { code: "AUTHENTICATION_REJECTED", message: "Profile authentication failed." });
  auth.close();
});

test("AuthContext is canonical, server-side, expiring, and invalidated by lock", async () => {
  let clock = Date.parse("2026-08-20T14:00:00.000Z");
  const { auth, created, stateStore } = await createDesktopProfile({ options: { now: () => clock, sessionTtlMs: 5_000 } });
  assert.deepEqual(sortedKeys(created.authContext), ["authStrength", "expiresAt", "issuedAt", "nodeId", "profileId", "roles", "sessionId"]);
  assert.equal(Buffer.from(created.authContext.sessionId, "base64url").byteLength, 32);
  assert.deepEqual(created.authContext.roles, ["human"]);
  const browserStatus = auth.getAuthStatus(created.authContext);
  assert.equal("sessionId" in browserStatus, false);
  assert.equal("roles" in browserStatus, false);
  assert.doesNotMatch(JSON.stringify(await stateStore.read()), new RegExp(created.authContext.sessionId, "u"));
  assert.equal(auth.lock(created.authContext), true);
  assert.throws(() => auth.getAuthStatus(created.authContext), (error) => error?.code === "SESSION_REJECTED");

  const recovered = await auth.authenticateWithRecovery({ profileId: created.profile.profileId, recoverySecret: created.recoverySecret });
  assert.equal(recovered.authContext.authStrength, "recovery");
  auth.lock(recovered.authContext);

  const login = await auth.authenticate({ profileId: created.profile.profileId, password });
  clock += 5_001;
  assert.throws(() => auth.getAuthStatus(login.authContext), (error) => error?.code === "SESSION_REJECTED");
  auth.close();
});

test("disable revokes every target session and prevents later authentication", async () => {
  const { auth, created } = await createDesktopProfile();
  const secondSession = await auth.authenticate({ profileId: created.profile.profileId, password });
  const disabled = await auth.disableProfile(created.profile.profileId, secondSession.authContext);
  assert.equal(disabled.status, "disabled");
  assert.throws(() => auth.getAuthStatus(created.authContext), (error) => error?.code === "SESSION_REJECTED");
  assert.throws(() => auth.getAuthStatus(secondSession.authContext), (error) => error?.code === "SESSION_REJECTED");
  await assert.rejects(auth.authenticate({ profileId: created.profile.profileId, password }), (error) => toPublicAuthError(error).code === "AUTHENTICATION_REJECTED");
  auth.close();
});

test("persistent state separates safe registry metadata from encrypted credentials and recovery material", async () => {
  const { auth, created, stateStore } = await createDesktopProfile();
  const state = await stateStore.read();
  const registryText = JSON.stringify(state.registry);
  const persistentText = JSON.stringify(state);
  assert.doesNotMatch(registryText, forbiddenRegistryTerms);
  assert.equal(sortedKeys(state.credentials[created.profile.profileId]).join(","), "passwordEnvelope,profileId,recoveryEnvelope");
  assert.doesNotMatch(persistentText, new RegExp(password, "u"));
  assert.doesNotMatch(persistentText, new RegExp(created.recoverySecret, "u"));
  assert.doesNotMatch(persistentText, new RegExp(created.authContext.sessionId, "u"));
  auth.close();
});

test("JSON file storage survives restart and rejects corrupt or cross-Node state", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-auth-core-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "auth", "state.json");
  const stateStore = createJsonFileAuthStateStore(filePath);
  const auth = await createPlotPickleAuthService(serviceOptions(stateStore));
  const created = await auth.createFirstProfile({ displayName: "Persistent Human", password, avatarRef: null });
  auth.close();
  assert.equal((await readFile(filePath, "utf8")).endsWith("\n"), true);
  const restarted = await createPlotPickleAuthService(serviceOptions(createJsonFileAuthStateStore(filePath)));
  assert.equal(restarted.listProfileSummaries()[0].profileId, created.profile.profileId);
  restarted.close();
  await assert.rejects(createPlotPickleAuthService(serviceOptions(createJsonFileAuthStateStore(filePath), { nodeId: "node_wrong" })), (error) => error?.code === "AUTH_STATE_MISMATCH");
  await writeFile(filePath, "{not-json", "utf8");
  await assert.rejects(createPlotPickleAuthService(serviceOptions(createJsonFileAuthStateStore(filePath))), (error) => error?.code === "AUTH_STATE_CORRUPT");
});

test("runtime schemas reject extra profile fields and forbidden first-run identity inputs", async () => {
  const { auth, created, stateStore } = await createDesktopProfile();
  await assert.rejects(auth.createProfile({ displayName: "Unsafe", password, avatarRef: null, email: "human@example.test" }, created.authContext), (error) => error?.code === "INVALID_AUTH_CONTRACT");
  await assert.rejects(auth.createProfile({ displayName: "Unsafe", password: "admin/admin", avatarRef: null }, created.authContext), (error) => error?.code === "INVALID_PROFILE_PASSWORD");
  await assert.rejects(auth.createProfile({ displayName: "Unsafe", password: "123456789012", avatarRef: null }, created.authContext), (error) => error?.code === "INVALID_PROFILE_PASSWORD");
  await assert.rejects(auth.createProfile({ displayName: "Unsafe profile", password: "Unsafe profile", avatarRef: null }, created.authContext), (error) => error?.code === "INVALID_PROFILE_PASSWORD");
  const state = await stateStore.read();
  const target = state.registry.profiles[created.profile.profileId];
  state.registry.profiles[created.profile.profileId] = { ...target, buzzSignerRef: "signer" };
  assert.throws(() => parseAuthPersistentState(state), (error) => error?.code === "INVALID_AUTH_CONTRACT");
  auth.close();
});

test("Auth Core documentation, CI, packaging, and focused UAT ownership are explicit", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const registry = JSON.parse(fs.readFileSync(path.join(root, "config", "uat-autopilot-registry.json"), "utf8"));
  const startup = registry.areas.find((area) => area.id === "startup");
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "auth-core.yml"), "utf8");
  const architecture = fs.readFileSync(path.join(root, "docs", "architecture", "PLOTPICKLE-AUTH-CORE.md"), "utf8");
  const authCore = fs.readFileSync(path.join(root, "core", "auth", "plotpickle-auth-core.mjs"), "utf8");
  assert.equal(packageJson.scripts["test:auth-core"], "node --test tests/issue-1139-auth-core.test.mjs");
  assert.equal(startup.tests.includes("tests/issue-1139-auth-core.test.mjs"), true);
  assert.match(workflow, /windows-latest[\s\S]*ubuntu-latest/u);
  assert.match(workflow, /npm run test:auth-core/u);
  assert.match(workflow, /npm run test:auth-crypto/u);
  assert.match(workflow, /npm run build/u);
  assert.match(architecture, /desktop-loopback[\s\S]*server-network/u);
  assert.match(architecture, /process-global active Human/iu);
  assert.match(architecture, /one-time[\s\S]*bootstrap proof/iu);
  assert.doesNotMatch(authCore, /(?:let|var)\s+(?:activeUser|activeHuman|currentProfile|currentUser)\b/iu);
  assert.match(authCore, /const sessions = new Map\(\)/u);
  assert.match(fs.readFileSync(path.join(root, "scripts", "package-platform.mjs"), "utf8"), /runtimeDirectories[\s\S]*"core"/u);
});
