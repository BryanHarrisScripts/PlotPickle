#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  ensurePiInstalled,
  resolveGitBash,
  runPortableCommand,
} from "./pi-worker-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(38, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

async function main() {
  const pi = await ensurePiInstalled({
    onStatus: (state, detail) => status("Pi coding agent", state, detail),
  });

  if (process.platform === "win32") {
    const bash = await resolveGitBash();
    if (!bash) {
      throw new Error("Pi is installed, but Git Bash is missing. PlotPickle requires Git for Windows/Git Bash so Pi repair commands remain Windows-native without using the WSL launcher.");
    }
    status("Pi shell", "READY", bash);
  }

  const model = await runPortableCommand(process.execPath, [
    "scripts/ensure-local-repair-model.mjs",
    "--worker", "pi",
  ], {
    cwd: repoRoot,
    timeout: 35 * 60_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (model.stdout) process.stdout.write(`${model.stdout}\n`);
  if (model.stderr) process.stderr.write(`${model.stderr}\n`);
  status("Pi repair stack", "READY", `${pi.version} · approved local coding model available`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
