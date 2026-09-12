#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { emitEvidence, planVerification, runLayer } from "../lib/verification/verification-core.mjs";

const root = process.cwd();
const artifactRoot = path.join(root, ".artifacts", "verification-shadow");
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
  const [layerId, ...rest] = argv;
  const options = { layerId: layerId || null, baseRef: null, commitSha: null, platform: "linux" };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    const next = () => rest[++index];
    if (arg === "--base-ref") options.baseRef = next();
    else if (arg === "--commit-sha") options.commitSha = next();
    else if (arg === "--platform") options.platform = next();
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.layerId) throw new Error("Usage: node scripts/verification-shadow.mjs <layer-id> --base-ref <ref> --commit-sha <sha>");
  return options;
}

function runGit(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function changedFilesFrom(baseRef) {
  if (!baseRef) return [];
  const output = runGit(["diff", "--name-only", `${baseRef}...HEAD`]);
  return output ? output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean) : [];
}

function spawnChecked(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: "inherit", shell: false });
  return result.status === 0 ? "pass" : "fail";
}

function safeTypedRunners() {
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

async function writeJson(relativeName, value) {
  await mkdir(artifactRoot, { recursive: true });
  const outputPath = path.join(artifactRoot, relativeName);
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path.relative(root, outputPath).replaceAll("\\", "/");
}

export async function runShadowLayer({ layerId, baseRef, commitSha, platform = "linux" }) {
  const started = Date.now();
  const configuration = await loadConfiguration();
  const changedFiles = changedFilesFrom(baseRef);
  const exactSha = commitSha || runGit(["rev-parse", "HEAD"]);
  const plan = planVerification({
    ...configuration,
    changedFiles,
    mode: "impact",
    platform,
    allowHeavy: false,
    allowNetwork: false,
    allowNative: false,
    allowSecrets: false,
  });
  const layer = plan.layers.find((candidate) => candidate.layerId === layerId);
  if (!layer) throw new Error(`Unknown architecture layer: ${layerId}`);

  let run;
  let executionError = null;
  if (plan.status === "blocked") {
    run = { layerId, result: "skipped", results: [] };
  } else {
    try {
      run = await runLayer({
        plan,
        catalog: configuration.catalog,
        layerId,
        runners: safeTypedRunners(),
        context: { source: "github-shadow" },
      });
    } catch (error) {
      executionError = error instanceof Error ? error.message : String(error);
      run = { layerId, result: "fail", results: [] };
    }
  }

  const durationMs = Math.max(0, Date.now() - started);
  const evidence = emitEvidence({
    plan,
    catalog: configuration.catalog,
    architecture: configuration.architecture,
    layerId,
    commitSha: exactSha,
    run,
    runtime: { platform, runner: "github-shadow", nodeVersion: process.version },
    durationMs,
  });

  const evidencePath = await writeJson(`${layerId}.json`, evidence);
  const summary = {
    schemaVersion: "1.0",
    commitSha: exactSha,
    layerId,
    planStatus: plan.status,
    baseline: "configuration-contracts-validated",
    impacted: layer.impacted,
    changedFiles: layer.changedFiles,
    riskTokens: layer.riskTokens,
    selectedTestIds: layer.selectedTests.map((test) => test.id),
    skippedTests: layer.skippedTests,
    blockingFindings: plan.blockingFindings,
    result: run.result,
    durationMs,
    evidencePath,
    ...(executionError ? { executionError } : {}),
  };
  const summaryPath = await writeJson(`${layerId}.summary.json`, summary);
  return { plan, layer, run, evidence, summary, evidencePath, summaryPath };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runShadowLayer(options);
  console.log(JSON.stringify({ summary: result.summary, summaryPath: result.summaryPath }, null, 2));
  if (result.plan.status === "blocked") process.exitCode = 3;
  else if (result.run.result === "fail") process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
