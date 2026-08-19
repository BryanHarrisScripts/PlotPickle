#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  FULL_VERIFICATION_GRAPH,
  ensurePlotPickleReady,
  runVerificationGraph,
} from "./full-verification-graph.mjs";
import { verificationCommandFor } from "./full-verification-process.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authoritativeTotal = FULL_VERIFICATION_GRAPH.filter((node) => node.authoritative).length;
export const PI_PREFLIGHT_TIMEOUT_MS = 30_000;
export const FULL_VERIFICATION_HEARTBEAT_MS = 10_000;
export const FULL_VERIFICATION_STAGE_TIMEOUT_MS = Object.freeze({
  "agent-skills-registry": 5 * 60_000,
  "agent-skills-architecture": 10 * 60_000,
  "learn-curriculum": 10 * 60_000,
  "production-build": 30 * 60_000,
  "ensure-pi-model": 5 * 60_000,
  "pi-preflight": PI_PREFLIGHT_TIMEOUT_MS,
  "buzz-live": 10 * 60_000,
  "exhaustive-uat": 2 * 60 * 60_000,
  "writer-in-residence": 60 * 60_000,
});

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

function cleanDetail(value, limit = 1200) {
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

function reportProcessCleanupFailure(context, error) {
  const detail = cleanDetail(error instanceof Error ? error.message : String(error), 300);
  process.stderr.write(`[verification-cleanup] ${context}: ${detail || "unknown process cleanup error"}\n`);
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(Number(milliseconds) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function verificationProgressSnapshot({ completed, total = authoritativeTotal, startedAt, now = Date.now(), active = [] }) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCompleted = Math.max(0, Math.min(safeTotal, Number(completed) || 0));
  const elapsedMs = Math.max(1, Number(now) - Number(startedAt));
  const percent = Math.round((safeCompleted / safeTotal) * 100);
  const filled = Math.max(0, Math.min(20, Math.round((percent / 100) * 20)));
  const bar = `[${"#".repeat(filled)}${"-".repeat(20 - filled)}]`;
  let eta = "estimating";
  if (safeCompleted > 0 && safeCompleted < safeTotal) {
    const estimatedRemainingMs = Math.round((elapsedMs / safeCompleted) * (safeTotal - safeCompleted));
    eta = `~${formatDuration(estimatedRemainingMs)}`;
  } else if (safeCompleted >= safeTotal) {
    eta = "0:00";
  }
  return {
    line: `PROGRESS ${bar} ${safeCompleted}/${safeTotal} ${percent}% | elapsed ${formatDuration(elapsedMs)} | ETA ${eta} | active: ${active.length ? active.join(", ") : "scheduling"}`,
    percent,
    eta,
  };
}

export function verificationTimeoutForNode(node) {
  if (!node?.authoritative) return 0;
  const timeoutMs = FULL_VERIFICATION_STAGE_TIMEOUT_MS[node.id];
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Full Verification stage ${node.id || "<unknown>"} is missing a bounded host timeout.`);
  }
  return timeoutMs;
}

function commandFor(node) {
  return verificationCommandFor(node);
}

function writeChunk(prefix, stream, chunk) {
  const text = String(chunk || "");
  if (!text) return;
  for (const line of text.split(/(?<=\n)/)) if (line) stream.write(`[${prefix}] ${line}`);
}

async function executableAvailable(name) {
  const command = process.platform === "win32" ? "where.exe" : "which";
  return new Promise((resolve) => {
    let settled = false;
    const child = spawn(command, [name], { cwd: repoRoot, windowsHide: true, shell: false, stdio: "ignore" });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill();
      } catch (error) {
        reportProcessCleanupFailure(`could not stop ${name} availability probe`, error);
      }
      resolve(false);
    }, 5_000);
    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
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

async function terminateProcessTree(child) {
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
      try {
        const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
          windowsHide: true,
          shell: false,
          stdio: "ignore",
        });
        timer = setTimeout(() => {
          try { killer.kill(); } catch (error) { reportProcessCleanupFailure(`could not stop taskkill for PID ${child.pid}`, error); }
          finish();
        }, 5_000);
        killer.once("error", (error) => {
          reportProcessCleanupFailure(`could not start taskkill for PID ${child.pid}`, error);
          finish();
        });
        killer.once("close", finish);
      } catch (error) {
        reportProcessCleanupFailure(`could not start taskkill for PID ${child.pid}`, error);
        finish();
      }
    });
    const closed = await waitForChildClose(child, 3_000);
    if (!closed) {
      try { child.kill(); } catch (error) { reportProcessCleanupFailure(`could not stop PID ${child.pid} after taskkill`, error); }
      await waitForChildClose(child, 2_000);
    }
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch (error) {
    reportProcessCleanupFailure(`could not stop PID ${child.pid}`, error);
  }
  if (await waitForChildClose(child, 3_000)) return;
  try {
    child.kill("SIGKILL");
  } catch (error) {
    reportProcessCleanupFailure(`could not force-stop PID ${child.pid}`, error);
  }
  await waitForChildClose(child, 2_000);
}

export async function executeBoundedCommand(node, timeoutMs = 0) {
  const { command, args } = commandFor(node);
  const started = Date.now();
  let tail = "";
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env },
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timer = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };
    const capture = (chunk, stream) => {
      const text = String(chunk || "");
      tail = `${tail}${text}`.slice(-12_000);
      writeChunk(node.id, stream, text);
    };
    child.stdout?.on("data", (chunk) => capture(chunk, process.stdout));
    child.stderr?.on("data", (chunk) => capture(chunk, process.stderr));
    child.on("error", (error) => {
      if (timedOut) return;
      finish({ status: "FAIL", exitCode: 1, detail: cleanDetail(error.message), durationMs: Date.now() - started });
    });
    child.on("close", (code) => {
      if (timedOut) return;
      const exitCode = Number.isFinite(Number(code)) ? Number(code) : 1;
      finish({
        status: exitCode === 0 ? "PASS" : "FAIL",
        exitCode,
        detail: exitCode === 0 ? "" : cleanDetail(tail) || `Process exited with code ${exitCode}.`,
        durationMs: Date.now() - started,
      });
    });
    timer = timeoutMs > 0 ? setTimeout(() => {
      if (settled || timedOut) return;
      timedOut = true;
      const timeoutSeconds = Math.round(timeoutMs / 1000);
      process.stderr.write(`[${node.id}] HOST TIMEOUT after ${timeoutSeconds}s; stopping the process tree so independent verification work can continue.\n`);
      void terminateProcessTree(child)
        .catch((error) => reportProcessCleanupFailure(`timeout cleanup for PID ${child.pid || "unknown"}`, error))
        .finally(() => finish({
          status: "FAIL",
          exitCode: 124,
          detail: `${node.name} exceeded its ${timeoutSeconds} second host timeout and was stopped; independent graph stages may continue.`,
          durationMs: Date.now() - started,
        }));
    }, timeoutMs) : null;
  });
}

async function main() {
  const resultFile = argument("--result-file");
  if (!resultFile) throw new Error("--result-file is required.");
  const startupWaitSeconds = Number(argument("--startup-wait-seconds", "240"));
  const maxParallelism = Number(argument("--max-parallelism", process.env.PLOTPICKLE_FULL_CHECK_PARALLELISM || "3"));
  const startedAt = Date.now();
  const active = new Map();
  const completedAuthoritative = new Set();

  const printProgress = () => {
    const snapshot = verificationProgressSnapshot({
      completed: completedAuthoritative.size,
      total: authoritativeTotal,
      startedAt,
      active: [...active.values()],
    });
    process.stdout.write(`${snapshot.line}\n`);
  };

  process.stdout.write(`Full Verification progress runner ... START  heartbeat every ${FULL_VERIFICATION_HEARTBEAT_MS / 1000}s; ETA is approximate\n`);
  printProgress();
  const heartbeat = setInterval(printProgress, FULL_VERIFICATION_HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    const result = await runVerificationGraph({
      startupWaitSeconds,
      maxParallelism,
      echo: true,
      execute: async (node) => {
        active.set(node.id, node.name);
        try {
          if (node.tool === "app-ready") return await ensurePlotPickleReady({ startupWaitSeconds, echo: true });
          if (node.id === "pi-preflight" && !(await executableAvailable("pi"))) {
            return {
              status: "FAIL",
              exitCode: 2,
              detail: "Pi is not installed or not available on PATH. Full Verification will not wait on a missing repair worker.",
              durationMs: 0,
            };
          }
          return await executeBoundedCommand(node, verificationTimeoutForNode(node));
        } finally {
          active.delete(node.id);
          if (node.authoritative) completedAuthoritative.add(node.id);
        }
      },
    });

    printProgress();
    await mkdir(path.dirname(path.resolve(resultFile)), { recursive: true });
    await writeFile(path.resolve(resultFile), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    process.stdout.write(`Full Verification graph ............ ${result.deterministicResult}  peak parallel nodes ${result.maxParallelObserved}\n`);
    process.exitCode = result.deterministicResult === "PASS" ? 0 : 1;
  } finally {
    clearInterval(heartbeat);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(cleanDetail(error instanceof Error ? error.stack || error.message : String(error), 1800));
    process.exitCode = 1;
  });
}
