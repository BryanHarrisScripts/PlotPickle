#!/usr/bin/env node

import { constants, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { canonicalEvidencePaths, canonicalWebMcpSurfaceIds } from "../lib/verification/skin-v1-surface-registry.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
export const SKIN_V1_BASELINE_MANIFEST = "tests/visual-baselines/skin-v1/manifest.json";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export async function readVisualBaselineManifest({ root = DEFAULT_ROOT } = {}) {
  const manifestPath = path.join(root, SKIN_V1_BASELINE_MANIFEST);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest?.skin !== "skin-v1" || !manifest?.surfaces || typeof manifest.surfaces !== "object") {
    throw new Error(`Invalid Skin V1 visual baseline manifest: ${manifestPath}`);
  }
  if (path.resolve(root) === DEFAULT_ROOT) {
    const canonicalIds = [...canonicalWebMcpSurfaceIds()];
    const manifestIds = Object.keys(manifest.surfaces);
    if (manifestIds.length !== canonicalIds.length || manifestIds.some((id) => !canonicalIds.includes(id))) {
      throw new Error("Skin V1 visual baseline manifest surface set drifted from the canonical Surface Registry.");
    }
    for (const id of canonicalIds) {
      const evidence = canonicalEvidencePaths(id);
      const entry = manifest.surfaces[id];
      if (!entry || entry.candidate !== evidence?.candidate || entry.baseline !== evidence?.baseline) {
        throw new Error(`Skin V1 visual evidence path drifted from canonical navigation identity for ${id}.`);
      }
    }
  }
  return { manifest, manifestPath };
}

function assertPng(contents, candidatePath) {
  if (contents.length < PNG_SIGNATURE.length || !contents.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`Candidate is not a PNG screenshot: ${candidatePath}`);
  }
}

async function readCandidate(root, entry, surface) {
  if (!["candidate", "locked"].includes(entry.status)) {
    throw new Error(`${entry.label || surface} has unsupported baseline status: ${entry.status}`);
  }
  const candidatePath = path.join(root, entry.candidate);
  const baselinePath = path.join(root, entry.baseline);
  const candidate = await readFile(candidatePath).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`Candidate screenshot does not exist: ${candidatePath}`);
    throw error;
  });
  assertPng(candidate, candidatePath);
  return { surface, entry, candidatePath, baselinePath };
}

export async function lockVisualBaseline(surface, { root = DEFAULT_ROOT } = {}) {
  const normalized = String(surface || "").trim().toLowerCase();
  const { manifest, manifestPath } = await readVisualBaselineManifest({ root });
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

export async function lockAllVisualBaselines({ root = DEFAULT_ROOT, replace = false } = {}) {
  if (!replace) {
    throw new Error("Bulk Skin V1 baseline replacement requires the explicit --replace flag.");
  }

  const { manifest, manifestPath } = await readVisualBaselineManifest({ root });
  const candidates = await Promise.all(Object.entries(manifest.surfaces).map(([surface, entry]) => readCandidate(root, entry, surface)));

  for (const candidate of candidates) {
    await mkdir(path.dirname(candidate.baselinePath), { recursive: true });
    await copyFile(candidate.candidatePath, candidate.baselinePath);
    manifest.surfaces[candidate.surface] = { ...candidate.entry, status: "locked" };
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { baselines: candidates, manifestPath };
}

function normalizeToggleSelection(surfaces) {
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    throw new Error("Select at least one Skin V1 visual surface to toggle.");
  }
  const normalized = surfaces.map((surface) => String(surface || "").trim().toLowerCase());
  if (normalized.some((surface) => !surface)) throw new Error("Visual baseline selection contains an empty surface.");
  if (new Set(normalized).size !== normalized.length) throw new Error("Visual baseline selection contains duplicate surfaces.");
  return normalized;
}

export async function toggleVisualBaselines(surfaces, { root = DEFAULT_ROOT } = {}) {
  const selected = normalizeToggleSelection(surfaces);
  const { manifest, manifestPath } = await readVisualBaselineManifest({ root });
  const changes = selected.map((surface) => {
    const entry = manifest.surfaces[surface];
    if (!entry) throw new Error(`Unknown Skin V1 visual surface: ${surface}`);
    if (!["candidate", "locked"].includes(entry.status)) {
      throw new Error(`${entry.label || surface} has unsupported baseline status: ${entry.status}`);
    }
    return {
      surface,
      label: entry.label || surface,
      before: entry.status,
      after: entry.status === "locked" ? "candidate" : "locked",
      entry,
    };
  });

  const baselines = await Promise.all(changes
    .filter((change) => change.after === "locked")
    .map((change) => readCandidate(root, change.entry, change.surface)));

  for (const baseline of baselines) {
    await mkdir(path.dirname(baseline.baselinePath), { recursive: true });
    await copyFile(baseline.candidatePath, baseline.baselinePath);
  }
  for (const change of changes) {
    manifest.surfaces[change.surface] = { ...change.entry, status: change.after };
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    changes: changes.map(({ entry: _entry, ...change }) => change),
    lockedSurfaces: Object.entries(manifest.surfaces)
      .filter(([, entry]) => entry.status === "locked")
      .map(([surface]) => surface),
    manifestPath,
  };
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(SCRIPT_PATH);
if (directExecution) {
  const surface = process.argv[2];
  if (surface === "all") {
    lockAllVisualBaselines({ replace: process.argv.includes("--replace") }).then(({ baselines, manifestPath }) => {
      console.log(`Replaced and locked ${baselines.length} Skin V1 visual baselines locally:`);
      for (const baseline of baselines) console.log(`- ${baseline.surface}: ${baseline.baselinePath}`);
      console.log(`Updated manifest: ${manifestPath}`);
      console.log("No GitHub commit or push was performed. Review these local changes and use the normal pull-request workflow.");
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  } else {
    lockVisualBaseline(surface).then(({ surface: lockedSurface, baselinePath }) => {
      console.log(`Locked Skin V1 ${lockedSurface} baseline: ${baselinePath}`);
      console.log("Review and commit the baseline PNG plus manifest change in a normal pull request.");
    }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
