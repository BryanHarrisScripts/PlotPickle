import type { StoryboardEditorialShot } from "../../core/contracts/storyboard/editorial-shot";
import {
  markImportedScreenplayProjectionStale,
  type ProjectSourceEvidence,
} from "../../core/contracts/imported-screenplay-evidence";
import type { LibraryPPFProject } from "../../core/storage/project-library-browser";
import type { PlotPickleProject } from "../projects/project";
import {
  createPreproductionCreativeChangeSet,
  verifyPreproductionCreativeChangeSet,
} from "../creative-transactions/preproduction-creative-transaction-bridge";
import type { CreativeChangeArea, CreativeVerificationEvidence } from "../creative-transactions/creative-transaction-contract";
import {
  buildPreproductionDependencySnapshot,
  downstreamImpactIds,
  downstreamImpactPaths,
} from "./dependency-projection";
import {
  projectPreproductionSemantics,
  projectProductionInstruction,
  type BeatSemanticProjection,
  type FrameSemanticProjection,
} from "./semantic-projection";

export type CreativeRevisionKind =
  | "block-content"
  | "mini-content"
  | "writing"
  | "planning-lock"
  | "accepted-visual";

export type CreativeRevisionTarget =
  | {
    readonly kind: "block-content" | "planning-lock";
    readonly blockNumber: number;
  }
  | {
    readonly kind: "mini-content" | "writing";
    readonly blockNumber: number;
    readonly miniBlockNumber: number;
  }
  | {
    readonly kind: "accepted-visual";
    readonly artifactId: string;
  };

export type CreativeRevisionAffectedKind =
  | "scene"
  | "beat"
  | "storyboard"
  | "previs"
  | "production"
  | "other";

export type CreativeRevisionAffectedRef = {
  readonly id: string;
  readonly kind: CreativeRevisionAffectedKind;
  readonly path: readonly string[];
  readonly explanation: string;
};

export type CreativeRevisionPropagationPlan = {
  readonly projectId: string;
  readonly baseRevision: number;
  readonly target: CreativeRevisionTarget;
  readonly directTargetIds: readonly string[];
  readonly changeSet: ReturnType<typeof createPreproductionCreativeChangeSet>;
  readonly verificationEvidence: readonly CreativeVerificationEvidence[];
  readonly affectedRefs: readonly CreativeRevisionAffectedRef[];
  readonly staleAcceptedVisualArtifactIds: readonly string[];
  readonly staleProductionShotIds: readonly string[];
  readonly staleSceneIds: readonly string[];
  readonly staleProductionInstructionIds: readonly string[];
  readonly unaffectedAcceptedVisualArtifactIds: readonly string[];
  readonly unaffectedProductionShotIds: readonly string[];
  readonly sourceProjectionRefs: readonly string[];
  readonly requiresRegeneration: false;
};

function bounded(value: unknown, maximum = 4_000) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function stable(values: readonly string[]) {
  return [...new Set(values.map((value) => bounded(value, 500)).filter(Boolean))].sort();
}

