import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createInMemoryAuthStateStore,
  createPlotPickleAuthService,
} from "../core/auth/plotpickle-auth-core.mjs";
import {
  createProfilePrivateStorageService,
  profileStoragePaths,
} from "../core/storage/profile-private/profile-private-storage-core.mjs";
import {
  PROFILE_BACKUP_FORMAT,
  createProfileBackupBundle,
  parseProfileBackupBundle,
  readProfileBackupFile,
  restoreProfileBackupToStateStore,
  serializeProfileBackupBundle,
  verifyProfileBackupBundle,
  writeProfileBackupFile,
} from "../core/auth/profile-backup/profile-backup-core.mjs";

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "new portable recovery passphrase";
const STORY_MARKER = "PP_1145_STORY_ONLY_THE_HUMAN_CAN_READ";
const PROVIDER_MARKER = "PP_1145_PROVIDER_SECRET_CANARY";
const BUZZ_MARKER = "nsec1PP1145PRIVATEIDENTITYCANARY";
const SOURCE_NODE = "PP_1145_SOURCE_NODE_ID";
const DESTINATION_NODE = "PP_1145_DESTINATION_NODE_ID";

async function sourceFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1145-source-"));
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService({
    nodeId: SOURCE_NODE,
    accessMode: "desktop-loopback",
    stateStore,
  });
  const created = await auth.createFirstProfile({
    displayName: "Portable Writer",
    password: PASSWORD,
    avatarRef: null,
  });
  const storage = createProfilePrivateStorageService({ root, authService: auth });
  await storage.initializeProfile(created.authContext);
  await storage.saveProject(created.authContext, {
    project: { id: "portable-story", title: STORY_MARKER, body: "A private draft." },
    summary: { title: STORY_MARKER },
  });
  await storage.writePrivateJson(created.authContext, {
    domain: "memory",
    objectId: "sage-thread",
    value: { note: STORY_MARKER },
  });
  await storage.writeCredential(created.authContext, "provider.json", {
    apiKey: PROVIDER_MARKER,
  });
  await storage.writePrivateJson(created.authContext, {
    domain: "buzz",
    objectId: "human-identity",
    value: { privateKey: BUZZ_MARKER, identityLabel: "Portable Writer" },
  });
  return { root, stateStore, auth, storage, created };
}

async function emptyDestination(nodeId = DESTINATION_NODE, accessMode = "desktop-loopback") {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1145-destination-"));
  const stateStore = createInMemoryAuthStateStore();
  const auth = await createPlotPickleAuthService({ nodeId, accessMode, stateStore });
  return { root, stateStore, auth };
}

async function authenticateRestored(fixture, profileId, password) {
  fixture.auth.close();
  const auth = await createPlotPickleAuthService({
    nodeId: DESTINATION_NODE,
    accessMode: "desktop-loopback",
    stateStore: fixture.stateStore,
  });
  const signedIn = await auth.authenticate({ profileId, password });
  const storage = createProfilePrivateStorageService({ root: fixture.root, authService: auth });
  return { auth, storage, signedIn };
}

async function cleanup(...fixtures) {
  for (const fixture of fixtures) {
    fixture.storage?.close?.();
    fixture.auth?.close?.();
    if (fixture.root) await rm(fixture.root, { recursive: true, force: true });
  }
}

test("#1145 creates an authenticated portable backup without plaintext Human data or Node identity", async () => {
  const source = await sourceFixture();
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
    });
    assert.equal(bundle.format, PROFILE_BACKUP_FORMAT);
    const serialized = serializeProfileBackupBundle(bundle);
    assert.ok(!serialized.includes(STORY_MARKER));
    assert.ok(!serialized.includes(PROVIDER_MARKER));
    assert.ok(!serialized.includes(BUZZ_MARKER));
    assert.ok(!serialized.includes(PASSWORD));
    assert.ok(!serialized.includes(source.created.recoverySecret));
    assert.ok(!serialized.includes(SOURCE_NODE));
    assert.equal(bundle.entries.some((entry) => Buffer.from(entry.data, "base64").toString("utf8").includes('"domain": "buzz"')), false);

    await assert.rejects(
      verifyProfileBackupBundle(bundle, { password: "wrong password that is long enough" }),
      (error) => error?.code === "PROFILE_BACKUP_AUTH_REJECTED",
    );
    const verified = await verifyProfileBackupBundle(bundle, { password: PASSWORD });
    assert.equal(verified.displayName, "Portable Writer");
    assert.equal(verified.profileId, source.created.profile.profileId);
    assert.equal(verified.includesNetworkIdentity, false);
    assert.ok(verified.objectCount >= 4);
  } finally {
    await cleanup(source);
  }
});

