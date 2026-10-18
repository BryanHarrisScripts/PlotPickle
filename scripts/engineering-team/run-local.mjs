#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { admitEngineeringCampaign } from "./contract.mjs";
import { executeEngineeringTeam } from "./execution.mjs";
import { createFocusedUatEngineeringAdapter, createPiEngineeringReadOnlyAdapter } from "./local-adapters.mjs";
import { probeManagedPi } from "../pi-managed-install.mjs";
import { resolvePiLocalRuntime } from "../pi-worker-runtime.mjs";

const exec = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SHA = /^[a-f0-9]{40}$/i;
const TASK = /^[a-z0-9][a-z0-9._:/-]{1,119}$/i;
const MODES = new Set(["structured", "lossy"]);
const ROLES = new Set(["scout", "tester", "challenger"]);
const keys = new Set(["--head", "--base", "--task", "--mode", "--roles", "--attempt"]);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function parseEngineeringCommand(args) {
  if (!Array.isArray(args) || !args.includes("--run")) {
    throw new Error("Explicit --run is required; no agent or QA executes from startup or a status probe.");
  }
  const values = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "--run") continue;
    if (!keys.has(token) || values[token] !== undefined || !args[i + 1] || args[i + 1].startsWith("--")) {
      throw new Error("Engineering Team command contains unsupported, repeated or missing arguments.");
    }
    values[token] = args[++i];
  }
  const head = String(values["--head"] ?? "").toLowerCase();
  if (!SHA.test(head)) throw new Error("Engineering Team command requires the 40-character exact --head SHA.");
  const base = String(values["--base"] ?? "").toLowerCase();
  if (!SHA.test(base) || base === head) throw new Error("Engineering Team requires a different exact --base SHA for full change scope.");
  const task = String(values["--task"] ?? "");
  if (!TASK.test(task)) throw new Error("Engineering Team command requires a bounded --task issue/PR reference.");
  const mode = String(values["--mode"] ?? "structured");
  if (!MODES.has(mode)) throw new Error("Engineering Team mode must be structured or lossy.");
  const roles = String(values["--roles"] ?? "scout,tester,challenger").split(",").filter(Boolean);
  if (roles.length < 2 || roles.length > 3 || new Set(roles).size !== roles.length || roles.some((role) => !ROLES.has(role))) {
    throw new Error("Engineering Team live adapter roles must be Scout, Tester and/or Challenger, without duplicates.");
  }
  if (!roles.includes("tester") || !roles.includes("challenger") || roles.includes("repairer")) {
    throw new Error("Engineering Team live run requires independent Tester and Challenger; repair has separate authority.");
  }
  const attempt = Number(values["--attempt"] ?? 1);
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 9) throw new Error("Engineering Team attempt must be 1-9.");
  return Object.freeze({ head, base, task, mode, roles, attempt });
}

export async function inspectEngineeringCheckout({ repoRoot = REPO, base, runGit = async (args) =>
  (await exec("git", args, { cwd: repoRoot, timeout: 30_000, maxBuffer: 512_000, windowsHide: true })).stdout
}) {
  const head = String(await runGit(["rev-parse", "HEAD"])).trim().toLowerCase();
  if (!SHA.test(head)) throw new Error("Engineering Team checkout has no exact Git commit.");
  const dirty = String(await runGit(["status", "--porcelain", "--untracked-files=no"])).trim();
  if (dirty) throw new Error("Engineering Team requires a clean tracked source checkout or an isolated worktree.");
  if (!SHA.test(base || "") || base.toLowerCase() === head) throw new Error("Engineering Team checkout requires an exact prior base SHA.");
  const common = String(await runGit(["merge-base", base, head])).trim().toLowerCase();
  if (common !== base.toLowerCase()) throw new Error("Engineering Team base SHA is not an ancestor of the tested head.");
  const changed = String(await runGit(["diff", "--name-only", base, head])).trim();
  const paths = [...new Set(changed.split(/\r?\n/).map((s) => s.trim().replaceAll("\\", "/")).filter((s) => /^[\w./-]{1,240}$/.test(s)))].slice(0, 20);
  return Object.freeze({ head, changedPaths: Object.freeze(paths) });
}

function localAppRoot() {
  if (process.env.LOCALAPPDATA) return path.resolve(process.env.LOCALAPPDATA, "PlotPickle");
  return process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local", "PlotPickle")
    : path.join(os.homedir(), ".local", "share", "PlotPickle");
}

