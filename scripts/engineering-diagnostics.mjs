#!/usr/bin/env node
import { lstat, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { probeManagedPi } from "./pi-managed-install.mjs";
import { probeManagedPiDurable } from "./pi-durable-managed-install.mjs";

const SCOPE = /^[a-f0-9]{64}$/;
const HEAD = /^[a-f0-9]{40}$/;
const CODE = /^[A-Z][A-Z0-9_]{1,80}$/;
const PHASE = /^[a-z][a-z0-9-]{1,50}$/;
const ROLE = new Set(["scout", "tester", "challenger"]);
const MAX_SIZE = 96 * 1024;
const MAX_SCOPES = 200;
const LEGACY_CODE = "LEGACY_FAILURE_NOT_CLASSIFIED";

function defaultAppRoot() {
  const base = process.env.LOCALAPPDATA || (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share"));
  return path.join(base, "PlotPickle");
}
async function smallJson(filename) {
  try {
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_SIZE) return { _invalid: true };
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    return { _invalid: true };
  }
}
async function listMarkers(directory) {
  try {
    const names = await readdir(directory, { withFileTypes: true });
    return Object.freeze({
      saved: names.filter((entry) => entry.isFile() && /^role-[0-2]\.json$/.test(entry.name)).map((entry) => entry.name).sort(),
      started: names.filter((entry) => entry.isFile() && /^role-[0-2]\.started\.json$/.test(entry.name)).map((entry) => entry.name).sort(),
    });
  } catch (error) {
    if (error?.code === "ENOENT") return { saved: [], started: [] };
    throw error;
  }
}

/** Read-only: no model probes, host task resume, CLI subprocess or filesystem changes. */
export async function diagnoseEngineeringLocalAttempt({ appRoot = defaultAppRoot(), exactSha,
  probePi = probeManagedPi, probeDurable = probeManagedPiDurable,
} = {}) {
  if (!path.isAbsolute(appRoot) || (exactSha && !HEAD.test(exactSha))) {
    throw new Error("Engineering diagnostic requires a private absolute app root and optional exact SHA.");
  }
  const parent = path.join(appRoot, "engineering-team", "runs");
  let entries;
  try {
    entries = await readdir(parent, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") entries = [];
    else throw error;
  }
  const choices = [];
  for (const entry of entries.filter((e) => e.isDirectory() && SCOPE.test(e.name)).slice(0, MAX_SCOPES)) {
    const folder = path.join(parent, entry.name);
    const reservation = await smallJson(path.join(folder, "reservation.json"));
    if (!reservation || reservation._invalid || reservation.scopeHash !== entry.name
      || !HEAD.test(reservation.exactSha || "") || (exactSha && exactSha !== reservation.exactSha)) continue;
    const stats = await lstat(path.join(folder, "reservation.json"));
    choices.push({ folder, scopeHash: entry.name, reservation, modified: stats.mtimeMs });
  }
  choices.sort((a, b) => b.modified - a.modified);
  const selected = choices[0];
  const piDurable = await probeDurable().then((v) => ({
    installed: v.ready === true, state: v.state || "unknown", version: v.version || null,
  }), () => ({ installed: false, state: "unproven", version: null }));
  const managedPi = await probePi().then((v) => ({
    ready: v.ready === true, state: v.ready === true ? "ready" : "unavailable",
  }), () => ({ ready: false, state: "unproven" }));
  const nativeReadiness = Object.freeze({ managedPi, managedPiDurable: piDurable, clineCli: "not-probed", localModel: "not-probed" });
  if (!selected) {
    return Object.freeze({
      schemaVersion: 1, source: "read-only-private-attempt-metadata",
      status: "no-matching-attempt", exactSha: exactSha || null,
      nativeReadiness, modelInferenceExecuted: "unknown", replayAuthorized: false,
    });
  }
  const { folder, reservation, scopeHash } = selected;
  const [failure, resumeFailure, receipt, roleMarkers] = await Promise.all([
    smallJson(path.join(folder, "failure.json")),
    smallJson(path.join(folder, "resume-failure.json")),
    smallJson(path.join(folder, "receipt.json")),
    listMarkers(path.join(folder, "durable-role-artifacts")),
  ]);
  const reason = resumeFailure || failure;
  const code = reason && CODE.test(reason.code || "") ? reason.code
    : reason ? LEGACY_CODE : "NO_RECORDED_FAILURE";
  const phase = reason && PHASE.test(reason.stage || "") ? reason.stage : "unknown";
  const startedIndexes = new Set(roleMarkers.started.map((name) => name.match(/\d+/)?.[0]));
  const savedIndexes = new Set(roleMarkers.saved.map((name) => name.match(/\d+/)?.[0]));
  const uncertainIndexes = [...startedIndexes].filter((n) => !savedIndexes.has(n));
  const failed = reason !== null;
  return Object.freeze({
    schemaVersion: 1, source: "read-only-private-attempt-metadata",
    exactSha: reservation.exactSha, scopeHash,
    campaignId: String(reservation.campaignId || "").slice(0, 160),
    executionMode: reservation.executionMode || "unknown",
    status: receipt && !receipt._invalid ? "receipt-present" : failed ? "blocked" : "reserved-unresolved",
    failureCode: code, failureStage: phase,
    failureRole: ROLE.has(reason?.role) ? reason.role : null,
    nativeReadiness,
    roleArtifacts: {
      startedCount: startedIndexes.size, savedCount: savedIndexes.size,
      uncertainCount: uncertainIndexes.length,
    },
    // A started marker is written before model dispatch, not proof an actual
    // request reached the provider. A missing marker also cannot prove no I/O.
    modelInferenceExecuted: "unknown",
    replayAuthorized: false, independentFindingVerified: false, mergeEligible: false,
    nextAction: uncertainIndexes.length
      ? "retain-uncertain-step-evidence-no-replay"
      : "inspect-failure-stage-and-provider-readiness-before-new-attempt",
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes("--latest")
    || args.length > 4
    || args.some((item, i) => !["--latest", "--json", "--head"].includes(item)
      && args[i - 1] !== "--head")) {
    throw new Error("Usage: node scripts/engineering-team/diagnose-local.mjs --latest [--json] [--head <40hex>].");
  }
  const headIndex = args.indexOf("--head");
  const exactSha = headIndex < 0 ? undefined : args[headIndex + 1];
  if (headIndex !== -1 && !HEAD.test(exactSha || "")) throw new Error("Invalid exact head argument.");
  const output = await diagnoseEngineeringLocalAttempt({ exactSha });
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write("Engineering Team read-only diagnostics unavailable; no worker was dispatched.\n");
    process.exitCode = 1;
  });
}