function fingerprintSource(value: unknown) {
  const source = typeof value === "string" ? value : JSON.stringify(value);
  let first = 2166136261;
  let second = 3335557771;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 2246822519);
  }
  return `revision:${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function creativeRevisionFingerprint(value: unknown) {
  return fingerprintSource(value);
}

function anchorFromArtifact(keys: readonly string[] | undefined) {
  return (keys ?? []).find((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key)) ?? "";
}

function dependencyKeyFromArtifact(keys: readonly string[] | undefined) {
  return (keys ?? []).find((key) => key.startsWith("storyboard-upstream:")) ?? "";
}

function visualFrames(project: LibraryPPFProject): readonly FrameSemanticProjection[] {
  const artifacts = [
    ...project.build.foundations.visualArtifacts,
    ...project.build.world.visualArtifacts,
  ];
  return artifacts.flatMap((artifact) => {
    const anchorRef = anchorFromArtifact(artifact.sourceDecisionKeys);
    if (!anchorRef) return [];
    return [{
      frameId: artifact.id,
      anchorRef,
      storyboardArtifactId: artifact.id,
      storyboardDependencyKey: dependencyKeyFromArtifact(artifact.sourceDecisionKeys),
      narrativePurpose: artifact.narrativeIntention || "",
    }];
  });
}

function acceptedVisualIds(project: LibraryPPFProject) {
  return stable([
    ...project.build.foundations.acceptedVisualArtifactIds,
    ...project.build.world.acceptedVisualArtifactIds,
  ]);
}

function resolvedTargetIds(project: LibraryPPFProject, target: CreativeRevisionTarget) {
  if (target.kind === "accepted-visual") return [target.artifactId];
  const block = project.structure.blocks.find((candidate) => candidate.number === target.blockNumber);
  if (!block) throw new Error(`Creative revision Block ${target.blockNumber} was not found.`);
  if (target.kind === "planning-lock") return [`planning-lock:${block.id}`];
  if (target.kind === "block-content") return [block.id];
  const mini = block.miniBlocks.find((candidate) => candidate.ordinal === target.miniBlockNumber);
  if (!mini) throw new Error(`Creative revision Mini-Block ${target.blockNumber}.${target.miniBlockNumber} was not found.`);
  return [mini.id];
}

function sourceProjectionRefs(project: LibraryPPFProject, target: CreativeRevisionTarget) {
  if (target.kind === "accepted-visual" || target.kind === "planning-lock") return [];
  if (target.kind === "block-content") {
    return [`ppf:structure:block:${target.blockNumber}`];
  }
  return [
    `ppf:structure:block:${target.blockNumber}`,
    `ppf:structure:block:${target.blockNumber}:mini:${target.miniBlockNumber}`,
  ];
}

function changeArea(kind: CreativeRevisionKind): CreativeChangeArea {
  if (kind === "accepted-visual") return "storyboard";
  if (kind === "writing") return "screenplay";
  return "story";
}

function affectedKind(id: string): CreativeRevisionAffectedKind {
  if (id.startsWith("production-instruction:")) return "production";
  if (id.startsWith("previs-")) return "previs";
  if (id.startsWith("source-scene:") || id.startsWith("scene-")) return "scene";
  if (id.startsWith("beat-") || id.includes(":beat")) return "beat";
  if (id.startsWith("storyboard-") || id.startsWith("frame-") || id.includes("editorial-shot")) return "storyboard";
  return "other";
}

function explanation(path: readonly string[]) {
  return path.length > 1
    ? `${path[0]} → ${path.slice(1).join(" → ")}`
    : path[0] ?? "";
}

function targetSummary(target: CreativeRevisionTarget) {
  if (target.kind === "accepted-visual") return `accepted visual ${target.artifactId}`;
  if (target.kind === "planning-lock") return `Block ${String(target.blockNumber).padStart(2, "0")} planning lock`;
  if (target.kind === "block-content") return `Block ${String(target.blockNumber).padStart(2, "0")} content`;
  return `Block ${String(target.blockNumber).padStart(2, "0")} · Mini-Block ${target.miniBlockNumber} ${target.kind === "writing" ? "working screenplay" : "content"}`;
}

/**
 * Deterministic consequence projection over the existing #2092 dependency graph
 * and #2035 Creative Change Set contract. It owns no transaction provider,
 * persistence, regeneration, approval or separate staleness store.
 */
export function planCreativeRevisionPropagation(input: {
  readonly project: LibraryPPFProject;
  readonly target: CreativeRevisionTarget;
  readonly beforeValue: unknown;
  readonly afterValue: unknown;
  readonly changeSetId: string;
  readonly summary?: string;
  readonly legacyProject?: PlotPickleProject | null;
  readonly beats?: readonly BeatSemanticProjection[];
  readonly editorialShots?: readonly StoryboardEditorialShot[];
  readonly currentStaleIds?: readonly string[];
  readonly occurredAt?: string;
}): CreativeRevisionPropagationPlan {
  const directTargetIds = resolvedTargetIds(input.project, input.target);
  const beforeFingerprint = creativeRevisionFingerprint(input.beforeValue);
  const afterFingerprint = creativeRevisionFingerprint(input.afterValue);
  if (beforeFingerprint === afterFingerprint) {
    throw new Error("Creative revision propagation requires a real before/after delta.");
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const semantics = projectPreproductionSemantics(input.project, input.legacyProject ?? null);
  const frames = visualFrames(input.project);
  const productionInstruction = projectProductionInstruction(input.project);
  const dependencySnapshot = buildPreproductionDependencySnapshot({
    project: input.project,
    semantics,
    beats: input.beats,
    editorialShots: input.editorialShots,
    frames,
    productionInstruction,
    generatedAt: occurredAt,
  });
  const changeSet = createPreproductionCreativeChangeSet({
    project: input.project,
    dependencySnapshot,
    changeSetId: input.changeSetId,
    changes: [{
      area: changeArea(input.target.kind),
      targetIds: directTargetIds,
      summary: bounded(input.summary || `Revise ${targetSummary(input.target)}.`, 800),
      beforeFingerprint,
      afterFingerprint,
    }],
    createdAt: occurredAt,
  });
  const verificationEvidence = verifyPreproductionCreativeChangeSet({
    project: input.project,
    dependencySnapshot,
    changeSet,
    currentStaleIds: input.currentStaleIds ?? [],
    recordedAt: occurredAt,
  });
  const impactIds = stable(downstreamImpactIds(dependencySnapshot, directTargetIds));
  const paths = downstreamImpactPaths(dependencySnapshot, directTargetIds);
  const acceptedIds = acceptedVisualIds(input.project);
  const acceptedSet = new Set(acceptedIds);
  const productionShotIds = stable(input.project.production.shots.map((shot) => shot.id));
  const productionShotSet = new Set(productionShotIds);

  const staleAcceptedVisualArtifactIds = impactIds.filter((id) => acceptedSet.has(id));
  const staleProductionShotIds = impactIds.filter((id) => productionShotSet.has(id));
  const staleSceneIds = impactIds.filter((id) => affectedKind(id) === "scene");
  const staleProductionInstructionIds = impactIds.filter((id) => id.startsWith("production-instruction:"));

  return {
    projectId: input.project.id,
    baseRevision: input.project.revision,
    target: input.target,
    directTargetIds,
    changeSet,
    verificationEvidence,
    affectedRefs: impactIds.map((id) => ({
      id,
      kind: affectedKind(id),
      path: paths[id] ?? [...directTargetIds, id],
      explanation: explanation(paths[id] ?? [...directTargetIds, id]),
    })),
    staleAcceptedVisualArtifactIds,
    staleProductionShotIds,
    staleSceneIds,
    staleProductionInstructionIds,
    unaffectedAcceptedVisualArtifactIds: acceptedIds.filter((id) => !staleAcceptedVisualArtifactIds.includes(id)),
    unaffectedProductionShotIds: productionShotIds.filter((id) => !staleProductionShotIds.includes(id)),
    sourceProjectionRefs: sourceProjectionRefs(input.project, input.target),
    requiresRegeneration: false,
  };
}

/**
 * Records only the existing screenplay-projection review provenance after a
 * committed creative revision. Visual/Previs staleness remains derived from
 * their existing dependency keys; accepted artifacts are not deleted or demoted.
 */
export function markCreativeRevisionSourceProjectionStale(
  sourceEvidence: ProjectSourceEvidence,
  plan: Pick<CreativeRevisionPropagationPlan, "sourceProjectionRefs">,
  atRevision: number,
) {
  return plan.sourceProjectionRefs.length
    ? markImportedScreenplayProjectionStale(
      sourceEvidence,
      plan.sourceProjectionRefs,
      atRevision,
    )
    : sourceEvidence;
}
