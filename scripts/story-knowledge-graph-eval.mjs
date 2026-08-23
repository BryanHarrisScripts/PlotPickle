#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function normalize(value) {
  return String(value || "").replace(/\u0000/g, "").replace(/[’']/g, "'").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function prf(predicted, gold) {
  const truePositive = [...predicted].filter((value) => gold.has(value)).length;
  const precision = predicted.size ? truePositive / predicted.size : 0;
  const recall = gold.size ? truePositive / gold.size : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { truePositive, predicted: predicted.size, gold: gold.size, precision, recall, f1 };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(value.slice(2), next);
      index += 1;
    } else {
      args.set(value.slice(2), "true");
    }
  }
  return args;
}

async function loadJson(value, fallback) {
  const target = path.resolve(repoRoot, value || fallback);
  return JSON.parse(await readFile(target, "utf8"));
}

function entityRows(document) {
  if (Array.isArray(document.entities)) return document.entities.map((entity) => ({
    type: entity.type,
    name: entity.name || entity.canonicalName,
    aliases: entity.aliases || [entity.name || entity.canonicalName],
    id: entity.id || "",
  }));
  return (document.nodes || []).map((node) => ({
    type: node.type,
    name: node.canonicalName || node.name,
    aliases: node.aliases || [node.canonicalName || node.name],
    id: node.id || "",
  }));
}

function goldAliasIndex(gold) {
  const index = new Map();
  for (const entity of entityRows(gold)) {
    const canonical = `${entity.type}:${normalize(entity.name)}`;
    for (const alias of [entity.name, ...(entity.aliases || [])]) {
      index.set(`${entity.type}:${normalize(alias)}`, canonical);
      const untyped = index.get(normalize(alias));
      if (!untyped) index.set(normalize(alias), canonical);
      else if (untyped !== canonical) index.set(normalize(alias), null);
    }
  }
  return index;
}

function canonicalEntityKey(name, type, aliases) {
  const typed = type ? aliases.get(`${type}:${normalize(name)}`) : undefined;
  if (typed) return typed;
  const untyped = aliases.get(normalize(name));
  if (untyped) return untyped;
  return `${type || "UNKNOWN"}:${normalize(name)}`;
}

function relationRows(document) {
  if (Array.isArray(document.relations)) return document.relations;
  const nodes = new Map(entityRows(document).map((node) => [node.id, node]));
  return (document.edges || []).map((edge) => {
    const source = nodes.get(edge.sourceId);
    const target = nodes.get(edge.targetId);
    return {
      source: source?.name || edge.source || edge.sourceId,
      sourceType: source?.type || edge.sourceType,
      predicate: edge.predicate,
      target: target?.name || edge.target || edge.targetId,
      targetType: target?.type || edge.targetType,
    };
  });
}

function relationKey(relation, aliases, includePredicate) {
  const source = canonicalEntityKey(relation.source, relation.sourceType, aliases);
  const target = canonicalEntityKey(relation.target, relation.targetType, aliases);
  return includePredicate ? `${source}|${normalize(relation.predicate)}|${target}` : `${source}|${target}`;
}

function mergeHealth(predicted, aliases) {
  let mergeNodes = 0;
  let badMergeNodes = 0;
  for (const entity of entityRows(predicted)) {
    const values = [...new Set((entity.aliases || []).map((alias) => canonicalEntityKey(alias, entity.type, aliases)))];
    if ((entity.aliases || []).length > 1) mergeNodes += 1;
    if (values.length > 1) badMergeNodes += 1;
  }
  return {
    mergeNodes,
    badMergeNodes,
    badMergeRate: mergeNodes ? badMergeNodes / mergeNodes : 0,
  };
}

export function evaluateStoryKnowledgePrediction(gold, predicted) {
  const aliases = goldAliasIndex(gold);
  const goldEntities = new Set(entityRows(gold).map((entity) => canonicalEntityKey(entity.name, entity.type, aliases)));
  const predictedEntities = new Set(entityRows(predicted).map((entity) => canonicalEntityKey(entity.name, entity.type, aliases)));
  const goldRelations = relationRows(gold);
  const predictedRelations = relationRows(predicted);
  const semanticGold = new Set(goldRelations.map((relation) => relationKey(relation, aliases, true)));
  const semanticPredicted = new Set(predictedRelations.map((relation) => relationKey(relation, aliases, true)));
  const endpointGold = new Set(goldRelations.map((relation) => relationKey(relation, aliases, false)));
  const endpointPredicted = new Set(predictedRelations.map((relation) => relationKey(relation, aliases, false)));
  const health = predicted.health || {};
  const dropped = health.droppedRelations || {};
  const sourceEntityCount = Number(health.sourceEntityCount || predictedEntities.size || 0);
  const sourceRelationCount = Number(health.sourceRelationCount || predictedRelations.length || 0);
  const droppedCount = Number(dropped.unresolvedSource || 0) + Number(dropped.unresolvedTarget || 0) + Number(dropped.selfLoop || 0);

  return {
    version: 1,
    entity: prf(predictedEntities, goldEntities),
    relation: prf(semanticPredicted, semanticGold),
    relationEndpointOnlyDiagnostic: prf(endpointPredicted, endpointGold),
    health: {
      orphanCount: Number(health.orphanCount || 0),
      orphanRate: sourceEntityCount ? Number(health.orphanCount || 0) / sourceEntityCount : 0,
      droppedRelations: {
        unresolvedSource: Number(dropped.unresolvedSource || 0),
        unresolvedTarget: Number(dropped.unresolvedTarget || 0),
        selfLoop: Number(dropped.selfLoop || 0),
      },
      droppedEdgeRate: sourceRelationCount ? droppedCount / sourceRelationCount : 0,
      ...mergeHealth(predicted, aliases),
    },
    notes: [
      "Relation precision/recall/F1 includes normalized predicate meaning.",
      "Endpoint-only relation scoring is diagnostic only and must not be used as the quality gate.",
      "Absence from the derived graph is not evidence that a fact is absent from canonical PPF.",
    ],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const gold = await loadJson(args.get("gold"), "tests/fixtures/afterglow-story-knowledge-gold.json");
  const predicted = await loadJson(args.get("predicted"), "tests/fixtures/afterglow-story-knowledge-baseline.json");
  const result = evaluateStoryKnowledgePrediction(gold, predicted);
  process.stdout.write(`${JSON.stringify(result, null, args.has("pretty") ? 2 : 0)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Story Knowledge Graph eval failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
