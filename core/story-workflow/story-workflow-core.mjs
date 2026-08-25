export const STORY_WORK_ITEM_STATUSES = [
  "queued",
  "running",
  "waiting-human",
  "resolved",
  "blocked",
  "failed",
  "superseded",
];

export const STORY_RESULT_KINDS = [
  "finding",
  "proposal",
  "alternatives",
  "no-finding",
  "blocked",
  "needs-human",
];

export const STORY_HUMAN_GATES = [
  "informational",
  "auto-check-complete",
  "proposal-review",
  "creative-choice",
  "conflict",
  "blocked",
];

const PRIORITY_ORDER = { blocking: 0, high: 1, normal: 2, low: 3 };

function text(value, maximum = 1000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function strings(value, maximum = 128, itemMaximum = 240) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item, itemMaximum))
    .filter(Boolean))].slice(0, maximum);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function priority(value) {
  return Object.hasOwn(PRIORITY_ORDER, value) ? value : "normal";
}

function intersects(left, rightSet) {
  return left.some((value) => rightSet.has(value));
}

export function storyWorkItemId(input) {
  const signature = stable({
    projectId: text(input.projectId, 240),
    baseRevision: text(input.baseRevision, 120),
    curriculumRequirementId: text(input.curriculumRequirementId, 360),
    targetRefs: strings(input.targetRefs).sort(),
  });
  return `story-work:${fnv1a(signature)}`;
}

export function planStoryWorkItems(input) {
  const projectId = text(input.projectId, 240);
  const baseRevision = text(input.baseRevision, 120);
  if (!projectId) throw new Error("Story Workflow requires a projectId.");
  if (!baseRevision) throw new Error("Story Workflow requires a baseRevision.");
  const maximum = Math.max(1, Math.min(64, Number.isFinite(Number(input.maxItems)) ? Math.floor(Number(input.maxItems)) : 12));

  return (Array.isArray(input.requirements) ? input.requirements : [])
    .map((requirement) => {
      const curriculumRequirementId = text(requirement.id, 360);
      const targetRefs = strings(requirement.targetRefs);
      const evidenceRefs = strings(requirement.evidenceRefs);
      const dependencyRefs = strings(requirement.dependencyRefs);
      const locked = Boolean(requirement.locked);
      const stale = Boolean(requirement.stale);
      const contradiction = Boolean(requirement.contradiction);
      const waitingHuman = Boolean(requirement.waitingHuman);
      const satisfied = Boolean(requirement.satisfied) && !stale && !contradiction;
      if (!curriculumRequirementId || locked || satisfied) return null;
      const kind = waitingHuman ? "human-gate" : stale ? "re-evaluation" : contradiction ? "audit" : "requirement";
      return {
        workItemId: storyWorkItemId({ projectId, baseRevision, curriculumRequirementId, targetRefs }),
        projectId,
        baseRevision,
        curriculumRequirementId,
        frontier: text(requirement.frontier || "Foundations", 120),
        targetRefs,
        status: waitingHuman ? "waiting-human" : "queued",
        reason: text(requirement.reason || (waitingHuman
          ? "A bounded proposal already exists and requires Human judgment before more work is useful."
          : stale
            ? "Accepted story evidence changed and this bounded requirement needs re-evaluation."
            : contradiction
              ? "Current evidence contains a contradiction that needs bounded review."
              : "Current-frontier story evidence does not yet satisfy this requirement."), 1200),
        evidenceRefs,
        assignedAgentId: text(requirement.assignedAgentId, 180),
        runId: "",
        proposalIds: [],
        dependencyRefs,
        severity: requirement.severity === "high" || requirement.severity === "low" ? requirement.severity : "medium",
        priority: priority(requirement.priority),
        kind,
      };
    })
    .filter(Boolean)
    .sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
      || left.curriculumRequirementId.localeCompare(right.curriculumRequirementId)
      || left.workItemId.localeCompare(right.workItemId))
    .slice(0, maximum);
}

export function classifyStoryResultHumanGate(result) {
  if (result.kind === "blocked") return "blocked";
  if (result.kind === "no-finding") return "auto-check-complete";
  if (result.kind === "needs-human" || result.kind === "alternatives") return "creative-choice";
  if (result.kind === "proposal") return "proposal-review";
  return "informational";
}

