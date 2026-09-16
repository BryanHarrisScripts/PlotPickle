import type { ProductionShotIntent } from "../../core/contracts/previs";
import { applyStoryCommand } from "../../core/project/apply-command";
import type { PPFProject } from "../../core/project/project";
import type { LibraryPPFProject } from "../../core/storage/project-library-browser";
import {
  creativeChangeSetFingerprint,
  type CreativeTransactionRecord,
  type CreativeVerificationEvidence,
} from "../creative-transactions/creative-transaction-contract";
import {
  createPreproductionCreativeChangeSet,
  verifyPreproductionCreativeChangeSet,
} from "../creative-transactions/preproduction-creative-transaction-bridge";
import type { PlotPickleProject } from "../projects/project";
import {
  buildPreproductionDependencySnapshot,
  downstreamImpactIds,
} from "./dependency-projection";
import {
  projectPreproductionSemantics,
  projectProductionInstruction,
} from "./semantic-projection";

export type ApprovedShotTimingChangePlan = {
  readonly projectId: string;
  readonly baseRevision: number;
  readonly productionShotId: string;
  readonly candidateShot: ProductionShotIntent;
  readonly changeSet: ReturnType<typeof createPreproductionCreativeChangeSet>;
  readonly verificationEvidence: readonly CreativeVerificationEvidence[];
  readonly staleDerivativeIds: readonly string[];
  readonly unaffectedProductionShotIds: readonly string[];
};

export type ApprovedShotTimingAdmission = {
  readonly project: PPFProject;
  readonly productionShotId: string;
  readonly staleDerivativeIds: readonly string[];
  readonly unaffectedProductionShotIds: readonly string[];
  readonly transactionId: string;
  readonly durableRevisionId: string;
};

function normalizedDuration(value: number | null) {
  if (value === null) return null;
  if (!Number.isFinite(value) || value <= 0) throw new Error("Approved Shot duration must be a positive number or null.");
  return Math.min(3600, Math.round(value * 100) / 100);
}

function timingFingerprint(shot: Pick<ProductionShotIntent, "id" | "durationSeconds" | "transitionIn" | "transitionOut" | "reviewState">) {
  return [
    "previs-timing-v1",
    shot.id,
    shot.durationSeconds === null ? "untimed" : String(shot.durationSeconds),
    shot.transitionIn,
    shot.transitionOut,
    shot.reviewState,
  ].join("|");
}

