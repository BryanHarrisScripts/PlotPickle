#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
import { recordEngineeringLocalHandoffs } from "./buzz-experiment.mjs";
import { driveEngineeringDurableCheckpoint } from "./durable-checkpoint.mjs";
import { createClineEngineeringPlanAdapter } from "./cline-plan-adapter.mjs";

const exec = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const SHA = /^[a-f0-9]{40}$/i;
const TASK = /^[a-z0-9][a-z0-9._:/-]{1,119}$/i;
const MODES = new Set(["structured", "lossy"]);
const ROLES = new Set(["scout", "tester", "challenger"]);
const keys = new Set(["--head", "--base", "--task", "--mode", "--roles", "--attempt", "--challenger"]);
const sha256 = (text) => createHash("sha256").update(text).digest("hex");


const SAFE_FAILURE_STAGES = new Set([
  "adapter-selection", "native-runtime-open", "native-task-admit",
  "native-task-resume", "native-task-wait", "native-receipt-check",
  "role-started", "role-dispatch", "role-saved", "local-buzz",
]);
const SAFE_ROLES = new Set(["scout", "tester", "challenger"]);

export function classifyEngineeringFailure(error, phase = "unknown") {
  // Do not persist arbitrary exception text: subprocess stderr can contain
  // API keys, model prompts, private source or account-specific paths.
  const message = String(error?.message || "");
  let code = "EXECUTION_FAILED_UNKNOWN";
  if (/Pi Durable .*unavailable|managed Pi Durable .*not installed|not-installed/.test(message)) code = "PI_DURABLE_UNAVAILABLE";
  else if (/required read-only role adapter is unavailable/.test(message)) code = "REVIEW_ADAPTER_UNAVAILABLE";
  else if (/Cline managed CLI version|reviewed pin/.test(message)) code = "CLINE_VERSION_MISMATCH";
  else if (/Cline did not complete a usable/.test(message)) code = "CLINE_RESULT_UNAVAILABLE";
  else if (/Cline found no bounded ordinary source/.test(message)) code = "CLINE_NO_REVIEWABLE_SOURCE";
  else if (/checkpoint failed integrity|scope\/route validation|scope changed|stale/.test(message)) code = "CHECKPOINT_OR_SCOPE_INVALID";
  else if (error?.code === "EEXIST") code = "UNCERTAIN_STEP_REPLAY_DENIED";
  else if (/cancelled|aborted/i.test(message)) code = "CANCELLED";
  else if (/head changed|head differs/.test(message)) code = "STALE_HEAD";
  else if (/did not finish with a completed checkpoint/.test(message)) code = "NATIVE_TASK_NOT_COMPLETED";
  return Object.freeze({
    code,
    stage: SAFE_FAILURE_STAGES.has(phase) ? phase : "unknown",
    reasonClass: "safe-operational-code-only",
    modelRequestState: "unknown",
    replayAuthorized: false,
    mergeEligible: false,
  });
}