export function normalizeStoryResult(result) {
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Story Workflow result must be a structured object.");
  if (!STORY_RESULT_KINDS.includes(result.kind)) throw new Error(`Unsupported Story Workflow result kind: ${text(result.kind, 80) || "missing"}.`);
  const workItemId = text(result.workItemId, 180);
  const targetRefs = strings(result.targetRefs);
  const evidenceRefs = strings(result.evidenceRefs);
  const explanation = text(result.explanation, 2000);
  if (!workItemId || !targetRefs.length || !explanation) throw new Error("Story Workflow result requires workItemId, targetRefs and explanation.");
  const confidence = Number(result.confidence);
  return {
    resultId: text(result.resultId || `story-result:${fnv1a(stable(result))}`, 180),
    workItemId,
    kind: result.kind,
    targetRefs,
    evidenceRefs,
    curriculumRequirementId: text(result.curriculumRequirementId, 360),
    principleRef: text(result.principleRef, 360),
    severity: result.severity === "high" || result.severity === "low" ? result.severity : "medium",
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    changesCanon: Boolean(result.changesCanon),
    explanation,
    proposal: text(result.proposal, 4000),
    alternatives: strings(result.alternatives, 12, 2000),
    affectedDownstreamRefs: strings(result.affectedDownstreamRefs),
    humanGate: classifyStoryResultHumanGate(result),
    duplicateResultIds: [],
  };
}

function duplicateSignature(result) {
  return stable({
    kind: result.kind,
    targetRefs: [...result.targetRefs].sort(),
    evidenceRefs: [...result.evidenceRefs].sort(),
    curriculumRequirementId: result.curriculumRequirementId,
    principleRef: result.principleRef,
    changesCanon: result.changesCanon,
    explanation: result.explanation,
    proposal: result.proposal,
    alternatives: [...result.alternatives].sort(),
  });
}

function conflictSignature(result) {
  return stable({
    targetRefs: [...result.targetRefs].sort(),
    curriculumRequirementId: result.curriculumRequirementId,
  });
}

function choiceSignature(result) {
  return stable({ kind: result.kind, proposal: result.proposal, alternatives: [...result.alternatives].sort(), explanation: result.explanation });
}

export function reduceStoryResults(input) {
  const normalized = (Array.isArray(input) ? input : []).map(normalizeStoryResult);
  const byDuplicate = new Map();
  for (const result of normalized) {
    const key = duplicateSignature(result);
    const existing = byDuplicate.get(key);
    if (!existing) {
      byDuplicate.set(key, result);
      continue;
    }
    existing.duplicateResultIds = [...existing.duplicateResultIds, result.resultId];
  }
  const results = [...byDuplicate.values()];
  const choiceGroups = new Map();
  for (const result of results.filter((item) => ["proposal", "alternatives", "needs-human"].includes(item.kind))) {
    const key = conflictSignature(result);
    const group = choiceGroups.get(key) || [];
    group.push(result);
    choiceGroups.set(key, group);
  }
  const conflicts = [];
  for (const [targetKey, group] of choiceGroups.entries()) {
    const distinctChoices = new Set(group.map(choiceSignature));
    if (distinctChoices.size < 2) continue;
    conflicts.push({ targetKey, resultIds: group.map((item) => item.resultId).sort() });
    for (const result of group) result.humanGate = "conflict";
  }
  return { results, conflicts };
}

export function affectedStoryWorkItemIds(workItems, changedRefs) {
  const changed = new Set(strings(changedRefs));
  if (!changed.size) return [];
  return (Array.isArray(workItems) ? workItems : [])
    .filter((item) => intersects(strings(item.targetRefs), changed) || intersects(strings(item.dependencyRefs), changed))
    .map((item) => text(item.workItemId, 180))
    .filter(Boolean);
}

export function requeueAffectedStoryWorkItems(workItems, changedRefs) {
  const affected = new Set(affectedStoryWorkItemIds(workItems, changedRefs));
  const refs = strings(changedRefs);
  return (Array.isArray(workItems) ? workItems : []).map((item) => {
    if (!affected.has(item.workItemId)) return item;
    return {
      ...item,
      status: "queued",
      runId: "",
      proposalIds: [],
      kind: "re-evaluation",
      reason: `Re-evaluate only this affected work after accepted change to ${refs.join(", ")}.`,
    };
  });
}
