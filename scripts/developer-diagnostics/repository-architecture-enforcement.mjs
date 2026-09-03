#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "../..");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const ignoredDirectories = new Set([".git", ".next", "node_modules", "releases"]);

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function normalized(relativePath) {
  return relativePath.replaceAll("\\", "/");
}

function isSourceFile(relativePath) {
  return sourceExtensions.has(path.posix.extname(normalized(relativePath)));
}

function directSourceFiles(rootName) {
  const rootPath = path.join(repoRoot, rootName);
  if (!existsSync(rootPath)) return [];
  return readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isSourceFile(entry.name))
    .map((entry) => `${rootName}/${entry.name}`)
    .sort();
}

function directChildDirectoryCount(rootName) {
  const rootPath = path.join(repoRoot, rootName);
  if (!existsSync(rootPath)) return 0;
  return readdirSync(rootPath, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !ignoredDirectories.has(entry.name)).length;
}

function maxRelativeDepth(rootName) {
  const rootPath = path.join(repoRoot, rootName);
  if (!existsSync(rootPath)) return 0;
  let maximum = 0;
  const visit = (directory, depth) => {
    maximum = Math.max(maximum, depth);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
      visit(path.join(directory, entry.name), depth + 1);
    }
  };
  visit(rootPath, 0);
  return maximum;
}

function parseChangedEntries(baseRef) {
  if (!baseRef) return [];
  const output = execFileSync("git", ["diff", "--name-status", "--find-renames", `${baseRef}...HEAD`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (!output) return [];
  return output.split(/\r?\n/).map((line) => {
    const fields = line.split("\t");
    const status = fields[0];
    const filePath = status.startsWith("R") ? fields[2] : fields[1];
    return { status, path: normalized(filePath ?? "") };
  }).filter((entry) => entry.path);
}

export function directRootAdditionViolations(changes, protectedRoots) {
  const protectedSet = new Set(protectedRoots);
  const violations = [];
  for (const change of changes) {
    if (!(change.status === "A" || change.status.startsWith("R"))) continue;
    if (!isSourceFile(change.path)) continue;
    const parts = normalized(change.path).split("/");
    if (parts.length !== 2 || !protectedSet.has(parts[0])) continue;
    violations.push(`New direct source file is not allowed in governed root ${parts[0]}/: ${change.path}. Place it under its owning domain directory.`);
  }
  return violations;
}

function importSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function targetRootForSpecifier(sourcePath, specifier) {
  if (specifier.startsWith("@/")) return specifier.slice(2).split("/")[0] ?? null;
  if (!specifier.startsWith(".")) return null;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(normalized(sourcePath)), specifier));
  if (resolved.startsWith("../")) return null;
  return resolved.split("/")[0] ?? null;
}

export function importBoundaryViolations(sourcePath, source, rules) {
  const sourceRoot = normalized(sourcePath).split("/")[0];
  const applicable = rules.filter((rule) => rule.fromRoot === sourceRoot);
  if (!applicable.length) return [];
  const violations = [];
  for (const specifier of importSpecifiers(source)) {
    const targetRoot = targetRootForSpecifier(sourcePath, specifier);
    if (!targetRoot) continue;
    for (const rule of applicable) {
      if (!rule.toRoots.includes(targetRoot)) continue;
      violations.push(`Forbidden architecture import in ${sourcePath}: ${specifier} crosses ${rule.fromRoot} -> ${targetRoot}. ${rule.reason}`);
    }
  }
  return violations;
}

function changedImportViolations(changes, rules) {
  const violations = [];
  for (const change of changes) {
    if (change.status === "D" || !isSourceFile(change.path)) continue;
    const absolutePath = path.join(repoRoot, change.path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) continue;
    violations.push(...importBoundaryViolations(change.path, readFileSync(absolutePath, "utf8"), rules));
  }
  return violations;
}

export function isTemporaryReexportBridge(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 2) return false;
  if (!/^\/\/ Temporary Phase\b.*\bcompatibility bridge\b/i.test(lines[0])) return false;
  return /^export \* from ["'][^"']+["'];?$/.test(lines[1]);
}

