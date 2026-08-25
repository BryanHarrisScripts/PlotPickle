#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadCasebook } from "./casebook-contract.mjs";
import { createBusinessCaseRegistry, executeBusinessCaseContributions } from "./casebook/business-case-registry.mjs";
import { installedBusinessCaseContributions } from "./casebook/installed-contributions.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function flag(name) {
  return argv.includes(name);
}

function printContribution(item) {
  const state = item.migrationState === "legacy" ? "legacy-adapter" : "1:1-contract";
  process.stdout.write(`${item.businessCaseId}\t${item.ownerId}\t${item.capability}\t${state}\t${item.title}\n`);
}

function runAttendedCase(contribution) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "run-casebook-attended.mjs"), "--case", contribution.businessCaseId], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", (error) => resolve({ status: "fail", error: error.message }));
    child.once("exit", (code, signal) => resolve({
      status: code === 0 ? "pass" : "fail",
      exitCode: code,
      signal: signal || null,
    }));
  });
}

export async function discoverBusinessCaseRegistry() {
  const casebook = await loadCasebook();
  return createBusinessCaseRegistry(installedBusinessCaseContributions(casebook));
}

export function selectorFromArgs(args = argv) {
  const read = (name) => {
    const index = args.indexOf(name);
    return index >= 0 && index + 1 < args.length ? args[index + 1] : "";
  };
  return {
    businessCaseId: read("--case") || read("--retry"),
    ownerId: read("--plugin") || read("--owner"),
    capability: read("--capability"),
  };
}

async function main() {
  const registry = await discoverBusinessCaseRegistry();
  const selector = selectorFromArgs();
  const selected = registry.list(selector);

  if (flag("--list") || (!flag("--attended") && !flag("--release"))) {
    for (const item of selected) printContribution(item);
    if (!selected.length) process.exitCode = 2;
    return;
  }

  if (!selected.length) throw new Error("No installed Business Case matched the requested selector.");
  if (!flag("--release") && !selector.businessCaseId && !selector.ownerId && !selector.capability) {
    throw new Error("Execution requires --case, --retry, --plugin/--owner, --capability, or --release.");
  }

  const results = await executeBusinessCaseContributions({
    registry,
    selector,
    execute: runAttendedCase,
  });

  process.stdout.write("\nBusiness Case results\n");
  for (const result of results) process.stdout.write(`${result.businessCaseId}\t${String(result.status).toUpperCase()}\n`);
  if (results.some((result) => result.status !== "pass")) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  });
}
