import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createInMemoryMemoryStore,
  createMemoryService,
  resolveMemoryAgainstPpf,
} from "../core/memory/memory-service-core.mjs";
import {
  parseSageMemoryCommand,
  retrieveAveryContinuity,
  retrieveSageContinuity,
} from "../core/memory/agent-memory-continuity-core.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const proof = Object.freeze({ sessionId: "session" });

function serviceFor(store, profileId, projects, ids) {
  let clock = 0;
  return createMemoryService({
    resolveSession(sessionId) {
      assert.equal(sessionId, proof.sessionId);
      return { profileId };
    },
    store,
    authorizeProject: ({ projectId }) => projects.includes(projectId),
    authorizeAgent: ({ agentId }) => ["sage-brinewick", "avery-north"].includes(agentId),
    now: () => new Date(Date.UTC(2026, 7, 24, 20, 0, clock++)).toISOString(),
    createId: () => ids.shift() || `memory-${clock}`,
  });
}

test("explicit Sage remember and forget language stays deterministic and narrow", () => {
  assert.deepEqual(parseSageMemoryCommand("remember this: Do not use dream endings"), {
    action: "remember",
    scope: "project",
    content: "Do not use dream endings",
  });
  assert.deepEqual(parseSageMemoryCommand("remember for all my projects: keep explanations concise"), {
    action: "remember",
    scope: "human",
    content: "keep explanations concise",
  });
  assert.deepEqual(parseSageMemoryCommand("always keep explanations concise"), {
    action: "remember",
    scope: "human",
    content: "Always keep explanations concise",
  });
  assert.deepEqual(parseSageMemoryCommand("do not suggest dream sequences again"), {
    action: "remember",
    scope: "project",
    content: "Do not suggest dream sequences again.",
  });
  assert.deepEqual(parseSageMemoryCommand("forget this"), {
    action: "forget",
    mode: "latest",
    query: "",
  });
  assert.equal(parseSageMemoryCommand("I was wondering about act two"), null);
});

test("Sage and Avery retrieve useful memory after restart without cross-Human/project/agent leakage", async () => {
  const store = createInMemoryMemoryStore();
  const first = serviceFor(store, "human-a", ["project-a", "project-b"], ["human-pref", "project-a-decision", "project-b-canary", "sage-private"]);
  await first.saveMemory(proof, {
    scope: "human",
    content: "Keep explanations concise and practical.",
    source: "human",
    tags: ["concise", "teaching"],
  });
  const projectDecision = await first.saveMemory(proof, {
    scope: "project",
    projectId: "project-a",
    content: "Do not use the dream-sequence ending again; it made Mara passive.",
    source: "human",
    tags: ["ending", "rejected"],
  });
  await first.saveMemory(proof, {
    scope: "project",
    projectId: "project-b",
    content: "PROJECT-B-ONLY-CANARY uses a lighthouse finale.",
    source: "human",
    tags: ["canary"],
  });
  await first.saveMemory(proof, {
    scope: "agent",
    projectId: "project-a",
    agentId: "sage-brinewick",
    content: "SAGE-PRIVATE-CANARY temporary working note.",
    source: "agent",
    tags: ["private"],
  });

  const restarted = serviceFor(store, "human-a", ["project-a", "project-b"], []);
  const sageHuman = await retrieveSageContinuity(restarted, proof, { projectId: "project-a", text: "concise explanations" });
  assert.equal(sageHuman.items[0]?.id, "human-pref");
  assert.deepEqual(sageHuman.scopes, ["human", "project"]);

  const sageProject = await retrieveSageContinuity(restarted, proof, { projectId: "project-a", text: "dream sequence ending Mara" });
  assert.equal(sageProject.items[0]?.id, projectDecision.id);
  assert.ok(sageProject.items.every((item) => !item.excerpt.includes("PROJECT-B-ONLY-CANARY")));
  assert.ok(sageProject.items.every((item) => !item.excerpt.includes("SAGE-PRIVATE-CANARY")));

  const averyProject = await retrieveAveryContinuity(restarted, proof, { projectId: "project-a", text: "dream sequence ending Mara" });
  assert.equal(averyProject.items[0]?.id, projectDecision.id);
  assert.deepEqual(averyProject.scopes, ["project"]);
  const averyHuman = await retrieveAveryContinuity(restarted, proof, { projectId: "project-a", text: "concise explanations" });
  assert.equal(averyHuman.items.length, 0, "Avery must not receive Human-wide preference memory.");
  const averyPrivate = await retrieveAveryContinuity(restarted, proof, { projectId: "project-a", text: "private working note" });
  assert.equal(averyPrivate.items.length, 0, "Avery must not receive Sage agent-private memory.");

  const projectB = await retrieveSageContinuity(restarted, proof, { projectId: "project-b", text: "dream sequence ending Mara" });
  assert.ok(projectB.items.every((item) => item.id !== projectDecision.id));

  const otherHuman = serviceFor(store, "human-b", ["project-a"], []);
  const foreign = await retrieveSageContinuity(otherHuman, proof, { projectId: "project-a", text: "dream sequence ending Mara" });
  assert.equal(foreign.items.length, 0, "A second Human on the same Node must not discover Human A memory.");

  await restarted.forgetMemory(proof, projectDecision.id);
  const restartedAgain = serviceFor(store, "human-a", ["project-a", "project-b"], []);
  const forgotten = await retrieveSageContinuity(restartedAgain, proof, { projectId: "project-a", text: "dream sequence ending Mara" });
  assert.ok(forgotten.items.every((item) => item.id !== projectDecision.id), "Forgotten memory must remain absent after restart.");
});

test("current PPF stays canonical when remembered context conflicts", () => {
  assert.deepEqual(resolveMemoryAgainstPpf({
    ppfValue: "Mara is 34.",
    memoryValue: "Mara is 29.",
  }), {
    value: "Mara is 34.",
    authority: "ppf",
  });
});

test("the product wires Sage through authenticated Memory v1 while Avery remains project-only", async () => {
  const [page, sage, route, continuity] = await Promise.all([
    read("app/page.tsx"),
    read("modules/creative-room/memory-aware-sage-guide.ts"),
    read("app/api/memory/route.ts"),
    read("core/memory/agent-memory-continuity-core.mjs"),
  ]);
  assert.match(page, /guide=\{memoryAwareSageGuide\}/);
  assert.match(sage, /handleSageMemoryCommand/);
  assert.match(sage, /sagePersistentMemoryText/);
  assert.match(sage, /PPF\/curriculum evidence always wins a conflict/);
  assert.match(route, /boundary\.authorizeRequest/);
  assert.match(route, /createProfilePrivateMemoryStore/);
  assert.match(route, /retrieveSageContinuity/);
  assert.match(route, /retrieveAveryContinuity/);
  assert.match(continuity, /SAGE_SCOPES = Object\.freeze\(\["human", "project"\]\)/);
  assert.match(continuity, /AVERY_SCOPES = Object\.freeze\(\["project"\]\)/);
  assert.doesNotMatch(continuity, /embedding|vector|openai|minimax|cloud/i);
});
