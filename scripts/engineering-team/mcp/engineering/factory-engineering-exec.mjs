/**
 * #3110: opt-in authenticated engineering runner for staged PR source.
 *
 * The owner chooses the scope by staging an exact PR head with the existing
 * factory-pr-stage receipt. This runner accepts a repository task, not a raw
 * PowerShell -Command string or arbitrary Windows filesystem location.
 * It runs in that private worktree, never the owner's clean main checkout.
 */
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { terminateVerificationProcessTree } from "../../../full-verification-process.mjs";
import { inspectFactoryCandidatePr, readFactoryVerificationHead } from "../factory-named-tests.mjs";

const exec = promisify(execFile);
const SHA = /^[a-f0-9]{40}$/u;
const REQUEST = /^[a-f0-9]{32}$/u;
const NAME = /^[A-Za-z][A-Za-z0-9:_-]{0,79}$/u;
const RELATIVE = /^(?:tests|scripts)\/[A-Za-z0-9_./-]{1,220}$/u;
const ARG = /^[A-Za-z0-9_.,:=/@+-]{1,128}$/u;
const MODES = Object.freeze([
  "git-diff-check", "node-test", "node-script",
  "powershell-file", "npm-script", "npm-install",
]);
const result = (code, sourceHead = null, extra = {}) => Object.freeze({
  state: "BLOCKED", code, sourceHead, replayAuthorized: false,
  independentVerification: false, modelInvoked: false, ...extra,
});
export const ENGINEERING_MODES = MODES;

export function validEngineeringSelection(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return false;
  if (Object.keys(args).some(k => ![
    "requestId", "expectedHead", "stageRequestId", "candidatePrNumber",
    "candidateHead", "mode", "target", "scriptArgs",
  ].includes(k))) return false;
  if (!REQUEST.test(args.requestId || "") || !REQUEST.test(args.stageRequestId || "") ||
      args.requestId === args.stageRequestId ||
      !SHA.test(args.expectedHead || "") || !SHA.test(args.candidateHead || "") ||
      !Number.isSafeInteger(args.candidatePrNumber) ||
      args.candidatePrNumber < 1 || args.candidatePrNumber > 9999999 ||
      !MODES.includes(args.mode)) return false;
  if (!Array.isArray(args.scriptArgs) || args.scriptArgs.length > 8 ||
      !args.scriptArgs.every(s => typeof s === "string" && ARG.test(s))) return false;
  if (args.mode === "git-diff-check" || args.mode === "npm-install")
    return args.target === undefined && args.scriptArgs.length === 0;
  if (args.mode === "npm-script")
    return typeof args.target === "string" && NAME.test(args.target);
  if (typeof args.target !== "string" || !RELATIVE.test(args.target) ||
      args.target.split("/").includes("..") ||
      args.target.split("/").includes(".")) return false;
  if (args.mode === "node-test")
    return args.target.startsWith("tests/") && args.target.endsWith(".test.mjs");
  if (args.mode === "node-script")
    return args.target.startsWith("scripts/") && /\.(?:mjs|cjs|js)$/u.test(args.target);
  return args.target.startsWith("scripts/") && args.target.endsWith(".ps1");
}

function safeEnv(stage) {
  const keys = process.platform === "win32"
    ? ["PATH", "Path", "SystemRoot", "WINDIR", "PATHEXT", "ComSpec", "PSModulePath", "TEMP", "TMP"]
    : ["PATH", "TMPDIR"];
  const env = Object.fromEntries(keys.filter(k => typeof process.env[k] === "string")
    .map(k => [k, process.env[k]]));
  // Do not inherit factory control, API, account, model or creative-story secrets.
  env.CI = "1";
  env.GIT_TERMINAL_PROMPT = "0";
  env.GIT_LFS_SKIP_SMUDGE = "1";
  env.PLOTPICKLE_FACTORY_ENGINEERING_STAGE = "1";
  env.npm_config_audit = "false";
  env.npm_config_fund = "false";
  env.npm_config_update_notifier = "false";
  env.HOME = stage;
  env.USERPROFILE = stage;
  env.APPDATA = path.join(stage, ".artifacts", "engineering-appdata");
  env.LOCALAPPDATA = path.join(stage, ".artifacts", "engineering-localappdata");
  return env;
}

