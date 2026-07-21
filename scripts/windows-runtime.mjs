import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const packageFile = path.join(projectRoot, "package.json");
const lockFile = path.join(projectRoot, "package-lock.json");
const command = process.argv[2] ?? "describe";
const outputFile = process.argv[3];

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function lockHash() {
  const source = existsSync(lockFile) ? readFileSync(lockFile) : readFileSync(packageFile);
  return createHash("sha256").update(source).digest("hex").slice(0, 20);
}

function runtimeInfo() {
  const home = persistentHome();
  const hash = lockHash();
  const runtimeDir = path.join(home, "runtimes", hash);
  return {
    home,
    hash,
    runtimeDir,
    runtimeModules: path.join(runtimeDir, "node_modules"),
    appModules: path.join(projectRoot, "node_modules"),
    npmCache: path.join(home, "npm-cache"),
    marker: path.join(runtimeDir, "ready.json"),
  };
}

function entryExists(item) {
  try {
    lstatSync(item);
    return true;
  } catch {
    return false;
  }
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function realPathOrNull(item) {
  try {
    return realpathSync.native(item);
  } catch {
    return null;
  }
}

function coreReady(modulesPath) {
  return ["vite", "next", "react", "vinext"].every((name) =>
    existsSync(path.join(modulesPath, name, "package.json")),
  );
}

function removeLinkOrDirectory(item) {
  if (!entryExists(item)) return;
  const stat = lstatSync(item);
  if (stat.isSymbolicLink()) {
    unlinkSync(item);
  } else {
    rmSync(item, { recursive: true, force: true });
  }
}

function createJunction(target, link) {
  mkdirSync(target, { recursive: true });
  if (entryExists(link)) {
    const resolved = realPathOrNull(link);
    if (resolved && samePath(resolved, target)) return;
    removeLinkOrDirectory(link);
  }
  symlinkSync(target, link, "junction");
}

function copyRuntimeManifests(info) {
  mkdirSync(info.runtimeDir, { recursive: true });
  copyFileSync(packageFile, path.join(info.runtimeDir, "package.json"));
  if (existsSync(lockFile)) copyFileSync(lockFile, path.join(info.runtimeDir, "package-lock.json"));
}

function prepare() {
  const info = runtimeInfo();
  mkdirSync(info.home, { recursive: true });
  mkdirSync(path.dirname(info.runtimeDir), { recursive: true });
  mkdirSync(info.npmCache, { recursive: true });
  mkdirSync(info.runtimeDir, { recursive: true });

  let migrated = false;
  let reused = coreReady(info.runtimeModules);

  if (entryExists(info.appModules)) {
    const stat = lstatSync(info.appModules);
    const resolved = realPathOrNull(info.appModules);
    const alreadyLinked = stat.isSymbolicLink() && resolved && samePath(resolved, info.runtimeModules);

    if (!alreadyLinked && !stat.isSymbolicLink()) {
      if (!entryExists(info.runtimeModules)) {
        renameSync(info.appModules, info.runtimeModules);
        migrated = true;
        reused = coreReady(info.runtimeModules);
      } else if (coreReady(info.runtimeModules)) {
        rmSync(info.appModules, { recursive: true, force: true });
        reused = true;
      } else if (coreReady(info.appModules)) {
        rmSync(info.runtimeModules, { recursive: true, force: true });
        renameSync(info.appModules, info.runtimeModules);
        migrated = true;
        reused = true;
      } else {
        rmSync(info.appModules, { recursive: true, force: true });
      }
    } else if (stat.isSymbolicLink() && !alreadyLinked) {
      unlinkSync(info.appModules);
    }
  }

  copyRuntimeManifests(info);
  createJunction(info.runtimeModules, info.appModules);

  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  const values = {
    PLOTPICKLE_HOME: info.home,
    PLOTPICKLE_LOCK_HASH: info.hash,
    PLOTPICKLE_RUNTIME_DIR: info.runtimeDir,
    PLOTPICKLE_RUNTIME_MODULES: info.runtimeModules,
    PLOTPICKLE_NPM_CACHE: info.npmCache,
    PLOTPICKLE_RUNTIME_REUSED: reused ? "1" : "0",
    PLOTPICKLE_RUNTIME_MIGRATED: migrated ? "1" : "0",
    PLOTPICKLE_VERSION: String(manifest.version ?? "unknown"),
  };

  if (!outputFile) throw new Error("prepare requires an output .cmd file path");
  const cmd = Object.entries(values)
    .map(([key, value]) => `set "${key}=${String(value).replaceAll("%", "%%")}"`)
    .join("\r\n");
  writeFileSync(outputFile, `${cmd}\r\n`, "utf8");
  console.log(`Persistent runtime prepared: ${info.runtimeDir}`);
  if (migrated) console.log("Existing local dependencies were moved into the persistent runtime.");
  if (reused) console.log("A matching installed runtime is available for reuse.");
}

function markReady() {
  const info = runtimeInfo();
  if (!coreReady(info.runtimeModules)) {
    console.error("The persistent runtime is incomplete and cannot be marked ready.");
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  writeFileSync(
    info.marker,
    JSON.stringify(
      {
        lockHash: info.hash,
        applicationVersion: manifest.version,
        verifiedAt: new Date().toISOString(),
        runtimeModules: info.runtimeModules,
      },
      null,
      2,
    ),
    "utf8",
  );
}

function resetCurrent() {
  const info = runtimeInfo();
  if (entryExists(info.runtimeModules)) rmSync(info.runtimeModules, { recursive: true, force: true });
  if (existsSync(info.marker)) rmSync(info.marker, { force: true });
  mkdirSync(info.runtimeModules, { recursive: true });
  copyRuntimeManifests(info);
  createJunction(info.runtimeModules, info.appModules);
  console.log(`Reset runtime: ${info.runtimeDir}`);
}

function describe() {
  const info = runtimeInfo();
  console.log(`Application folder: ${projectRoot}`);
  console.log(`Persistent home: ${info.home}`);
  console.log(`Dependency fingerprint: ${info.hash}`);
  console.log(`Persistent runtime: ${info.runtimeDir}`);
  console.log(`Persistent dependencies: ${info.runtimeModules}`);
  console.log(`Persistent npm cache: ${info.npmCache}`);
  console.log(`Runtime ready: ${coreReady(info.runtimeModules) ? "yes" : "no"}`);
}

try {
  if (command === "prepare") prepare();
  else if (command === "mark-ready") markReady();
  else if (command === "reset-current") resetCurrent();
  else describe();
} catch (error) {
  console.error(`[PlotPickle runtime error] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
