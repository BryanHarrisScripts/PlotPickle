#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { emitEvidence, explainPlan, planVerification, runLayer } from "../lib/verification/verification-core.mjs";

const root = process.cwd();
const readJson = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));

async function loadConfiguration() {
  const [architecture, phase0Inventory, vocabulary, catalog, ownership] = await Promise.all([
    readJson("architecture/plotpickle.architecture.json"),
    readJson("config/verification/phase-0-inventory.json"),
    readJson("config/verification/phase-1-vocabulary.json"),
    readJson("config/verification/test-catalog.json"),
    readJson("config/verification/ownership-map.json"),
  ]);
  return { architecture, phase0Inventory, vocabulary, catalog, ownership };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {
    command,
    changedFiles: [],
    mode: "impact",
    platform: process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux",
    allowHeavy: false,
    allowNetwork: false,
    allowNative: false,
    allowSecrets: false,
    json: false,
    layerId: null,
    baseRef: null,
    commitSha: null,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = () => rest[++index];
    if (arg === "--changed-file") options.changedFiles.push(next());
    else if (arg === "--base-ref") options.baseRef = next();
    else if (arg === "--mode") options.mode = next();
    else if (arg === "--platform") options.platform = next();
    else if (arg === "--commit-sha") options.commitSha = next();
    else if (arg === "--allow-heavy") options.allowHeavy = true;
    else if (arg === "--allow-network") options.allowNetwork = true;
    else if (arg === "--allow-native") options.allowNative = true;
    else if (arg === "--allow-secrets") options.allowSecrets = true;
    else if (arg === "--json") options.json = true;
    else if (!arg.startsWith("--") && command === "run-layer" && !options.layerId) options.layerId = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function resolveChangedFiles(options) {
  if (options.changedFiles.length > 0) return options.changedFiles;
  if (!options.baseRef) return [];
  const output = runGit(["diff", "--name-only", `${options.baseRef}...HEAD`]);
  return output ? output.split(/\r?\n/u).filter(Boolean) : [];
}

function resolveCommitSha(options) {
  return options.commitSha ?? runGit(["rev-parse", "HEAD"]);
}

function spawnChecked(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", shell: false });
  return result.status === 0 ? "pass" : "fail";
}

function typedRunners() {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const runEach = (command, prefix = []) => async ({ entry }) => {
    const started = Date.now();
    let result = "pass";
    for (const target of entry.runner.targets) {
      if (spawnChecked(command, [...prefix, target]) === "fail") {
        result = "fail";
        break;
      }
    }
    return { result, durationMs: Date.now() - started, artifacts: [], security: {} };
  };

  return {
    "node-test": async ({ entry }) => {
      const started = Date.now();
      const result = spawnChecked(process.execPath, ["--test", ...entry.runner.targets]);
      return { result, durationMs: Date.now() - started, artifacts: [], security: {} };
    },
    "node-script": runEach(process.execPath),
    "npm-script": runEach(npmCommand, ["run"]),
    build: runEach(npmCommand, ["run"]),
  };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/verification-core.mjs plan [--changed-file PATH ... | --base-ref REF] [--json]",
    "  node scripts/verification-core.mjs explain [--changed-file PATH ... | --base-ref REF]",
    "  node scripts/verification-core.mjs run-layer LAYER_ID [--changed-file PATH ... | --base-ref REF] [permissions]",
    "",
    "Permissions: --allow-heavy --allow-network --allow-native --allow-secrets",
    "Modes: --mode impact|release|scheduled|manual",
  ].join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!new Set(["plan", "explain", "run-layer"]).has(options.command)) {
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  if (options.command === "run-layer" && !options.layerId) throw new Error("run-layer requires a layer ID");

  const configuration = await loadConfiguration();
  const changedFiles = resolveChangedFiles(options);
  const plan = planVerification({
    ...configuration,
    changedFiles,
    mode: options.mode,
    platform: options.platform,
    allowHeavy: options.allowHeavy,
    allowNetwork: options.allowNetwork,
    allowNative: options.allowNative,
    allowSecrets: options.allowSecrets,
  });

  if (options.command === "plan") {
    console.log(options.json ? JSON.stringify(plan, null, 2) : explainPlan(plan));
    if (plan.status === "blocked") process.exitCode = 3;
    return;
  }

  if (options.command === "explain") {
    console.log(explainPlan(plan));
    if (plan.status === "blocked") process.exitCode = 3;
    return;
  }

  if (plan.status === "blocked") {
    console.error(explainPlan(plan));
    process.exitCode = 3;
    return;
  }

  const started = Date.now();
  const run = await runLayer({ plan, catalog: configuration.catalog, layerId: options.layerId, runners: typedRunners(), context: { source: "local-cli" } });
  const evidence = emitEvidence({
    plan,
    catalog: configuration.catalog,
    architecture: configuration.architecture,
    layerId: options.layerId,
    commitSha: resolveCommitSha(options),
    run,
    runtime: { platform: options.platform, runner: "local-cli", nodeVersion: process.version },
    durationMs: Date.now() - started,
  });
  const artifactDir = path.join(root, ".artifacts", "verification");
  await mkdir(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `${options.layerId}.json`);
  await writeFile(artifactPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ run, evidencePath: path.relative(root, artifactPath).replaceAll("\\", "/") }, null, 2));
  if (run.result === "fail") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
