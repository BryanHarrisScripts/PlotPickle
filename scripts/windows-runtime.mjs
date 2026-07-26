import { spawnSync } from "node:child_process";
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
const commandArgument = process.argv[3];

const WINDOWS_ROLLDOWN_BINDINGS = {
  x64: "@rolldown/binding-win32-x64-msvc",
  arm64: "@rolldown/binding-win32-arm64-msvc",
  ia32: "@rolldown/binding-win32-ia32-msvc",
};

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function lockHash() {
  const source = existsSync(lockFile) ? readFileSync(lockFile) : readFileSync(packageFile);
  return createHash("sha256").update(source).digest("hex").slice(0, 20);
}

function runtimeFingerprint() {
  return `${lockHash()}-${process.platform}-${process.arch}`;
}

function runtimeInfo() {
  const home = persistentHome();
  const hash = lockHash();
  const fingerprint = runtimeFingerprint();
  const runtimeDir = path.join(home, "runtimes", fingerprint);
  return {
    home,
    hash,
    fingerprint,
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
  return ["vite", "next", "react", "vinext", "rolldown"].every((name) =>
    existsSync(path.join(modulesPath, name, "package.json")),
  );
}

function expectedWindowsBinding() {
  if (process.platform !== "win32") return null;
  return WINDOWS_ROLLDOWN_BINDINGS[process.arch] ?? null;
}

function nativeBindingStatus(modulesPath) {
  const packageName = expectedWindowsBinding();
  if (!packageName) {
    return {
      required: process.platform === "win32",
      packageName: "",
      entryPath: "",
      ready: process.platform !== "win32",
    };
  }

  const packageDirectory = path.join(modulesPath, ...packageName.split("/"));
  const manifestPath = path.join(packageDirectory, "package.json");
  if (!existsSync(manifestPath)) {
    return { required: true, packageName, entryPath: manifestPath, ready: false };
  }

  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = typeof manifest.main === "string" ? manifest.main : "";
    const entryPath = entry ? path.resolve(packageDirectory, entry) : "";
    return { required: true, packageName, entryPath, ready: Boolean(entryPath && existsSync(entryPath)) };
  } catch {
    return { required: true, packageName, entryPath: manifestPath, ready: false };
  }
}

function nativeBindingReady(modulesPath) {
  return nativeBindingStatus(modulesPath).ready;
}

function runtimeReady(modulesPath) {
  return coreReady(modulesPath) && nativeBindingReady(modulesPath);
}

function verifyModules(modulesPath, { quiet = false } = {}) {
  if (!coreReady(modulesPath)) {
    if (!quiet) console.error(`[PlotPickle runtime error] Core packages are incomplete in ${modulesPath}`);
    return false;
  }

  const binding = nativeBindingStatus(modulesPath);
  if (!binding.ready) {
    if (!quiet) {
      console.error(`[PlotPickle runtime error] Required Windows native binding is missing: ${binding.packageName || `${process.platform}-${process.arch}`}`);
      if (binding.entryPath) console.error(`[PlotPickle runtime error] Expected native entry: ${binding.entryPath}`);
      console.error("Run Repair-PlotPickle.bat, or allow Start-PlotPickle.bat to rebuild this runtime automatically.");
    }
    return false;
  }

  if (!quiet) {
    console.log(`Runtime verification passed: ${modulesPath}`);
    if (binding.packageName) console.log(`Native binding verified: ${binding.packageName}`);
  }
  return true;
}

function installedRolldownVersion(modulesPath) {
  const manifestPath = path.join(modulesPath, "rolldown", "package.json");
  if (!existsSync(manifestPath)) return "";
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return typeof manifest.version === "string" ? manifest.version : "";
  } catch {
    return "";
  }
}

