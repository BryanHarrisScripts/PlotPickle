#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  discoverChangedFiles,
  loadDiagnosticsRegistry,
  planChangedTests,
  renderPlan,
  runAndSummarize,
} from "./index.mjs";

function parseArguments(argv) {
  const options = { files: [], execute: true, base: null, head: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan" || arg === "--dry-run") options.execute = false;
    else if (arg === "--base") options.base = argv[++index] || null;
    else if (arg === "--head") options.head = argv[++index] || null;
    else if (arg === "--files") {
      options.files.push(...String(argv[++index] || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean));
    } else if (arg.startsWith("--files=")) {
      options.files.push(...arg.slice("--files=".length).split(/[,\n]/).map((item) => item.trim()).filter(Boolean));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function main() {
  const root = process.cwd();
  const registry = await loadDiagnosticsRegistry(root);
  const options = parseArguments(process.argv.slice(2));
  const discovered = await discoverChangedFiles(root, options);
  const plan = planChangedTests(discovered.files, registry, discovered);
  const reportDirectory = path.resolve(root, registry.reportDirectory);
  await mkdir(reportDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(reportDirectory, "changed-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8"),
    writeFile(path.join(reportDirectory, "changed-plan.md"), renderPlan(plan), "utf8"),
  ]);

  process.stdout.write(renderPlan(plan));
  if (plan.safeFallback) {
    process.exitCode = 2;
    return;
  }
  if (!options.execute) return;

  const [command, ...args] = plan.command;
  const { exitCode } = await runAndSummarize(command, args, {
    root,
    registry,
    plan,
    reportDirectory: registry.reportDirectory,
  });
  process.exitCode = exitCode;
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