export function parseEngineeringCommand(args) {
  if (!Array.isArray(args) || !args.includes("--run")) {
    throw new Error("Explicit --run is required; no agent or QA executes from startup or a status probe.");
  }
  const values = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === "--run" || token === "--buzz-local" || token === "--durable" || token === "--resume") continue;
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
  const challenger = String(values["--challenger"] ?? "pi");
  if (!["pi", "cline"].includes(challenger)) throw new Error("Engineering Team challenger must be pi or cline.");
  if (challenger === "cline" && !args.includes("--durable")) throw new Error("Independent Cline reviewer requires --durable admission.");
  const attempt = Number(values["--attempt"] ?? 1);
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > 9) throw new Error("Engineering Team attempt must be 1-9.");
  if (args.includes("--resume") && !args.includes("--durable")) throw new Error("Engineering Team explicit resume requires --durable.");
  for (const flag of ["--run", "--buzz-local", "--durable", "--resume"]) {
    if (args.filter((arg) => arg === flag).length > 1) throw new Error("Engineering Team repeat flag not allowed.");
  }
  return Object.freeze({ head, base, task, mode, roles, attempt,
    buzzLocal: args.includes("--buzz-local"), durable: args.includes("--durable"), resume: args.includes("--resume"), challenger });
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
      + "-" + config.mode + "-" + config.attempt + (config.challenger === "cline" ? "-cline" : ""),
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
  // Existing attempts never automatically replay. Durable recovery requires
  // explicit --resume, the same base/head/scope and an incomplete prior result.
  const reservationPath = path.join(runDir, "reservation.json");
  if (config.resume) {
    const previous = JSON.parse(await readFile(reservationPath, "utf8"));
    if (previous.campaignId !== campaign.campaignId || previous.scopeHash !== campaign.scopeHash
      || previous.exactSha !== campaign.exactSha || previous.baseSha !== config.base
      || previous.executionMode !== "durable" || previous.state !== "reserved") {
      throw new Error("Engineering Team durable recovery reservation is stale or mismatched.");
    }
    try {
      await readFile(path.join(runDir, "receipt.json"), "utf8");
      throw new Error("Engineering Team completed attempt cannot be resumed.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  } else {
    await writeFile(reservationPath, JSON.stringify({
      schemaVersion: 1, campaignId: campaign.campaignId, exactSha: campaign.exactSha,
      baseSha: config.base, scopeHash: campaign.scopeHash,
      executionMode: config.durable ? "durable" : "direct",
      state: "reserved",
    }) + "\n", { flag: config.resume ? "w" : "wx", mode: 0o600 });
  }
  const artifactRoot = path.join(runDir, "focused-uat");
  const buildAdapters = options.buildAdapters || (async () => {
    const adapters = { tester: createFocusedUatEngineeringAdapter({ repoRoot, artifactRoot }) };
    if (campaign.roles.includes("scout") || campaign.roles.includes("challenger")) {
      try {
        const runtime = await resolvePiLocalRuntime();
        const needsPi = campaign.roles.includes("scout") || (campaign.roles.includes("challenger") && config.challenger !== "cline");
        if (needsPi) {
          const pi = await probeManagedPi();
          if (pi.ready) {
            for (const role of ["scout", "challenger"]) {
              if (!campaign.roles.includes(role) || (role === "challenger" && config.challenger === "cline")) continue;
              adapters[role] = createPiEngineeringReadOnlyAdapter({
                role, repoRoot, command: pi.command, runtime, changedPaths: checkout.changedPaths,
              });
            }
          }
        }
        if (campaign.roles.includes("challenger") && config.challenger === "cline") {
          adapters.challenger = createClineEngineeringPlanAdapter({
            role: "challenger", repoRoot, privateRoot: path.join(runDir, "cline-challenger"),
            runtime, changedPaths: checkout.changedPaths,
          });
        }
      } catch {
        // Provider resolution, path or CLI errors are not evidence of an available reviewer.
        options.onAdapterBlocked?.("independent-reviewer-or-local-model-unavailable");
      }
    }
    return adapters;
  });
  let result;
  let localBuzz = null;
  let phase = "adapter-selection";
  let currentRole = "";
  const onStage = (nextPhase, role = "") => {
    phase = SAFE_FAILURE_STAGES.has(nextPhase) ? nextPhase : "unknown";
    currentRole = SAFE_ROLES.has(role) ? role : "";
  };
  try {
    const adapters = await buildAdapters({ campaign, checkout, repoRoot, artifactRoot });
    const execution = {
      getExactHead: options.getExactHead || (async () => (await inspect()).head),
      adapters, signal: options.signal, onStage,
    };
    result = config.durable
      ? await (options.driveDurable || driveEngineeringDurableCheckpoint)(campaign, { ...execution, runDir })
      : await executeEngineeringTeam(campaign, execution);
    if (config.buzzLocal && result.status === "observed") {
      onStage("local-buzz");
      localBuzz = await recordEngineeringLocalHandoffs(campaign, result, {
        localRoot: path.join(root, "buzz-local-backbone"),
      });
    }
  } catch (error) {
    const classified = classifyEngineeringFailure(error, phase);
    const privateRecord = {
      schemaVersion: 2, campaignId: campaign.campaignId,
      exactSha: campaign.exactSha, scopeHash: campaign.scopeHash,
      state: "blocked", ...classified,
      role: currentRole || null, sourceMutationAllowed: false,
    };
    await writeFile(path.join(runDir, config.resume ? "resume-failure.json" : "failure.json"),
      JSON.stringify(privateRecord) + "\n", { flag: config.resume ? "w" : "wx", mode: 0o600 });
    throw new Error("Engineering Team blocked [" + classified.code + "] at "
      + classified.stage + (currentRole ? " (" + currentRole + ")" : "")
      + ". Read-only inspect: node scripts/engineering-diagnostics.mjs --latest.");
  }
  const receipt = {
    ...result,
    evidenceClass: "on-demand-local-execution",
    durableRecoveryProven: false,
    durableCheckpointAdmitted: result.durableCheckpointAdmitted === true,
    independentlyVerified: false,
    signedExternalBuzzProven: false,
    localBuzz,
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
