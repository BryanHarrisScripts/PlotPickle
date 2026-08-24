import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import {
  createMemoryService,
  createProfilePrivateMemoryStore,
  MEMORY_STORE_OBJECT_ID,
} from "../core/memory/memory-service-core.mjs";
import {
  createProfilePrivateStorageService,
  profileStoragePaths,
} from "../core/storage/profile-private/profile-private-storage-core.mjs";

const FIXED_NOW = "2026-08-24T23:40:00.000Z";
const PASSWORD_A = "Memory persistence profile A passphrase 2026";
const PASSWORD_B = "Memory persistence profile B passphrase 2026";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-memory-v1-"));
  const auth = await createPlotPickleAuthService({
    nodeId: "node-memory-v1-test",
    accessMode: "desktop-loopback",
    stateStore: createInMemoryAuthStateStore(),
    now: () => Date.parse(FIXED_NOW),
  });
  const profileA = await auth.createFirstProfile({ displayName: "Human A", password: PASSWORD_A, avatarRef: null });
  const profileB = await auth.createProfile({ displayName: "Human B", password: PASSWORD_B, avatarRef: null }, profileA.authContext);
  const projectOwners = new Map([
    ["project-a", profileA.profile.profileId],
    ["project-a2", profileA.profile.profileId],
    ["project-b", profileB.profile.profileId],
  ]);
  const agentOwners = new Map([
    ["sage-a", profileA.profile.profileId],
    ["avery-a", profileA.profile.profileId],
    ["sage-b", profileB.profile.profileId],
  ]);
  let storage = null;
  let memoryId = 0;
  let tick = 0;

  function openStorage() {
    storage = createProfilePrivateStorageService({
      root,
      authService: auth,
      now: () => FIXED_NOW,
      normalizeProject(value) { return value; },
    });
    return storage;
  }

  function service() {
    if (!storage) throw new Error("Storage is not open.");
    return createMemoryService({
      store: createProfilePrivateMemoryStore(storage),
      resolveSession(sessionId) {
        return auth.resolveSession(sessionId, { touch: false });
      },
      authorizeProject({ authContext, projectId }) {
        return projectOwners.get(projectId) === authContext.profileId;
      },
      authorizeAgent({ authContext, agentId, projectId }) {
        if (agentOwners.get(agentId) !== authContext.profileId) return false;
        return !projectId || projectOwners.get(projectId) === authContext.profileId;
      },
      now() {
        tick += 1;
        return new Date(Date.parse(FIXED_NOW) + tick * 1000).toISOString();
      },
      createId() {
        memoryId += 1;
        return `memory:persist-${memoryId}`;
      },
    });
  }

  async function restart() {
    storage?.close();
    storage = null;
    openStorage();
    return service();
  }

  openStorage();
  return {
    root,
    auth,
    profileA,
    profileB,
    projectOwners,
    service,
    restart,
    storage: () => storage,
    async close() {
      storage?.close();
      auth.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function proof(profile) {
  return { sessionId: profile.authContext.sessionId };
}

test("#1201 profile-private Memory v1 survives service/storage restart without crossing Humans or projects", async () => {
  const setup = await fixture();
  try {
    let memory = setup.service();
    const forgedProof = { sessionId: setup.profileA.authContext.sessionId, profileId: setup.profileB.profile.profileId };
    const human = await memory.saveMemory(forgedProof, {
      scope: "human",
      content: "Prefer concise craft explanations.",
      source: "human",
      tags: ["preference"],
    });
    await memory.saveMemory(proof(setup.profileA), {
      scope: "project",
      projectId: "project-a",
      content: "Project A keeps its winter setting.",
      source: "project",
    });
    await memory.saveMemory(proof(setup.profileA), {
      scope: "agent",
      projectId: "project-a",
      agentId: "sage-a",
      content: "Lead with a concrete scene example.",
      source: "agent",
    });
    assert.equal(human.profileId, setup.profileA.profile.profileId);

    memory = await setup.restart();
    assert.equal((await memory.listMemories(proof(setup.profileA))).length, 3);
    assert.deepEqual(await memory.listMemories(proof(setup.profileB)), []);
    await assert.rejects(
      memory.listMemories(proof(setup.profileB), { projectId: "project-a" }),
      /outside the authenticated Human authority/,
    );
    await assert.rejects(
      memory.saveMemory(proof(setup.profileA), {
        scope: "project",
        projectId: "project-b",
        content: "Foreign project write.",
        source: "human",
      }),
      /outside the authenticated Human authority/,
    );
  } finally {
    await setup.close();
  }
});

test("#1201 rejects obvious credential canaries before anything reaches profile-private memory", async () => {
  const setup = await fixture();
  try {
    const memory = setup.service();
    await memory.saveMemory(proof(setup.profileA), {
      scope: "human",
      content: "Remember that I prefer direct scene examples.",
      source: "human",
    });
    const canaries = [
      "password=super-secret-password-value",
      "passphrase:never-store-this-value",
      "nsec1abcdefghijklmnop",
      "Bearer abcdefghijklmnop",
      "sk-abcdefghijklmnop",
      "csrf_token=abcdefghijklmnop",
      "recovery_secret=abcdefghijklmnop",
      "oauth_token=abcdefghijklmnop",
      "BUZZ_AUTH_TAG=abcdefghijklmnop",
      ["-----BEGIN", "PRIVATE KEY-----", "secret"].join(" "),
    ];
    for (const canary of canaries) {
      await assert.rejects(memory.saveMemory(proof(setup.profileA), {
        scope: "human",
        content: `Do not remember ${canary}`,
        source: "human",
      }), /credential or secret material/);
    }

    const stored = await setup.storage().readPrivateJson(setup.profileA.authContext, {
      domain: "memory",
      objectId: MEMORY_STORE_OBJECT_ID,
    });
    const decoded = JSON.stringify(stored);
    for (const canary of canaries) assert.doesNotMatch(decoded, new RegExp(canary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));

    const filePath = path.join(profileStoragePaths(setup.root, setup.profileA.profile.profileId).memory, `${MEMORY_STORE_OBJECT_ID}.json`);
    const encrypted = await readFile(filePath, "utf8");
    assert.doesNotMatch(encrypted, /direct scene examples/i);
    assert.doesNotMatch(encrypted, /super-secret-password-value/i);
  } finally {
    await setup.close();
  }
});

test("#1201 forget removes the durable record and it stays gone after restart", async () => {
  const setup = await fixture();
  try {
    let memory = setup.service();
    const forgotten = await memory.saveMemory(proof(setup.profileA), {
      scope: "human",
      content: "Temporary preference to forget.",
      source: "human",
    });
    const retained = await memory.saveMemory(proof(setup.profileA), {
      scope: "human",
      content: "Permanent preference to retain.",
      source: "human",
    });
    assert.equal((await memory.forgetMemory(proof(setup.profileA), forgotten.id)).status, "forgotten");

    memory = await setup.restart();
    const records = await memory.listMemories(proof(setup.profileA), { includeForgotten: true });
    assert.deepEqual(records.map((record) => record.id), [retained.id]);
    await assert.rejects(memory.forgetMemory(proof(setup.profileA), forgotten.id), /not found in the authenticated Human scope/);
  } finally {
    await setup.close();
  }
});

test("#1201 project/profile deletion lifecycle purges only the owned memory scope", async () => {
  const setup = await fixture();
  try {
    let memory = setup.service();
    await memory.saveMemory(proof(setup.profileA), {
      scope: "human",
      content: "Human A preference remains after project deletion.",
      source: "human",
    });
    await memory.saveMemory(proof(setup.profileA), {
      scope: "project",
      projectId: "project-a",
      content: "Project A decision.",
      source: "project",
    });
    await memory.saveMemory(proof(setup.profileA), {
      scope: "agent",
      projectId: "project-a",
      agentId: "sage-a",
      content: "Project A Sage preference.",
      source: "agent",
    });
    await memory.saveMemory(proof(setup.profileA), {
      scope: "project",
      projectId: "project-a2",
      content: "Project A2 decision remains.",
      source: "project",
    });
    await memory.saveMemory(proof(setup.profileB), {
      scope: "human",
      content: "Human B remains isolated.",
      source: "human",
    });
    await memory.saveMemory(proof(setup.profileB), {
      scope: "project",
      projectId: "project-b",
      content: "Project B remains isolated.",
      source: "project",
    });

    assert.equal(await memory.purgeProjectMemories(proof(setup.profileA), "project-a"), 2);
    memory = await setup.restart();
    assert.deepEqual(
      (await memory.listMemories(proof(setup.profileA))).map((record) => record.content).sort(),
      ["Human A preference remains after project deletion.", "Project A2 decision remains."].sort(),
    );
    assert.equal((await memory.listMemories(proof(setup.profileB))).length, 2);

    assert.equal(await memory.purgeProfileMemories(proof(setup.profileA)), 2);
    memory = await setup.restart();
    assert.deepEqual(await memory.listMemories(proof(setup.profileA)), []);
    assert.equal((await memory.listMemories(proof(setup.profileB))).length, 2);
  } finally {
    await setup.close();
  }
});
