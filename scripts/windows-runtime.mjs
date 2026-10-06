import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
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
import { createRequire } from "node:module";
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

const WINDOWS_SHARP_BINDINGS = {
  x64: "@img/sharp-win32-x64",
  arm64: "@img/sharp-win32-arm64",
  ia32: "@img/sharp-win32-ia32",
};

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function lockHash() {
  const packageSource = readFileSync(packageFile);
  const lockSource = existsSync(lockFile) ? readFileSync(lockFile) : Buffer.alloc(0);
  return createHash("sha256").update(packageSource).update("\0").update(lockSource).digest("hex").slice(0, 20);
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
  if (!existsSync(item)) return null;
  return realpathSync.native(item);
}

function coreReady(modulesPath) {
  return ["vite", "next", "react", "vinext", "rolldown"].every((name) =>
    existsSync(path.join(modulesPath, name, "package.json")),
  );
}

function sharpRuntimeStatus(modulesPath) {
  const manifestPath = path.join(modulesPath, "sharp", "package.json");
  if (!existsSync(manifestPath)) {
    return { ready: false, version: "", message: "Sharp is not installed in the PlotPickle runtime." };
  }
  try {
    const requireFromRuntime = createRequire(path.join(modulesPath, "__plotpickle-sharp-runtime-check.cjs"));
    const loaded = requireFromRuntime("sharp");
    const sharp = typeof loaded === "function" ? loaded : loaded?.default;
    if (typeof sharp !== "function") {
      return { ready: false, version: "", message: "Sharp loaded without its image-processing entry point." };
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
      ready: true,
      version: typeof manifest.version === "string" ? manifest.version : "",
      message: "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ready: false,
      version: "",
      message: `Sharp could not load its native runtime: ${message.slice(0, 500)}`,
    };
  }
}

function sharpRuntimeReady(modulesPath) {
  return sharpRuntimeStatus(modulesPath).ready;
}

function expectedWindowsBinding() {
  if (process.platform !== "win32") return null;
  return WINDOWS_ROLLDOWN_BINDINGS[process.arch] ?? null;
}

function expectedWindowsSharpBinding() {
  if (process.platform !== "win32") return null;
  return WINDOWS_SHARP_BINDINGS[process.arch] ?? null;
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
  return coreReady(modulesPath) && nativeBindingReady(modulesPath) && sharpRuntimeReady(modulesPath);
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
      console.error("Run Utilities\\Repair-PlotPickle.cmd, or allow Start-PlotPickle.bat to rebuild this runtime automatically.");
    }
    return false;
  }

  const sharp = sharpRuntimeStatus(modulesPath);
  if (!sharp.ready) {
    if (!quiet) {
      console.error(`[PlotPickle runtime error] ${sharp.message}`);
      console.error("PlotPickle needs a working Sharp runtime for local image processing and Animated WebP export.");
      console.error("Run Utilities\\Repair-PlotPickle.cmd, or allow Start-PlotPickle.bat to rebuild this runtime automatically.");
    }
    return false;
  }

  if (!quiet) {
    console.log(`Runtime verification passed: ${modulesPath}`);
    if (binding.packageName) console.log(`Native binding verified: ${binding.packageName}`);
    console.log(`Sharp runtime verified: ${sharp.version || "installed"}`);
  }
  return true;
}

function installedRolldownVersion(modulesPath) {
  const manifestPath = path.join(modulesPath, "rolldown", "package.json");
  if (!existsSync(manifestPath)) return "";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return typeof manifest.version === "string" ? manifest.version : "";
}

