#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  FULL_VERIFICATION_GRAPH,
  runVerificationGraph,
} from "./full-verification-graph.mjs";
import {
  terminateVerificationProcessTree,
  verificationCommandFor,
} from "./full-verification-process.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authoritativeTotal = FULL_VERIFICATION_GRAPH.filter((node) => node.authoritative).length;
export const PI_STACK_TIMEOUT_MS = 40 * 60_000;
export const PI_PREFLIGHT_TIMEOUT_MS = 20 * 60_000;
export const EXHAUSTIVE_UAT_STALL_TIMEOUT_MS = 60_000;
export const FULL_VERIFICATION_HEARTBEAT_MS = 10_000;
export const FULL_VERIFICATION_STAGE_TIMEOUT_MS = Object.freeze({
  "agent-skills-registry": 5 * 60_000,
  "agent-skills-architecture": 10 * 60_000,
  "learn-curriculum": 10 * 60_000,
  "production-build": 30 * 60_000,
  "ensure-pi-model": PI_STACK_TIMEOUT_MS,
  "pi-preflight": PI_PREFLIGHT_TIMEOUT_MS,
  "buzz-live": 10 * 60_000,
  "exhaustive-uat": 2 * 60 * 60_000,
  "writer-in-residence": 60 * 60_000,
});
export const FULL_VERIFICATION_STAGE_STALL_TIMEOUT_MS = Object.freeze({
  "exhaustive-uat": EXHAUSTIVE_UAT_STALL_TIMEOUT_MS,
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

export function verificationStallTimeoutForNode(node) {
  const timeoutMs = FULL_VERIFICATION_STAGE_STALL_TIMEOUT_MS[node?.id] || 0;
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
}

function writeChunk(prefix, stream, chunk) {
  const text = String(chunk || "");
  if (!text) return;
  for (const line of text.split(/(?<=\n)/)) if (line) stream.write(`[${prefix}] ${line}`);
}

export async function executeBoundedCommand(node, timeoutMs = 0, stallTimeoutMs = 0, options = {}) {
  const { command, args } = verificationCommandFor(node);
  const started = Date.now();
  let tail = "";
  return new Promise((resolve) => {
    let settled = false;
    let timedOut = false;
    const child = spawn(command, args, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let timer = null;
    let stallTimer = null;
    const clearTimers = () => {
      if (timer) clearTimeout(timer);
      if (stallTimer) clearTimeout(stallTimer);
      timer = null;
      stallTimer = null;
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(result);
    };
    const stopForTimeout = (kind, limitMs) => {
      if (settled || timedOut) return;
      timedOut = true;
      const timeoutSeconds = Math.round(limitMs / 1000);
      const label = kind === "stall" ? "STALL TIMEOUT" : "HOST TIMEOUT";
      const reason = kind === "stall"
        ? `${node.name} produced no progress output for ${timeoutSeconds} seconds and was stopped; independent graph stages may continue.`
        : `${node.name} exceeded its ${timeoutSeconds} second host timeout and was stopped; independent graph stages may continue.`;
      process.stderr.write(`[${node.id}] ${label} after ${timeoutSeconds}s; stopping the process tree so independent verification work can continue.\n`);
      void terminateVerificationProcessTree(child)
        .catch((error) => reportProcessCleanupFailure(`${kind} timeout cleanup for PID ${child.pid || "unknown"}`, error))
        .finally(() => finish({
          status: "FAIL",
          exitCode: 124,
          detail: reason,
          durationMs: Date.now() - started,
        }));
    };
    const armStallTimer = () => {
      if (!(stallTimeoutMs > 0) || settled || timedOut) return;
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => stopForTimeout("stall", stallTimeoutMs), stallTimeoutMs);
    };
    const capture = (chunk, stream) => {
      const text = String(chunk || "");
      tail = `${tail}${text}`.slice(-12_000);
      writeChunk(node.id, stream, text);
      armStallTimer();
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
    timer = timeoutMs > 0 ? setTimeout(() => stopForTimeout("host", timeoutMs), timeoutMs) : null;
    armStallTimer();
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
      execute: async (node, endpointContext) => {
        active.set(node.id, node.name);
        try {
          if (node.tool === "app-ready") {
            return await endpointContext.ensureReady({ startupWaitSeconds, echo: true, cwd: repoRoot });
          }
          return await executeBoundedCommand(
            node,
            verificationTimeoutForNode(node),
            verificationStallTimeoutForNode(node),
            { env: endpointContext.environment() },
          );
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
