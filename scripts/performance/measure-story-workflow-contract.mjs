import { performance } from "node:perf_hooks";
import {
  affectedStoryWorkItemIds,
  planStoryWorkItems,
  requeueAffectedStoryWorkItems,
} from "../../core/story-workflow/runtime/story-workflow-core.mjs";

const afterglowRequirements = [
  {
    id: "foundations:ren-motivation",
    frontier: "Foundations",
    targetRefs: ["ppf:foundations:ren-motivation"],
    dependencyRefs: ["character:ren"],
    evidenceRefs: ["afterglow-v9-block-17"],
    assignedAgentId: "tamsin",
    priority: "high",
    severity: "high",
    satisfied: false,
  },
  {
    id: "structure:block-17-causality",
    frontier: "Structure",
    targetRefs: ["ppf:structure:block-17"],
    dependencyRefs: ["ppf:foundations:ren-motivation"],
    evidenceRefs: ["afterglow-v9-block-17"],
    assignedAgentId: "sage",
    priority: "normal",
    severity: "medium",
    satisfied: false,
  },
  {
    id: "visual:ren-isobel-beach",
    frontier: "Visual",
    targetRefs: ["visual:ren-isobel-beach"],
    dependencyRefs: ["ppf:structure:block-17"],
    evidenceRefs: ["afterglow-v9-reference-frame-17"],
    assignedAgentId: "merrin",
    priority: "normal",
    severity: "medium",
    satisfied: false,
  },
  {
    id: "world:weather",
    frontier: "World",
    targetRefs: ["ppf:world:weather"],
    dependencyRefs: ["location:wasaga-beach"],
    evidenceRefs: ["afterglow-v9-world"],
    assignedAgentId: "sage",
    priority: "low",
    severity: "low",
    satisfied: false,
  },
];

function elapsed(start) {
  return Number((performance.now() - start).toFixed(3));
}

export function measureStoryWorkflowContract(input = {}) {
  const projectId = input.projectId || "afterglow-v9";
  const baseRevision = input.baseRevision ?? 9;
  const changedRefs = input.changedRefs || ["ppf:foundations:ren-motivation"];

  let start = performance.now();
  const fullItems = planStoryWorkItems({
    projectId,
    baseRevision,
    requirements: afterglowRequirements,
    maxItems: 64,
  });
  const fullPlanElapsedMs = elapsed(start);

  start = performance.now();
  const affectedIds = affectedStoryWorkItemIds(fullItems, changedRefs);
  const affectedLookupElapsedMs = elapsed(start);
  const affectedSet = new Set(affectedIds);

  start = performance.now();
  const requeued = requeueAffectedStoryWorkItems(fullItems, changedRefs);
  const targetedItems = requeued.filter((item) => affectedSet.has(item.workItemId));
  const targetedPlanElapsedMs = elapsed(start);

  const fullAgents = [...new Set(fullItems.map((item) => item.assignedAgentId).filter(Boolean))];
  const targetedAgents = [...new Set(targetedItems.map((item) => item.assignedAgentId).filter(Boolean))];
  const unaffectedIds = fullItems.filter((item) => !affectedSet.has(item.workItemId)).map((item) => item.workItemId);
  const preservedUnaffected = requeued
    .filter((item) => unaffectedIds.includes(item.workItemId))
    .every((item) => item.kind !== "re-evaluation");

  const fullContextBytes = Buffer.byteLength(JSON.stringify(fullItems), "utf8");
  const targetedContextBytes = Buffer.byteLength(JSON.stringify(targetedItems), "utf8");

  return {
    status: "captured-deterministic-contract",
    workload: "afterglow-v9-bounded-story-workflow",
    projectId,
    baseRevision,
    changedRefs,
    providerRoute: "deterministic-local-contract",
    paidCloudRequired: false,
    fullAudit: {
      elapsedMs: fullPlanElapsedMs,
      workItemCount: fullItems.length,
      specialistCount: fullAgents.length,
      specialistIds: fullAgents,
      contextBytes: fullContextBytes,
    },
    targetedReevaluation: {
      elapsedMs: Number((affectedLookupElapsedMs + targetedPlanElapsedMs).toFixed(3)),
      workItemCount: targetedItems.length,
      specialistCount: targetedAgents.length,
      specialistIds: targetedAgents,
      contextBytes: targetedContextBytes,
      affectedWorkItemIds: affectedIds,
      preservedUnaffected,
    },
    comparison: {
      workItemRatio: fullItems.length ? Number((targetedItems.length / fullItems.length).toFixed(4)) : 0,
      specialistRatio: fullAgents.length ? Number((targetedAgents.length / fullAgents.length).toFixed(4)) : 0,
      contextByteRatio: fullContextBytes ? Number((targetedContextBytes / fullContextBytes).toFixed(4)) : 0,
      targetedIsBounded: targetedItems.length > 0 && targetedItems.length < fullItems.length && preservedUnaffected,
    },
    note: "This measures deterministic planning/invalidation cost and work amplification only. Live model latency, retries and network transport remain separate real-machine measurements and are never fabricated here.",
  };
}
