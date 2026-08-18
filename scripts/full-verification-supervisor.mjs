#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS = 45_000;
export const FULL_VERIFICATION_RUNNER_OVERALL_TIMEOUT_MS = 4 * 60 * 60_000;
export const FULL_VERIFICATION_SUPERVISOR_POLL_MS = 1_000;

function commandLineValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : "";
}

function cleanDetail(value, limit = 900) {
  return String(value || "")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\/(?:home|Users)\/[^/\s]+/g, "~")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-limit);
}

function reportCleanupFailure(context, error, stderr = process.stderr) {
  const detail = cleanDetail(error instanceof Error ? error.message : String(error), 300);
  stderr?.write?.(`[verification-supervisor] cleanup ${context}: ${detail || "unknown process cleanup error"}\n`);
}

function childAlreadyClosed(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForChildClose(child, timeoutMs = 3_000) {
  if (!child || childAlreadyClosed(child)) return true;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (closed) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("close", onClose);
      resolve(closed);
    };
    const onClose = () => finish(true);
    const timer = setTimeout(() => finish(childAlreadyClosed(child)), timeoutMs);
    child.once("close", onClose);
  });
}

async function terminateProcessTree(child, stderr = process.stderr) {
  if (!child?.pid || childAlreadyClosed(child)) return;

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      let settled = false;
      let timer = null;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve();
      };
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        shell: false,
        stdio: "ignore",
      });
      timer = setTimeout(() => {
        try {
          killer.kill();
        } catch (error) {
          reportCleanupFailure(`could not stop taskkill for PID ${child.pid}`, error, stderr);
        }
        finish();
      }, 5_000);
      killer.once("error", (error) => {
        reportCleanupFailure(`could not start taskkill for PID ${child.pid}`, error, stderr);
        finish();
      });
      killer.once("close", finish);
    });
    if (await waitForChildClose(child, 3_000)) return;
    try {
      child.kill();
    } catch (error) {
      reportCleanupFailure(`could not stop PID ${child.pid} after taskkill`, error, stderr);
    }
    await waitForChildClose(child, 2_000);
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch (error) {
    reportCleanupFailure(`could not send SIGTERM to PID ${child.pid}`, error, stderr);
  }
  if (await waitForChildClose(child, 3_000)) return;
  try {
    child.kill("SIGKILL");
  } catch (error) {
    reportCleanupFailure(`could not send SIGKILL to PID ${child.pid}`, error, stderr);
  }
  await waitForChildClose(child, 2_000);
}

export async function superviseProcess({
  command,
  args = [],
  cwd = repoRoot,
  env = process.env,
  livenessTimeoutMs = FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS,
  overallTimeoutMs = FULL_VERIFICATION_RUNNER_OVERALL_TIMEOUT_MS,
  pollMs = FULL_VERIFICATION_SUPERVISOR_POLL_MS,
  stdout = process.stdout,
  stderr = process.stderr,
}) {
  const startedAt = Date.now();
  let lastActivityAt = startedAt;
  let stopping = false;
  let settled = false;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...env },
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let watchdog = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearInterval(watchdog);
      resolve({ ...result, durationMs: Date.now() - startedAt });
    };

    const forward = (chunk, stream) => {
      lastActivityAt = Date.now();
      const text = String(chunk || "");
      if (text) stream?.write?.(text);
    };

    const stop = async (reason, exitCode, detail) => {
      if (settled || stopping) return;
      stopping = true;
      stderr?.write?.(`[verification-supervisor] ${detail}\n`);
      try {
        await terminateProcessTree(child, stderr);
      } finally {
        finish({ exitCode, reason, detail });
      }
    };

    child.stdout?.on("data", (chunk) => forward(chunk, stdout));
    child.stderr?.on("data", (chunk) => forward(chunk, stderr));
    child.once("error", (error) => {
      if (stopping) return;
      finish({ exitCode: 126, reason: "spawn-error", detail: cleanDetail(error.message) || "Verification runner could not start." });
    });
    child.once("close", (code) => {
      if (stopping) return;
      const exitCode = Number.isFinite(Number(code)) ? Number(code) : 1;
      finish({ exitCode, reason: "runner-exit", detail: `Verification runner exited with code ${exitCode}.` });
    });

    const interval = Math.max(20, Number(pollMs) || FULL_VERIFICATION_SUPERVISOR_POLL_MS);
    watchdog = setInterval(() => {
      if (settled || stopping) return;
      const now = Date.now();
      if (overallTimeoutMs > 0 && now - startedAt > overallTimeoutMs) {
        void stop(
          "overall-timeout",
          125,
          `WATCHDOG overall timeout after ${Math.round(overallTimeoutMs / 1000)}s; stopping the Full Verification process tree.`,
        );
        return;
      }
      if (livenessTimeoutMs > 0 && now - lastActivityAt > livenessTimeoutMs) {
        void stop(
          "liveness-timeout",
          125,
          `WATCHDOG liveness timeout after ${Math.round(livenessTimeoutMs / 1000)}s without runner output; stopping the Full Verification process tree.`,
        );
      }
    }, interval);
  });
}

async function main() {
  const resultFile = commandLineValue("--result-file");
  if (!resultFile) throw new Error("--result-file is required.");
  const startupWaitSeconds = commandLineValue("--startup-wait-seconds") || "240";
  const runner = path.join(repoRoot, "scripts", "full-verification-progress-runner.mjs");
  const runnerArgs = [runner, "--result-file", resultFile, "--startup-wait-seconds", startupWaitSeconds];

  process.stdout.write(
    `Full Verification watchdog ........ START  independent liveness guard ${FULL_VERIFICATION_RUNNER_LIVENESS_TIMEOUT_MS / 1000}s; overall guard ${Math.round(FULL_VERIFICATION_RUNNER_OVERALL_TIMEOUT_MS / 60_000)}m\n`,
  );

  const result = await superviseProcess({ command: process.execPath, args: runnerArgs });
  if (result.reason === "runner-exit") {
    process.stdout.write(`Full Verification watchdog ........ END  runner exit ${result.exitCode}\n`);
  } else {
    process.stderr.write(`Full Verification watchdog ........ STOP  ${result.reason}\n`);
  }
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(cleanDetail(error instanceof Error ? error.stack || error.message : String(error), 1400));
    process.exitCode = 126;
  });
}
