/**
 * #3241 — read-only, fail-closed local Factory capacity preflight.
 *
 * A minimum-headroom check is NOT a disk reservation, an ownership/cleanup
 * attestation or a measured promise about a future install. No files are
 * removed. No caller-controlled paths should be passed from an MCP request.
 * Always call immediately before worktree/install operations.
 */
import { lstat, statfs } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const FACTORY_DISK_MIN_FREE_BYTES = Object.freeze({
  dependencyInstall: 4 * 1024 ** 3,
  candidateStage: 8 * 1024 ** 3, // default owner-disk safety reserve for multi-GB PR snapshots
});

const validDestination = p =>
  typeof p === "string" && p.length > 0 && p.length <= 1024 &&
  path.isAbsolute(p) && !p.includes("\0");

async function nearestExistingDirectory(destination, readStat) {
  if (!validDestination(destination)) return null;
  let candidate = path.resolve(destination);
  for (let i = 0; i < 64; i++) {
    try {
      const info = await readStat(candidate);
      if (!info.isDirectory() || info.isSymbolicLink()) return null;
      return candidate;
    } catch (error) {
      if (error?.code !== "ENOENT") return null;
      const parent = path.dirname(candidate);
      if (parent === candidate) return null;
      candidate = parent;
    }
  }
  return null;
}

/**
 * Probe EACH destination; a multi-root operation may use different volumes.
 * Conservative per-location headroom is not a commitment to reserve space.
 * Do not publish absolute paths, arbitrary filesystem errors or credentials.
 */
export async function readFactoryDiskSpace({
  locations, requiredBytes,
  getStats = statfs, readStat = lstat,
} = {}) {
  if (!Array.isArray(locations) || locations.length < 1 ||
      locations.length > 4 || !locations.every(validDestination) ||
      !Number.isSafeInteger(requiredBytes) || requiredBytes <= 0 ||
      requiredBytes > 256 * 1024 ** 3)
    return Object.freeze({
      state: "BLOCKED", code: "DISK_SPACE_UNVERIFIED",
      requiredBytes: null, freeBytes: null, checkedDestinations: 0,
    });
  let minFree = null;
  let checked = 0;
  try {
    for (const destination of locations) {
      const existing = await nearestExistingDirectory(destination, readStat);
      if (!existing) throw Error("UNVERIFIED_DISK_ROOT");
      const s = await getStats(existing, { bigint: true });
      const available = BigInt(s.bavail) * BigInt(s.bsize);
      if (available < 0n || BigInt(s.bsize) <= 0n)
        throw Error("INVALID_DISK_CAPACITY");
      if (minFree === null || available < minFree) minFree = available;
      checked++;
    }
  } catch {
    return Object.freeze({
      state: "BLOCKED", code: "DISK_SPACE_UNVERIFIED",
      requiredBytes, freeBytes: null, checkedDestinations: checked,
    });
  }
  const available = Number(minFree > BigInt(Number.MAX_SAFE_INTEGER)
    ? BigInt(Number.MAX_SAFE_INTEGER) : minFree);
  const ready = minFree >= BigInt(requiredBytes);
  return Object.freeze({
    state: ready ? "READY" : "BLOCKED",
    code: ready ? "DISK_SPACE_SUFFICIENT" : "DISK_SPACE_INSUFFICIENT",
    requiredBytes, freeBytes: available, checkedDestinations: checked,
    isReservation: false, cleanupAuthorized: false,
  });
}
