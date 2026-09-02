#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "../..");
const contractPath = path.join(repoRoot, "config", "runtime-weight-inventory.json");
const packagePath = path.join(repoRoot, "package.json");
const packagerPath = path.join(repoRoot, "scripts", "package-platform.mjs");
const windowsRuntimePath = path.join(repoRoot, "scripts", "windows-runtime.mjs");
const windowsLauncherPath = path.join(repoRoot, "Start-PlotPickle.bat");
const excludedSegments = new Set([".git", ".next", ".wrangler", "dist", "node_modules", "releases", ".env", ".env.local"]);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function quotedStrings(source) {
  return [...source.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map((match) => JSON.parse(`"${match[1]}"`));
}

function extractRuntimeDirectories(packagerSource) {
  const match = packagerSource.match(/const runtimeDirectories\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error("Unable to read runtimeDirectories from scripts/package-platform.mjs.");
  return quotedStrings(match[1]);
}

function extractCopiedRootFiles(packagerSource) {
  const match = packagerSource.match(/for \(const file of \[([\s\S]*?)\]\) \{/);
  if (!match) throw new Error("Unable to read copied root files from scripts/package-platform.mjs.");
  return quotedStrings(match[1]);
}

function extractCoreReadyPackages(runtimeSource) {
  const match = runtimeSource.match(/function coreReady\([\s\S]*?return \[([\s\S]*?)\]\.every/);
  if (!match) throw new Error("Unable to read coreReady package requirements from scripts/windows-runtime.mjs.");
  return quotedStrings(match[1]);
}

function sourceHead(contract) {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return contract.baseline.sourceCommit;
  }
}

function measureBytes(target) {
  if (!existsSync(target)) return null;
  const info = lstatSync(target);
  if (info.isSymbolicLink()) return 0;
  if (info.isFile()) return statSync(target).size;
  if (!info.isDirectory()) return 0;
  let total = 0;
  for (const name of readdirSync(target).sort()) {
    if (excludedSegments.has(name)) continue;
    const measured = measureBytes(path.join(target, name));
    if (Number.isFinite(measured)) total += measured;
  }
  return total;
}

function packageLocation(name) {
  return path.join(repoRoot, "node_modules", ...name.split("/"));
}

function directPackages(packageJson, contract) {
  const sections = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
  const result = [];
  for (const section of sections) {
    const declarations = packageJson[section] ?? {};
    for (const name of Object.keys(declarations).sort()) {
      const override = contract.packageOverrides[name];
      result.push({
        name,
        version: declarations[name],
        declaration: section,
        weightClass: override?.weightClass ?? null,
        disposition: override?.disposition ?? (override ? "classified" : "requires-reachability-proof"),
        targetDomains: override?.targetDomains ?? [],
        evidence: override?.evidence ?? [`package.json ${section} declaration is direct; Slice A has not yet proven a shipped runtime consumer for ${name}.`],
        installedBytes: measureBytes(packageLocation(name)),
      });
    }
  }
  return result.sort((left, right) => left.name.localeCompare(right.name) || left.declaration.localeCompare(right.declaration));
}

export function buildInventory() {
  const contract = readJson(contractPath);
  const packageJson = readJson(packagePath);
  const packagerSource = readFileSync(packagerPath, "utf8");
  const windowsRuntimeSource = readFileSync(windowsRuntimePath, "utf8");
  const windowsLauncherSource = readFileSync(windowsLauncherPath, "utf8");
  const runtimeDirectories = extractRuntimeDirectories(packagerSource);
  const copiedRootFiles = extractCopiedRootFiles(packagerSource);
  const knownPaths = new Map(contract.releasePayloads.map((item) => [item.path, item]));

  return {
    schemaVersion: contract.schemaVersion,
    issue: contract.issue,
    sourceCommit: sourceHead(contract),
    baseline: contract.baseline,
    ownershipDomains: contract.ownershipDomains,
    weightClasses: contract.weightClasses,
    installationPolicy: {
      windowsPersistentRuntimeIncludesDev: /npm ci --prefix "%PLOTPICKLE_RUNTIME_DIR%" --include=dev/.test(windowsLauncherSource),
      windowsCoreReadyPackages: extractCoreReadyPackages(windowsRuntimeSource),
      mastraVerifiedBeforeServerStart: windowsLauncherSource.includes("require('./node_modules/@mastra/core/package.json').version"),
    },
    releaseAuthority: {
      packager: "scripts/package-platform.mjs",
      runtimeDirectories,
      copiedRootFiles,
      selectedPlatformLauncher: true,
      generatedFiles: ["release-manifest.json", "FILES.txt"],
    },
    releasePayloads: contract.releasePayloads.map((item) => ({
      ...item,
      sourceBytes: item.kind === "directory" || item.kind === "file" ? measureBytes(path.join(repoRoot, item.path)) : null,
    })),
    directPackages: directPackages(packageJson, contract),
    coverage: {
      runtimeDirectoryCount: runtimeDirectories.length,
      copiedRootFileCount: copiedRootFiles.length,
      classifiedRuntimeDirectoryCount: runtimeDirectories.filter((item) => knownPaths.has(item)).length,
      classifiedCopiedRootFileCount: copiedRootFiles.filter((item) => knownPaths.has(item)).length,
    },
  };
}

export function validateInventory(inventory) {
  const failures = [];
  const domainIds = new Set(inventory.ownershipDomains.map((item) => item.id));
  const weightClasses = new Set(inventory.weightClasses);
  const payloadByPath = new Map(inventory.releasePayloads.map((item) => [item.path, item]));

  for (const pathName of inventory.releaseAuthority.runtimeDirectories) {
    if (!payloadByPath.has(pathName)) failures.push(`Unclassified packaged runtime directory: ${pathName}`);
  }
  for (const pathName of inventory.releaseAuthority.copiedRootFiles) {
    if (!payloadByPath.has(pathName)) failures.push(`Unclassified packaged root file: ${pathName}`);
  }
  for (const generated of ["<platform-launcher>", ...inventory.releaseAuthority.generatedFiles]) {
    if (!payloadByPath.has(generated)) failures.push(`Unclassified generated/selected release payload: ${generated}`);
  }

  for (const payload of inventory.releasePayloads) {
    if (!weightClasses.has(payload.weightClass)) failures.push(`${payload.path}: invalid weight class ${payload.weightClass}`);
    if (!Array.isArray(payload.targetDomains) || payload.targetDomains.length === 0) failures.push(`${payload.path}: target domain ownership is missing`);
    for (const domain of payload.targetDomains ?? []) {
      if (!domainIds.has(domain)) failures.push(`${payload.path}: unknown target domain ${domain}`);
    }
    if (!Array.isArray(payload.evidence) || payload.evidence.length === 0) failures.push(`${payload.path}: evidence is missing`);
  }

  for (const item of inventory.directPackages) {
    const classified = item.weightClass !== null && weightClasses.has(item.weightClass);
    const explicitlyDeferred = item.disposition === "requires-reachability-proof";
    if (!classified && !explicitlyDeferred) failures.push(`${item.name}: package has neither a valid weight class nor requires-reachability-proof disposition`);
    if (!Array.isArray(item.evidence) || item.evidence.length === 0) failures.push(`${item.name}: package evidence is missing`);
    for (const domain of item.targetDomains ?? []) {
      if (!domainIds.has(domain)) failures.push(`${item.name}: unknown package target domain ${domain}`);
    }
  }

  if (!inventory.installationPolicy.windowsPersistentRuntimeIncludesDev) failures.push("Windows persistent runtime --include=dev baseline was not detected.");
  if (!inventory.installationPolicy.mastraVerifiedBeforeServerStart) failures.push("Required @mastra/core launcher verification was not detected.");
  return failures;
}

function argumentValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const inventory = buildInventory();
  const failures = validateInventory(inventory);
  if (failures.length) {
    for (const failure of failures) console.error(`[runtime-weight inventory] ${failure}`);
    process.exitCode = 1;
    return;
  }

  const json = `${JSON.stringify(inventory, null, 2)}\n`;
  const output = argumentValue("--output");
  if (output) {
    const resolved = path.resolve(repoRoot, output);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, json, "utf8");
    console.log(resolved);
  } else {
    process.stdout.write(json);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
