import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const TASKS_PATH = path.join(REPO_ROOT, "config", "agent-bench", "tasks.json");
const ARTIFACT_ROOT = path.join(REPO_ROOT, ".artifacts", "agent-bench");
const SUPPORTED_AGENTS = new Set(["pi", "cline"]);
const MAX_CAPTURE = 2_000_000;

function parseArgs(argv) {
  const args = { list: false, agent: "", task: "", keep: false, skipDeps: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--list") args.list = true;
    else if (token === "--keep") args.keep = true;
    else if (token === "--skip-deps") args.skipDeps = true;
    else if (token === "--agent") args.agent = argv[++index] ?? "";
    else if (token === "--task") args.task = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function executable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function clip(text) {
  const value = String(text ?? "");
  return value.length <= MAX_CAPTURE ? value : `${value.slice(0, MAX_CAPTURE)}\n...[truncated]`;
}

function run(command, args, { cwd = REPO_ROOT, timeoutMs = 900_000, env = process.env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout.on("data", (chunk) => {
      if (stdout.length < MAX_CAPTURE) stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < MAX_CAPTURE) stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: -1, stdout: "", stderr: error.message, timedOut: false, durationMs: Date.now() - started });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? -1,
        stdout: clip(stdout),
        stderr: clip(stderr),
        timedOut,
        durationMs: Date.now() - started,
      });
    });
  });
}

function runTrustedShell(command, cwd, timeoutMs = 900_000) {
  if (process.platform === "win32") {
    return run("cmd.exe", ["/d", "/s", "/c", command], { cwd, timeoutMs });
  }
  return run("bash", ["-lc", command], { cwd, timeoutMs });
}

async function loadCatalog() {
  const catalog = JSON.parse(await readFile(TASKS_PATH, "utf8"));
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.tasks) || catalog.tasks.length === 0) {
    throw new Error("Agent Bench task catalog is invalid.");
  }
  const ids = new Set();
  for (const task of catalog.tasks) {
    if (!task.id || !task.baseSha || !task.prompt || !Array.isArray(task.verify) || task.verify.length === 0) {
      throw new Error(`Invalid benchmark task: ${task.id || "unknown"}`);
    }
    if (ids.has(task.id)) throw new Error(`Duplicate benchmark task: ${task.id}`);
    ids.add(task.id);
  }
  return catalog;
}

function printCatalog(catalog) {
  console.log("PlotPickle Agent Bench");
  for (const task of catalog.tasks) {
    console.log(`- ${task.id}: ${task.label} @ ${task.baseSha.slice(0, 12)}`);
  }
  console.log("Agents: pi, cline");
}

async function ensureCommit(sha) {
  let result = await run("git", ["cat-file", "-e", `${sha}^{commit}`], { timeoutMs: 30_000 });
  if (result.exitCode === 0) return;
  console.log(`Fetching historical benchmark commit ${sha.slice(0, 12)}...`);
  result = await run("git", ["fetch", "origin", sha], { timeoutMs: 180_000 });
  if (result.exitCode !== 0) throw new Error(`Unable to fetch benchmark base ${sha}: ${result.stderr || result.stdout}`);
}

async function createWorktree(task, runId) {
  await ensureCommit(task.baseSha);
  const root = path.join(os.tmpdir(), "plotpickle-agent-bench");
  const worktree = path.join(root, runId);
  await mkdir(root, { recursive: true });
  await rm(worktree, { recursive: true, force: true });

  const add = await run("git", ["worktree", "add", "--detach", worktree, task.baseSha], { timeoutMs: 120_000 });
  if (add.exitCode !== 0) throw new Error(`Unable to create benchmark worktree: ${add.stderr || add.stdout}`);

  // Historical tasks predate the shared developer-agent constitution. Inject the
  // current AGENTS.md as a clean baseline commit so Pi and Cline receive identical rules.
  const agents = await readFile(path.join(REPO_ROOT, "AGENTS.md"), "utf8");
  await writeFile(path.join(worktree, "AGENTS.md"), agents, "utf8");
  let git = await run("git", ["add", "AGENTS.md"], { cwd: worktree, timeoutMs: 30_000 });
  if (git.exitCode !== 0) throw new Error(`Unable to stage benchmark AGENTS.md: ${git.stderr}`);
  git = await run("git", [
    "-c", "user.name=PlotPickle Agent Bench",
    "-c", "user.email=bench@plotpickle.local",
    "commit", "--no-verify", "-m", "bench: inject current developer rules",
  ], { cwd: worktree, timeoutMs: 60_000 });
  if (git.exitCode !== 0) throw new Error(`Unable to create benchmark baseline: ${git.stderr || git.stdout}`);
  const baseline = await run("git", ["rev-parse", "HEAD"], { cwd: worktree, timeoutMs: 30_000 });
  return { worktree, baselineSha: baseline.stdout.trim() };
}

