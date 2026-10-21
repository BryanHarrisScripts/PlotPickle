import { randomUUID } from "node:crypto";
import { lstat, readFile, rename } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

/**
 * Recover only a demonstrably dead Windows Factory service lock.
 * This does not stop a worker, start a service, approve a queue, or mutate
 * any job/attempt receipts. Unknown ownership always blocks startup/preflight.
 */
export async function inspectFactoryServiceLock({
  root,
  platform = process.platform,
  probePid = (pid) => process.kill(pid, 0),
  createId = randomUUID,
} = {}) {
  if (typeof root !== "string" || !path.isAbsolute(root))
    return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });
  const filename = path.join(root, "service.lock");
  let info;
  try { info = await lstat(filename); }
  catch (error) {
    if (error?.code === "ENOENT")
      return Object.freeze({ safeToProceed: true, state: "NO_LOCK" });
    return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });
  }
  // This guard is Windows-owned. Do not infer PID/process ownership on a
  // different platform or dereference a malicious/surprising lock file.
  if (platform !== "win32" || !info.isFile() || info.isSymbolicLink()
      || info.size < 2 || info.size > 4096)
    return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });
  let original;
  let lock;
  try {
    original = await readFile(filename, "utf8");
    lock = JSON.parse(original);
  } catch {
    return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });
  }
  if (lock?.schemaVersion !== 1 || !Number.isSafeInteger(lock.pid) || lock.pid < 1
      || !Number.isSafeInteger(lock.at) || lock.at < 0)
    return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });

  try {
    probePid(lock.pid);
    return Object.freeze({ safeToProceed: false, state: "ACTIVE_OR_UNVERIFIED" });
  } catch (error) {
    // EACCES / EPERM / unexpected Windows errors do NOT prove process death.
    if (error?.code !== "ESRCH")
      return Object.freeze({ safeToProceed: false, state: "ACTIVE_OR_UNVERIFIED" });
  }
  try {
    // The lock must still have identical content before it is archived.
    const checked = await lstat(filename);
    if (!checked.isFile() || checked.isSymbolicLink() || await readFile(filename, "utf8") !== original)
      return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });
    await rename(filename, path.join(root, "service-stale-inspected-" + lock.at + "-" + createId() + ".json"));
  } catch {
    return Object.freeze({ safeToProceed: false, state: "UNVERIFIED_LOCK" });
  }
  // Archived for investigation; no job/reservation/STOP marker was touched.
  return Object.freeze({ safeToProceed: true, state: "STALE_LOCK_ARCHIVED" });
}
