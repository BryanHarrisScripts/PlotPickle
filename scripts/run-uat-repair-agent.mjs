#!/usr/bin/env node

import { Agent } from "@mastra/core/agent";
import { LocalFilesystem, LocalSandbox, Workspace } from "@mastra/core/workspace";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { approvedCodingModel, rankApprovedCodingModel } from "./developer-repair-model-policy.mjs";

const exec = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const has = (name) => args.includes(name);

const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const defaultReport = path.join(localRoot, "PlotPickle", "uat-focused", "uat-findings.json");
const reportPath = path.resolve(argument("--report", defaultReport));
const requestedFingerprint = argument("--fingerprint");
const requestedIssue = argument("--issue");
const explicitEndpoint = argument("--endpoint", process.env.PLOTPICKLE_REPAIR_ENDPOINT || "");
const explicitModel = argument("--model", process.env.PLOTPICKLE_REPAIR_MODEL || "");
const requestedWorker = argument("--worker", process.env.PLOTPICKLE_REPAIR_WORKER || "pi").toLowerCase();
const keepWorktree = has("--keep-worktree");
const dryRun = has("--dry-run");
const preflightOnly = has("--preflight");
const preflightJson = has("--json");
const requireReady = has("--require-ready");

const SUPPORTED_REPAIR_WORKERS = new Set(["pi", "cline", "mastra-qwen"]);
const REPAIR_WORKER_LABELS = {
  pi: "Pi",
  cline: "Cline",
  "mastra-qwen": "Mastra legacy Qwen",
};

export const UAT_REPAIR_MODEL = {
  label: "Qwen3.8-27B",
  expectedNameFragments: ["qwen3.8-27b", "qwen-3.8-27b", "qwen_qwen3.8-27b", "qwen/qwen3.8-27b"],
  purpose: "On-demand PlotPickle repository repair and coding agent",
};

const APPROVED_LOCAL_CODING_MODEL_FRAGMENTS = [
  "qwen2.5-coder-7b",
  "qwen2.5coder7b",
  "qwen2.5-coder-14b",
  "qwen2.5coder14b",
  ...UAT_REPAIR_MODEL.expectedNameFragments,
  "qwen3-coder-30b",
  "qwen3coder30b",
  "qwen2.5-coder-32b",
  "qwen2.5coder32b",
  "devstral-small",
  "devstralsmall",
  "codestral",
  "deepseek-coder",
  "deepseekcoder",
  "gpt-oss-20b",
  "gptoss20b",
];

