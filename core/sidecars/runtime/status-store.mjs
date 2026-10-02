import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function runtimeStatusDocument({ supervisor, core, services, timing, observedAt = new Date().toISOString() }) {
  return Object.freeze({
    schemaVersion: 1,
    supervisor,
    core,
    services,
    ...(timing ? { timing } : {}),
    observedAt,
  });
}

const pendingWrites = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function writeRuntimeStatus(file, document, { renameFile = rename, wait = pause } = {}) {
  const target = path.resolve(file);
  const serialized = JSON.stringify(document, null, 2) + "\n";
  const previous = pendingWrites.get(target) || Promise.resolve();
  const writing = previous.catch(() => {}).then(async () => {
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, serialized, "utf8");
      for (let attempt = 0; ; attempt++) {
        try {
          await renameFile(temp, target);
          break;
        } catch (error) {
          // Windows readers and antivirus can briefly deny replacement. Preserve the last valid snapshot.
          if (!["EPERM", "EACCES", "EBUSY"].includes(error.code) || attempt >= 9) throw error;
          await wait(25 * (attempt + 1));
        }
      }
      return target;
    } finally {
      await rm(temp, { force: true }).catch(() => {});
    }
  });
  pendingWrites.set(target, writing);
  try { return await writing; }
  finally { if (pendingWrites.get(target) === writing) pendingWrites.delete(target); }
}