function repairNativeBinding(modulesPath) {
  if (process.platform !== "win32") return true;
  if (nativeBindingReady(modulesPath)) {
    console.log("Windows native binding is already complete.");
    return true;
  }

  const packageName = expectedWindowsBinding();
  const version = installedRolldownVersion(modulesPath);
  if (!packageName || !version) {
    console.error("[PlotPickle runtime error] Rolldown must be installed before its Windows native binding can be repaired.");
    return false;
  }

  const runtimeDir = path.dirname(modulesPath);
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const packageSpec = `${packageName}@${version}`;
  console.log(`Repairing Windows native binding with ${packageSpec}...`);
  const result = spawnSync(
    npmCommand,
    [
      "install",
      "--prefix",
      runtimeDir,
      "--include=dev",
      "--prefer-offline",
      "--no-audit",
      "--no-fund",
      "--no-save",
      "--package-lock=false",
      packageSpec,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        npm_config_cache: process.env.PLOTPICKLE_NPM_CACHE || runtimeInfo().npmCache,
      },
    },
  );
  if (result.status !== 0) {
    console.error(`[PlotPickle runtime error] Native binding repair exited with code ${result.status ?? "unknown"}.`);
    return false;
  }
  return verifyModules(modulesPath);
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
  let reused = runtimeReady(info.runtimeModules);

  if (entryExists(info.appModules)) {
    const stat = lstatSync(info.appModules);
    const resolved = realPathOrNull(info.appModules);
    const alreadyLinked = stat.isSymbolicLink() && resolved && samePath(resolved, info.runtimeModules);

    if (!alreadyLinked && !stat.isSymbolicLink()) {
      if (!entryExists(info.runtimeModules)) {
        renameSync(info.appModules, info.runtimeModules);
        migrated = true;
        reused = runtimeReady(info.runtimeModules);
      } else if (runtimeReady(info.runtimeModules)) {
        rmSync(info.appModules, { recursive: true, force: true });
        reused = true;
      } else if (runtimeReady(info.appModules)) {
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
  const binding = nativeBindingStatus(info.runtimeModules);
  const values = {
    PLOTPICKLE_HOME: info.home,
    PLOTPICKLE_LOCK_HASH: info.hash,
    PLOTPICKLE_RUNTIME_FINGERPRINT: info.fingerprint,
    PLOTPICKLE_RUNTIME_PLATFORM: process.platform,
    PLOTPICKLE_RUNTIME_ARCH: process.arch,
    PLOTPICKLE_NATIVE_BINDING: binding.packageName,
    PLOTPICKLE_RUNTIME_DIR: info.runtimeDir,
    PLOTPICKLE_RUNTIME_MODULES: info.runtimeModules,
    PLOTPICKLE_NPM_CACHE: info.npmCache,
    PLOTPICKLE_RUNTIME_REUSED: reused ? "1" : "0",
    PLOTPICKLE_RUNTIME_MIGRATED: migrated ? "1" : "0",
    PLOTPICKLE_VERSION: String(manifest.version ?? "unknown"),
  };

  if (!commandArgument) throw new Error("prepare requires an output .cmd file path");
  const cmd = Object.entries(values)
    .map(([key, value]) => `set "${key}=${String(value).replaceAll("%", "%%")}"`)
    .join("\r\n");
  writeFileSync(commandArgument, `${cmd}\r\n`, "utf8");
  console.log(`Persistent runtime prepared: ${info.runtimeDir}`);
  if (migrated) console.log("Existing local dependencies were moved into the persistent runtime.");
  if (reused) console.log("A matching installed runtime is available for reuse.");
  else if (coreReady(info.runtimeModules) && !nativeBindingReady(info.runtimeModules)) {
    console.log("The matching runtime is missing its Windows native binding and will be rebuilt.");
  }
}

function markReady() {
  const info = runtimeInfo();
  if (!verifyModules(info.runtimeModules)) {
    console.error("The persistent runtime is incomplete and cannot be marked ready.");
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  const binding = nativeBindingStatus(info.runtimeModules);
  writeFileSync(
    info.marker,
    JSON.stringify(
      {
        lockHash: info.hash,
        runtimeFingerprint: info.fingerprint,
        platform: process.platform,
        architecture: process.arch,
        nativeBinding: binding.packageName,
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
  const binding = nativeBindingStatus(info.runtimeModules);
  console.log(`Application folder: ${projectRoot}`);
  console.log(`Persistent home: ${info.home}`);
  console.log(`Dependency fingerprint: ${info.hash}`);
  console.log(`Runtime fingerprint: ${info.fingerprint}`);
  console.log(`Runtime platform: ${process.platform} ${process.arch}`);
  console.log(`Persistent runtime: ${info.runtimeDir}`);
  console.log(`Persistent dependencies: ${info.runtimeModules}`);
  console.log(`Persistent npm cache: ${info.npmCache}`);
  if (binding.packageName) console.log(`Required native binding: ${binding.packageName}`);
  console.log(`Runtime ready: ${runtimeReady(info.runtimeModules) ? "yes" : "no"}`);
}

try {
  if (command === "prepare") prepare();
  else if (command === "mark-ready") markReady();
  else if (command === "reset-current") resetCurrent();
  else if (command === "verify-runtime") {
    if (!verifyModules(runtimeInfo().runtimeModules)) process.exitCode = 1;
  } else if (command === "verify-modules") {
    const modulesPath = path.resolve(projectRoot, commandArgument || "node_modules");
    if (!verifyModules(modulesPath)) process.exitCode = 1;
  } else if (command === "repair-native") {
    const modulesPath = commandArgument
      ? path.resolve(projectRoot, commandArgument)
      : runtimeInfo().runtimeModules;
    if (!repairNativeBinding(modulesPath)) process.exitCode = 1;
  } else describe();
} catch (error) {
  console.error(`[PlotPickle runtime error] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
