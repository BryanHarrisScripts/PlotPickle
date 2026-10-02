import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MANAGED_PI_DURABLE_PACKAGE = "@earendil-works/pi-durable";
export const MANAGED_PI_DURABLE_VERSION = "1.0.0";
export const MANAGED_PI_DURABLE_MINIMUM_NODE = "22.19.0";

function versionTuple(value) {
  return String(value || "").split(".").slice(0, 3).map((item) => Number(item) || 0);
}

export function nodeSupportsPiDurable(version = process.versions.node) {
  const actual = versionTuple(version);
  const minimum = versionTuple(MANAGED_PI_DURABLE_MINIMUM_NODE);
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

export function managedPiDurableRoot(home) {
  return path.resolve(home, "runtimes", `pi-durable-${MANAGED_PI_DURABLE_VERSION}`);
}

async function exists(file) {
  return access(file).then(() => true, () => false);
}

export async function inspectManagedPiDurable(home) {
  const root = managedPiDurableRoot(home);
  const manifestPath = path.join(root, "node_modules", "@earendil-works", "pi-durable", "package.json");
  if (!nodeSupportsPiDurable()) {
    return Object.freeze({
      ready: false,
      root,
      version: "",
      reason: `Node ${process.versions.node} is below Pi Durable's supported minimum ${MANAGED_PI_DURABLE_MINIMUM_NODE}.`,
    });
  }
  if (!await exists(manifestPath)) {
    return Object.freeze({ ready: false, root, version: "", reason: "managed package not installed" });
  }
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.version !== MANAGED_PI_DURABLE_VERSION) {
      return Object.freeze({ ready: false, root, version: String(manifest.version || ""), reason: "managed package version mismatch" });
    }
    return Object.freeze({ ready: true, root, version: manifest.version, reason: "ready" });
  } catch (error) {
    return Object.freeze({ ready: false, root, version: "", reason: error instanceof Error ? error.message : String(error) });
  }
}

export async function ensureManagedPiDurable(home, {
  install = null,
  allowInstall = true,
} = {}) {
  let inspection = await inspectManagedPiDurable(home);
  if (inspection.ready) return inspection;
  if (!nodeSupportsPiDurable()) throw new Error(inspection.reason);
  if (!allowInstall) throw new Error(`Pi Durable is not ready and managed installation is disabled: ${inspection.reason}`);
  if (typeof install !== "function") throw new Error("Pi Durable managed installation requires the reviewed npm installer callback.");

  const root = managedPiDurableRoot(home);
  await mkdir(root, { recursive: true });
  const packageJson = {
    name: "plotpickle-pi-durable-runtime",
    private: true,
    type: "module",
    dependencies: { [MANAGED_PI_DURABLE_PACKAGE]: MANAGED_PI_DURABLE_VERSION },
  };
  await writeFile(path.join(root, "package.json"), JSON.stringify(packageJson, null, 2) + "\n", "utf8");
  await install({
    root,
    packageSpec: `${MANAGED_PI_DURABLE_PACKAGE}@${MANAGED_PI_DURABLE_VERSION}`,
  });
  inspection = await inspectManagedPiDurable(home);
  if (!inspection.ready) throw new Error(`Managed Pi Durable installation did not validate: ${inspection.reason}`);
  return inspection;
}

async function importFromManagedRoot(root, specifier) {
  const require = createRequire(path.join(root, "package.json"));
  const resolved = require.resolve(specifier);
  return import(pathToFileURL(resolved).href);
}

export async function openManagedPiDurableHarness(home) {
  const inspection = await inspectManagedPiDurable(home);
  if (!inspection.ready) throw new Error(`Pi Durable is not ready: ${inspection.reason}`);

  const [durable, jsonl, chord, piAi] = await Promise.all([
    importFromManagedRoot(inspection.root, "@earendil-works/pi-durable"),
    importFromManagedRoot(inspection.root, "@earendil-works/pi-durable/storage/jsonl/node"),
    importFromManagedRoot(inspection.root, "@earendil-works/chord/context"),
    importFromManagedRoot(inspection.root, "@earendil-works/pi-ai/models"),
  ]);
  const context = chord.BACKGROUND_CONTEXT;
  const storageRoot = path.join(home, "node", "runtime", "sidecars", "pi-durable", "state");
  await mkdir(storageRoot, { recursive: true });
  const storage = await jsonl.openNodeJsonlStorage(storageRoot, context);
  const harness = await durable.Harness.open(storage, {
    models: piAi.createModels(),
    registry: durable.createRegistry(),
  }, context);
  const rootConversation = await harness.root(context);
  return Object.freeze({
    runtime: "pi-durable",
    version: inspection.version,
    root: inspection.root,
    storageRoot,
    rootConversationId: rootConversation.id,
    context,
    harness,
    close: () => harness.close(context),
  });
}