function compatibilityBridgeEvidence(policy) {
  const bridgePaths = directSourceFiles("lib").filter((relativePath) => isTemporaryReexportBridge(readFileSync(path.join(repoRoot, relativePath), "utf8")));
  const exceptionByPath = new Map(policy.compatibilityBridgeExceptions.map((entry) => [entry.path, entry]));
  const violations = [];
  const evidence = [];
  for (const bridgePath of bridgePaths) {
    const exception = exceptionByPath.get(bridgePath);
    if (!exception) {
      violations.push(`Undocumented compatibility bridge remains: ${bridgePath}. Retire it or add a narrow owned exception.`);
      continue;
    }
    if (!existsSync(path.join(repoRoot, exception.canonicalTarget))) {
      violations.push(`Compatibility bridge target is missing for ${bridgePath}: ${exception.canonicalTarget}`);
    }
    const consumers = [];
    for (const consumerPath of exception.consumerPaths) {
      const absoluteConsumer = path.join(repoRoot, consumerPath);
      if (!existsSync(absoluteConsumer)) {
        violations.push(`Documented bridge consumer is missing for ${bridgePath}: ${consumerPath}`);
        continue;
      }
      const consumerSource = readFileSync(absoluteConsumer, "utf8");
      if (!consumerSource.includes(exception.consumerImportFragment)) {
        violations.push(`Bridge exception for ${bridgePath} is stale: ${consumerPath} no longer uses ${exception.consumerImportFragment}. Retire the bridge.`);
        continue;
      }
      consumers.push(consumerPath);
    }
    evidence.push({ path: bridgePath, canonicalTarget: exception.canonicalTarget, ownerIssue: exception.ownerIssue, consumers });
  }
  for (const exception of policy.compatibilityBridgeExceptions) {
    if (!bridgePaths.includes(exception.path)) violations.push(`Compatibility bridge exception is stale because the bridge no longer exists: ${exception.path}. Remove the exception.`);
  }
  return { bridgePaths, evidence, violations };
}

export function runArchitectureEnforcement({ baseRef = null, writeArtifact = true } = {}) {
  const target = readJson("config/repository-architecture-target.json");
  const policy = readJson("config/repository-architecture-enforcement.json");
  if (target.ratifiedForIssue !== 1461 || policy.issue !== 1466) throw new Error("Repository architecture authority metadata is inconsistent.");
  const ceilings = target.structuralCeilings;
  const violations = [];
  const metrics = {};
  for (const rootName of ceilings.governedRoots) {
    const sourceFiles = directSourceFiles(rootName);
    const childDirectories = directChildDirectoryCount(rootName);
    const depth = maxRelativeDepth(rootName);
    const directSourceLimit = policy.legacyDirectSourceRatchets[rootName] ?? ceilings.maxDirectSourceFiles;
    metrics[rootName] = { directSourceFiles: sourceFiles.length, directSourceLimit, directChildDirectories: childDirectories, maxRelativeDepth: depth };
    if (sourceFiles.length > directSourceLimit) violations.push(`${rootName}/ has ${sourceFiles.length} direct source files; ratified limit for this phase is ${directSourceLimit}.`);
    if (childDirectories > ceilings.maxDirectChildDirectories) violations.push(`${rootName}/ has ${childDirectories} direct child directories; ceiling is ${ceilings.maxDirectChildDirectories}.`);
    if (depth > ceilings.maxRelativeDepth) violations.push(`${rootName}/ reaches relative depth ${depth}; ceiling is ${ceilings.maxRelativeDepth}.`);
  }
  const changes = parseChangedEntries(baseRef);
  violations.push(...directRootAdditionViolations(changes, policy.protectedDirectSourceRoots));
  violations.push(...changedImportViolations(changes, policy.forbiddenImports));
  const bridgeEvidence = compatibilityBridgeEvidence(policy);
  violations.push(...bridgeEvidence.violations);
  const report = {
    schemaVersion: 1,
    issue: 1466,
    status: violations.length ? "fail" : "pass",
    baseRef,
    architectureTargetIssue: target.ratifiedForIssue,
    strategy: policy.strategy,
    baselineEvidence: policy.baselineEvidence,
    metrics,
    changedFiles: changes.map((entry) => entry.path),
    compatibilityBridges: bridgeEvidence.evidence,
    violations,
  };
  if (writeArtifact) {
    const artifactDirectory = path.join(repoRoot, ".artifacts", "repository-architecture");
    mkdirSync(artifactDirectory, { recursive: true });
    writeFileSync(path.join(artifactDirectory, "enforcement.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const baseRefIndex = process.argv.indexOf("--base-ref");
  const baseRef = baseRefIndex >= 0 ? process.argv[baseRefIndex + 1] : null;
  const report = runArchitectureEnforcement({ baseRef: baseRef ?? process.env.ARCHITECTURE_BASE_REF ?? null });
  console.log(`Repository architecture enforcement: ${report.status}`);
  for (const [rootName, metric] of Object.entries(report.metrics)) {
    console.log(`${rootName}: direct source ${metric.directSourceFiles}/${metric.directSourceLimit}, child dirs ${metric.directChildDirectories}, depth ${metric.maxRelativeDepth}`);
  }
  if (report.compatibilityBridges.length) console.log(`Documented compatibility bridges: ${report.compatibilityBridges.map((entry) => entry.path).join(", ")}`);
  if (report.violations.length) {
    for (const violation of report.violations) console.error(`- ${violation}`);
    process.exitCode = 1;
  }
}