export async function runExplicitEngineeringCampaign(config, options = {}) {
  const repoRoot = options.repoRoot || REPO;
  const inspect = options.inspect || (() => inspectEngineeringCheckout({ repoRoot, base: config.base }));
  const checkout = await inspect();
  if (checkout.head !== config.head) throw new Error("Engineering Team checkout head differs from explicitly selected commit.");
  if (!SHA.test(config.base || "") || config.base === config.head) throw new Error("Engineering Team requires a distinct exact base SHA.");
  const campaign = admitEngineeringCampaign({
    campaignId: "eng-" + config.head.slice(0, 12) + "-" + sha256(config.task).slice(0, 12)
      + "-" + config.mode + "-" + config.attempt,
    taskRef: config.task,
    exactSha: config.head,
    repository: "BryanHarrisScripts/PlotPickle",
    mode: config.mode,
    roles: config.roles,
    budget: {
      maxRoleRuns: config.roles.length,
      maxMessages: 8,
      maxSummaryChars: 800,
      maxDurationMs: 30 * 60_000,
      maxCloudCostUsd: 0,
    },
  });
  const root = options.appRoot || localAppRoot();
  const runDir = path.join(root, "engineering-team", "runs", campaign.scopeHash);
  await mkdir(runDir, { recursive: true, mode: 0o700 });
  // Exclusive reservation: after a crash an existing run is never silently
  // replayed (including local Pi prompts). Host-owned Pi Durable recovery is
  // a distinct, not-yet-implemented phase of #3098.
  await writeFile(path.join(runDir, "reservation.json"), JSON.stringify({
    schemaVersion: 1,
    campaignId: campaign.campaignId,
    exactSha: campaign.exactSha,
    scopeHash: campaign.scopeHash,
    state: "reserved",
  }) + "\n", { flag: "wx", mode: 0o600 });
  const artifactRoot = path.join(runDir, "focused-uat");
  const buildAdapters = options.buildAdapters || (async () => {
    const adapters = { tester: createFocusedUatEngineeringAdapter({ repoRoot, artifactRoot }) };
    if (campaign.roles.includes("scout") || campaign.roles.includes("challenger")) {
      try {
        const pi = await probeManagedPi();
        if (pi.ready) {
          const runtime = await resolvePiLocalRuntime();
          for (const role of ["scout", "challenger"]) {
            if (!campaign.roles.includes(role)) continue;
            adapters[role] = createPiEngineeringReadOnlyAdapter({
              role, repoRoot, command: pi.command, runtime, changedPaths: checkout.changedPaths,
            });
          }
        }
      } catch {
        // No local model or private Pi install means role BLOCKED, never a
        // silent cloud fallback or a registry-only synthetic success.
      }
    }
    return adapters;
  });
  let result;
  try {
    const adapters = await buildAdapters({ campaign, checkout, repoRoot, artifactRoot });
    result = await executeEngineeringTeam(campaign, {
      getExactHead: options.getExactHead || (async () => (await inspect()).head),
      adapters,
      signal: options.signal,
    });
  } catch {
    await writeFile(path.join(runDir, "failure.json"), JSON.stringify({
      campaignId: campaign.campaignId, state: "blocked", reason: "execution-or-evidence-failure",
      sourceMutationAllowed: false, mergeEligible: false,
    }) + "\n", { flag: "wx", mode: 0o600 });
    throw new Error("Engineering Team run was blocked; the reserved attempt cannot automatically replay.");
  }
  const receipt = {
    ...result,
    evidenceClass: "on-demand-local-execution",
    durableRecoveryProven: false,
    independentlyVerified: false,
    signedExternalBuzzProven: false,
  };
  const temporary = path.join(runDir, "receipt.tmp");
  await writeFile(temporary, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const { rename } = await import("node:fs/promises");
  await rename(temporary, path.join(runDir, "receipt.json"));
  return Object.freeze({ receipt, evidenceDirectory: runDir });
}

async function main() {
  const config = parseEngineeringCommand(process.argv.slice(2));
  const result = await runExplicitEngineeringCampaign(config);
  process.stdout.write(JSON.stringify({
    campaignId: result.receipt.campaignId,
    exactSha: result.receipt.exactSha,
    status: result.receipt.status,
    roleResults: result.receipt.roleResults,
    independentlyVerified: false,
    externalPublication: false,
    evidenceDirectory: result.evidenceDirectory,
  }, null, 2) + "\n");
  if (result.receipt.status !== "observed") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("Engineering Team blocked: " + String(error?.message || "Unknown failure").slice(0, 240) + "\n");
    process.exitCode = 1;
  });
}