test("#1145 restores the same stable Human profile id onto a different Node and keeps BUZZ optional", async () => {
  const source = await sourceFixture();
  const destination = await emptyDestination();
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
    });
    destination.auth.close();
    const restored = await restoreProfileBackupToStateStore({
      root: destination.root,
      stateStore: destination.stateStore,
      bundle,
      password: PASSWORD,
      nodeId: DESTINATION_NODE,
      accessMode: "desktop-loopback",
    });
    assert.equal(restored.profileId, source.created.profile.profileId);
    assert.equal(restored.recoverySecret, null);

    const reopened = await authenticateRestored(destination, restored.profileId, PASSWORD);
    destination.auth = reopened.auth;
    destination.storage = reopened.storage;
    const project = await reopened.storage.loadProject(reopened.signedIn.authContext, "portable-story");
    assert.equal(project.title, STORY_MARKER);
    assert.deepEqual(await reopened.storage.readCredential(reopened.signedIn.authContext, "provider.json"), { apiKey: PROVIDER_MARKER });
    assert.equal(await reopened.storage.readPrivateJson(reopened.signedIn.authContext, { domain: "buzz", objectId: "human-identity" }), null);
    const state = await destination.stateStore.read();
    assert.equal(state.registry.nodeId, DESTINATION_NODE);
    assert.notEqual(state.registry.nodeId, SOURCE_NODE);
  } finally {
    await cleanup(source, destination);
  }
});

test("#1145 carries BUZZ Human identity only when network identity inclusion is explicit", async () => {
  const source = await sourceFixture();
  const destination = await emptyDestination();
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
      includeNetworkIdentity: true,
    });
    const serialized = serializeProfileBackupBundle(bundle);
    assert.ok(!serialized.includes(BUZZ_MARKER));
    assert.equal((await verifyProfileBackupBundle(bundle, { password: PASSWORD })).includesNetworkIdentity, true);

    destination.auth.close();
    const restored = await restoreProfileBackupToStateStore({
      root: destination.root,
      stateStore: destination.stateStore,
      bundle,
      password: PASSWORD,
      nodeId: DESTINATION_NODE,
      accessMode: "desktop-loopback",
    });
    const reopened = await authenticateRestored(destination, restored.profileId, PASSWORD);
    destination.auth = reopened.auth;
    destination.storage = reopened.storage;
    const buzz = await reopened.storage.readPrivateJson(reopened.signedIn.authContext, { domain: "buzz", objectId: "human-identity" });
    assert.equal(buzz.privateKey, BUZZ_MARKER);
  } finally {
    await cleanup(source, destination);
  }
});

test("#1145 recovery restore rotates password and recovery wrapping instead of granting old recovery a normal session", async () => {
  const source = await sourceFixture();
  const destination = await emptyDestination();
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
    });
    const verified = await verifyProfileBackupBundle(bundle, { recoverySecret: source.created.recoverySecret });
    assert.equal(verified.profileId, source.created.profile.profileId);

    destination.auth.close();
    const restored = await restoreProfileBackupToStateStore({
      root: destination.root,
      stateStore: destination.stateStore,
      bundle,
      recoverySecret: source.created.recoverySecret,
      newPassword: NEW_PASSWORD,
      nodeId: DESTINATION_NODE,
      accessMode: "desktop-loopback",
    });
    assert.ok(restored.recoverySecret?.startsWith("pprec1."));
    assert.notEqual(restored.recoverySecret, source.created.recoverySecret);

    destination.auth = await createPlotPickleAuthService({
      nodeId: DESTINATION_NODE,
      accessMode: "desktop-loopback",
      stateStore: destination.stateStore,
    });
    await assert.rejects(destination.auth.authenticate({ profileId: restored.profileId, password: PASSWORD }));
    const signedIn = await destination.auth.authenticate({ profileId: restored.profileId, password: NEW_PASSWORD });
    destination.storage = createProfilePrivateStorageService({ root: destination.root, authService: destination.auth });
    assert.equal((await destination.storage.loadProject(signedIn.authContext, "portable-story")).title, STORY_MARKER);
  } finally {
    await cleanup(source, destination);
  }
});