function buildAgentPrompt(task) {
  return [
    "You are running a frozen PlotPickle software-repair benchmark.",
    "Read and obey AGENTS.md before editing.",
    "Work only inside this benchmark worktree.",
    "Reproduce the defect, inspect the existing architecture and nearby tests, add or strengthen a focused regression, then make the smallest root-cause repair.",
    "Do not weaken tests, do not change unrelated features, and do not commit, push, open a PR, or merge.",
    "When finished, summarize changed files and the validation you ran.",
    "",
    `TASK: ${task.prompt}`,
  ].join("\n");
}

async function invokeAgent(agent, prompt, worktree) {
  if (agent === "pi") {
    return run(executable("pi"), ["--mode", "json", "-p", "--no-session", prompt], {
      cwd: worktree,
      timeoutMs: 1_800_000,
      env: { ...process.env, PI_TELEMETRY: "0" },
    });
  }
  if (agent === "cline") {
    return run(executable("cline"), ["--json", "-y", prompt], {
      cwd: worktree,
      timeoutMs: 1_800_000,
    });
  }
  throw new Error(`Unsupported benchmark agent: ${agent}`);
}

function summarizeJsonLines(text) {
  let jsonEvents = 0;
  let toolEvents = 0;
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 };
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const value = JSON.parse(trimmed);
      jsonEvents += 1;
      const type = String(value.type ?? value.event ?? value.kind ?? "").toLowerCase();
      if (type.includes("tool")) toolEvents += 1;
      const candidate = value.usage ?? value.message?.usage ?? value.data?.usage;
      if (candidate && typeof candidate === "object") {
        usage.inputTokens += Number(candidate.input ?? candidate.inputTokens ?? candidate.input_tokens ?? 0) || 0;
        usage.outputTokens += Number(candidate.output ?? candidate.outputTokens ?? candidate.output_tokens ?? 0) || 0;
        usage.cacheReadTokens += Number(candidate.cacheRead ?? candidate.cache_read ?? candidate.cache_read_tokens ?? 0) || 0;
        usage.cacheWriteTokens += Number(candidate.cacheWrite ?? candidate.cache_write ?? candidate.cache_write_tokens ?? 0) || 0;
        usage.cost += Number(candidate.cost ?? 0) || 0;
      }
    } catch {
      // Output is preserved verbatim; metrics are deliberately best-effort.
    }
  }
  return { jsonEvents, toolEvents, usage };
}

async function changedFiles(worktree) {
  const status = await run("git", ["status", "--porcelain=v1"], { cwd: worktree, timeoutMs: 30_000 });
  if (status.exitCode !== 0) throw new Error(`Unable to read benchmark git status: ${status.stderr}`);
  return status.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^..\s+/, "").replace(/^"|"$/g, ""));
}

async function diffCheck(worktree) {
  // Intent-to-add makes git diff --check include newly created files without committing them.
  await run("git", ["add", "-N", "--", "."], { cwd: worktree, timeoutMs: 30_000 });
  return run("git", ["diff", "--check"], { cwd: worktree, timeoutMs: 30_000 });
}

