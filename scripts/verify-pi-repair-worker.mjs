#!/usr/bin/env node

import process from "node:process";
import {
  ensurePiInstalled,
  resolvePiLocalRuntime,
  runPiSmoke,
} from "./pi-worker-runtime.mjs";

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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
