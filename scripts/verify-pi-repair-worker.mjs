#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ensureManagedPiInstalled } from "./pi-managed-install.mjs";
import {
  resolvePiLocalRuntime,
  runPiSmoke,
  runPortableCommand,
} from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PI_SMOKE_TIMEOUT_MS = 4 * 60_000;

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(38, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

function safePiFailure(error) {
  if (!error || typeof error !== "object") return String(error || "Pi readiness probe failed.");
  const parts = [];
  if (error.code !== undefined && error.code !== null) parts.push(`exit=${error.code}`);
  if (error.signal) parts.push(`signal=${error.signal}`);
  if (error.killed) parts.push("terminated=yes");
  const stdout = String(error.stdout || "").trim();
  const stderr = String(error.stderr || "").trim();
  if (stderr) parts.push(`stderr=${stderr.slice(-700)}`);
  if (stdout) parts.push(`stdout=${stdout.slice(-700)}`);
  if (!parts.length && error.message) parts.push(String(error.message).slice(-900));
  return parts.join(" · ") || "Pi readiness probe failed without process detail.";
}

async function main() {
  const pi = await ensureManagedPiInstalled({ allowInstall: false });
  process.env.PLOTPICKLE_PI_COMMAND = pi.command;
  const runtime = await resolvePiLocalRuntime();
  status("Pi coding agent", "READY", `${pi.version} · PlotPickle-managed · ${pi.command}`);
  status("Pi local coding model", "READY", `${runtime.model} via ${runtime.label}`);
  status("Pi repair invocation", "START", `bounded local-model proof; cold start may use up to ${PI_SMOKE_TIMEOUT_MS / 60_000} minutes`);
  await runPiSmoke({ command: pi.command, runtime, purpose: "repair", timeout: PI_SMOKE_TIMEOUT_MS });
  status("Pi repair invocation", "PASS", "managed headless local-model smoke completed with no tools and no cloud fallback");

  try {
    const review = await runPortableCommand(process.execPath, ["scripts/run-pi-code-quality-review.mjs"], {
      cwd: repoRoot,
      timeout: 15 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
      env: { PLOTPICKLE_PI_COMMAND: pi.command },
    });
    if (review.stdout) process.stdout.write(`${review.stdout}\n`);
    if (review.stderr) process.stderr.write(`${review.stderr}\n`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    status("Pi code-quality review", "WARN", `advisory review unavailable; deterministic verification authority is unchanged · ${detail.slice(-500)}`);
  }
}

main().catch((error) => {
  const detail = safePiFailure(error);
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`${message}\nPi process evidence: ${detail}`);
  process.exitCode = 1;
});
