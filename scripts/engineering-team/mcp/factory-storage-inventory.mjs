/**
 * #3241: owner-Windows authenticated MCP storage inventory.
 * Fixed operational roots only, metadata only; never reads file contents,
 * accepts an arbitrary path, mutates storage, or authorizes retention cleanup.
 * A PARTIAL scan is a lower bound and must never be reported as empty.
 */
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { inventoryFactoryStoragePerRoot, planFactoryStorageRoots } from "../queue/storage/report.mjs";
import { readFactoryDiskSpace, FACTORY_DISK_MIN_FREE_BYTES } from "../queue/factory-disk-space.mjs";
import { readFactoryVerificationHead } from "./factory-named-tests.mjs";

export const STORAGE_ROOT_IDS = Object.freeze([
  "runtimes", "npm-cache", "engineering-team", "repository-artifacts",
]);
export const STORAGE_SCAN_MODES = Object.freeze(["quick", "deep"]);
const SHA = /^[a-f0-9]{40}$/u;
const DIGITS = /^\d+$/u;
const safeBytes = value => typeof value === "string" && DIGITS.test(value) ? value : null;
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
const safeName = name => typeof name === "string" && name.length <= 80 &&
  /^[a-zA-Z0-9_.() +\[\]-]+$/u.test(name) ? name : "[name withheld]";
const safeCapacity = capacity => ({
  state: ["READY", "BLOCKED"].includes(capacity?.state) ? capacity.state : "BLOCKED",
  code: ["DISK_SPACE_SUFFICIENT", "DISK_SPACE_INSUFFICIENT", "DISK_SPACE_UNVERIFIED"].includes(capacity?.code)
    ? capacity.code : "DISK_SPACE_UNVERIFIED",
  freeBytes: safeCount(capacity?.freeBytes),
  requiredBytes: safeCount(capacity?.requiredBytes),
  isReservation: false,
});
export const validStorageReportArgs = args => args && typeof args === "object" && !Array.isArray(args) &&
  Object.keys(args).length === 3 &&
  Object.keys(args).every(key => ["expectedHead", "rootId", "scanMode"].includes(key)) &&
  SHA.test(args.expectedHead || "") && STORAGE_ROOT_IDS.includes(args.rootId) &&
  STORAGE_SCAN_MODES.includes(args.scanMode);

/**
 * Every invocation rechecks exact clean MAIN and scans only one fixed root.
 * Dependencies are injectable so regression tests can reject unsafe requests
 * without touching the owner's actual Windows directories.
 */
export async function inspectFactoryStorage({
  expectedHead, rootId, scanMode, repoRoot = fileURLToPath(new URL("../../../", import.meta.url)),
  environment = process.env, home = os.homedir(),
  verifyHead = readFactoryVerificationHead,
  scan = inventoryFactoryStoragePerRoot, capacityCheck = readFactoryDiskSpace,
} = {}) {
  if (!validStorageReportArgs({expectedHead, rootId, scanMode}))
    return { state: "BLOCKED", code: "STORAGE_SELECTION_INVALID", cleanupAuthorized: false };
  let sourceHead;
  try { sourceHead = await verifyHead({repoRoot}); } catch { sourceHead = null; }
  if (sourceHead !== expectedHead)
    return { state: "BLOCKED", code: "EXACT_HEAD_MISMATCH", sourceHead: SHA.test(sourceHead || "") ? sourceHead : null,
      cleanupAuthorized: false };
  const appHome = environment.PLOTPICKLE_HOME ? path.resolve(environment.PLOTPICKLE_HOME) :
    environment.LOCALAPPDATA ? path.join(environment.LOCALAPPDATA, "PlotPickle") :
    path.join(home, ".plotpickle");
  const plan = planFactoryStorageRoots({appHome, repoRoot});
  const selected = plan.roots.find(root => root.id === rootId);
  if (!selected)
    return {state:"BLOCKED",code:"STORAGE_ROOT_OVERLAP_OMITTED",sourceHead,rootId,
      cleanupAuthorized:false};
  const limit = scanMode === "deep"
    ? {maxEntriesPerRoot: 200000, maxDurationMsPerRoot: 60000}
    : {maxEntriesPerRoot: 35000, maxDurationMsPerRoot: 15000};
  let inventory, capacity;
  try {
    [inventory, capacity] = await Promise.all([
      scan({roots:[selected],...limit}), capacityCheck({
        locations:[appHome, repoRoot],
        requiredBytes:FACTORY_DISK_MIN_FREE_BYTES.dependencyInstall,
      }),
    ]);
  } catch {
    return {state:"BLOCKED",code:"STORAGE_SCAN_UNVERIFIED",sourceHead,rootId,
      cleanupAuthorized:false};
  }
  // Recheck source AFTER the potentially lengthy scan; never attach stale MAIN
  // metadata to a changed tree. No caller-controlled root or path is returned.
  let after;
  try { after = await verifyHead({repoRoot}); } catch { after = null; }
  if (after !== expectedHead)
    return {state:"BLOCKED",code:"EXACT_HEAD_MISMATCH",sourceHead:null,rootId,
      cleanupAuthorized:false};
  const item = inventory?.roots?.[0];
  if (!item || item.id !== rootId || inventory?.metadataOnly !== true ||
      inventory?.cleanupAuthorized !== false || inventory?.bytesAreReclaimable !== false)
    return {state:"BLOCKED",code:"STORAGE_SCAN_UNVERIFIED",sourceHead,rootId,
      cleanupAuthorized:false};
  const sorted = [...(Array.isArray(item.children) ? item.children : [])]
    .sort((a,b) => {
      const aa = BigInt(safeBytes(a.apparentBytes) || "0");
      const bb = BigInt(safeBytes(b.apparentBytes) || "0");
      return bb > aa ? 1 : bb < aa ? -1 : String(a.name).localeCompare(String(b.name));
    });
  const children = sorted.slice(0, 25).map(child => ({
    name: safeName(child.name), apparentBytes:safeBytes(child.apparentBytes),
    files:safeCount(child.files), directories:safeCount(child.directories),
    skippedLinks:safeCount(child.skippedLinks), errors:safeCount(child.errors),
  }));
  return {
    state: item.state === "COMPLETE" ? "COMPLETE" : "PARTIAL",
    code: ["INVENTORY_COMPLETE","TIME_LIMIT_REACHED","ENTRY_LIMIT_REACHED",
      "DEPTH_LIMIT_REACHED","ROOT_NOT_PRESENT","STORAGE_ROOT_UNVERIFIED",
      "ENTRY_UNVERIFIED","DIRECTORY_CHANGED"].includes(item.code)
      ? item.code : "STORAGE_SCAN_UNVERIFIED",
    sourceHead, rootId, scanMode,
    limits:limit, visitedEntries:safeCount(inventory.visitedEntries),
    apparentBytes:safeBytes(item.apparentBytes), uniqueFileBytes:safeBytes(item.uniqueFileBytes),
    files:safeCount(item.files), directories:safeCount(item.directories),
    skippedLinks:safeCount(item.skippedLinks), errors:safeCount(item.errors),
    children, childrenObserved:sorted.length, childrenOmitted:Math.max(0,sorted.length-children.length),
    capacity:safeCapacity(capacity),
    retentionReferenceState:"UNVERIFIED", metadataOnly:true, totalsAreLowerBounds:item.state !== "COMPLETE",
    cleanupAuthorized:false, deletionImplemented:false, independentVerification:false,
    note:"Read-only operational metadata. Missing/partial counts are not free space or reclaimable bytes; no files were deleted.",
  };
}
