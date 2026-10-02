import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export function runtimeStatusDocument({ supervisor, core, services, observedAt = new Date().toISOString() }) {
  return Object.freeze({
    schemaVersion: 1,
    supervisor,
    core,
    services,
    observedAt,
  });
}

export async function writeRuntimeStatus(file, document) {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(document, null, 2) + "\n", "utf8");
  await rename(temp, target);
  return target;
}