function stableIds(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

/**
 * Prepare one approved Previs timing change for the existing #2035 transaction path.
 * This function does not mutate PPF canon, create a transaction provider, or invent
 * staleness. Current stale IDs must be supplied by existing Storyboard/Previs owners.
 */
export function planApprovedShotTimingChange(input: {
  readonly project: LibraryPPFProject;
  readonly legacyProject?: PlotPickleProject | null;
  readonly productionShotId: string;
  readonly durationSeconds: number | null;
  readonly currentStaleIds: readonly string[];
  readonly changeSetId: string;
  readonly occurredAt?: string;
}): ApprovedShotTimingChangePlan {
  const shot = input.project.production.shots.find((candidate) => candidate.id === input.productionShotId);
  if (!shot) throw new Error(`Approved Shot timing change target ${input.productionShotId} was not found.`);
  if (shot.reviewState !== "approved") {
    throw new Error("Only an approved ProductionShotIntent uses the Slice 5 #2035 admission seam.");
  }

  const durationSeconds = normalizedDuration(input.durationSeconds);
  if (shot.durationSeconds === durationSeconds) throw new Error("Approved Shot timing change must change the authored duration.");

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const candidateShot: ProductionShotIntent = {
    ...shot,
    durationSeconds,
    updatedAt: occurredAt,
  };
  const semantics = projectPreproductionSemantics(input.project, input.legacyProject ?? null);
  const productionInstruction = projectProductionInstruction(input.project);
  const dependencySnapshot = buildPreproductionDependencySnapshot({
    project: input.project,
    semantics,
    productionInstruction,
    generatedAt: occurredAt,
  });
  const changeSet = createPreproductionCreativeChangeSet({
    project: input.project,
    dependencySnapshot,
    changeSetId: input.changeSetId,
    changes: [{
      area: "previs",
      targetIds: [shot.id],
      summary: `Change approved Shot ${shot.order} duration from ${shot.durationSeconds ?? "untimed"}s to ${durationSeconds ?? "untimed"}s.`,
      beforeFingerprint: timingFingerprint(shot),
      afterFingerprint: timingFingerprint(candidateShot),
    }],
    createdAt: occurredAt,
  });
  const verificationEvidence = verifyPreproductionCreativeChangeSet({
    project: input.project,
    dependencySnapshot,
    changeSet,
    currentStaleIds: input.currentStaleIds,
    recordedAt: occurredAt,
  });
  const staleDerivativeIds = stableIds(downstreamImpactIds(dependencySnapshot, [shot.id]));
  const affected = new Set(changeSet.affectedIds);
  const unaffectedProductionShotIds = stableIds(
    input.project.production.shots
      .filter((candidate) => !affected.has(candidate.id))
      .map((candidate) => candidate.id),
  );

  return {
    projectId: input.project.id,
    baseRevision: input.project.revision,
    productionShotId: shot.id,
    candidateShot,
    changeSet,
    verificationEvidence,
    staleDerivativeIds,
    unaffectedProductionShotIds,
  };
}

/**
 * Admit the exact candidate only after an existing #2035 provider has durably
 * committed the same Change Set following blocking verification and Human review.
 * Persistence remains the caller's existing PPF responsibility.
 */
export function admitCommittedApprovedShotTimingChange(input: {
  readonly project: LibraryPPFProject;
  readonly plan: ApprovedShotTimingChangePlan;
  readonly transaction: CreativeTransactionRecord;
  readonly occurredAt?: string;
}): ApprovedShotTimingAdmission {
  const { project, plan, transaction } = input;
  if (transaction.state !== "committed" || !transaction.durableRevisionId) {
    throw new Error("Approved Shot timing cannot enter PPF before the #2035 transaction is durably committed.");
  }
  if (transaction.review.status !== "accepted" || !transaction.review.writerId) {
    throw new Error("Approved Shot timing requires explicit Human acceptance before PPF admission.");
  }
  if (project.id !== plan.projectId || project.id !== transaction.changeSet.projectId) {
    throw new Error("Approved Shot timing transaction belongs to a different project.");
  }
  if (project.revision !== plan.baseRevision || project.revision !== transaction.changeSet.baseCanonicalRevision) {
    throw new Error("Approved Shot timing transaction is stale relative to the current PPF revision.");
  }
  if (creativeChangeSetFingerprint(transaction.changeSet) !== creativeChangeSetFingerprint(plan.changeSet)) {
    throw new Error("Committed Creative Change Set does not match the reviewed approved Shot timing plan.");
  }

  const current = project.production.shots.find((candidate) => candidate.id === plan.productionShotId);
  if (!current || current.reviewState !== "approved") {
    throw new Error("Approved Shot timing target is no longer the approved ProductionShotIntent that was reviewed.");
  }
  const directChange = plan.changeSet.changes.find((change) => change.targetIds.includes(plan.productionShotId));
  if (!directChange || directChange.beforeFingerprint !== timingFingerprint(current)) {
    throw new Error("Approved Shot timing target changed after review; rebase the Creative Transaction.");
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const next = applyStoryCommand(project, {
    type: "previs.shot.store",
    shot: { ...plan.candidateShot, updatedAt: occurredAt },
    occurredAt,
  });

  return {
    project: next,
    productionShotId: plan.productionShotId,
    staleDerivativeIds: plan.staleDerivativeIds,
    unaffectedProductionShotIds: plan.unaffectedProductionShotIds,
    transactionId: transaction.transactionId,
    durableRevisionId: transaction.durableRevisionId,
  };
}
