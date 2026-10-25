/**
 * #3241: owner-Windows resource-aware, non-destructive candidate admission.
 *
 * Retained historical Git worktrees are evidence, NOT concurrent workers.
 * Count inventory to expose pressure, but NEVER delete/recycle a stage or
 * block solely because there are >3 retained worktrees. A single atomic
 * owner-private lock serializes candidate admission; a separate fixed-disk
 * preflight verifies available capacity before the Git operation begins.
 * A crash-retained lock remains a STOP until independently investigated.
 */
import { mkdir, opendir, rmdir, lstat } from "node:fs/promises";
import path from "node:path";

export const FACTORY_STAGING_POLICY = Object.freeze({
  maxConcurrentStaging: 1,
  maxInventoryEntries: 4096,
  minFreeBytes: 8 * 1024 ** 3,
  admissionReserveBytes: 1 * 1024 ** 3,
});
const STAGE_ID = /^[a-f0-9]{32}$/u;
const blocked = (code, extra = {}) => Object.freeze({
  state: "BLOCKED", code, ...extra, cleanupAuthorized: false,
  issueReserved: false,
});
const validBase = ({ root, base }) =>
  typeof root === "string" && path.isAbsolute(root) &&
  typeof base === "string" && path.isAbsolute(base) &&
  path.resolve(base) === path.resolve(root, "chat-candidate-stages");

/**
 * Bounded metadata inventory only. Existing stages remain untouched regardless
 * of how many are retained. An unexpected file, junction/symlink, inventory
 * overflow or incomplete enumeration is unknown ownership and fails closed.
 * The count is descriptive, NOT a retention quota.
 */
export async function assessCandidateStageCount({
  base, list = opendir,
  maxInventoryEntries = FACTORY_STAGING_POLICY.maxInventoryEntries,
} = {}) {
  if (typeof base !== "string" || !path.isAbsolute(base) ||
      maxInventoryEntries !== FACTORY_STAGING_POLICY.maxInventoryEntries)
    return blocked("STAGE_INVENTORY_UNVERIFIED");
  let count = 0;
  try {
    const handle = await list(base);
    try {
      for await (const entry of handle) {
        if (!entry.isDirectory() || entry.isSymbolicLink() ||
            !STAGE_ID.test(entry.name))
          return blocked("STAGE_INVENTORY_UNVERIFIED");
        count++;
        if (count > maxInventoryEntries)
          return blocked("STAGE_INVENTORY_BUDGET_EXCEEDED", {
            observedStagesAtLeast: count,
          });
      }
    } finally {
      try { await handle.close(); } catch (error) {
        if (error?.code !== "ERR_DIR_CLOSED") throw error;
      }
    }
    return Object.freeze({
      state: "READY", code: "RETAINED_STAGES_PRESERVED",
      observedRetainedStages: count, retentionReferenceState: "UNVERIFIED",
      maxConcurrentStaging: FACTORY_STAGING_POLICY.maxConcurrentStaging,
      cleanupAuthorized: false, issueReserved: false,
    });
  } catch { return blocked("STAGE_INVENTORY_UNVERIFIED"); }
}

/**
 * The atomic lock means at most one new stage at a time. Do not infer that
 * older registered worktrees consume an active worker slot. An actual disk
 * preflight supplied by the caller runs WHILE the lock is held to avoid
 * admitting simultaneous candidates from this MCP route on stale headroom.
 * No stage callback can execute if admission evidence is incomplete.
 */
export async function withCandidateStageBudget({
  root, base, makeLock = mkdir, releaseLock = rmdir, stat = lstat,
  assess = assessCandidateStageCount, checkCapacity, onStage,
} = {}) {
  if (!validBase({ root, base }) || typeof checkCapacity !== "function" ||
      typeof onStage !== "function")
    return blocked("STAGE_ADMISSION_UNVERIFIED");
  const lock = path.join(root, ".candidate-stage-budget.lock");
  let acquired = false, outcome;
  try {
    const rootStat = await stat(root);
    const baseStat = await stat(base);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() ||
        !baseStat.isDirectory() || baseStat.isSymbolicLink())
      return blocked("STAGE_ADMISSION_UNVERIFIED");
    try {
      await makeLock(lock);
      acquired = true;
    } catch (error) {
      return blocked(error?.code === "EEXIST"
        ? "STAGE_ADMISSION_BUSY" : "STAGE_ADMISSION_UNVERIFIED");
    }
    const inventory = await assess({ base });
    if (inventory?.state !== "READY" ||
        inventory.code !== "RETAINED_STAGES_PRESERVED") {
      outcome = blocked(
        ["STAGE_INVENTORY_UNVERIFIED", "STAGE_INVENTORY_BUDGET_EXCEEDED"]
          .includes(inventory?.code) ? inventory.code : "STAGE_INVENTORY_UNVERIFIED",
      );
    } else {
      const capacity = await checkCapacity();
      if (capacity?.code === "DISK_SPACE_INSUFFICIENT") {
        outcome = blocked("BLOCK_RESOURCE_PRESSURE");
      } else if (capacity?.state !== "READY" ||
          capacity.code !== "DISK_SPACE_SUFFICIENT" ||
          !Number.isSafeInteger(capacity.freeBytes)) {
        outcome = blocked("STAGE_ADMISSION_UNVERIFIED");
      } else if (capacity.freeBytes <
          FACTORY_STAGING_POLICY.minFreeBytes +
          FACTORY_STAGING_POLICY.admissionReserveBytes) {
        outcome = blocked("BLOCK_RESOURCE_PRESSURE");
      } else {
        outcome = await onStage();
      }
    }
  } catch {
    outcome = blocked("STAGE_ADMISSION_UNVERIFIED");
  }
  if (acquired) {
    try { await releaseLock(lock); } catch {
      return blocked("STAGE_ADMISSION_LOCK_RELEASE_FAILED");
    }
  }
  return outcome;
}
