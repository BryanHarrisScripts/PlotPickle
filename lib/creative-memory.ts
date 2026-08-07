import type { ConceptCanvasTargetKind, PlotPickleProject } from "./project";
import { readCreativeCandidateStore } from "./creative-candidates";
import { readVisualCanonBinder } from "./visual-canon";
import { readContinuityLockStore } from "./continuity-locks";
import { readImageToStoryProposalStore } from "./image-to-story-proposals";

export type CreativeMemoryNodeKind = "concept" | "reference" | "candidate" | "canon" | "continuity" | "story-change";
export type CreativeMemoryNodeStatus = "active" | "historical";

export type CreativeMemoryTarget = { kind: ConceptCanvasTargetKind; id: string; label: string };
export type CreativeMemoryNode = {
  id: string;
  kind: CreativeMemoryNodeKind;
  target: CreativeMemoryTarget;
  summary: string;
  status: CreativeMemoryNodeStatus;
  createdAt: string;
  sourceIds: string[];
};
export type CreativeMemoryEdge = { from: string; to: string; relationship: "informed" | "derived" | "approved" | "superseded" | "changed-story" };
export type CreativeMemoryGraph = { version: 1; nodes: CreativeMemoryNode[]; edges: CreativeMemoryEdge[] };

function target(kind: ConceptCanvasTargetKind, id: string, label: string): CreativeMemoryTarget { return { kind, id: id || "project", label: label || "Whole project" }; }

export function buildCreativeMemoryGraph(project: PlotPickleProject): CreativeMemoryGraph {
  const nodes: CreativeMemoryNode[] = [];
  const edges: CreativeMemoryEdge[] = [];
  const canvas = project.development.conceptCanvas;
  nodes.push({ id: "memory-concept", kind: "concept", target: target(canvas.targetKind, canvas.targetId, canvas.targetLabel), summary: canvas.conceptText, status: "active", createdAt: canvas.updatedAt, sourceIds: [] });

  for (const reference of project.development.visualReferences) {
    nodes.push({ id: `memory-reference:${reference.id}`, kind: "reference", target: target(reference.targetKind, reference.targetId, reference.targetLabel), summary: reference.notes || reference.title, status: "active", createdAt: reference.createdAt, sourceIds: [reference.id] });
  }

  for (const candidate of readCreativeCandidateStore(project).candidates) {
    const active = candidate.status === "ready" || candidate.status === "shortlisted";
    nodes.push({ id: `memory-candidate:${candidate.id}`, kind: "candidate", target: candidate.target, summary: candidate.directionSummary || candidate.payload.text || candidate.payload.assetRef, status: active ? "active" : "historical", createdAt: candidate.createdAt, sourceIds: [candidate.id, ...candidate.lineage.derivedFromCandidateIds] });
    for (const sourceId of candidate.lineage.derivedFromCandidateIds) edges.push({ from: `memory-candidate:${sourceId}`, to: `memory-candidate:${candidate.id}`, relationship: "derived" });
  }

  for (const item of readVisualCanonBinder(project).items) {
    const active = item.status === "approved";
    nodes.push({ id: `memory-canon:${item.id}`, kind: "canon", target: item.target, summary: item.description || item.title, status: active ? "active" : "historical", createdAt: item.createdAt, sourceIds: [item.source.candidateId, item.source.referenceId].filter(Boolean) });
    if (item.source.candidateId) edges.push({ from: `memory-candidate:${item.source.candidateId}`, to: `memory-canon:${item.id}`, relationship: "approved" });
    if (item.supersededByItemId) edges.push({ from: `memory-canon:${item.id}`, to: `memory-canon:${item.supersededByItemId}`, relationship: "superseded" });
  }

  for (const lock of readContinuityLockStore(project).locks) {
    nodes.push({ id: `memory-lock:${lock.id}`, kind: "continuity", target: target("project", lock.scope.id, lock.scope.label), summary: `${lock.kind}: ${lock.value}`, status: lock.active ? "active" : "historical", createdAt: lock.createdAt, sourceIds: [lock.canonItemId].filter(Boolean) });
    if (lock.canonItemId) edges.push({ from: `memory-canon:${lock.canonItemId}`, to: `memory-lock:${lock.id}`, relationship: "approved" });
  }

  for (const proposal of readImageToStoryProposalStore(project).proposals) {
    if (proposal.status !== "accepted" && proposal.status !== "edited") continue;
    nodes.push({ id: `memory-story-change:${proposal.id}`, kind: "story-change", target: target("project", proposal.targetId, proposal.targetLabel), summary: proposal.proposedText, status: "active", createdAt: proposal.updatedAt, sourceIds: [proposal.sourceAssetId, proposal.sourceCandidateId].filter(Boolean) });
    if (proposal.sourceCandidateId) edges.push({ from: `memory-candidate:${proposal.sourceCandidateId}`, to: `memory-story-change:${proposal.id}`, relationship: "changed-story" });
  }

  return { version: 1, nodes: nodes.sort((a, b) => a.id.localeCompare(b.id)), edges: edges.sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`)) };
}

export function effectiveCreativeMemory(project: PlotPickleProject, selectedTarget?: CreativeMemoryTarget) {
  const graph = buildCreativeMemoryGraph(project);
  return graph.nodes.filter((node) => node.status === "active" && (!selectedTarget || node.target.kind === "project" || (node.target.kind === selectedTarget.kind && node.target.id === selectedTarget.id)));
}

export function historicalCreativeMemory(project: PlotPickleProject) {
  return buildCreativeMemoryGraph(project).nodes.filter((node) => node.status === "historical");
}

export const creativeMemoryPrivacy = { credentialsIncluded: false, providerConfigurationIncluded: false, unrelatedPrivateContentIncluded: false } as const;
