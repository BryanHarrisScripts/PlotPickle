/**
 * #3241: fail-closed cap for opt-in developer Factory PR staging.
 *
 * This is a growth brake, NOT cleanup, byte accounting, or runtime retention.
 * A private atomic directory excludes concurrent stages until the Git worktree
 * operation settles. Stale locks block new work and require owner inspection.
 * No arbitrary paths are accepted by MCP: the caller supplies the fixed,
 * server-selected private Factory root.
 */
import { mkdir, opendir, rmdir, lstat } from "node:fs/promises";
import path from "node:path";

export const FACTORY_STAGING_POLICY = Object.freeze({
  maxRetainedStages: 3,
  minFreeBytes: 8 * 1024 ** 3,
});
const STAGE_ID = /^[a-f0-9]{32}$/u;
const blocked = (code,extra={}) => Object.freeze({
  state:"BLOCKED",code,...extra,cleanupAuthorized:false,
  issueReserved:false,
});
const validBase = ({root,base}) =>
  typeof root==="string" && path.isAbsolute(root) &&
  typeof base==="string" && path.isAbsolute(base) &&
  path.resolve(base)===path.resolve(root,"chat-candidate-stages");

/** Fast bounded count, never opens any candidate contents. */
export async function assessCandidateStageCount({
  base, list=opendir, maxRetainedStages=FACTORY_STAGING_POLICY.maxRetainedStages,
}={}) {
  if(typeof base!=="string" || !path.isAbsolute(base) ||
     maxRetainedStages!==FACTORY_STAGING_POLICY.maxRetainedStages)
    return blocked("STAGE_BUDGET_UNVERIFIED");
  let count=0;
  try {
    const handle=await list(base);
    try {
      for await (const entry of handle) {
        if(!entry.isDirectory() || entry.isSymbolicLink() ||
           !STAGE_ID.test(entry.name))
          return blocked("STAGE_BUDGET_UNVERIFIED");
        count++;
        if(count>=maxRetainedStages)
          return blocked("STAGE_BUDGET_EXCEEDED",{
            observedStagesAtLeast:count,
            maximumStages:maxRetainedStages,
          });
      }
    } finally {
      try { await handle.close(); } catch(error) {
        if(error?.code!=="ERR_DIR_CLOSED") throw error;
      }
    }
    return Object.freeze({state:"READY",code:"STAGE_BUDGET_AVAILABLE",
      observedStages:count,maximumStages:maxRetainedStages,
      cleanupAuthorized:false});
  } catch {
    return blocked("STAGE_BUDGET_UNVERIFIED");
  }
}

/**
 * Serializes budget check + stage creation, preserving a failed lock as
 * fail-closed when the process dies. Only removes our empty owned lock.
 * The onStage callback cannot be reached when the root or count is uncertain.
 */
export async function withCandidateStageBudget({
  root,base, makeLock=mkdir, releaseLock=rmdir, stat=lstat,
  assess=assessCandidateStageCount, onStage,
}={}) {
  if(!validBase({root,base}) || typeof onStage!=="function")
    return blocked("STAGE_BUDGET_UNVERIFIED");
  const lock=path.join(root,".candidate-stage-budget.lock");
  let acquired=false, outcome;
  try {
    const rootStat=await stat(root);
    const baseStat=await stat(base);
    if(!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
       !baseStat.isDirectory() || baseStat.isSymbolicLink())
      return blocked("STAGE_BUDGET_UNVERIFIED");
    try {
      await makeLock(lock); // atomic exclusive mkdir; never recursive
      acquired=true;
    } catch(error) {
      return blocked(error?.code==="EEXIST"?"STAGE_BUDGET_BUSY":"STAGE_BUDGET_UNVERIFIED");
    }
    const proof=await assess({base});
    if(proof?.state!=="READY" || proof.code!=="STAGE_BUDGET_AVAILABLE")
      outcome=blocked(
        ["STAGE_BUDGET_EXCEEDED","STAGE_BUDGET_UNVERIFIED"].includes(proof?.code)
          ? proof.code : "STAGE_BUDGET_UNVERIFIED",
        proof?.code==="STAGE_BUDGET_EXCEEDED"
          ? {maximumStages:FACTORY_STAGING_POLICY.maxRetainedStages}: {},
      );
    else outcome=await onStage();
  } catch {
    outcome=blocked("STAGE_BUDGET_UNVERIFIED");
  }
  if(acquired) {
    try { await releaseLock(lock); }
    catch {return blocked("STAGE_BUDGET_LOCK_RELEASE_FAILED");}
  }
  return outcome;
}
