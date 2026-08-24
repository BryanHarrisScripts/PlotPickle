import assert from "node:assert/strict";
import test from "node:test";
import {
  MEMORY_AUTHORITY,
  createMemoryService,
  parseMemoryRecord,
  resolveMemoryAgainstPpf,
} from "../core/memory/memory-service-core.mjs";

function authContext(profileId, sessionId) {
  return {
    sessionId,
    profileId,
    nodeId: "node-a",
    authStrength: "password",
    issuedAt: "2026-08-24T20:00:00.000Z",
    expiresAt: "2026-08-25T20:00:00.000Z",
    roles: ["human"],
  };
}

function memoryHarness() {
  const sessions = new Map([
    ["session-a", authContext("human-a", "session-a")],
    ["session-b", authContext("human-b", "session-b")],
  ]);
  const projectOwners = new Map([
    ["project-a", "human-a"],
    ["project-b", "human-b"],
  ]);
  const agentOwners = new Map([
    ["sage-a", "human-a"],
    ["avery-a", "human-a"],
    ["sage-b", "human-b"],
  ]);
  let tick = 0;
  let identifier = 0;
  const service = createMemoryService({
    resolveSession(sessionId) {
      const resolved = sessions.get(sessionId);
      if (!resolved) throw new Error("Session is not authorized.");
      return resolved;
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
      return new Date(Date.UTC(2026, 7, 24, 20, 0, tick)).toISOString();
    },
    createId() {
      identifier += 1;
      return `memory:test-${identifier}`;
    },
  });
  return { service, projectOwners };
}

test("#1200 runtime-validates the minimal contextual memory record", () => {
  const record = parseMemoryRecord({
    version: 1,
    id: "memory:one",
    scope: "project",
    profileId: "human-a",
    projectId: "project-a",
    agentId: null,
    content: "Keep the ending unresolved.",
    source: "human",
    authority: "contextual",
    createdAt: "2026-08-24T20:00:00.000Z",
    updatedAt: "2026-08-24T20:00:00.000Z",
    tags: ["Ending", "tone"],
    status: "active",
  });
  assert.equal(record.version, 1);
  assert.equal(record.authority, MEMORY_AUTHORITY);
  assert.deepEqual(record.tags, ["ending", "tone"]);
  assert.throws(() => parseMemoryRecord({ ...record, authority: "canonical" }), /PPF is canonical/);
  assert.throws(() => parseMemoryRecord({ ...record, scope: "project", projectId: null }), /requires an authoritative project ID/);
  assert.throws(() => parseMemoryRecord({ ...record, scope: "agent", agentId: null }), /requires an authoritative agent ID/);
});

test("host-owned save derives Human authority from the authenticated session", async () => {
  const { service } = memoryHarness();
  const human = await service.saveMemory({ sessionId: "session-a", profileId: "human-b" }, {
    scope: "human",
    content: "I prefer concise coaching.",
    source: "human",
    tags: ["coaching"],
  });
  const project = await service.saveMemory({ sessionId: "session-a" }, {
    scope: "project",
    projectId: "project-a",
    content: "The third act stays in winter.",
    source: "project",
  });
  const agent = await service.saveMemory({ sessionId: "session-a" }, {
    scope: "agent",
    projectId: "project-a",
    agentId: "sage-a",
    content: "Use scene examples before theory.",
    source: "agent",
  });

  assert.equal(human.profileId, "human-a");
  assert.equal(project.profileId, "human-a");
  assert.equal(agent.profileId, "human-a");
  assert.equal(project.projectId, "project-a");
  assert.equal(agent.agentId, "sage-a");
  assert.notEqual(human.id, project.id);
});

test("caller cannot inject profile, canonical authority, status or timestamps", async () => {
  const { service } = memoryHarness();
  for (const field of ["profileId", "ownerProfileId", "authority", "status", "createdAt", "updatedAt"]) {
    await assert.rejects(
      service.saveMemory({ sessionId: "session-a" }, {
        scope: "human",
        content: "Do not persist caller authority.",
        source: "human",
        [field]: field === "authority" ? "canonical" : "forged",
      }),
      new RegExp(`${field} is host-owned`),
    );
  }
});

test("cross-Human, foreign-project and foreign-agent writes are rejected", async () => {
  const { service } = memoryHarness();
  await assert.rejects(service.saveMemory({ sessionId: "session-a" }, {
    scope: "project",
    projectId: "project-b",
    content: "Foreign project memory.",
    source: "human",
  }), /outside the authenticated Human authority/);
  await assert.rejects(service.saveMemory({ sessionId: "session-a" }, {
    scope: "agent",
    agentId: "sage-b",
    content: "Foreign agent memory.",
    source: "agent",
  }), /outside the authenticated Human authority/);

  const own = await service.saveMemory({ sessionId: "session-a" }, {
    scope: "human",
    content: "Human A only.",
    source: "human",
  });
  assert.deepEqual(await service.listMemories({ sessionId: "session-b" }), []);
  await assert.rejects(service.forgetMemory({ sessionId: "session-b" }, own.id), /not found in the authenticated Human scope/);
});

test("listMemories rechecks project authority and does not leak inaccessible records", async () => {
  const { service, projectOwners } = memoryHarness();
  await service.saveMemory({ sessionId: "session-a" }, {
    scope: "project",
    projectId: "project-a",
    content: "Project A only.",
    source: "project",
  });
  assert.equal((await service.listMemories({ sessionId: "session-a" })).length, 1);
  projectOwners.set("project-a", "human-b");
  assert.deepEqual(await service.listMemories({ sessionId: "session-a" }), []);
  await assert.rejects(service.listMemories({ sessionId: "session-a" }, { projectId: "project-a" }), /outside the authenticated Human authority/);
});

test("forget is host-owned, deterministic and hidden from normal reads", async () => {
  const { service } = memoryHarness();
  const saved = await service.saveMemory({ sessionId: "session-a" }, {
    scope: "human",
    content: "Remember then forget this.",
    source: "human",
  });
  const forgotten = await service.forgetMemory({ sessionId: "session-a" }, saved.id);
  assert.equal(forgotten.status, "forgotten");
  assert.notEqual(forgotten.updatedAt, saved.updatedAt);
  assert.deepEqual(await service.listMemories({ sessionId: "session-a" }), []);
  const history = await service.listMemories({ sessionId: "session-a" }, { includeForgotten: true });
  assert.equal(history.length, 1);
  assert.equal(history[0].id, saved.id);
  assert.equal((await service.forgetMemory({ sessionId: "session-a" }, saved.id)).status, "forgotten");
});

test("PPF deterministically outranks conflicting contextual memory", () => {
  assert.deepEqual(
    resolveMemoryAgainstPpf({ ppfValue: "She leaves Toronto.", memoryValue: "She stays in Toronto." }),
    { value: "She leaves Toronto.", authority: "ppf" },
  );
  assert.deepEqual(
    resolveMemoryAgainstPpf({ ppfValue: null, memoryValue: "Writer prefers short scene descriptions." }),
    { value: "Writer prefers short scene descriptions.", authority: "memory-context" },
  );
});

test("agent-suggested memory still requires the host session boundary", async () => {
  assert.throws(() => createMemoryService({}), /requires the host Auth session resolver/);
  const { service } = memoryHarness();
  await assert.rejects(service.saveMemory({ sessionId: "missing" }, {
    scope: "agent",
    agentId: "sage-a",
    content: "An agent cannot persist outside host authority.",
    source: "agent",
  }), /Session is not authorized/);
});
