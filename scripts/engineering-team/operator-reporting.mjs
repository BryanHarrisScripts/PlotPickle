import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { adjudicateEngineeringFinding } from "./contract.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const EXACT_SHA = /^[0-9a-f]{40}$/;
const ALLOWED = new Set(["observed", "blocked", "stale", "cancelled"]);
const MAX_RECORD = 512 * 1024;
const MAX_RUNS = 100;
function defaultAppRoot() {
  const root = process.env.LOCALAPPDATA || (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share"));
  return path.join(root, "PlotPickle");
}
function safeStatus(value) { return ALLOWED.has(value) ? value : "unknown"; }
function digest(value) { return createHash("sha256").update(value).digest("hex"); }

// Read-only, no model probes, BUZZ signing, GitHub calls or scheduler activation.
// A local receipt is never a substitute for independent Windows/GitHub proof.
export async function readEngineeringOperatorStatus(options = {}) {
  const appRoot = options.appRoot || defaultAppRoot();
  if (!path.isAbsolute(appRoot)) throw new Error("Engineering Team status requires an absolute private application root.");
  const root = path.join(appRoot, "engineering-team", "runs");
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") entries = [];
    else throw error;
  }
  const dirs = entries.filter((entry) => entry.isDirectory() && SHA256.test(entry.name)).slice(0, MAX_RUNS);
  const results = [];
  for (const entry of dirs) {
    const file = path.join(root, entry.name, "receipt.json");
    let info;
    try {
      info = await lstat(file);
      if (!info.isFile() || info.size > MAX_RECORD) {
        results.push({ scopeHash: entry.name, status: "unknown", reason: "invalid-file" });
        continue;
      }
      const record = JSON.parse(await readFile(file, "utf8"));
      if (!record || record.scopeHash !== entry.name || !EXACT_SHA.test(record.exactSha || "")
        || !Array.isArray(record.roleResults) || !ALLOWED.has(record.status)) {
        results.push({ scopeHash: entry.name, status: "unknown", reason: "invalid-receipt" });
        continue;
      }
      results.push({
        scopeHash: entry.name,
        exactSha: record.exactSha,
        status: safeStatus(record.status),
        roleCount: record.roleResults.length,
        observedRoles: record.roleResults.filter((role) => role.status === "observed").length,
        blockedRoles: record.roleResults.filter((role) => role.status === "blocked").length,
        localBuzzRecorded: Number(record.localBuzz?.localRecorded || 0),
        localBuzzExternalSigned: false,
        modifiedAt: info.mtime.toISOString(),
        evidenceAuthority: "advisory-local-run",
      });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      results.push({ scopeHash: entry.name, status: "unknown", reason: "unreadable-receipt" });
    }
  }
  results.sort((a, b) => String(b.modifiedAt || "").localeCompare(String(a.modifiedAt || "")));
  return Object.freeze({
    schemaVersion: 1,
    source: "local-receipt-observation-only",
    totalIndexed: results.length,
    last: results[0] || null,
    statuses: Object.freeze({
      observed: results.filter((item) => item.status === "observed").length,
      blocked: results.filter((item) => item.status === "blocked").length,
      stale: results.filter((item) => item.status === "stale").length,
      cancelled: results.filter((item) => item.status === "cancelled").length,
      unknown: results.filter((item) => item.status === "unknown").length,
    }),
    realWindowsAgentProof: "unproven",
    providerReadiness: "not-probed",
    remoteBuzzAgentSigner: "unproven",
    githubPublication: "not-authorized",
    independentFindingVerification: "not-inferred",
    continuousScheduler: "not-enabled",
    mergeEligible: false,
    runs: Object.freeze(results),
  });
}

export function draftEngineeringGithubCandidate(campaign, findingRef, observations, verifier, existingFingerprints = []) {
  if (!campaign || campaign.schemaVersion !== 1 || !EXACT_SHA.test(campaign.exactSha || "")
    || !Array.isArray(existingFingerprints) || existingFingerprints.some((value) => !SHA256.test(value))) {
    throw new Error("Engineering Team GitHub draft requires a valid scoped campaign and existing fingerprints.");
  }
  const finding = adjudicateEngineeringFinding(campaign, { findingRef, observations, verifier });
  const fingerprint = digest(JSON.stringify({
    schemaVersion: 1, repository: campaign.repository,
    taskRef: campaign.taskRef, exactSha: campaign.exactSha, findingRef: finding.findingRef,
  }));
  if (!finding.publishable || existingFingerprints.includes(fingerprint)) {
    return Object.freeze({
      exactSha: campaign.exactSha,
      findingRef: finding.findingRef,
      fingerprint,
      state: existingFingerprints.includes(fingerprint) ? "duplicate" : "blocked",
      draft: null, githubPublished: false, mergeEligible: false,
    });
  }
  // The candidate deliberately omits model prose and private source material.
  // GitHub publication remains a separate authorized existing reporter action.
  return Object.freeze({
    exactSha: campaign.exactSha,
    findingRef: finding.findingRef,
    fingerprint,
    state: "candidate-only",
    draft: Object.freeze({
      title: "Engineering Team verified finding " + finding.findingRef,
      summary: "Independent Tester, Challenger and deterministic corroboration available for exact commit " + campaign.exactSha.slice(0, 12) + ". Review private evidence before any publication.",
      taskRef: campaign.taskRef,
      sourceCommit: campaign.exactSha,
      authorizedToPublish: false,
    }),
    githubPublished: false,
    mergeEligible: false,
  });
}


async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2 || !args.includes("--status")
    || args.some((value) => value !== "--status" && value !== "--json")) {
    throw new Error("Use --status [--json] for read-only Engineering Team operator evidence.");
  }
  const result = await readEngineeringOperatorStatus();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("Engineering Team status UNKNOWN: " + String(error?.message || "read failed").slice(0, 240) + "\n");
    process.exitCode = 1;
  });
}
