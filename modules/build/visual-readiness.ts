import type { PPFProject } from "../../core/project/project";
import { deriveProgressiveStoryMap, type BuildStoryEvidenceState } from "./progressive-story-map";

export type VisualReadinessState = BuildStoryEvidenceState;
export type VisualTargetKind = "project" | "block" | "character" | "location" | "reference";

export type VisualReadinessProvenance = {
  readonly source: "ppf" | "curriculum" | "observed-reference" | "accepted-visual";
  readonly ref: string;
};

export type VisualReadinessTarget = {
  readonly id: string;
  readonly kind: VisualTargetKind;
  readonly label: string;
  readonly state: VisualReadinessState;
  readonly curriculumFrontier: string;
  readonly storyboardAllowed: boolean;
  readonly missingPrerequisites: readonly string[];
  readonly provenance: readonly VisualReadinessProvenance[];
  readonly staleBecause: readonly string[];
};

export type LegacyVisualIdentityEvidence = {
  readonly id: string;
  readonly kind: "character" | "location" | "reference";
  readonly label: string;
  readonly approved?: boolean;
  readonly sourceRef?: string;
};

export type VisualReadinessSnapshot = {
  readonly projectId: string;
  readonly projectRevision: number;
  readonly curriculumFrontier: string;
  readonly storyboardAllowed: boolean;
  readonly targets: readonly VisualReadinessTarget[];
};

function projectFrontier(project: PPFProject) {
  if (Object.keys(project.world.lessons).length > 0) return "Foundations + World";
  return "Foundations";
}

function acceptedVisualIds(project: PPFProject) {
  return new Set([
    ...project.build.foundations.acceptedVisualArtifactIds,
    ...project.build.world.acceptedVisualArtifactIds,
  ]);
}

function targetState(input: LegacyVisualIdentityEvidence, acceptedIds: ReadonlySet<string>): VisualReadinessState {
  if (input.approved || acceptedIds.has(input.id)) return "defined";
  return input.sourceRef ? "observed" : "emerging";
}

export function deriveVisualReadiness(input: {
  readonly project: PPFProject;
  readonly legacyVisualEvidence?: readonly LegacyVisualIdentityEvidence[];
  readonly staleTargetIds?: readonly string[];
  readonly staleReason?: string;
}): VisualReadinessSnapshot {
  const { project } = input;
  const map = deriveProgressiveStoryMap(project);
  const frontier = projectFrontier(project);
  const stale = new Set(input.staleTargetIds ?? []);
  const acceptedIds = acceptedVisualIds(project);

  const projectTarget: VisualReadinessTarget = {
    id: `project:${project.id}`,
    kind: "project",
    label: project.title,
    state: project.revision > 0 ? "defined" : "emerging",
    curriculumFrontier: frontier,
    storyboardAllowed: false,
    missingPrerequisites: ["reviewed structural placement", "storyboard frontier approval"],
    provenance: [{ source: "ppf", ref: `project:${project.id}@${project.revision}` }],
    staleBecause: stale.has(`project:${project.id}`) && input.staleReason ? [input.staleReason] : [],
  };

  const blockTargets: VisualReadinessTarget[] = map.blocks.map((block) => {
    const id = `block:${block.id}`;
    const reviewedPlacement = block.state === "observed" || block.state === "defined";
    return {
      id,
      kind: "block",
      label: `Block ${block.number}: ${block.sequenceTitle}`,
      state: block.state,
      curriculumFrontier: map.frontier,
      storyboardAllowed: reviewedPlacement,
      missingPrerequisites: reviewedPlacement ? [] : ["Human-reviewed structural placement"],
      provenance: block.observedPassageCount
        ? [{ source: "curriculum", ref: `${map.frontier}:${block.id}` }]
        : [],
      staleBecause: stale.has(id) && input.staleReason ? [input.staleReason] : [],
    };
  });

  const legacyTargets: VisualReadinessTarget[] = (input.legacyVisualEvidence ?? []).map((evidence) => {
    const state = targetState(evidence, acceptedIds);
    const id = `${evidence.kind}:${evidence.id}`;
    return {
      id,
      kind: evidence.kind,
      label: evidence.label,
      state,
      curriculumFrontier: frontier,
      storyboardAllowed: state === "defined",
      missingPrerequisites: state === "defined" ? [] : ["Human-approved canonical visual identity"],
      provenance: evidence.sourceRef
        ? [{ source: state === "defined" ? "accepted-visual" : "observed-reference", ref: evidence.sourceRef }]
        : [],
      staleBecause: stale.has(id) && input.staleReason ? [input.staleReason] : [],
    };
  });

  const targets = [projectTarget, ...blockTargets, ...legacyTargets];
  return {
    projectId: project.id,
    projectRevision: project.revision,
    curriculumFrontier: frontier,
    storyboardAllowed: targets.some((target) => target.kind === "block" && target.storyboardAllowed),
    targets,
  };
}

export function markVisualTargetsStale(
  snapshot: VisualReadinessSnapshot,
  affectedTargetIds: readonly string[],
  reason: string,
): VisualReadinessSnapshot {
  const affected = new Set(affectedTargetIds);
  return {
    ...snapshot,
    targets: snapshot.targets.map((target) => affected.has(target.id)
      ? { ...target, staleBecause: [...target.staleBecause, reason] }
      : target),
  };
}