export function sanitizeEngineeringOutput(output) {
  if (typeof output !== "string") return "";
  return output
    .replace(/[A-Za-z]:\\Users\\[^\\\r\n]+/giu, "[USER_PATH]")
    .replace(/(?:token|secret|password|passphrase|api[_-]?key)\s*[:=]\s*\S+/giu,
      "[REDACTED_CREDENTIAL]")
    .replace(/(?:sk|ghp|gho|github_pat)-?[A-Za-z0-9_-]{20,}/gu, "[REDACTED_TOKEN]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "")
    .slice(-2048);
}

export async function executeOwnedEngineeringCommand({
  program, argv, cwd, timeoutMs = 240_000, launch = spawn,
  stop = terminateVerificationProcessTree,
} = {}) {
  let child;
  try {
    child = launch(program, argv, {
      cwd, env: safeEnv(cwd), shell: false,
      windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return { exitCode: null, timedOut: false, stopVerified: true, output: "" };
  }
  return await new Promise(resolve => {
    let settled = false, data = "", timedOut = false;
    const settle = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ...value, output: sanitizeEngineeringOutput(data) });
    };
    const collect = chunk => {
      data = (data + String(chunk)).slice(-8192);
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    child.once("error", () => settle({
      exitCode: null, timedOut: false, stopVerified: true,
    }));
    child.once("close", code => {
      if (!timedOut) settle({
        exitCode: Number.isInteger(code) ? code : null,
        timedOut: false, stopVerified: true,
      });
    });
    const timer = setTimeout(async () => {
      if (settled) return;
      timedOut = true;
      try {
        await stop(child, { stderr: { write() {} } });
        settle({ exitCode: null, timedOut: true, stopVerified:
          child.exitCode !== null || child.signalCode !== null });
      } catch {
        settle({ exitCode: null, timedOut: true, stopVerified: false });
      }
    }, timeoutMs);
  });
}

async function gitRead(args, cwd) {
  const output = await exec("git", args, {
    cwd, windowsHide: true, timeout: 30_000, maxBuffer: 24_000,
    encoding: "utf8",
  });
  return String(output.stdout || "").trim();
}

function invocation(selection, stage, nodePath = process.execPath) {
  if (selection.mode === "git-diff-check") return {
    program: "git", argv: [
      "diff", "--check", selection.expectedHead, selection.candidateHead,
    ],
  };
  if (selection.mode === "npm-script" || selection.mode === "npm-install") {
    const npmCli = path.join(path.dirname(nodePath), "node_modules", "npm", "bin", "npm-cli.js");
    if (!existsSync(npmCli)) return null;
    return { program: nodePath, argv: selection.mode === "npm-install"
      ? [npmCli, "ci", "--ignore-scripts", "--include=dev", "--no-audit", "--no-fund"]
      : [npmCli, "run", selection.target, "--", ...selection.scriptArgs] };
  }
  const filename = path.join(stage, ...selection.target.split("/"));
  if (selection.mode === "powershell-file") return {
    program: "powershell.exe",
    argv: ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", filename, ...selection.scriptArgs],
  };
  if (selection.mode === "node-test") return {
    program: nodePath, argv: ["--test", filename, ...selection.scriptArgs],
  };
  return { program: nodePath, argv: [filename, ...selection.scriptArgs] };
}

/**
 * Test one independently staged, exact-head PR. This is engineering execution,
 * not independent Windows/browser product assurance or a merge decision.
 */
export async function runStagedEngineeringTask({
  selection, root, repoRoot, stageReceipt, platform = process.platform,
  verifyHead = readFactoryVerificationHead,
  inspectPr = inspectFactoryCandidatePr,
  git = gitRead, execute = executeOwnedEngineeringCommand,
  fs = { lstat, realpath }, nodePath = process.execPath,
} = {}) {
  const a = selection;
  if (!validEngineeringSelection(a)) return result("ENGINEERING_SELECTION_INVALID");
  if (platform !== "win32") return result("WINDOWS_ONLY");
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      typeof repoRoot !== "string" || !path.isAbsolute(repoRoot))
    return result("ENGINEERING_STAGE_INVALID");
  if (stageReceipt?.state !== "TEST_PASSED" ||
      stageReceipt?.code !== "CANDIDATE_STATIC_STAGED" ||
      stageReceipt?.stageId !== a.stageRequestId ||
      stageReceipt?.sourceHead !== a.expectedHead ||
      stageReceipt?.candidatePrNumber !== a.candidatePrNumber ||
      stageReceipt?.candidateHead !== a.candidateHead)
    return result("ENGINEERING_STAGE_RECEIPT_INVALID", a.expectedHead);
  const stage = path.join(root, "chat-candidate-stages", a.stageRequestId);
  try {
    const [baseInfo, stageInfo, resolved] = await Promise.all([
      fs.lstat(path.dirname(stage)), fs.lstat(stage), fs.realpath(stage),
    ]);
    if (!baseInfo.isDirectory() || baseInfo.isSymbolicLink() ||
        !stageInfo.isDirectory() || stageInfo.isSymbolicLink() ||
        path.normalize(resolved).toLowerCase() !== path.normalize(stage).toLowerCase())
      return result("ENGINEERING_STAGE_INVALID", a.expectedHead);
    if (a.target) {
      const filename = path.join(stage, ...a.target.split("/"));
      const targetInfo = await fs.lstat(filename);
      const targetRealpath = await fs.realpath(filename);
      if (!targetInfo.isFile() || targetInfo.isSymbolicLink() ||
          !path.normalize(targetRealpath).toLowerCase().startsWith(
            path.normalize(stage + path.sep).toLowerCase()))
        return result("ENGINEERING_TARGET_INVALID", a.expectedHead);
    }
  } catch { return result("ENGINEERING_STAGE_INVALID", a.expectedHead); }

  const attest = async () => {
    if (await verifyHead({ repoRoot }) !== a.expectedHead) return false;
    const remote = await inspectPr({
      prNumber: a.candidatePrNumber, candidateHead: a.candidateHead,
      expectedHead: a.expectedHead, repoRoot, platform, verifyHead,
    });
    if (remote?.state !== "TEST_PASSED" ||
        remote?.code !== "CANDIDATE_HEAD_VERIFIED") return false;
    return await git(["rev-parse", "HEAD"], stage) === a.candidateHead &&
      await git(["status", "--porcelain", "--untracked-files=no"], stage) === "";
  };
  try { if (!await attest()) return result("ENGINEERING_SOURCE_CHANGED", a.expectedHead); }
  catch { return result("ENGINEERING_SOURCE_UNVERIFIED", a.expectedHead); }

  const command = invocation(a, stage, nodePath);
  if (!command) return result("ENGINEERING_EXECUTABLE_UNAVAILABLE", a.expectedHead);
  const started = Date.now();
  let execution;
  try { execution = await execute({ ...command, cwd: stage, timeoutMs: 240_000 }); }
  catch { return result("ENGINEERING_EXECUTION_UNCONFIRMED", a.expectedHead); }
  const durationMs = Math.max(0, Date.now() - started);
  if (execution?.timedOut) return result(
    execution.stopVerified === true ? "ENGINEERING_TASK_TIMEOUT" : "ENGINEERING_STOP_UNVERIFIED",
    a.expectedHead,
  );
  try { if (!await attest()) return result("ENGINEERING_SOURCE_CHANGED", a.expectedHead); }
  catch { return result("ENGINEERING_SOURCE_UNVERIFIED", a.expectedHead); }
  const passed = execution?.exitCode === 0;
  const text = sanitizeEngineeringOutput(execution?.output);
  return Object.freeze({
    state: passed ? "TEST_PASSED" : "TEST_FAILED",
    code: passed ? "ENGINEERING_TASK_PASSED" : "ENGINEERING_TASK_FAILED",
    sourceHead: a.expectedHead, candidateHead: a.candidateHead,
    candidatePrNumber: a.candidatePrNumber, stageId: a.stageRequestId,
    mode: a.mode, target: a.target || null,
    exitCode: Number.isInteger(execution?.exitCode) ? execution.exitCode : null,
    durationMs, outputDigest: createHash("sha256").update(text).digest("hex"),
    diagnostic: passed ? null : text,
    independentVerification: false, modelInvoked: null, replayAuthorized: false,
  });
}
