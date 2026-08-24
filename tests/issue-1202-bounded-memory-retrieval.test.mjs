import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createInMemoryMemoryStore,
  createMemoryService,
  resolveMemoryAgainstPpf,
} from "../core/memory/memory-service-core.mjs";
import { retrieveRelevantMemories } from "../core/memory/memory-retrieval-core.mjs";

function authContext(profileId, sessionId) {
  return {
    sessionId,
    profileId,
    nodeId: "node-memory-retrieval",
    authStrength: "password",
    issuedAt: "2026-08-24T23:45:00.000Z",
    expiresAt: "2026-08-25T23:45:00.000Z",
    roles: ["human"],
  };
}

function harness() {
  const sessions = new Map([
    ["session-a", authContext("human-a", "session-a")],
    ["session-b", authContext("human-b", "session-b")],
  ]);
  const projects = new Map([
    ["project-a", "human-a"],
    ["project-b", "human-b"],
  ]);
  const agents = new Map([
    ["sage-a", "human-a"],
    ["sage-b", "human-b"],
  ]);
  let identifier = 0;
  let tick = 0;
  const service = createMemoryService({
    store: createInMemoryMemoryStore(),
    resolveSession(sessionId) {
      const resolved = sessions.get(sessionId);
      if (!resolved) throw new Error("Session is not authorized.");
      return resolved;
    },
    authorizeProject({ authContext, projectId }) {
      return projects.get(projectId) === authContext.profileId;
    },
    authorizeAgent({ authContext, agentId, projectId }) {
      if (agents.get(agentId) !== authContext.profileId) return false;
      return !projectId || projects.get(projectId) === authContext.profileId;
    },
    createId() {
      identifier += 1;
      return `memory:retrieval-${identifier}`;
    },
    now() {
      tick += 1;
      return new Date(Date.UTC(2026, 7, 24, 23, 45, tick)).toISOString();
    },
  });
  return { service };
}

async function seed() {
  const setup = harness();
  const a = { sessionId: "session-a" };
  const b = { sessionId: "session-b" };
  await setup.service.saveMemory(a, {
    scope: "human",
    content: "Prefer concise coaching with concrete scene examples.",
    source: "human",
    tags: ["coaching", "concise"],
  });
  await setup.service.saveMemory(a, {
    scope: "project",
    projectId: "project-a",
    content: "The ending happens in winter at the quarry.",
    source: "project",
    tags: ["ending", "winter"],
  });
  await setup.service.saveMemory(a, {
    scope: "project",
    projectId: "project-a",
    content: "The protagonist drives a red car in act one.",
    source: "project",
    tags: ["vehicle"],
  });
  await setup.service.saveMemory(a, {
    scope: "agent",
    projectId: "project-a",
    agentId: "sage-a",
    content: "When discussing endings, Sage should ask about causality.",
    source: "agent",
    tags: ["ending", "sage"],
  });
  await setup.service.saveMemory(b, {
    scope: "project",
    projectId: "project-b",
    content: "HUMAN_B_UNIQUE_CANARY winter ending must never cross profiles.",
    source: "project",
    tags: ["winter", "ending"],
  });
  return setup;
}

test("#1202 returns a small relevant same-scope set and omits unrelated memory", async () => {
  const { service } = await seed();
  const result = await retrieveRelevantMemories(service, { sessionId: "session-a" }, {
    text: "winter ending causality",
    projectId: "project-a",
    agentId: "sage-a",
    maxResults: 2,
    maxCharacters: 180,
  });

  assert.equal(result.items.length, 2);
  assert.ok(result.usedCharacters <= 180);
  assert.ok(result.approximateTokens <= Math.ceil(180 / 4));
  assert.match(result.items[0].excerpt, /winter|ending/i);
  assert.ok(result.items.some((item) => /causality/i.test(item.excerpt)));
  assert.ok(result.items.every((item) => !/red car/i.test(item.excerpt)));
  assert.ok(result.items.every((item) => !/HUMAN_B_UNIQUE_CANARY/.test(item.excerpt)));
});

