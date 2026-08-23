import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const envFile = process.argv[2];
if (!envFile) {
  console.error("windows-source-sync requires an output .cmd path");
  process.exit(2);
}

const root = process.cwd();
const LOCAL_GIT_TIMEOUT_MS = 5_000;
const NETWORK_GIT_TIMEOUT_MS = 8_000;
const gitEnvironment = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GCM_INTERACTIVE: "Never",
};
const result = {
  mode: "download",
  updated: "0",
  sha: "unknown",
  branch: "unknown",
  message: "This PlotPickle copy is not a Git checkout; source updates remain manual.",
};

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
    timeout: options.timeoutMs ?? LOCAL_GIT_TIMEOUT_MS,
    windowsHide: true,
    env: gitEnvironment,
  }).trim();
}

function gitOk(args) {
  try {
    execFileSync("git", args, {
      cwd: root,
      stdio: "ignore",
      timeout: LOCAL_GIT_TIMEOUT_MS,
      windowsHide: true,
      env: gitEnvironment,
    });
    return true;
  } catch {
    return false;
  }
}

function quoteCmd(value) {
  return String(value).replaceAll("%", "%%").replaceAll('"', '""');
}

function writeEnv() {
  const lines = [
    `set "PLOTPICKLE_SOURCE_MODE=${quoteCmd(result.mode)}"`,
    `set "PLOTPICKLE_SOURCE_UPDATED=${quoteCmd(result.updated)}"`,
    `set "PLOTPICKLE_SOURCE_SHA=${quoteCmd(result.sha)}"`,
    `set "PLOTPICKLE_SOURCE_BRANCH=${quoteCmd(result.branch)}"`,
    `set "PLOTPICKLE_SOURCE_MESSAGE=${quoteCmd(result.message)}"`,
  ];
  writeFileSync(resolve(envFile), `${lines.join("\r\n")}\r\n`, "utf8");
}

try {
  if (!existsSync(resolve(root, ".git"))) {
    writeEnv();
    process.exit(0);
  }

  if (!gitOk(["--version"])) {
    result.mode = "git-unavailable";
    result.message = "Git metadata exists, but git.exe is unavailable; continuing without automatic source update.";
    writeEnv();
    process.exit(0);
  }

  result.branch = git(["branch", "--show-current"], { quiet: true }) || "detached";
  result.sha = git(["rev-parse", "--short=12", "HEAD"], { quiet: true }) || "unknown";

  if (result.branch !== "main") {
    result.mode = "non-main";
    result.message = `Source update skipped because this checkout is on ${result.branch}, not main.`;
    writeEnv();
    process.exit(0);
  }

  // Preserve tracked local work. Git's fast-forward also refuses to overwrite
  // a conflicting untracked path, so this check never discards user files.
  const dirty = git(["status", "--porcelain", "--untracked-files=no"], { quiet: true });
  if (dirty) {
    result.mode = "dirty";
    result.message = "Source update skipped because this checkout has tracked local changes; nothing was overwritten.";
    writeEnv();
    process.exit(0);
  }

  result.mode = "git";
  try {
    git(["fetch", "--quiet", "origin", "main"], {
      quiet: true,
      timeoutMs: NETWORK_GIT_TIMEOUT_MS,
    });
  } catch {
    result.mode = "fetch-failed";
    result.message = "Could not check GitHub for a newer main branch; continuing with the current local source.";
    writeEnv();
    process.exit(0);
  }

  const head = git(["rev-parse", "HEAD"], { quiet: true });
  const remote = git(["rev-parse", "origin/main"], { quiet: true });
  if (head === remote) {
    result.sha = head.slice(0, 12);
    result.message = `Source is current at ${result.sha}.`;
    writeEnv();
    process.exit(0);
  }

  if (!gitOk(["merge-base", "--is-ancestor", "HEAD", "origin/main"])) {
    result.mode = "diverged";
    result.message = "Local main is not a clean fast-forward of origin/main; automatic update was skipped.";
    writeEnv();
    process.exit(0);
  }

  git(["merge", "--ff-only", "origin/main"], { quiet: true });
  const nextHead = git(["rev-parse", "HEAD"], { quiet: true });
  result.updated = "1";
  result.sha = nextHead.slice(0, 12);
  result.message = `Updated PlotPickle to current main at ${result.sha}.`;
  writeEnv();
} catch (error) {
  result.mode = "sync-error";
  result.message = `Source check could not finish: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}`;
  writeEnv();
}
