import { isAfterglowRecoverySnapshot } from "./afterglow-recovery-snapshot.mjs";

/**
 * Read-only source discovery for the consolidation planner. Snapshot ID is
 * independent of story project ID: several recovery points may capture the
 * very same project at different revisions, with different accepted work.
 *
 * This does NOT certify original media bytes or authorize a durable save.
 * The signed-in profile must already have authorized and hydrated the inputs.
 */
export function collectAfterglowReviewSources({active, archived, recoveryPoints, load}) {
  if (!Array.isArray(active) || !Array.isArray(archived) ||
    !Array.isArray(recoveryPoints) || typeof load !== "function") {
    throw new Error("Afterglow review requires an authenticated, complete source inventory.");
  }
  const result=[], warnings=[], keys=new Set();
  function include(entry) {
    const key=entry.sourceKey??entry.project.id;
    if(keys.has(key)) throw new Error("A saved Afterglow snapshot was counted more than once: "+key);
    keys.add(key);
    result.push(entry);
  }
  for(const summary of active) {
    const project=load(summary.id);
    if(!isAfterglowRecoverySnapshot(project) || project.id!==summary.id) {
      throw new Error("An active Afterglow source cannot be read. Existing work was not changed.");
    }
    include({project,savedAt:summary.updatedAt,sourceKind:"working-copy"});
  }
  for(const summary of archived) {
    const project=load(summary.id);
    if(!isAfterglowRecoverySnapshot(project) || project.id!==summary.id) {
      warnings.push("Archived Afterglow from "+summary.updatedAt+" is unavailable or invalid.");
      continue;
    }
    include({project,sourceKey:"archived:"+summary.id,savedAt:summary.updatedAt,sourceKind:"archived-copy"});
  }
  for(const point of recoveryPoints) {
    if(!isAfterglowRecoverySnapshot(point?.project)) continue;
    if(point.project.id!==point.projectId) {
      warnings.push("Recovery point from "+point.createdAt+" has mismatched story identity.");
      continue;
    }
    if(typeof point.id!=="string"||!point.id.trim()) {
      warnings.push("An Afterglow recovery point has no stable snapshot identity.");
      continue;
    }
    include({project:point.project,sourceKey:"point:"+point.id,
      savedAt:point.createdAt,sourceKind:"recovery-point"});
  }
  result.sort((a,b)=>a.project.updatedAt.localeCompare(b.project.updatedAt)
    ||(a.sourceKey??a.project.id).localeCompare(b.sourceKey??b.project.id));
  return {sources:result,warnings};
}
