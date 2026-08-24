#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : "";
}

function settingsRepositoryPath() {
  const localAppData = process.env.LOCALAPPDATA || (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share"));
  const settingsPath = path.join(localAppData, "PlotPickle", "DeveloperWorkbench", "settings.json");
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    return String(parsed?.repositoryPath || "").trim();
  } catch {
    return "";
  }
}

function resolveRepository() {
  const candidate = path.resolve(argument("--repository") || settingsRepositoryPath() || process.cwd());
  if (!existsSync(path.join(candidate, "package.json")) || !existsSync(path.join(candidate, "AGENTS.md"))) {
    throw new Error(`PlotPickle repository not found at ${candidate}. Launch the Workbench and choose Local repo first, or pass --repository <path>.`);
  }
  return candidate;
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: "inherit",
      windowsHide: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit ${code}`}.`));
    });
  });
}

async function main() {
  const repository = resolveRepository();
  const steps = [
    ["Changed-test selection", ["scripts/developer-diagnostics/test-changed.mjs"]],
    ["BEN deterministic code quality", ["scripts/run-ben-code-quality.mjs"]],
    ["Production build", ["scripts/build-verified.mjs"]],
  ];

  process.stdout.write(`PlotPickle Developer Workbench local pre-CI validation\nRepository: ${repository}\n\n`);
  for (const [label, args] of steps) {
    process.stdout.write(`=== ${label} ===\n`);
    await run(process.execPath, args, repository);
    process.stdout.write(`PASS: ${label}\n\n`);
  }
  process.stdout.write("LOCAL PRE-CI GREEN\nChanged tests, BEN, and production build passed locally. GitHub Actions should now be used as the independent exact-head release gate.\n");
}

main().catch((error) => {
  console.error(`LOCAL PRE-CI RED\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
