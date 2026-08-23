import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { evaluateStoryKnowledgePrediction } from "../scripts/story-knowledge-graph-eval.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

async function loadGraphCore() {
  const source = await read("lib/story-knowledge-graph.ts");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      isolatedModules: true,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function evidence(id, revision = "rev-1") {
  return {
    sourceId: "ppf:test-project",
    revision,
    evidenceId: id,
    evidenceLocation: `fixture/${id}`,
    extractor: { id: "fixture", version: "1", route: "deterministic" },
  };
}

test("derived graph keeps resolver orphans as singleton nodes and counts every dropped relation reason", async () => {
  const { buildStoryKnowledgeGraph } = await loadGraphCore();
  const graph = buildStoryKnowledgeGraph({
    projectId: "test-project",
    sourceRevision: "rev-1",
    extractorVersion: "fixture@1",
    generatedAt: "2026-08-18T00:00:00.000Z",
    batches: [{
      sourceId: "ppf:test-project",
      revision: "rev-1",
      entities: [
        { name: "Ren", type: "CHARACTER", description: "Protagonist", provenance: evidence("ren") },
        { name: "Amy", type: "CHARACTER", description: "Sentient guide", provenance: evidence("amy") },
      ],
      relations: [
        { source: "Ren", sourceType: "CHARACTER", predicate: "trusts", target: "Amy", targetType: "CHARACTER", provenance: evidence("rel-good") },
        { source: "Missing", sourceType: "CHARACTER", predicate: "knows", target: "Amy", targetType: "CHARACTER", provenance: evidence("rel-src") },
        { source: "Ren", sourceType: "CHARACTER", predicate: "knows", target: "Missing", targetType: "CHARACTER", provenance: evidence("rel-tgt") },
        { source: "Ren", sourceType: "CHARACTER", predicate: "is", target: "Ren", targetType: "CHARACTER", provenance: evidence("rel-loop") },
      ],
    }],
    resolution: {
      CHARACTER: [{ canonical: "Ren", aliases: ["Ren"] }],
    },
  });

  assert.equal(graph.derived, true);
  assert.equal(graph.readOnly, true);
  assert.equal(graph.health.orphanCount, 1, "Amy must survive as an explicit singleton when the resolver omits it");
  assert.ok(graph.nodes.some((node) => node.canonicalName === "Amy"));
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].predicate, "trusts");
  assert.equal(graph.edges[0].provenance.evidenceId, "rel-good");
  assert.deepEqual(graph.health.droppedRelations, { unresolvedSource: 1, unresolvedTarget: 1, selfLoop: 1 });
});

test("graph revisions are explicit and semantic diffs expose additions without mutating the old graph", async () => {
  const { buildStoryKnowledgeGraph, diffStoryKnowledgeGraphs, storyKnowledgeGraphIsStale } = await loadGraphCore();
  const make = (revision, includeAmy) => buildStoryKnowledgeGraph({
    projectId: "test-project",
    sourceRevision: revision,
    extractorVersion: "fixture@1",
    generatedAt: "2026-08-18T00:00:00.000Z",
    batches: [{
      sourceId: "ppf:test-project",
      revision,
      entities: [
        { name: "Ren", type: "CHARACTER", description: "Protagonist", provenance: evidence("ren", revision) },
        ...(includeAmy ? [{ name: "Amy", type: "CHARACTER", description: "Guide", provenance: evidence("amy", revision) }] : []),
      ],
      relations: includeAmy ? [{ source: "Ren", sourceType: "CHARACTER", predicate: "trusts", target: "Amy", targetType: "CHARACTER", provenance: evidence("rel", revision) }] : [],
    }],
  });
  const previous = make("rev-1", false);
  const next = make("rev-2", true);
  const before = JSON.stringify(previous);
  const diff = diffStoryKnowledgeGraphs(previous, next);

  assert.equal(storyKnowledgeGraphIsStale(previous, "rev-2"), true);
  assert.equal(storyKnowledgeGraphIsStale(next, "rev-2"), false);
  assert.equal(diff.addedEntities.length, 1);
  assert.equal(diff.addedRelations.length, 1);
  assert.equal(JSON.stringify(previous), before, "diffing must not mutate derived or canonical inputs");
});

