#!/usr/bin/env node

import { constants, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
export const SKIN_V1_BASELINE_MANIFEST = "tests/visual-baselines/skin-v1/manifest.json";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function readManifest(root) {
  const manifestPath = path.join(root, SKIN_V1_BASELINE_MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest?.skin !== "skin-v1" || !manifest?.surfaces || typeof manifest.surfaces !== "object") {
    throw new Error(`Invalid Skin V1 visual baseline manifest: ${manifestPath}`);
  }
  return { manifest, manifestPath };
}

function assertPng(contents, candidatePath) {
  if (contents.length < PNG_SIGNATURE.length || !contents.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`Candidate is not a PNG screenshot: ${candidatePath}`);
  }
}

export async function lockVisualBaseline(surface, { root = DEFAULT_ROOT } = {}) {
  const normalized = String(surface || "").trim().toLowerCase();
  const { manifest, manifestPath } = await readManifest(root);
  const entry = manifest.surfaces[normalized];
  if (!entry) throw new Error(`Unknown Skin V1 visual surface: ${normalized || "empty"}`);
  if (entry.status === "locked") {
    throw new Error(`${entry.label || normalized} is already locked. Return it to candidate in the manifest deliberately before replacing its approved baseline.`);
  }
  if (entry.status !== "candidate") throw new Error(`${entry.label || normalized} has unsupported baseline status: ${entry.status}`);

  const candidatePath = path.join(root, entry.candidate);
  const baselinePath = path.join(root, entry.baseline);
  const candidate = await readFile(candidatePath).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`Candidate screenshot does not exist: ${candidatePath}`);
    throw error;
  });
  assertPng(candidate, candidatePath);

  await mkdir(path.dirname(baselinePath), { recursive: true });
  await copyFile(candidatePath, baselinePath, constants.COPYFILE_EXCL).catch((error) => {
    if (error?.code === "EEXIST") {
      throw new Error(`Baseline already exists and will not be overwritten automatically: ${baselinePath}`);
    }
    throw error;
  });

  manifest.surfaces[normalized] = { ...entry, status: "locked" };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { surface: normalized, candidatePath, baselinePath, manifestPath };
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH);
if (directExecution) {
  lockVisualBaseline(process.argv[2]).then(({ surface, baselinePath }) => {
    console.log(`Locked Skin V1 ${surface} baseline: ${baselinePath}`);
    console.log("Review and commit the baseline PNG plus manifest change in a normal pull request.");
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
