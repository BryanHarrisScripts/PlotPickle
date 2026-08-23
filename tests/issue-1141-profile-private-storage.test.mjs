import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import {
  createNodeSecretStore,
  createProfilePrivateStorageService,
  nodeStoragePaths,
  profileStoragePaths,
} from "../core/storage/profile-private/profile-private-storage-core.mjs";

const PASSWORD_A = "Bryan profile storage passphrase 2026";
const PASSWORD_B = "Jane profile storage passphrase 2026";
const FIXED_NOW = "2026-08-20T18:40:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-profile-storage-"));
  const auth = await createPlotPickleAuthService({
    nodeId: "node-profile-storage-test",
    accessMode: "desktop-loopback",
    stateStore: createInMemoryAuthStateStore(),
    now: () => Date.parse(FIXED_NOW),
  });
  const profileA = await auth.createFirstProfile({ displayName: "Bryan", password: PASSWORD_A, avatarRef: null });
  const profileB = await auth.createProfile({ displayName: "Jane", password: PASSWORD_B, avatarRef: null }, profileA.authContext);
  const logs = [];
  const storage = createProfilePrivateStorageService({
    root,
    authService: auth,
    now: () => FIXED_NOW,
    migrationLog: (event) => logs.push(event),
    normalizeProject(value) {
      if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.id !== "string") throw new Error("invalid project");
      return structuredClone(value);
    },
  });
  return {
    root,
    auth,
    storage,
    profileA,
    profileB,
    logs,
    async close() {
      storage.close();
      auth.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function project(id, title, storyText = `${title} private story text`) {
  return { id, title, storyText, revision: 1, createdAt: FIXED_NOW, updatedAt: FIXED_NOW };
}

test("#1141 derives distinct fixed profile roots from opaque authenticated ids and rejects traversal", async () => {
  const setup = await fixture();
  try {
    const initializedA = await setup.storage.initializeProfile(setup.profileA.authContext);
    const initializedB = await setup.storage.initializeProfile(setup.profileB.authContext);
    assert.equal(initializedA.profileId, setup.profileA.profile.profileId);
    assert.equal(initializedB.profileId, setup.profileB.profile.profileId);
    assert.notEqual(initializedA.paths.profileRoot, initializedB.paths.profileRoot);
    assert.equal(path.dirname(initializedA.paths.profileRoot), path.join(setup.root, "profiles"));
    assert.throws(() => profileStoragePaths(setup.root, "../other-profile"), (error) => error?.code === "INVALID_PROFILE_ID");
    await assert.rejects(
      setup.storage.writePrivateJson(setup.profileA.authContext, { domain: "projects", objectId: "../escape", value: {} }),
      (error) => error?.code === "INVALID_OBJECT_ID",
    );
  } finally {
    await setup.close();
  }
});

test("#1141 encrypts Library metadata and projects under the PMK and denies guessed cross-profile ids", async () => {
  const setup = await fixture();
  try {
    const bryanStory = project("shared-looking-id", "Bryan Private Story", "Bryan unreleased ending");
    await setup.storage.saveProject(setup.profileA.authContext, { project: bryanStory, summary: { progress: 42, frontier: "World" } });
    assert.deepEqual((await setup.storage.listProjects(setup.profileA.authContext)).map((item) => item.title), ["Bryan Private Story"]);
    assert.deepEqual(await setup.storage.listProjects(setup.profileB.authContext), []);
    assert.equal(await setup.storage.loadProject(setup.profileB.authContext, bryanStory.id), null);

    const locations = profileStoragePaths(setup.root, setup.profileA.profile.profileId);
    const projectEnvelope = await readFile(path.join(locations.projects, `${bryanStory.id}.json`), "utf8");
    const libraryEnvelope = await readFile(path.join(locations.library, "registry.json"), "utf8");
    for (const source of [projectEnvelope, libraryEnvelope]) {
      assert.match(source, /plotpickle-profile-private-object/);
      assert.doesNotMatch(source, /Bryan Private Story|unreleased ending/);
    }
    assert.equal((await setup.storage.loadProject(setup.profileA.authContext, bryanStory.id)).storyText, "Bryan unreleased ending");
  } finally {
    await setup.close();
  }
});

test("#1141 keeps active project state session/profile scoped and clears it on lock", async () => {
  const setup = await fixture();
  try {
    await setup.storage.saveProject(setup.profileA.authContext, { project: project("a-story", "A Story") });
    await setup.storage.saveProject(setup.profileB.authContext, { project: project("b-story", "B Story") });
    assert.equal((await setup.storage.loadActiveProject(setup.profileA.authContext)).id, "a-story");
    assert.equal((await setup.storage.loadActiveProject(setup.profileB.authContext)).id, "b-story");
    assert.equal(setup.auth.lock(setup.profileA.authContext), true);
    await assert.rejects(setup.storage.loadActiveProject(setup.profileA.authContext), (error) => error?.code === "SESSION_REJECTED");
    assert.equal((await setup.storage.loadActiveProject(setup.profileB.authContext)).id, "b-story");
  } finally {
    await setup.close();
  }
});

test("#1141 scopes credentials, creative memory, indexes and caches to the authenticated Human", async () => {
  const setup = await fixture();
  try {
    const syntheticSecret = "synthetic-provider-secret-for-bryan";
    await setup.storage.writeCredential(setup.profileA.authContext, "ai-connection.json", { apiKey: syntheticSecret, provider: "local-test" });
    await setup.storage.writePrivateJson(setup.profileA.authContext, { domain: "memory", objectId: "story-agent", value: { projectId: "story-a", agentId: "sage", summary: "private memory" } });
    await setup.storage.writePrivateJson(setup.profileA.authContext, { domain: "indexes", objectId: "story-search", value: { projectId: "story-a", chunks: ["private retrieval"] } });
    await setup.storage.writePrivateJson(setup.profileA.authContext, { domain: "cache", objectId: "recent-prompts", value: { prompts: ["private prompt"] } });

    assert.equal((await setup.storage.readCredential(setup.profileA.authContext, "ai-connection.json")).apiKey, syntheticSecret);
    assert.equal(await setup.storage.readCredential(setup.profileB.authContext, "ai-connection.json"), null);
    for (const domain of ["memory", "indexes", "cache"]) {
      const objectId = domain === "memory" ? "story-agent" : domain === "indexes" ? "story-search" : "recent-prompts";
      assert.equal(await setup.storage.readPrivateJson(setup.profileB.authContext, { domain, objectId }), null);
    }
    const credentialPath = path.join(profileStoragePaths(setup.root, setup.profileA.profile.profileId).credentials, "ai-connection.json".slice(0, -5) + ".json");
    assert.doesNotMatch(await readFile(credentialPath, "utf8"), new RegExp(syntheticSecret));
    const audit = spawnSync(process.execPath, [path.join(process.cwd(), "scripts", "local-credential-audit.mjs"), "--root", process.cwd(), "--home", setup.root, "--strict", "--json"], { encoding: "utf8" });
    assert.equal(audit.status, 0, audit.stderr || audit.stdout);
    const report = JSON.parse(audit.stdout);
    assert.equal(report.passed, true);
    assert.ok(report.profile_envelopes.length >= 4);
    assert.doesNotMatch(audit.stdout, new RegExp(syntheticSecret));
  } finally {
    await setup.close();
  }
});

test("#1141 rejects a symlinked profile domain instead of following it outside the profile root", async (context) => {
  const setup = await fixture();
  const outside = await mkdtemp(path.join(os.tmpdir(), "plotpickle-profile-storage-outside-"));
  try {
    const initialized = await setup.storage.initializeProfile(setup.profileA.authContext);
    await rm(initialized.paths.memory, { recursive: true });
    try {
      await symlink(outside, initialized.paths.memory, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error?.code)) {
        context.skip("Windows test account cannot create a directory junction.");
        return;
      }
      throw error;
    }
    await assert.rejects(
      setup.storage.writePrivateJson(setup.profileA.authContext, { domain: "memory", objectId: "escape", value: { secret: true } }),
      (error) => error?.code === "SYMLINK_ESCAPE_REJECTED",
    );
    assert.deepEqual(await readdir(outside), []);
  } finally {
    await setup.close();
    await rm(outside, { recursive: true, force: true });
  }
});

test("#1141 quarantines tampered encrypted objects without inventing empty replacement data", async () => {
  const setup = await fixture();
  try {
    const saved = project("tamper-story", "Tamper Story");
    await setup.storage.saveProject(setup.profileA.authContext, { project: saved });
    const directory = profileStoragePaths(setup.root, setup.profileA.profile.profileId).projects;
    const filePath = path.join(directory, `${saved.id}.json`);
    const record = JSON.parse(await readFile(filePath, "utf8"));
    record.envelope.aead.ciphertext = `${record.envelope.aead.ciphertext.slice(0, -1)}${record.envelope.aead.ciphertext.endsWith("A") ? "B" : "A"}`;
    await writeFile(filePath, `${JSON.stringify(record, null, 2)}\n`);
    await assert.rejects(setup.storage.loadProject(setup.profileA.authContext, saved.id), (error) => error?.code === "PROFILE_OBJECT_CORRUPT");
    const names = await readdir(directory);
    assert.ok(names.some((name) => name.startsWith(`${saved.id}.json.quarantine.invalid.`)));
    assert.equal(names.includes(`${saved.id}.json`), false);
  } finally {
    await setup.close();
  }
});

test("#1141 migration is read-only, resumable and value-free in logs while retaining its snapshot", async () => {
  const setup = await fixture();
  try {
    let readOnly = false;
    let snapshots = 0;
    let completed = false;
    let failCredential = true;
    const circular = {};
    circular.self = circular;
    const storyText = "unpublished dragon ending";
    const credentialValue = "synthetic-token-value-never-log";
    const source = {
      sourceId: "legacy-local-store",
      async setReadOnly(value) { assert.equal(value, true); readOnly = true; },
      async createSnapshot() { snapshots += 1; return "snapshot-20260820"; },
      async listProjects() { return [{ id: "legacy-story", value: project("legacy-story", "Legacy Story", storyText) }]; },
      async listCredentials() { return [{ name: "ai-connection.json", value: failCredential ? circular : { apiKey: credentialValue } }]; },
      async complete() { completed = true; },
    };

    await assert.rejects(setup.storage.migrateLegacyProfile(setup.profileA.authContext, source), (error) => error?.code === "INVALID_STRUCTURED_VALUE");
    assert.equal(readOnly, true);
    assert.equal(snapshots, 1);
    assert.equal(completed, false);
    assert.equal((await setup.storage.loadProject(setup.profileA.authContext, "legacy-story")).storyText, storyText);

    failCredential = false;
    const result = await setup.storage.migrateLegacyProfile(setup.profileA.authContext, source);
    assert.equal(result.resumed, true);
    assert.equal(result.complete, true);
    assert.equal(result.projectCount, 1);
    assert.equal(result.credentialCount, 1);
    assert.equal(snapshots, 1, "the verified migration snapshot is retained and reused");
    assert.equal(completed, true);
    assert.equal((await setup.storage.readCredential(setup.profileA.authContext, "ai-connection.json")).apiKey, credentialValue);
    const logs = JSON.stringify(setup.logs);
    assert.doesNotMatch(logs, new RegExp(storyText));
    assert.doesNotMatch(logs, new RegExp(credentialValue));
    assert.match(logs, /migration-failed/);
    assert.match(logs, /migration-complete/);
  } finally {
    await setup.close();
  }
});

test("#1141 explicit project export still enforces the authenticated owner", async () => {
  const setup = await fixture();
  try {
    await setup.storage.saveProject(setup.profileA.authContext, { project: project("export-story", "Export Story") });
    const exported = await setup.storage.exportProject(setup.profileA.authContext, "export-story");
    assert.equal(exported.format, "plotpickle-explicit-project-export");
    assert.equal(exported.ownerProfileId, setup.profileA.profile.profileId);
    await assert.rejects(setup.storage.exportProject(setup.profileB.authContext, "export-story"), (error) => error?.code === "PROJECT_NOT_FOUND");
  } finally {
    await setup.close();
  }
});

test("#1141 NodeSecretStore is node-scoped, headless-adapter protected and separate from every Human PMK", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-node-secret-"));
  try {
    const protector = {
      protection: "test-operator-managed-key",
      async protect({ name, clear }) { return { name, opaque: Buffer.from(clear).toString("base64").split("").reverse().join("") }; },
      async unprotect({ name, protected: value }) {
        assert.equal(value.name, name);
        return new Uint8Array(Buffer.from(value.opaque.split("").reverse().join(""), "base64"));
      },
    };
    const store = createNodeSecretStore({ root, protector });
    const relaySecret = "node-relay-secret-value";
    await store.write("buzz-managed-secrets.json", { relayPrivateKey: relaySecret });
    assert.equal((await store.read("buzz-managed-secrets.json")).relayPrivateKey, relaySecret);
    assert.deepEqual(await store.inventory(), ["buzz-managed-secrets.json"]);
    assert.equal(store.path, nodeStoragePaths(root).secrets);
    assert.equal(store.path.startsWith(path.join(root, "profiles")), false);
    assert.doesNotMatch(await readFile(path.join(store.path, "buzz-managed-secrets.json"), "utf8"), new RegExp(relaySecret));
    await assert.rejects(store.write("../human.json", {}), (error) => error?.code === "INVALID_CREDENTIAL_NAME");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("#1141 credential inventory classifies every record as Human-profile or Node owned", async () => {
  const registry = JSON.parse(await readFile(new URL("../config/credential-boundary.registry.json", import.meta.url), "utf8"));
  assert.equal(registry.schema_version, 2);
  assert.equal(registry.storage_roots.human_profile, "PLOTPICKLE_HOME/profiles/<profile_uuid>/credentials");
  assert.equal(registry.storage_roots.node, "PLOTPICKLE_HOME/node/secrets");
  assert.ok(registry.credentials.length > 0);
  for (const credential of registry.credentials) {
    assert.ok(["human-profile", "node"].includes(credential.owner_scope));
    assert.equal(credential.protection, credential.owner_scope === "human-profile" ? registry.encryption_contract.human_profile : registry.encryption_contract.node);
    assert.equal(credential.canonical_storage, credential.owner_scope === "human-profile" ? registry.storage_roots.human_profile : registry.storage_roots.node);
    assert.match(credential.migration_state, /legacy-read-only|move-and-verify/);
  }
  const humanBuzz = registry.credentials.find((item) => item.id === "buzz-connection");
  const nodeBuzz = registry.credentials.find((item) => item.id === "buzz-managed-runtime");
  assert.equal(humanBuzz.owner_scope, "human-profile");
  assert.equal(nodeBuzz.owner_scope, "node");

  const [legacyCredentials, legacyProjects, workflow] = await Promise.all([
    readFile(new URL("../build/local-credentials.ts", import.meta.url), "utf8"),
    readFile(new URL("../build/local-project-gateway.ts", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/profile-private-storage.yml", import.meta.url), "utf8"),
  ]);
  assert.match(legacyCredentials, /createLegacyCredentialMigrationSource/);
  assert.match(legacyCredentials, /legacy-credentials\.read-only\.json/);
  assert.match(legacyProjects, /createLegacyProjectMigrationSource/);
  assert.match(legacyProjects, /legacy-projects\.read-only\.json/);
  assert.match(workflow, /Windows x64/);
  assert.match(workflow, /Linux x64/);
});