test("model routing is provider-independent and bounds local inference rather than promoting extraction to a frontier model", async () => {
  const source = await read("lib/story-knowledge-graph.ts");
  assert.match(source, /extraction: \{ route: "fast", maxLocalConcurrency: 1 \}/);
  assert.match(source, /resolution: \{ route: "quality", maxLocalConcurrency: 1 \}/);
  assert.match(source, /export type StoryKnowledgeExtractor/);
  assert.doesNotMatch(source, /claude|anthropic|openai|gemini|haiku|sonnet|opus/i);
});

test("canonical PPF seeds a read-only graph from characters, locations, blocks and relationships with revision provenance", async () => {
  const source = await read("lib/story-knowledge-ppf.ts");
  assert.match(source, /import type \{ PlotPickleProject \} from "\.\/project";/);
  assert.match(source, /project\.characters/);
  assert.match(source, /project\.world\.locations/);
  assert.match(source, /project\.blocks/);
  assert.match(source, /character\.relationships/);
  assert.match(source, /evidenceLocation/);
  assert.match(source, /storyKnowledgeRevisionForProject/);
  assert.match(source, /buildStoryKnowledgeGraph/);
  assert.doesNotMatch(source, /project\.[A-Za-z0-9_.]+\s*=/, "derived graph construction must not write into PPF canon");
});

test("Context Engine treats story graph material as bounded non-canon evidence below PPF authority", async () => {
  const [engine, adapter] = await Promise.all([
    read("lib/agents/context-engine.ts"),
    read("lib/story-knowledge-context.ts"),
  ]);
  assert.match(engine, /"story-knowledge-graph"/);
  assert.match(engine, /storyKnowledgeGraph: 76/);
  assert.match(engine, /if \(item\.sourceType === "story-knowledge-graph"\) return Math\.min\(item\.authority, AUTHORITY\.storyKnowledgeGraph\)/);
  assert.match(adapter, /sourceType: "story-knowledge-graph"/);
  assert.match(adapter, /trust: "unverified"/);
  assert.match(adapter, /allowedUse: "evidence"/);
  assert.match(adapter, /Math\.min\(12/);
  assert.match(adapter, /absenceIsNotEvidenceOfAbsence: true/);
  assert.doesNotMatch(adapter, /allowedUse: "canon"|trust: "owner-trusted"/);

  const authorityBlock = engine.match(/const AUTHORITY = \{([\s\S]*?)\} as const;/)?.[1] || "";
  const value = (name) => Number(authorityBlock.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1] || 0);
  assert.ok(value("ppfCanon") > value("storyKnowledgeGraph"));
  assert.ok(value("storyKnowledgeGraph") > value("approvedProjectMemory"));
});

test("Afterglow gold set is grounded in the bundled PPF fixture and baseline scorer is perfect", async () => {
  const [gold, predicted, afterglow] = await Promise.all([
    readJson("tests/fixtures/afterglow-story-knowledge-gold.json"),
    readJson("tests/fixtures/afterglow-story-knowledge-baseline.json"),
    read("data/afterglow.ts"),
  ]);
  for (const name of ["Ren", "Isobel", "Amy", "Jai", "Kai", "Sarah"]) assert.match(afterglow, new RegExp(`name: "${name}"`));
  for (const predicate of ["Connection", "Creator and creation", "Creator and companion", "Partner", "Lost loved one"]) assert.ok(afterglow.includes(`label: "${predicate}"`));

  const result = evaluateStoryKnowledgePrediction(gold, predicted);
  assert.equal(result.entity.f1, 1);
  assert.equal(result.relation.f1, 1);
  assert.equal(result.health.orphanRate, 0);
  assert.equal(result.health.droppedEdgeRate, 0);
  assert.equal(result.health.badMergeRate, 0);
});

test("relation evaluator scores predicate meaning, not endpoints alone", async () => {
  const [gold, predicted] = await Promise.all([
    readJson("tests/fixtures/afterglow-story-knowledge-gold.json"),
    readJson("tests/fixtures/afterglow-story-knowledge-baseline.json"),
  ]);
  const wrong = structuredClone(predicted);
  wrong.edges[0].predicate = "betrays";
  const result = evaluateStoryKnowledgePrediction(gold, wrong);

  assert.equal(result.relationEndpointOnlyDiagnostic.f1, 1, "endpoint-only diagnostic should miss the semantic error");
  assert.ok(result.relation.f1 < 1, "predicate-aware relation score must catch the semantic error");
  assert.match(result.notes.join(" "), /predicate meaning/i);
});
