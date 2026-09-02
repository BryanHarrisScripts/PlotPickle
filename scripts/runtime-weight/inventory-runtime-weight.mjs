#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "../..");
const allowedPlatforms = new Set(["windows", "macos", "linux"]);

function parseArgs(argv) {
  const args = { platform: "windows", output: "", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") args.json = true;
    else if (value === "--platform") args.platform = argv[++index] ?? "";
    else if (value === "--output") args.output = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!allowedPlatforms.has(args.platform)) throw new Error(`Unsupported platform: ${args.platform}`);
  return args;
}

async function json(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function quotedStrings(source) {
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function packagerContract(source) {
  const runtimeBlock = source.match(/const runtimeDirectories = \[([\s\S]*?)\n\];/);
  if (!runtimeBlock) throw new Error("Unable to locate package-platform runtimeDirectories.");
  const fileBlock = source.match(/for \(const file of \[([\s\S]*?)\]\) \{/);
  if (!fileBlock) throw new Error("Unable to locate package-platform root file list.");
  return {
    directories: quotedStrings(runtimeBlock[1]),
    files: quotedStrings(fileBlock[1]),
  };
}

function launcherFor(platform) {
  if (platform === "windows") return "Start-PlotPickle.bat";
  if (platform === "macos") return "Start-PlotPickle.command";
  return "start-plotpickle.sh";
}

function windowsReadinessPackages(source) {
  const match = source.match(/function coreReady\(modulesPath\) \{\s*return \[([\s\S]*?)\]\.every/);
  if (!match) throw new Error("Unable to locate Windows coreReady package list.");
  return quotedStrings(match[1]);
}

function directDeclarations(packageJson) {
  return new Map([
    ...Object.keys(packageJson.dependencies ?? {}).map((name) => [name, "dependencies"]),
    ...Object.keys(packageJson.devDependencies ?? {}).map((name) => [name, "devDependencies"]),
  ]);
}

function sameSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function validatePolicy({ policy, packageJson, packager, launcher, launcherSource, windowsRuntimeSource }) {
  const errors = [];
  const roles = new Set(policy.roles ?? []);
  const dispositions = new Set(policy.dispositions ?? []);
  const payload = new Map((policy.releasePayload ?? []).map((entry) => [entry.id, entry]));
  const expectedPayload = new Set([...packager.directories, ...packager.files, "platform-launcher"]);

  if (!sameSet(new Set(payload.keys()), expectedPayload)) {
    const missing = [...expectedPayload].filter((id) => !payload.has(id));
    const extra = [...payload.keys()].filter((id) => !expectedPayload.has(id));
    errors.push(`Release payload coverage mismatch. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`);
  }

  for (const [id, entry] of payload) {
    if (!roles.has(entry.role)) errors.push(`Release payload ${id} has invalid role ${entry.role}.`);
    if (!dispositions.has(entry.disposition)) errors.push(`Release payload ${id} has invalid disposition ${entry.disposition}.`);
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) errors.push(`Release payload ${id} has no evidence.`);
  }

  const declarations = directDeclarations(packageJson);
  const policyPackages = new Map(Object.entries(policy.packageDeclarations ?? {}));
  if (!sameSet(new Set(declarations.keys()), new Set(policyPackages.keys()))) {
    const missing = [...declarations.keys()].filter((name) => !policyPackages.has(name));
    const extra = [...policyPackages.keys()].filter((name) => !declarations.has(name));
    errors.push(`Direct package coverage mismatch. Missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`);
  }

  for (const [name, declaration] of declarations) {
    const entry = policyPackages.get(name);
    if (!entry) continue;
    if (entry.declaration !== declaration) errors.push(`${name} is classified as ${entry.declaration}, expected ${declaration}.`);
    if (!roles.has(entry.role)) errors.push(`${name} has invalid role ${entry.role}.`);
    if (!dispositions.has(entry.disposition)) errors.push(`${name} has invalid disposition ${entry.disposition}.`);
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) errors.push(`${name} has no evidence.`);
  }

  const includeDevObserved = /npm ci[^\r\n]*--include=dev/.test(launcherSource);
  if (includeDevObserved !== policy.persistentRuntime?.includeDev) {
    errors.push(`Persistent runtime includeDev policy is ${policy.persistentRuntime?.includeDev}; ${launcher} observed ${includeDevObserved}.`);
  }

  const readinessObserved = windowsReadinessPackages(windowsRuntimeSource);
  if (!sameSet(new Set(readinessObserved), new Set(policy.persistentRuntime?.currentReadinessPackages ?? []))) {
    errors.push(`Windows readiness package list drifted. Observed: ${readinessObserved.join(", ")}.`);
  }

  if (!windowsRuntimeSource.includes("WINDOWS_ROLLDOWN_BINDINGS") || !windowsRuntimeSource.includes("repairNativeBinding")) {
    errors.push("Windows native binding verification/repair evidence is missing.");
  }

  if (errors.length) throw new Error(errors.join("\n"));
}

const excludedSegments = new Set([".git", ".next", ".wrangler", "dist", "node_modules", "releases", ".env", ".env.local"]);

async function measurePath(absolutePath, { applyPackagerExclusions = false } = {}) {
  if (!existsSync(absolutePath)) return { exists: false, bytes: 0, files: 0 };
  const info = await stat(absolutePath);
  if (info.isFile()) return { exists: true, bytes: info.size, files: 1 };
  let bytes = 0;
  let files = 0;
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    if (applyPackagerExclusions && excludedSegments.has(entry.name)) continue;
    const child = await measurePath(path.join(absolutePath, entry.name), { applyPackagerExclusions });
    bytes += child.bytes;
    files += child.files;
  }
  return { exists: true, bytes, files };
}

async function measureReleasePayload(policy, platform) {
  const launcher = launcherFor(platform);
  const rows = [];
  for (const entry of policy.releasePayload) {
    const target = entry.id === "platform-launcher" ? launcher : entry.id;
    const measured = await measurePath(path.join(root, target), { applyPackagerExclusions: true });
    rows.push({
      id: entry.id,
      target,
      role: entry.role,
      disposition: entry.disposition,
      ...measured,
    });
  }
  return rows;
}

function lockedPackage(packageLock, name) {
  return packageLock.packages?.[`node_modules/${name}`] ?? null;
}

async function measureDirectPackages(policy, packageJson, packageLock) {
  const rows = [];
  for (const [name, entry] of Object.entries(policy.packageDeclarations)) {
    const declaration = packageJson[entry.declaration] ?? {};
    const locked = lockedPackage(packageLock, name);
    const installed = await measurePath(path.join(root, "node_modules", ...name.split("/")));
    rows.push({
      name,
      declaration: entry.declaration,
      declaredVersion: declaration[name] ?? null,
      lockedVersion: locked?.version ?? null,
      role: entry.role,
      disposition: entry.disposition,
      installed,
    });
  }
  return rows.sort((left, right) => left.name.localeCompare(right.name));
}

export async function buildRuntimeWeightInventory({ platform = "windows" } = {}) {
  if (!allowedPlatforms.has(platform)) throw new Error(`Unsupported platform: ${platform}`);
  const [policy, packageJson, packageLock, packagerSource, windowsRuntimeSource] = await Promise.all([
    json("scripts/runtime-weight/runtime-weight-policy.json"),
    json("package.json"),
    json("package-lock.json"),
    text("scripts/package-platform.mjs"),
    text("scripts/windows-runtime.mjs"),
  ]);
  const packager = packagerContract(packagerSource);
  const launcher = launcherFor(platform);
  const launcherSource = await text(launcher);
  validatePolicy({ policy, packageJson, packager, launcher, launcherSource, windowsRuntimeSource });

  const releasePayload = await measureReleasePayload(policy, platform);
  const directPackages = await measureDirectPackages(policy, packageJson, packageLock);
  const nodeModules = await measurePath(path.join(root, "node_modules"));

  return {
    schemaVersion: policy.schemaVersion,
    inventoryVersion: policy.inventoryVersion,
    baseline: policy.baseline,
    targetPlatform: platform,
    packageVersion: packageJson.version,
    release: {
      packager: "scripts/package-platform.mjs",
      launcher,
      payload: releasePayload,
      sourcePayloadBytes: releasePayload.reduce((sum, entry) => sum + entry.bytes, 0),
      sourcePayloadFiles: releasePayload.reduce((sum, entry) => sum + entry.files, 0),
      note: "Source payload measurements mirror the current packager exclusions and exclude generated release-manifest.json/FILES.txt plus node_modules.",
    },
    persistentRuntime: {
      includeDev: policy.persistentRuntime.includeDev,
      currentReadinessPackages: policy.persistentRuntime.currentReadinessPackages,
      nativeBindingPolicy: policy.persistentRuntime.nativeBindingPolicy,
      installedNodeModules: nodeModules,
    },
    directPackages,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await buildRuntimeWeightInventory({ platform: args.platform });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    const output = path.resolve(root, args.output);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, serialized, "utf8");
  }
  if (args.json || !args.output) process.stdout.write(serialized);
  else {
    process.stdout.write(`Runtime weight inventory passed: ${report.inventoryVersion}\n`);
    process.stdout.write(`Release source payload: ${report.release.sourcePayloadFiles} files, ${report.release.sourcePayloadBytes} bytes\n`);
    if (report.persistentRuntime.installedNodeModules.exists) {
      process.stdout.write(`Installed node_modules: ${report.persistentRuntime.installedNodeModules.files} files, ${report.persistentRuntime.installedNodeModules.bytes} bytes\n`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[runtime-weight inventory] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
