#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  ensurePiInstalled,
  resolvePiLocalRuntime,
  runPiSmoke,
  runPortableCommand,
} from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(38, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

async function main() {
  const pi = await ensurePiInstalled({ allowInstall: false });
  const runtime = await resolvePiLocalRuntime();
  status("Pi coding agent", "READY", `${pi.version} · ${pi.command}`);
  status("Pi local coding model", "READY", `${runtime.model} via ${runtime.label}`);
  await runPiSmoke({ command: pi.command, runtime, purpose: "repair", timeout: 120_000 });
  status("Pi repair invocation", "PASS", "headless local-model smoke completed with no tools and no cloud fallback");

  try {
    const review = await runPortableCommand(process.execPath, ["scripts/run-pi-code-quality-review.mjs"], {
      cwd: repoRoot,
      timeout: 15 * 60_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (review.stdout) process.stdout.write(`${review.stdout}\n`);
    if (review.stderr) process.stderr.write(`${review.stderr}\n`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    status("Pi code-quality review", "WARN", `advisory review unavailable; deterministic verification authority is unchanged · ${detail.slice(-500)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
