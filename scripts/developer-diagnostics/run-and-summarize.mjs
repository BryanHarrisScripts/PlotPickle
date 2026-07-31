#!/usr/bin/env node

import process from "node:process";
import { loadDiagnosticsRegistry, runAndSummarize } from "./index.mjs";

function splitCommand(argv) {
  const separator = argv.indexOf("--");
  if (separator === -1 || separator === argv.length - 1) {
    throw new Error("Usage: node scripts/developer-diagnostics/run-and-summarize.mjs -- <command> [args...]");
  }
  return argv.slice(separator + 1);
}

async function main() {
  const root = process.cwd();
  const registry = await loadDiagnosticsRegistry(root);
  const [command, ...args] = splitCommand(process.argv.slice(2));
  const { exitCode } = await runAndSummarize(command, args, {
    root,
    registry,
    reportDirectory: registry.reportDirectory,
  });
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