test("#1145 detects payload tampering, path traversal and profile-id collisions before activation", async () => {
  const source = await sourceFixture();
  const destination = await emptyDestination();
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
    });
    const tampered = structuredClone(bundle);
    tampered.entries[0].data = Buffer.from("tampered", "utf8").toString("base64");
    await assert.rejects(
      verifyProfileBackupBundle(tampered, { password: PASSWORD }),
      (error) => new Set(["PROFILE_BACKUP_TAMPERED", "INVALID_PROFILE_BACKUP"]).has(error?.code),
    );

    const state = await source.stateStore.read();
    const maliciousManifest = {
      format: "plotpickle-human-backup-manifest",
      version: 1,
      backupId: bundle.header.backupId,
      createdAt: bundle.header.createdAt,
      profile: state.registry.profiles[bundle.header.profileId],
      includeNetworkIdentity: false,
      credentialSha256: createHash("sha256").update(JSON.stringify(bundle.credential), "utf8").digest("base64url"),
      entries: bundle.entries.map((entry, index) => ({
        ref: entry.ref,
        relativePath: index === 0 ? "../escape.json" : `projects/item-${index}.json`,
        sha256: entry.sha256,
        bytes: entry.bytes,
      })),
    };
    const capability = source.auth.createProfileVaultCapability(source.created.authContext);
    const maliciousEnvelope = await capability.wrapSecret({
      secretId: `profile-backup:v1:${bundle.header.backupId}:manifest`,
      secret: JSON.stringify(maliciousManifest),
    });
    const traversal = { ...structuredClone(bundle), manifestEnvelope: maliciousEnvelope };
    await assert.rejects(
      verifyProfileBackupBundle(traversal, { password: PASSWORD }),
      (error) => error?.code === "PROFILE_BACKUP_PATH_REJECTED",
    );

    destination.auth.close();
    await restoreProfileBackupToStateStore({
      root: destination.root,
      stateStore: destination.stateStore,
      bundle,
      password: PASSWORD,
      nodeId: DESTINATION_NODE,
      accessMode: "desktop-loopback",
    });
    await assert.rejects(
      restoreProfileBackupToStateStore({
        root: destination.root,
        stateStore: destination.stateStore,
        bundle,
        password: PASSWORD,
        nodeId: DESTINATION_NODE,
        accessMode: "desktop-loopback",
      }),
      (error) => error?.code === "PROFILE_RESTORE_CONFLICT",
    );
  } finally {
    await cleanup(source, destination);
  }
});

test("#1145 writes and reads a verified .ppbackup atomically", async () => {
  const source = await sourceFixture();
  const exportRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-1145-export-"));
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
    });
    const destination = path.join(exportRoot, "portable-writer.ppbackup");
    await writeProfileBackupFile(bundle, destination);
    const parsed = await readProfileBackupFile(destination);
    assert.equal(parsed.header.backupId, bundle.header.backupId);
    assert.equal((await verifyProfileBackupBundle(parsed, { password: PASSWORD })).displayName, "Portable Writer");
    await writeFile(path.join(exportRoot, "truncated.ppbackup"), "{\"format\":", "utf8");
    await assert.rejects(readProfileBackupFile(path.join(exportRoot, "truncated.ppbackup")));
  } finally {
    await cleanup(source);
    await rm(exportRoot, { recursive: true, force: true });
  }
});

test("#1145 server-network restore requires the existing one-time bootstrap proof", async () => {
  const source = await sourceFixture();
  const destination = await emptyDestination("server-destination", "server-network");
  try {
    const bundle = await createProfileBackupBundle({
      root: source.root,
      authService: source.auth,
      stateStore: source.stateStore,
      authContext: source.created.authContext,
    });
    const bootstrap = await destination.auth.createServerBootstrapProof();
    destination.auth.close();
    await assert.rejects(
      restoreProfileBackupToStateStore({
        root: destination.root,
        stateStore: destination.stateStore,
        bundle,
        password: PASSWORD,
        nodeId: "server-destination",
        accessMode: "server-network",
        bootstrapProof: "invalid",
      }),
      (error) => error?.code === "RESTORE_BOOTSTRAP_REQUIRED",
    );
    const restored = await restoreProfileBackupToStateStore({
      root: destination.root,
      stateStore: destination.stateStore,
      bundle,
      password: PASSWORD,
      nodeId: "server-destination",
      accessMode: "server-network",
      bootstrapProof: bootstrap.proof,
    });
    assert.equal(restored.profileId, source.created.profile.profileId);
    const state = await destination.stateStore.read();
    assert.equal(state.bootstrap.consumedAt !== null, true);
    assert.equal(state.bootstrap.proofDigest, null);
  } finally {
    await cleanup(source, destination);
  }
});

test("#1145 source backup rejects symlinked profile objects where the platform permits symlinks", { skip: process.platform === "win32" }, async () => {
  const source = await sourceFixture();
  try {
    const locations = profileStoragePaths(source.root, source.created.profile.profileId);
    await mkdir(locations.projects, { recursive: true });
    const external = path.join(source.root, "outside.json");
    await writeFile(external, "{}", "utf8");
    await symlink(external, path.join(locations.projects, "linked.json"));
    await assert.rejects(
      createProfileBackupBundle({
        root: source.root,
        authService: source.auth,
        stateStore: source.stateStore,
        authContext: source.created.authContext,
      }),
      (error) => error?.code === "PROFILE_BACKUP_PATH_REJECTED",
    );
  } finally {
    await cleanup(source);
  }
});
