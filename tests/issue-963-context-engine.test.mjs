import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("shared Context Engine defines machine-readable source, trust, authority, revision, timestamp and allowed-use metadata", async () => {
  const engine = await read("lib/agents/context-engine.ts");
  for (const sourceType of [
    "agent-profile",
    "agent-skill",
    "writer-instruction",
    "ppf-canon",
    "curriculum-current",
    "curriculum-adapted",
    "curriculum-historical",
    "project-memory",
    "recent-conversation",
    "agent-observation",
    "buzz-peer",
    "external-tool",
    "task-schema",
  ]) assert.ok(engine.includes(`"${sourceType}"`), `Missing Context Engine source type ${sourceType}`);

  for (const field of ["sourceType", "sourceId", "trust", "authority", "allowedUse", "revision", "createdAt", "observedAt"]) {
    assert.ok(engine.includes(`readonly ${field}`), `Context item must expose ${field}`);
  }
  assert.match(engine, /budgetCharacters/);
  assert.match(engine, /usedCharacters/);
  assert.match(engine, /approximateTokens/);
  assert.match(engine, /sourceCounts/);
  assert.match(engine, /droppedCount/);
});

test("trust normalization prevents federated, observed and external context from becoming host instructions or canon", async () => {
  const engine = await read("lib/agents/context-engine.ts");
  assert.match(engine, /UNTRUSTED_SOURCE_TYPES = new Set<ContextSourceType>\(\["agent-observation", "buzz-peer", "external-tool"\]\)/);
  assert.match(engine, /if \(UNTRUSTED_SOURCE_TYPES\.has\(item\.sourceType\)\) return "untrusted-suggestion"/);
  assert.match(engine, /if \(UNTRUSTED_SOURCE_TYPES\.has\(item\.sourceType\)\) return "untrusted"/);
  assert.match(engine, /contextPacketHasHostInstructionFromUntrustedSource/);
  assert.doesNotMatch(engine, /signatureValid[^\n]*(?:authority|trust)\s*=/i);
});

test("PPF and current curriculum authority outrank approved memory, historical curriculum and untrusted evidence", async () => {
  const engine = await read("lib/agents/context-engine.ts");
  const authorityBlock = engine.match(/const AUTHORITY = \{([\s\S]*?)\} as const;/)?.[1] || "";
  const value = (name) => Number(authorityBlock.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1] || 0);
  assert.ok(value("writerInstruction") > value("ppfCanon"));
  assert.ok(value("ppfCanon") > value("currentCurriculum"));
  assert.ok(value("currentCurriculum") > value("approvedProjectMemory"));
  assert.ok(value("approvedProjectMemory") > value("historicalCurriculum"));
  assert.ok(value("historicalCurriculum") > value("externalTool"));
  assert.ok(value("externalTool") > value("buzzPeer"));
  assert.match(engine, /if \(item\.sourceType === "project-memory" && item\.allowedUse === "canon"\) return "evidence"/);
  assert.match(engine, /if \(item\.sourceType === "curriculum-historical" && item\.allowedUse === "instruction"\) return "reference"/);
});

test("context budgeting is bounded and reduces lower-priority sources without requiring a vector database", async () => {
  const engine = await read("lib/agents/context-engine.ts");
  assert.match(engine, /Math\.max\(2_000, Math\.min\(96_000/);
  assert.match(engine, /\.sort\(priority\)/);
  assert.match(engine, /maximumPerItem/);
  assert.match(engine, /clipContent/);
  assert.match(engine, /if \(!item\.required && allowance < 160\)/);
  assert.doesNotMatch(engine, /pinecone|weaviate|milvus|qdrant|pgvector|chromadb/i);
});

test("Sage assembles a bounded task packet around the existing curriculum retrieval result", async () => {
  const sage = await read("modules/creative-room/sage-context-engine.ts");
  assert.match(sage, /assembleContextPacket/);
  assert.match(sage, /profileId: "sage-brinewick"/);
  assert.match(sage, /SAGE_CONTEXT_BUDGET = 10_500/);
  assert.match(sage, /sourceType: "curriculum-current"/);
  assert.match(sage, /input\.retrieval\.context/);
  assert.match(sage, /input\.retrieval\.lessonChunkIds/);
  assert.match(sage, /input\.retrieval\.sourceChunkIds/);
  assert.match(sage, /sourceType: "project-memory"/);
  assert.match(sage, /sourceType: "recent-conversation"/);
  assert.match(sage, /sourceType: "writer-instruction"/);
  assert.match(sage, /skill:\/\/plotpickle\/sage-brinewick/);
  assert.match(sage, /contextReceiptSummary\(packet\.receipt, "Sage"\)/);
});

test("PLAN packet keeps imported PPF canon above project memory and current curriculum while preserving proposal-only drafting", async () => {
  const plan = await read("modules/plan/foundations-context-engine.ts");
  assert.match(plan, /assembleContextPacket/);
  assert.match(plan, /profileId: "tamsin-hearthquill"/);
  assert.match(plan, /PLAN_CONTEXT_BUDGET = 46_000/);
  assert.match(plan, /sourceType: "ppf-canon"/);
  assert.match(plan, /allowedUse: "canon"/);
  assert.match(plan, /sourceType: "project-memory"/);
  assert.match(plan, /allowedUse: "evidence"/);
  assert.match(plan, /sourceType: "curriculum-current"/);
  assert.match(plan, /skill:\/\/plotpickle\/plan-foundations/);
  assert.match(plan, /Draft editable working text only/);
  assert.match(plan, /cannot write PPF canon/);
  assert.match(plan, /contextReceiptSummary\(packet\.receipt, "PLAN"\)/);
});

test("context receipts expose provenance and compact source counts without hidden reasoning", async () => {
  const engine = await read("lib/agents/context-engine.ts");
  assert.match(engine, /contextReceiptSummary/);
  assert.match(engine, /const storyFacts = count\("ppf-canon"\)/);
  assert.match(engine, /count\("curriculum-current"\)/);
  assert.match(engine, /approved project/);
  assert.match(engine, /sources: included\.map/);
  assert.doesNotMatch(engine, /chain[- ]of[- ]thought|scratchpad|reasoningTrace|hiddenReasoning/i);
});
