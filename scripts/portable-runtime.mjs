import { createHash } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
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
  return path.join(os.homedir(), ".plotpickle");
}

function info() {
  const source = existsSync(lockFile) ? readFileSync(lockFile) : readFileSync(packageFile);
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 20);
  const home = persistentHome();
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

function ready(modules) {
  return ["vite", "next", "react", "vinext"].every((name) => existsSync(path.join(modules, name, "package.json")));
}

function removeEntry(item) {
  if (!existsSync(item) && !lstatSafe(item)) return;
  const stat = lstatSync(item);
  if (stat.isSymbolicLink()) unlinkSync(item);
  else rmSync(item, { recursive: true, force: true });
}

function lstatSafe(item) {
  try { return lstatSync(item); } catch { return null; }
}

function samePath(left, right) {
  try { return realpathSync(left) === realpathSync(right); } catch { return false; }
}

function copyManifests(runtimeDir) {
  mkdirSync(runtimeDir, { recursive: true });
  copyFileSync(packageFile, path.join(runtimeDir, "package.json"));
  if (existsSync(lockFile)) copyFileSync(lockFile, path.join(runtimeDir, "package-lock.json"));
}

function linkModules(target, link) {
  mkdirSync(target, { recursive: true });
  const current = lstatSafe(link);
  if (current?.isSymbolicLink() && samePath(link, target)) return;
  if (current) removeEntry(link);
  symlinkSync(target, link, "dir");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function prepare() {
  const current = info();
  mkdirSync(current.home, { recursive: true });
  mkdirSync(current.npmCache, { recursive: true });
  copyManifests(current.runtimeDir);
  linkModules(current.runtimeModules, current.appModules);
  if (!outputFile) throw new Error("prepare requires an output shell file path");
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  const values = {
    PLOTPICKLE_HOME: current.home,
    PLOTPICKLE_LOCK_HASH: current.hash,
    PLOTPICKLE_RUNTIME_DIR: current.runtimeDir,
    PLOTPICKLE_RUNTIME_MODULES: current.runtimeModules,
    PLOTPICKLE_NPM_CACHE: current.npmCache,
    PLOTPICKLE_RUNTIME_REUSED: ready(current.runtimeModules) ? "1" : "0",
    PLOTPICKLE_VERSION: String(manifest.version ?? "unknown"),
  };
  writeFileSync(outputFile, `${Object.entries(values).map(([key, value]) => `export ${key}=${shellQuote(value)}`).join("\n")}\n`, "utf8");
}

function markReady() {
  const current = info();
  if (!ready(current.runtimeModules)) throw new Error("The persistent runtime is incomplete.");
  writeFileSync(current.marker, `${JSON.stringify({ lockHash: current.hash, verifiedAt: new Date().toISOString(), runtimeModules: current.runtimeModules }, null, 2)}\n`);
}

function resetCurrent() {
  const current = info();
  removeEntry(current.appModules);
  rmSync(current.runtimeModules, { recursive: true, force: true });
  copyManifests(current.runtimeDir);
  mkdirSync(current.runtimeModules, { recursive: true });
  linkModules(current.runtimeModules, current.appModules);
  console.log(`Reset runtime: ${current.runtimeDir}`);
}

function describe() {
  const current = info();
  console.log(`Application folder: ${projectRoot}`);
  console.log(`Persistent home: ${current.home}`);
  console.log(`Dependency fingerprint: ${current.hash}`);
  console.log(`Persistent runtime: ${current.runtimeDir}`);
  console.log(`Persistent dependencies: ${current.runtimeModules}`);
  console.log(`Persistent npm cache: ${current.npmCache}`);
  console.log(`Runtime ready: ${ready(current.runtimeModules) ? "yes" : "no"}`);
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