function installedSharpVersion(modulesPath) {
  const manifestPath = path.join(modulesPath, "sharp", "package.json");
  if (!existsSync(manifestPath)) return "";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return typeof manifest.version === "string" ? manifest.version : "";
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
      "--omit=dev",
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

function repairSharpRuntime(modulesPath) {
  if (sharpRuntimeReady(modulesPath)) {
    console.log("Sharp image runtime is already complete.");
    return true;
  }
  if (process.platform !== "win32") {
    console.error("[PlotPickle runtime error] Automatic Sharp native repair is currently available only on Windows.");
    return false;
  }

  const packageName = expectedWindowsSharpBinding();
  const version = installedSharpVersion(modulesPath);
  if (!packageName || !version) {
    console.error("[PlotPickle runtime error] Sharp must be installed before its Windows native package can be repaired.");
    return false;
  }

  const runtimeDir = path.dirname(modulesPath);
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const packageSpec = `${packageName}@${version}`;
  console.log(`Repairing Sharp Windows image runtime with ${packageSpec}...`);
  const result = spawnSync(
    npmCommand,
    [
      "install",
      "--prefix",
      runtimeDir,
      "--omit=dev",
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
    console.error(`[PlotPickle runtime error] Sharp native repair exited with code ${result.status ?? "unknown"}.`);
    return false;
  }
  return verifyModules(modulesPath);
}

function removeDirectoryTree(item) {
  rmSync(item, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function removeLinkOrDirectory(item) {
  if (!entryExists(item)) return;
  const stat = lstatSync(item);
  if (stat.isSymbolicLink()) {
    unlinkSync(item);
  } else {
    removeDirectoryTree(item);
  }
}

function verifiedVendoredPackages() {
  const manifest = JSON.parse(readFileSync(packageFile, "utf8"));
  const contracts = manifest.plotpickleVendoredPackages ?? {};
  const verified = [];

  for (const [packageName, contract] of Object.entries(contracts)) {
    const relativePath = String(contract?.path ?? "");
    const sourcePath = path.resolve(projectRoot, relativePath);
    if (!relativePath || (!samePath(sourcePath, projectRoot) && !sourcePath.toLowerCase().startsWith((projectRoot + path.sep).toLowerCase()))) {
      throw new Error(`Vendored package ${packageName} has an invalid repository path.`);
    }
    const provenancePath = path.join(sourcePath, "SECURITY-PROVENANCE.json");
    if (!existsSync(provenancePath)) throw new Error(`Vendored package ${packageName} is missing SECURITY-PROVENANCE.json.`);
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
    if (provenance.upstreamCommit !== contract.upstreamCommit || provenance.upstreamTree !== contract.upstreamTree) {
      throw new Error(`Vendored package ${packageName} provenance does not match package.json.`);
    }

    const files = provenance.files ?? {};
    const canonical = Object.keys(files).sort().map((relativeFile) => {
      const filePath = path.resolve(sourcePath, relativeFile);
      if (!filePath.toLowerCase().startsWith((sourcePath + path.sep).toLowerCase())) {
        throw new Error(`Vendored package ${packageName} contains an invalid provenance path.`);
      }
      const bytes = readFileSync(filePath);
      const blobHash = createHash("sha1")
        .update(Buffer.from(`blob ${bytes.length}\0`))
        .update(bytes)
        .digest("hex");
      if (blobHash !== files[relativeFile]) {
        throw new Error(`Vendored package ${packageName} file hash changed: ${relativeFile}.`);
      }
      return `${relativeFile}\0${blobHash}\n`;
    }).join("");
    const digest = createHash("sha256").update(canonical).digest("hex");
    if (provenance.manifestDigest !== digest || contract.manifestDigest !== `sha256-${digest}`) {
      throw new Error(`Vendored package ${packageName} manifest digest changed.`);
    }
    const runtimePackagePath = path.join(sourcePath, "package.json");
    const runtimePackageDigest = createHash("sha256").update(readFileSync(runtimePackagePath)).digest("hex");
    if (provenance.runtimePackageSha256 !== runtimePackageDigest || contract.runtimePackageSha256 !== runtimePackageDigest) {
      throw new Error(`Vendored package ${packageName} runtime package metadata digest changed.`);
    }
    verified.push({ packageName, relativePath, sourcePath });
  }
  return verified;
}

function stageVendoredPackages(info) {
  for (const item of verifiedVendoredPackages()) {
    const target = path.resolve(info.runtimeDir, item.relativePath);
    if (!target.toLowerCase().startsWith((info.runtimeDir + path.sep).toLowerCase())) {
      throw new Error(`Vendored package ${item.packageName} resolved outside the persistent runtime.`);
    }
    if (entryExists(target)) removeDirectoryTree(target);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(item.sourcePath, target, { recursive: true, force: true });
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

function moveDirectory(source, target) {
  try {
    renameSync(source, target);
  } catch (error) {
    if (error?.code !== "EXDEV") throw error;
    cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
    removeDirectoryTree(source);
  }
}

function copyRuntimeManifests(info) {
  mkdirSync(info.runtimeDir, { recursive: true });
  copyFileSync(packageFile, path.join(info.runtimeDir, "package.json"));
  if (existsSync(lockFile)) copyFileSync(lockFile, path.join(info.runtimeDir, "package-lock.json"));
  stageVendoredPackages(info);
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
        moveDirectory(info.appModules, info.runtimeModules);
        migrated = true;
        reused = runtimeReady(info.runtimeModules);
      } else if (runtimeReady(info.runtimeModules)) {
        removeDirectoryTree(info.appModules);
        reused = true;
      } else if (runtimeReady(info.appModules)) {
        removeDirectoryTree(info.runtimeModules);
        moveDirectory(info.appModules, info.runtimeModules);
        migrated = true;
        reused = true;
      } else {
        removeDirectoryTree(info.appModules);
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
  if (entryExists(info.runtimeModules)) removeDirectoryTree(info.runtimeModules);
  if (existsSync(info.marker)) rmSync(info.marker, { force: true });
  mkdirSync(info.runtimeModules, { recursive: true });
  copyRuntimeManifests(info);
  createJunction(info.runtimeModules, info.appModules);
  console.log(`Reset runtime: ${info.runtimeDir}`);
}

function describe() {
  const info = runtimeInfo();
  const binding = nativeBindingStatus(info.runtimeModules);
  const sharp = sharpRuntimeStatus(info.runtimeModules);
  console.log(`Application folder: ${projectRoot}`);
  console.log(`Persistent home: ${info.home}`);
  console.log(`Dependency fingerprint: ${info.hash}`);
  console.log(`Runtime fingerprint: ${info.fingerprint}`);
  console.log(`Runtime platform: ${process.platform} ${process.arch}`);
  console.log(`Persistent runtime: ${info.runtimeDir}`);
  console.log(`Persistent dependencies: ${info.runtimeModules}`);
  console.log(`Persistent npm cache: ${info.npmCache}`);
  if (binding.packageName) console.log(`Required native binding: ${binding.packageName}`);
  console.log(`Sharp runtime: ${sharp.ready ? sharp.version || "ready" : "not ready"}`);
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
  } else if (command === "repair-sharp") {
    const modulesPath = commandArgument
      ? path.resolve(projectRoot, commandArgument)
      : runtimeInfo().runtimeModules;
    if (!repairSharpRuntime(modulesPath)) process.exitCode = 1;
  } else describe();
} catch (error) {
  console.error(`[PlotPickle runtime error] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