async function runVerification(task, worktree) {
  const results = [];
  for (const command of task.verify) {
    const result = await runTrustedShell(command, worktree, command.includes("npm run build") ? 900_000 : 600_000);
    results.push({ command, ...result });
    if (result.exitCode !== 0) break;
  }
  return results;
}

async function cleanupWorktree(worktree) {
  await run("git", ["worktree", "remove", "--force", worktree], { timeoutMs: 120_000 });
  await run("git", ["worktree", "prune"], { timeoutMs: 30_000 });
  await rm(worktree, { recursive: true, force: true }).catch(() => {});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = await loadCatalog();
  if (args.list) {
    printCatalog(catalog);
    return;
  }

  if (!SUPPORTED_AGENTS.has(args.agent)) throw new Error("--agent must be pi or cline.");
  const task = catalog.tasks.find((candidate) => candidate.id === args.task);
  if (!task) throw new Error("--task must name a task from --list.");

  const runId = `${task.id}-${args.agent}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const artifactDir = path.join(ARTIFACT_ROOT, runId);
  await mkdir(artifactDir, { recursive: true });

  const { worktree, baselineSha } = await createWorktree(task, runId);
  let report;
  try {
    if (!args.skipDeps) {
      console.log("Installing frozen-revision dependencies...");
      const install = await run(executable("npm"), ["ci", "--include=dev", "--no-audit", "--no-fund"], {
        cwd: worktree,
        timeoutMs: 900_000,
      });
      if (install.exitCode !== 0) throw new Error(`Benchmark dependency install failed: ${install.stderr || install.stdout}`);
    }

    const prompt = buildAgentPrompt(task);
    console.log(`Running ${args.agent} on ${task.id}...`);
    const agentResult = await invokeAgent(args.agent, prompt, worktree);
    await writeFile(path.join(artifactDir, "agent-stdout.log"), agentResult.stdout, "utf8");
    await writeFile(path.join(artifactDir, "agent-stderr.log"), agentResult.stderr, "utf8");

    const files = await changedFiles(worktree);
    const check = await diffCheck(worktree);
    const verification = await runVerification(task, worktree);
    const eventMetrics = summarizeJsonLines(agentResult.stdout);
    const testFilesChanged = files.some((file) => /^tests[\\/]/.test(file));
    const verificationPassed = verification.length === task.verify.length && verification.every((entry) => entry.exitCode === 0);
    const success = agentResult.exitCode === 0 && files.length > 0 && testFilesChanged && check.exitCode === 0 && verificationPassed;

    report = {
      schemaVersion: 1,
      runId,
      agent: args.agent,
      taskId: task.id,
      taskLabel: task.label,
      historicalIssues: task.historicalIssues ?? [],
      historicalBaseSha: task.baseSha,
      benchmarkBaselineSha: baselineSha,
      startedAt: new Date(Date.now() - agentResult.durationMs).toISOString(),
      completedAt: new Date().toISOString(),
      success,
      agent: {
        id: args.agent,
        exitCode: agentResult.exitCode,
        timedOut: agentResult.timedOut,
        durationMs: agentResult.durationMs,
        ...eventMetrics,
      },
      change: {
        files,
        fileCount: files.length,
        testFilesChanged,
        diffCheckPassed: check.exitCode === 0,
        diffCheckOutput: check.stdout || check.stderr,
      },
      verification: verification.map(({ command, exitCode, durationMs, timedOut, stdout, stderr }) => ({
        command,
        exitCode,
        durationMs,
        timedOut,
        outputTail: clip(`${stdout}\n${stderr}`).slice(-8_000),
      })),
      worktreeKept: args.keep,
      worktree: args.keep ? worktree : null,
    };

    await writeFile(path.join(artifactDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`${success ? "PASS" : "FAIL"}: ${args.agent} / ${task.id}`);
    console.log(`Report: ${path.join(artifactDir, "report.json")}`);
    if (!success) process.exitCode = 1;
  } finally {
    if (!args.keep) await cleanupWorktree(worktree);
  }
}

main().catch((error) => {
  console.error(`PlotPickle Agent Bench FAIL: ${error.message}`);
  process.exitCode = 1;
});