test("#1202 can retrieve Human preference memory without exposing project-only records", async () => {
  const { service } = await seed();
  const result = await retrieveRelevantMemories(service, { sessionId: "session-a" }, {
    text: "concise coaching",
    scopes: ["human"],
    maxResults: 3,
    maxCharacters: 400,
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].scope, "human");
  assert.match(result.items[0].excerpt, /concise coaching/i);
});

test("#1202 foreign Human/project identifiers do not reveal counts or canary content", async () => {
  const { service } = await seed();
  await assert.rejects(
    retrieveRelevantMemories(service, { sessionId: "session-a" }, {
      text: "winter ending",
      projectId: "project-b",
      scopes: ["project"],
    }),
    /outside the authenticated Human authority/,
  );
  await assert.rejects(
    retrieveRelevantMemories(service, { sessionId: "session-a" }, {
      text: "winter ending",
      profileId: "human-b",
    }),
    /profile authority comes from the authenticated session/,
  );
});

test("#1202 forgotten memory is absent from native retrieval", async () => {
  const { service } = harness();
  const saved = await service.saveMemory({ sessionId: "session-a" }, {
    scope: "human",
    content: "Use nautical metaphors when teaching structure.",
    source: "human",
    tags: ["nautical"],
  });
  await service.forgetMemory({ sessionId: "session-a" }, saved.id);
  const result = await retrieveRelevantMemories(service, { sessionId: "session-a" }, {
    text: "nautical structure",
    maxResults: 8,
    maxCharacters: 8_000,
  });
  assert.equal(result.items.length, 0);
  assert.equal(result.matchedCount, 0);
});

test("#1202 hard bounds cap requested result and context size", async () => {
  const { service } = harness();
  for (let index = 0; index < 12; index += 1) {
    await service.saveMemory({ sessionId: "session-a" }, {
      scope: "human",
      content: `Structure preference ${index}: use scene causality before exposition. ${"x".repeat(300)}`,
      source: "human",
      tags: ["structure", "causality"],
    });
  }
  const result = await retrieveRelevantMemories(service, { sessionId: "session-a" }, {
    text: "structure causality",
    maxResults: 999,
    maxCharacters: 999_999,
  });
  assert.equal(result.maxResults, 8);
  assert.equal(result.maxCharacters, 8_000);
  assert.ok(result.items.length <= 8);
  assert.ok(result.usedCharacters <= 8_000);
  assert.ok(result.droppedCount >= 4);
});

test("#1202 Context Engine adapter keeps persistent memory as bounded evidence below PPF", async () => {
  const adapter = await readFile(new URL("../lib/agents/context/memory-context.ts", import.meta.url), "utf8");
  const engine = await readFile(new URL("../lib/agents/context/context-engine.ts", import.meta.url), "utf8");
  assert.match(adapter, /retrieveRelevantMemories/);
  assert.match(adapter, /sourceType: "project-memory"/);
  assert.match(adapter, /trust: "approved"/);
  assert.match(adapter, /allowedUse: "evidence"/);
  assert.match(adapter, /CONTEXT_AUTHORITY\.approvedProjectMemory/);

  const authority = engine.match(/const AUTHORITY = \{([\s\S]*?)\} as const;/)?.[1] || "";
  const ppf = Number(authority.match(/ppfCanon:\s*(\d+)/)?.[1] || 0);
  const memory = Number(authority.match(/approvedProjectMemory:\s*(\d+)/)?.[1] || 0);
  assert.ok(ppf > memory);
  assert.deepEqual(
    resolveMemoryAgainstPpf({ ppfValue: "Mara leaves.", memoryValue: "Mara stays." }),
    { value: "Mara leaves.", authority: "ppf" },
  );
});

test("#1202 retrieval is native/offline and contains no vector or cloud provider dependency", async () => {
  const source = await readFile(new URL("../core/memory/memory-retrieval-core.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /pinecone|weaviate|milvus|qdrant|pgvector|chromadb|openai|anthropic|embedding|fetch\s*\(/i);
  assert.match(source, /memoryService\.listMemories/);
  assert.match(source, /maxResults/);
  assert.match(source, /maxCharacters/);
});
