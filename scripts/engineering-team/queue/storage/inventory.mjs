/** #3241: metadata-only inventory and retention preview. There is no delete API. */
import { lstat, opendir, realpath } from "node:fs/promises";
import path from "node:path";

const ROOT_KINDS = new Set(["runtimes", "npm-cache", "factory", "artifacts"]);
const RUNTIME_NAME = /^[a-f0-9]{20}-(?:win32|linux|darwin)-(?:x64|arm64|ia32)$/u;
const bounded = (n, fallback, max) => Number.isSafeInteger(n) && n > 0 && n <= max ? n : fallback;
const inside = (root, child) => {
  const relative = path.relative(root, child);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};
const identity = s => `${s.dev}:${s.ino}`;
const samePath = (a, b) => process.platform === "win32"
  ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
  : path.resolve(a) === path.resolve(b);

/** Check every ancestor, including a redirected parent of an otherwise normal root. */
async function checkedDirectory(directory) {
  let cursor = path.resolve(directory);
  for (;;) {
    const s = await lstat(cursor, { bigint: true });
    if (!s.isDirectory() || s.isSymbolicLink()) throw Error("STORAGE_ROOT_UNVERIFIED");
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (!samePath(await realpath(directory), directory)) throw Error("STORAGE_ROOT_UNVERIFIED");
}

/** Best-effort filesystem observation, never an ownership or deletion attestation.
 * Limits apply to the entire inventory. Partial totals are lower bounds, not zero.
 * BigInt filesystem counters remain decimal strings for lossless JSON transport.
 */
export async function inventoryFactoryStorage({ roots, maxEntries = 50000, maxDepth = 64,
  maxDurationMs = 10000, onProgress = () => {}, now = Date.now } = {}) {
  if (!Array.isArray(roots) || roots.length < 1 || roots.length > 8 ||
      roots.some(r => !r || !/^[a-z][a-z0-9-]{0,47}$/u.test(r.id || "") ||
        !ROOT_KINDS.has(r.kind) || typeof r.directory !== "string" ||
        !path.isAbsolute(r.directory) || r.directory.includes("\0")) ||
      new Set(roots.map(r => r.id)).size !== roots.length)
    throw Error("STORAGE_SELECTION_INVALID");
  const limits = { maxEntries: bounded(maxEntries, 50000, 1000000),
    maxDepth: bounded(maxDepth, 64, 128), maxDurationMs: bounded(maxDurationMs, 10000, 120000) };
  const startedAt = now(), deadline = startedAt + limits.maxDurationMs;
  let visitedEntries = 0, progressObserverErrors = 0;
  const results = [];
  const canonicalRoots = roots.map(r => path.resolve(r.directory));
  if (canonicalRoots.some((r, i) => canonicalRoots.some((other, j) =>
    i !== j && (inside(r, other) || inside(other, r))))) throw Error("STORAGE_ROOTS_OVERLAP");

  for (const [rootIndex, selection] of roots.entries()) {
    const directory = canonicalRoots[rootIndex];
    const result = { id: selection.id, kind: selection.kind, state: "COMPLETE", code: "INVENTORY_COMPLETE",
      apparentBytes: "0", uniqueFileBytes: "0", files: 0, directories: 0,
      skippedLinks: 0, errors: 0, children: [] };
    const rootSeen = new Set();
    let apparent = 0n, unique = 0n;
    function partial(code) { result.state = "PARTIAL"; result.code = code; }
    function exhausted() {
      if (visitedEntries >= limits.maxEntries) { partial("ENTRY_LIMIT_REACHED"); return true; }
      if (now() >= deadline) { partial("TIME_LIMIT_REACHED"); return true; }
      return false;
    }
    async function visit(filename, depth, row) {
      if (exhausted()) return;
      visitedEntries++;
      try {
        const s = await lstat(filename, { bigint: true });
        if (depth === 0) row.modifiedAtMs = String(s.mtimeMs);
        if (s.isSymbolicLink()) { row.skippedLinks++; result.skippedLinks++; return; }
        if (!inside(directory, await realpath(filename))) throw Error("PATH_REDIRECTED");
        if (s.isFile()) {
          row.files++; result.files++; row.bytes += s.size; apparent += s.size;
          // Inode zero is not a usable hard-link identity on all filesystems.
          // Unknown identities are counted per file and explicitly not deduplicated.
          const key = s.ino === 0n ? filename : identity(s);
          if (!rootSeen.has(key)) { rootSeen.add(key); unique += s.size; }
          return;
        }
        if (!s.isDirectory()) { row.errors++; result.errors++; partial("ENTRY_TYPE_UNVERIFIED"); return; }
        row.directories++; result.directories++;
        if (depth >= limits.maxDepth) { row.errors++; result.errors++; partial("DEPTH_LIMIT_REACHED"); return; }
        const handle = await opendir(filename);
        for await (const entry of handle) {
          if (exhausted()) break;
          await visit(path.join(filename, entry.name), depth + 1, row);
        }
        const after = await lstat(filename, { bigint: true });
        if (after.isSymbolicLink() || identity(after) !== identity(s) ||
            after.mtimeNs !== s.mtimeNs || !inside(directory, await realpath(filename)))
          throw Error("DIRECTORY_CHANGED");
      } catch {
        row.errors++; result.errors++; partial("ENTRY_UNVERIFIED");
      }
    }
    try {
      if (exhausted()) { results.push(result); continue; }
      await checkedDirectory(directory);
      const before = await lstat(directory, { bigint: true });
      const entries = await opendir(directory);
      for await (const child of entries) {
        if (exhausted()) break;
        const row = { name: child.name, modifiedAtMs: null, bytes: 0n, files: 0, directories: 0, skippedLinks: 0, errors: 0 };
        await visit(path.join(directory, child.name), 0, row);
        result.children.push({ name: row.name, modifiedAtMs: row.modifiedAtMs, apparentBytes: String(row.bytes), files: row.files,
          directories: row.directories, skippedLinks: row.skippedLinks, errors: row.errors });
        // Progress carries aggregate metadata only, never absolute paths or contents.
        try { onProgress({ rootId: selection.id, visitedEntries, apparentBytes: String(apparent) }); } catch { progressObserverErrors++; }
      }
      const after = await lstat(directory, { bigint: true });
      if (after.isSymbolicLink() || identity(after) !== identity(before) || after.mtimeNs !== before.mtimeNs)
        partial("DIRECTORY_CHANGED");
    } catch (error) {
      result.state = error?.code === "ENOENT" ? "MISSING" : "BLOCKED";
      result.code = error?.code === "ENOENT" ? "ROOT_NOT_PRESENT" : "STORAGE_ROOT_UNVERIFIED";
    }
    result.apparentBytes = String(apparent); result.uniqueFileBytes = String(unique);
    result.children.sort((a, b) => a.name.localeCompare(b.name));
    results.push(result);
  }
  return { schemaVersion: 1, startedAt, completedAt: now(), limits, visitedEntries, progressObserverErrors, roots: results,
    metadataOnly: true, cleanupAuthorized: false, bytesAreReclaimable: false,
    measurement: "Apparent file lengths; uniqueFileBytes deduplicates usable inode identities within each root only. Sparse, compressed and shared files may occupy different physical space. Partial totals are lower bounds. Concurrent filesystem activity can invalidate an observation." };
}

/** The host must supply independently verified process/task/worktree references.
 * A dry run never authorizes cleanup. Missing references keep every directory.
 * Unidentified Factory content, evidence, projects and caches are NEVER candidates.
 */
export function previewFactoryRetention(inventory, { referencesVerified = false,
  activeRuntime = null, fallbackRuntime = null, retainedHistorical = [],
  referencedRuntimes = [], ownedRuntimes = [] } = {}) {
  const validNames = list => Array.isArray(list) && list.every(n => typeof n === "string" && RUNTIME_NAME.test(n));
  const historical = Array.isArray(retainedHistorical) ? retainedHistorical : [];
  const referenced = Array.isArray(referencedRuntimes) ? referencedRuntimes : [];
  const owned = Array.isArray(ownedRuntimes) ? ownedRuntimes : [];
  const observed = new Set((inventory?.roots || []).filter(r => r.kind === "runtimes" && r.state === "COMPLETE")
    .flatMap(r => r.children || []).filter(c => c.directories > 0 && !c.skippedLinks && !c.errors).map(c => c.name));
  const completeReferences = referencesVerified === true && RUNTIME_NAME.test(activeRuntime || "") &&
    RUNTIME_NAME.test(fallbackRuntime || "") && activeRuntime !== fallbackRuntime &&
    validNames(retainedHistorical) && new Set(retainedHistorical).size === 10 &&
    historical.every(n => n !== activeRuntime && n !== fallbackRuntime) &&
    validNames(referencedRuntimes) && validNames(ownedRuntimes) &&
    [activeRuntime, fallbackRuntime, ...historical].every(n => observed.has(n) && owned.includes(n));
  const protectedNames = new Set([activeRuntime, fallbackRuntime, ...historical, ...referenced]);
  const candidates = [], kept = [];
  for (const root of inventory?.roots || []) for (const child of root.children || []) {
    let reason = root.kind !== "runtimes" ? "PROTECTED_OR_UNCLASSIFIED" :
      !RUNTIME_NAME.test(child.name) ? "UNIDENTIFIED_OR_SPECIAL_RUNTIME" :
      root.state !== "COMPLETE" || child.errors || child.skippedLinks || !child.directories ? "INVENTORY_INCOMPLETE" :
      !completeReferences ? "RUNTIME_REFERENCES_UNVERIFIED" :
      !owned.includes(child.name) ? "RUNTIME_OWNERSHIP_UNVERIFIED" :
      protectedNames.has(child.name) ? "RETAINED_OR_REFERENCED_RUNTIME" : null;
    const entry = { rootId: root.id, name: child.name, apparentBytes: child.apparentBytes };
    if (reason) kept.push({ ...entry, reason });
    else candidates.push({ ...entry, reason: "RETIRED_OWNED_RUNTIME_REQUIRES_OWNER_REVIEW" });
  }
  return { schemaVersion: 1, mode: "DRY_RUN", cleanupAuthorized: false, deletionImplemented: false,
    referenceState: completeReferences ? "VERIFIED_BY_HOST" : "UNVERIFIED", candidates, kept,
    estimatedReclaimedBytes: null, note: "No files removed. Apparent bytes are not reclaimable-byte estimates. Each candidate still requires owner review and a fresh reference check." };
}
