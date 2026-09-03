#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "../..");
const classificationPath = path.join(repoRoot, "config", "release-script-classification.json");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sourceHead() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function measure(target) {
  if (!existsSync(target)) return { bytes: 0, files: 0, exists: false };
  const info = lstatSync(target);
  if (info.isSymbolicLink()) return { bytes: 0, files: 0, exists: true };
  if (info.isFile()) return { bytes: statSync(target).size, files: 1, exists: true };
  if (!info.isDirectory()) return { bytes: 0, files: 0, exists: true };
  let bytes = 0;
  let files = 0;
  for (const name of readdirSync(target).sort()) {
    const nested = measure(path.join(target, name));
    bytes += nested.bytes;
    files += nested.files;
  }
  return { bytes, files, exists: true };
}

export function buildReleaseScriptInventory() {
  const classification = readJson(classificationPath);
  if (classification?.issue !== 1656) throw new Error("Release script classification must belong to #1656.");
  if (!Array.isArray(classification.baseUserReleaseExclusions) || !classification.baseUserReleaseExclusions.length) {
    throw new Error("Release script classification has no bounded exclusions.");
  }
  if (!Array.isArray(classification.retainedRuntimeAnchors) || !classification.retainedRuntimeAnchors.length) {
    throw new Error("Release script classification has no retained runtime/self-support anchors.");
  }

  const exclusions = classification.baseUserReleaseExclusions.map((entry) => {
    const measurement = measure(path.join(repoRoot, entry.path));
    if (!measurement.exists || measurement.files === 0) throw new Error(`Classified release-only path does not exist: ${entry.path}`);
    return { path: entry.path, weightClass: entry.weightClass, evidence: entry.evidence, ...measurement };
  });
  const retained = classification.retainedRuntimeAnchors.map((entry) => {
    const measurement = measure(path.join(repoRoot, entry.path));
    if (!measurement.exists) throw new Error(`Retained runtime/self-support anchor is missing: ${entry.path}`);
    return { path: entry.path, reason: entry.reason, ...measurement };
  });

  return {
    schemaVersion: 1,
    issue: 1656,
    sourceCommit: sourceHead(),
    classificationRule: classification.classificationRule,
    authorityBoundary: classification.authorityBoundary,
    exclusions,
    retained,
    totals: {
      excludedBytes: exclusions.reduce((sum, item) => sum + item.bytes, 0),
      excludedFiles: exclusions.reduce((sum, item) => sum + item.files, 0),
      retainedAnchorBytes: retained.reduce((sum, item) => sum + item.bytes, 0),
      retainedAnchorFiles: retained.reduce((sum, item) => sum + item.files, 0)
    }
  };
}

async function main() {
  const inventory = buildReleaseScriptInventory();
  const json = `${JSON.stringify(inventory, null, 2)}\n`;
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
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