const RUNTIME_CANDIDATES = [
  { kind: "lm-studio", label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
  { kind: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
  { kind: "llama.cpp", label: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1" },
  { kind: "openai-compatible", label: "OpenAI-compatible", baseUrl: "http://127.0.0.1:8000/v1" },
];

function modelKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchesRepairModel(model) {
  const key = modelKey(model);
  return UAT_REPAIR_MODEL.expectedNameFragments.some((fragment) => key.includes(modelKey(fragment)));
}

function matchesApprovedCodingModel(model) {
  const key = modelKey(model);
  return approvedCodingModel(model) || APPROVED_LOCAL_CODING_MODEL_FRAGMENTS.some((fragment) => key.includes(modelKey(fragment)));
}

function normalizedEndpoint(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  return /\/v1$/i.test(raw) ? raw : `${raw}/v1`;
}

function safeCliModelId(value) {
  const model = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:/+\-]+$/.test(model)) throw new Error(`Local model id contains unsupported shell characters: ${model}`);
  return model;
}

async function probeRuntime(candidate) {
  const baseUrl = normalizedEndpoint(candidate.baseUrl);
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return { ...candidate, baseUrl, reachable: false, models: [], error: `HTTP ${response.status}` };
    const body = await response.json();
    const models = Array.isArray(body?.data)
      ? body.data.flatMap((item) => typeof item?.id === "string" ? [item.id] : [])
      : [];
    return { ...candidate, baseUrl, reachable: true, models, error: "" };
  } catch (error) {
    return { ...candidate, baseUrl, reachable: false, models: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function probeAllRuntimes() {
  return Promise.all(RUNTIME_CANDIDATES.map((candidate) => probeRuntime(candidate)));
}

export async function resolveRepairRuntime(worker = requestedWorker) {
  if (explicitEndpoint && explicitModel) {
    const valid = worker === "mastra-qwen" ? matchesRepairModel(explicitModel) : matchesApprovedCodingModel(explicitModel);
    if (!valid) throw new Error(`The requested local repair model is not approved for ${REPAIR_WORKER_LABELS[worker] || worker}: ${explicitModel}`);
    return {
      kind: "explicit",
      label: "Explicit local runtime",
      baseUrl: normalizedEndpoint(explicitEndpoint),
      model: safeCliModelId(explicitModel),
    };
  }

  const probes = await probeAllRuntimes();
  const matcher = worker === "mastra-qwen" ? matchesRepairModel : matchesApprovedCodingModel;
  const candidates = probes.flatMap((runtime) => runtime.reachable
    ? runtime.models.filter(matcher).map((model) => ({ ...runtime, model: safeCliModelId(model) }))
    : []);
  if (worker !== "mastra-qwen") candidates.sort((a, b) => rankApprovedCodingModel(a.model) - rankApprovedCodingModel(b.model));
  if (candidates.length) return candidates[0];

  const reachable = probes.filter((item) => item.reachable)
    .map((item) => `${item.label}: ${item.models.length ? item.models.join(", ") : "no models reported"}`)
    .join("\n");
  const modelMessage = worker === "mastra-qwen"
    ? "Qwen3.8-27B is not available to the PlotPickle UAT Repair Agent."
    : "No approved local coding model is available to the PlotPickle developer repair worker.";
  throw new Error([
    modelMessage,
    "Run node scripts/ensure-local-repair-model.mjs --worker pi to load an already-installed approved coding model. Qwen2.5-Coder 7B is accepted as the lightweight Pi option; PlotPickle will not download a model silently.",
    "PlotPickle will not silently downgrade UAT repair work to the Fast or Quality story models and will not fall through to a paid/cloud provider.",
    reachable ? `Reachable runtimes:\n${reachable}` : "No supported local OpenAI-compatible runtime answered /v1/models.",
  ].join("\n"));
}

async function run(command, commandArgs, options = {}) {
  const result = await exec(command, commandArgs, {
    cwd: options.cwd || repoRoot,
    env: { ...process.env, ...(options.env || {}) },
    windowsHide: true,
    shell: options.shell === true,
    timeout: options.timeout || 0,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

async function runCli(command, commandArgs, options = {}) {
  return run(command, commandArgs, { ...options, shell: process.platform === "win32" });
}

async function commandAvailable(worker) {
  try {
    if (worker === "pi") await runCli("pi", ["--version"], { timeout: 10_000 });
    else if (worker === "cline") await runCli("cline", ["version"], { timeout: 10_000 });
    return true;
  } catch {
    return worker === "mastra-qwen";
  }
}

export async function repairPreflight(worker = requestedWorker) {
  if (!SUPPORTED_REPAIR_WORKERS.has(worker)) {
    return { ready: false, worker, workerLabel: worker, workerAvailable: false, message: `Unsupported repair worker: ${worker}` };
  }
  const workerAvailable = await commandAvailable(worker);
  if (!workerAvailable) {
    return { ready: false, worker, workerLabel: REPAIR_WORKER_LABELS[worker], workerAvailable: false, message: `${REPAIR_WORKER_LABELS[worker]} is not installed or not available on PATH.` };
  }
  try {
    const runtime = await resolveRepairRuntime(worker);
    return { ready: true, worker, workerLabel: REPAIR_WORKER_LABELS[worker], workerAvailable: true, runtime };
  } catch (error) {
    return { ready: false, worker, workerLabel: REPAIR_WORKER_LABELS[worker], workerAvailable: true, message: error instanceof Error ? error.message : String(error) };
  }
}

async function gh(...ghArgs) {
  return (await run("gh", ghArgs)).stdout;
}

function issueMarker(fingerprint) {
  return `<!-- plotpickle-uat-fingerprint:${fingerprint} -->`;
}

async function findIssueForFingerprint(fingerprint) {
  if (requestedIssue) {
    const raw = await gh("issue", "view", requestedIssue, "--repo", "BryanHarrisScripts/PlotPickle", "--json", "number,title,body,url");
    return JSON.parse(raw);
  }
  const raw = await gh("issue", "list", "--repo", "BryanHarrisScripts/PlotPickle", "--state", "open", "--label", "uat:autopilot", "--limit", "100", "--json", "number,title,body,url");
  const issues = JSON.parse(raw || "[]");
  return issues.find((issue) => String(issue.body || "").includes(issueMarker(fingerprint))) || null;
}

async function loadFinding() {
  if (requestedIssue && !requestedFingerprint) {
    const issue = await findIssueForFingerprint("");
    if (!issue) throw new Error(`GitHub issue #${requestedIssue} was not found.`);
    const marker = String(issue.body || "").match(/plotpickle-uat-fingerprint:([^\s>]+)/)?.[1] || `issue-${issue.number}`;
    return {
      fingerprint: marker,
      title: issue.title.replace(/^\[UAT\]\s*/i, ""),
      area: "github-uat-issue",
      severity: "blocker",
      message: issue.body || issue.title,
      evidence: { issueNumber: issue.number, issueUrl: issue.url },
    };
  }

  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const finding = requestedFingerprint
    ? findings.find((item) => item.fingerprint === requestedFingerprint)
    : findings[0];
  if (!finding) throw new Error(requestedFingerprint
    ? `Finding ${requestedFingerprint} was not present in ${reportPath}.`
    : `No UAT blocker was present in ${reportPath}.`);
  return finding;
}

function slug(value) {
  return String(value || "uat-repair").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "uat-repair";
}

async function prepareWorktree(finding) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const branch = `uat/repair-agent-${slug(finding.fingerprint)}-${stamp}`;
  const worktreeRoot = path.join(localRoot, "PlotPickle", "uat-repair-worktrees", `${slug(finding.fingerprint)}-${stamp}`);
  await mkdir(path.dirname(worktreeRoot), { recursive: true });
  await run("git", ["fetch", "origin", "main"]);
  await run("git", ["worktree", "add", "-b", branch, worktreeRoot, "origin/main"]);
  return { branch, worktreeRoot };
}

function repairInstructions() {
  return [
    "You are PlotPickle's UAT Repair Agent, a repository coding agent.",
    "Work only inside the isolated git worktree provided as your workspace.",
    "Your job is to turn one concrete UAT blocker into a tested code repair.",
    "First inspect the finding and reproduce the failure from existing evidence or tests.",
    "Before changing product behavior, add or strengthen a focused regression that fails for the reported defect.",
    "Then find the smallest architectural root cause and repair it without weakening existing UAT assertions.",
    "Run the relevant regression and nearby focused tests after edits; keep iterating until they pass.",
    "Do not edit generated dependencies, node_modules, credentials, user story data, or UAT evidence to hide a failure.",
    "Do not commit, push, open/merge/close pull requests, change GitHub issues, or change branches. The deterministic wrapper owns git/GitHub state.",
    "Do not use network access except the local model endpoint already provided by the runtime.",
    "Do not merely describe a fix: use the workspace file and command tools to inspect, edit, and test the repository.",
    "Finish with a concise summary of root cause, files changed, regression added, and tests you ran.",
  ].join("\n");
}

function repairPrompt(finding) {
  return [
    repairInstructions(),
    "",
    "Repair this PlotPickle UAT blocker.",
    "",
    `Fingerprint: ${finding.fingerprint}`,
    `Area: ${finding.area || "focused-uat"}`,
    `Severity: ${finding.severity || "blocker"}`,
    `Title: ${finding.title || finding.fingerprint}`,
    "",
    "Observed failure:",
    finding.message || "Focused UAT reported a blocker.",
    "",
    "Evidence:",
    JSON.stringify(finding.evidence || {}, null, 2),
    "",
    "Required repair sequence: reproduce -> regression first -> root-cause fix -> relevant tests.",
  ].join("\n");
}

async function runMastraAgent({ finding, runtime, worktreeRoot }) {
  const filesystem = new LocalFilesystem({
    basePath: worktreeRoot,
    instructions: "This is an isolated PlotPickle UAT repair worktree. Never read or write outside it.",
  });
  const sandbox = new LocalSandbox({
    workingDirectory: worktreeRoot,
    instructions: "Run only repository inspection, build, and test commands. Do not run git push/commit/merge or network/install commands.",
  });
  const workspace = new Workspace({ filesystem, sandbox });
  const agent = new Agent({
    id: "uat-repair-agent",
    name: "PlotPickle UAT Repair Agent",
    description: "Repairs PlotPickle UAT blockers inside an isolated local repository worktree.",
    instructions: repairInstructions(),
    model: {
      providerId: `plotpickle-${runtime.kind}`,
      modelId: runtime.model,
      url: runtime.baseUrl,
      apiKey: "plotpickle-local",
    },
    workspace,
    maxRetries: 1,
  });

  const result = await agent.generate(repairPrompt(finding), {
    maxSteps: 48,
    modelSettings: { temperature: 0.1 },
  });
  return String(result.text || "").trim();
}

async function writeExternalPrompt(finding, worktreeRoot) {
  const promptPath = path.join(worktreeRoot, ".plotpickle-uat-repair.md");
  await writeFile(promptPath, `${repairPrompt(finding)}\n`, "utf8");
  return promptPath;
}

async function configurePiRuntime(runtime) {
  const agentDir = path.join(localRoot, "PlotPickle", "developer-agent", "pi-repair");
  await mkdir(agentDir, { recursive: true });
  const models = {
    providers: {
      "plotpickle-local": {
        baseUrl: runtime.baseUrl,
        api: "openai-completions",
        apiKey: "plotpickle-local",
        compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
        models: [{
          id: runtime.model,
          name: `PlotPickle Repair — ${runtime.model}`,
          reasoning: false,
          input: ["text"],
          contextWindow: 131072,
          maxTokens: 16384,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        }],
      },
    },
  };
  await writeFile(path.join(agentDir, "models.json"), `${JSON.stringify(models, null, 2)}\n`, "utf8");
  return agentDir;
}

async function runPiAgent({ finding, runtime, worktreeRoot }) {
  const promptPath = await writeExternalPrompt(finding, worktreeRoot);
  const agentDir = await configurePiRuntime(runtime);
  try {
    const result = await runCli("pi", [
      "--mode", "json",
      "-p",
      "--no-session",
      "--provider", "plotpickle-local",
      "--model", runtime.model,
      "Read .plotpickle-uat-repair.md and execute every repair instruction in that file.",
    ], {
      cwd: worktreeRoot,
      timeout: 1_800_000,
      env: {
        PI_CODING_AGENT_DIR: agentDir,
        PI_OFFLINE: "1",
        PI_SKIP_VERSION_CHECK: "1",
        PI_TELEMETRY: "0",
      },
    });
    return result.stdout;
  } finally {
    await unlink(promptPath).catch(() => {});
  }
}

async function configureClineRuntime(runtime) {
  const dataDir = path.join(localRoot, "PlotPickle", "developer-agent", "cline-repair");
  await mkdir(dataDir, { recursive: true });
  await runCli("cline", [
    "--data-dir", dataDir,
    "auth",
    "--provider", "openai-native",
    "--apikey", "plotpickle-local",
    "--modelid", runtime.model,
    "--baseurl", runtime.baseUrl,
  ], { timeout: 30_000 });
  return dataDir;
}

async function runClineAgent({ finding, runtime, worktreeRoot }) {
  const promptPath = await writeExternalPrompt(finding, worktreeRoot);
  const dataDir = await configureClineRuntime(runtime);
  try {
    const result = await runCli("cline", [
      "--data-dir", dataDir,
      "--json",
      "--yolo",
      "--cwd", worktreeRoot,
      "-P", "openai-native",
      "-m", runtime.model,
      "-k", "plotpickle-local",
      "Read .plotpickle-uat-repair.md and execute every repair instruction in that file.",
    ], { cwd: worktreeRoot, timeout: 1_800_000 });
    return result.stdout;
  } finally {
    await unlink(promptPath).catch(() => {});
  }
}

async function runAgent({ finding, runtime, worktreeRoot, worker }) {
  if (worker === "pi") return runPiAgent({ finding, runtime, worktreeRoot });
  if (worker === "cline") return runClineAgent({ finding, runtime, worktreeRoot });
  return runMastraAgent({ finding, runtime, worktreeRoot });
}

async function validateRepair(worktreeRoot) {
  await run("git", ["diff", "--check"], { cwd: worktreeRoot });
  const status = (await run("git", ["status", "--porcelain"], { cwd: worktreeRoot })).stdout;
  if (!status) throw new Error("The UAT Repair Agent completed without changing the worktree.");

  await run(process.execPath, ["scripts/run-uat-autopilot.mjs", "--contracts-only", "--artifact-root", ".artifacts/uat-repair"], { cwd: worktreeRoot });
  await runCli("npm", ["run", "build"], { cwd: worktreeRoot });
  return status;
}

async function publishRepair({ finding, branch, worktreeRoot, summary, runtime, worker }) {
  const issue = await findIssueForFingerprint(finding.fingerprint);
  await run("git", ["add", "-A"], { cwd: worktreeRoot });
  await run("git", ["commit", "-m", `Repair UAT finding ${finding.fingerprint}`], { cwd: worktreeRoot });
  await run("git", ["push", "-u", "origin", branch], { cwd: worktreeRoot });

  const workerLabel = REPAIR_WORKER_LABELS[worker];
  const body = [
    `Automated local UAT repair for \`${finding.fingerprint}\`.`,
    issue?.number ? `\nCloses #${issue.number}.` : "",
    "",
    `**Repair worker:** ${workerLabel}`,
    `**Runtime:** ${runtime.label}`,
    `**Resolved local model:** \`${runtime.model}\``,
    "",
    "### Repair agent summary",
    summary || "The local repair worker changed the worktree and the deterministic validation wrapper passed.",
    "",
    "### Deterministic gates run before this PR",
    "- `git diff --check`",
    "- focused UAT contract registry",
    "- production build",
    "",
    "This PR is deliberately opened as a draft. GitHub CI remains the merge gate; the repair agent never merges its own work.",
  ].filter(Boolean).join("\n");

  const prUrl = await gh(
    "pr", "create",
    "--draft",
    "--repo", "BryanHarrisScripts/PlotPickle",
    "--base", "main",
    "--head", branch,
    "--title", `Repair UAT: ${finding.title || finding.fingerprint}`,
    "--body", body,
  );
  if (issue?.number) {
    await gh("issue", "comment", String(issue.number), "--repo", "BryanHarrisScripts/PlotPickle", "--body", `Local ${workerLabel} repair worker produced a tested draft repair PR: ${prUrl}`);
  }
  return { prUrl, issue };
}

async function writeRepairReport(payload) {
  const dir = path.join(localRoot, "PlotPickle", "uat-focused", "repairs");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slug(payload.finding.fingerprint)}-${Date.now()}.json`);
  await writeFile(file, `${JSON.stringify({
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    finding: payload.finding,
    worker: payload.worker,
    workerLabel: REPAIR_WORKER_LABELS[payload.worker],
    model: payload.runtime.model,
    runtime: { kind: payload.runtime.kind, label: payload.runtime.label, baseUrl: payload.runtime.baseUrl, model: payload.runtime.model },
    branch: payload.branch,
    prUrl: payload.prUrl || "",
    issueNumber: payload.issue?.number || null,
    agentSummary: payload.summary || "",
    operationalMetadataOnly: true,
    hiddenReasoningStored: false,
  }, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  const preflight = await repairPreflight(requestedWorker);
  if (preflightOnly) {
    if (preflightJson) process.stdout.write(`${JSON.stringify(preflight)}\n`);
    else if (preflight.ready) process.stdout.write(`Developer repair worker ............. READY  ${preflight.workerLabel} / ${preflight.runtime.model} via ${preflight.runtime.label}\n`);
    else process.stdout.write(`Developer repair worker ............. NOT READY  ${preflight.workerLabel}: ${String(preflight.message || "local coding model unavailable").split("\n")[0]}\n`);
    if (requireReady && !preflight.ready) process.exitCode = 2;
    return;
  }
  if (!preflight.ready) throw new Error(preflight.message || `${preflight.workerLabel} repair worker is not ready.`);

  const finding = await loadFinding();
  const runtime = preflight.runtime;
  const worker = preflight.worker;
  process.stdout.write(`Developer repair worker ............. READY  ${preflight.workerLabel}\n`);
  process.stdout.write(`UAT Repair Agent model ............. READY  ${runtime.model} via ${runtime.label}\n`);
  process.stdout.write(`UAT finding ........................ READY  ${finding.fingerprint}\n`);

  await gh("auth", "status", "--hostname", "github.com");
  const { branch, worktreeRoot } = await prepareWorktree(finding);
  let summary = "";
  let published = null;
  try {
    process.stdout.write(`Repair worktree .................... READY  ${worktreeRoot}\n`);
    if (dryRun) {
      process.stdout.write("Dry run requested; no model execution or repository modification was performed.\n");
      return;
    }

    await runCli("npm", ["ci", "--include=dev", "--no-audit", "--no-fund"], { cwd: worktreeRoot });
    summary = await runAgent({ finding, runtime, worktreeRoot, worker });
    process.stdout.write("UAT Repair Agent ................... COMPLETE\n");
    await validateRepair(worktreeRoot);
    process.stdout.write("Repair validation .................. PASS  focused UAT + production build\n");
    published = await publishRepair({ finding, branch, worktreeRoot, summary, runtime, worker });
    process.stdout.write(`Draft repair PR .................... CREATED  ${published.prUrl}\n`);
    const report = await writeRepairReport({ finding, runtime, branch, summary, worker, ...published });
    process.stdout.write(`Repair evidence .................... SAVED  ${report}\n`);
  } finally {
    if (!keepWorktree) {
      try { await run("git", ["worktree", "remove", "--force", worktreeRoot]); } catch {}
      try { await rm(worktreeRoot, { recursive: true, force: true }); } catch {}
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
