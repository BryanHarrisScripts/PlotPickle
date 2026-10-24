/** #3241: local metadata report, stdout only; no cleanup and no model invocation. */
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inventoryFactoryStorage, previewFactoryRetention } from "./inventory.mjs";
import { readFactoryDiskSpace, FACTORY_DISK_MIN_FREE_BYTES } from "../factory-disk-space.mjs";

export function factoryStorageRoots({ appHome, repoRoot }) {
  return [
    { id: "runtimes", kind: "runtimes", directory: path.join(appHome, "runtimes") },
    { id: "npm-cache", kind: "npm-cache", directory: path.join(appHome, "npm-cache") },
    { id: "engineering-team", kind: "factory", directory: path.join(appHome, "engineering-team") },
    { id: "repository-artifacts", kind: "artifacts", directory: path.join(repoRoot, ".artifacts") },
  ];
}

// Verification hosts may intentionally put their private app home beneath
// repository artifacts. Omit the broader root instead of traversing it twice.
export function planFactoryStorageRoots(options) {
  const all = factoryStorageRoots(options), excludedRoots = [];
  const roots = all.filter(root => {
    const overlaps = all.some(other => {
      if (root === other) return false;
      const relative = path.relative(root.directory, other.directory);
      return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
    });
    if (overlaps) excludedRoots.push({ id: root.id, code: "BROADER_OPERATIONAL_ROOT_OMITTED" });
    return !overlaps;
  });
  return { roots, excludedRoots };
}

async function main() {
  if (process.argv.length > 2) throw Error("STORAGE_REPORT_TAKES_NO_ARGUMENTS");
  const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
  const appHome = process.env.PLOTPICKLE_HOME ? path.resolve(process.env.PLOTPICKLE_HOME) :
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "PlotPickle") : path.join(os.homedir(), ".plotpickle");
  const plan = planFactoryStorageRoots({ appHome, repoRoot });
  const inventory = await inventoryFactoryStorage({ roots: plan.roots,
    onProgress: progress => process.stderr.write(`${JSON.stringify(progress)}\n`) });
  const capacity = await readFactoryDiskSpace({ locations: [appHome, repoRoot],
    requiredBytes: FACTORY_DISK_MIN_FREE_BYTES.dependencyInstall });
  // Process and scheduled-task reference collection is not yet implemented.
  // Keep everything until it is, even if a folder looks like an old runtime.
  const retention = previewFactoryRetention(inventory);
  process.stdout.write(`${JSON.stringify({ inventory, excludedRoots: plan.excludedRoots, capacity, retention }, null, 2)}\n`);
  if (inventory.roots.some(r => ["PARTIAL", "BLOCKED"].includes(r.state))) process.exitCode = 2;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  main().catch(error => {
    const code = ["STORAGE_REPORT_TAKES_NO_ARGUMENTS", "STORAGE_SELECTION_INVALID", "STORAGE_ROOTS_OVERLAP"].includes(error?.message)
      ? error.message : "STORAGE_REPORT_UNVERIFIED";
    process.stderr.write(`${code}\n`); process.exitCode = 1;
  });
