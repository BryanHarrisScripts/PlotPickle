#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: options.inherit ? "inherit" : "pipe",
  });
}

function requireResult(result, label) {
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status === 0) return;
  throw new Error(`${label} failed with exit ${result.status}.`);
}

export function normalizeStagedFiles(value) {
  const files = [...new Set(String(value || "")
    .split("\0")
    .map((item) => item.trim().replaceAll("\\", "/"))
    .filter(Boolean))];
  files.sort();
  return files;
}

export function buildGateResult({ status, indexTree = "", stagedFiles = [], completedSteps = [], failure = null }) {
  return {
    schemaVersion: 1,
    gateId: "plotpickle-pre-commit",
    generatedAt: new Date().toISOString(),
    status,
    scope: "staged-files",
    indexTree,
    stagedFiles: [...stagedFiles],
    completedSteps: [...completedSteps],
    failure,
    authoritativeFor: ["staged-diff-integrity", "changed-test-selection"],
    notAuthoritativeFor: ["ben", "production-build", "github-exact-head-ci"],
    nextAction: status === "pass"
      ? "commit"
      : "fix-the-reported-staged-file-problem-and-rerun-the-same-hook",
  };
}

function evidencePath() {
  const result = run("git", ["rev-parse", "--git-path", "plotpickle/pre-commit-result.json"]);
  requireResult(result, "Git evidence-path resolution");
  return path.resolve(repositoryRoot, result.stdout.trim());
}

function writeEvidence(report) {
  const target = evidencePath();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path.relative(repositoryRoot, target).replaceAll("\\", "/");
}

function stagedFiles() {
  const result = run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  requireResult(result, "Staged-file discovery");
  return normalizeStagedFiles(result.stdout);
}

function indexTree() {
  const result = run("git", ["write-tree"]);
  requireResult(result, "Git index-tree resolution");
  return result.stdout.trim();
}

function failure(rule, reason, rerun) {
  return {
    rule,
    reason,
    rerun,
    evidenceRef: "git:plotpickle/pre-commit-result.json",
  };
}

export function runPreCommitGate() {
  const files = stagedFiles();
  const exactIndexTree = indexTree();
  const completedSteps = [];

  if (files.length === 0) {
    const report = buildGateResult({ status: "pass", indexTree: exactIndexTree, stagedFiles: files, completedSteps });
    return { report, evidence: writeEvidence(report) };
  }

  const diffCheck = run("git", ["diff", "--cached", "--check"]);
  if (diffCheck.status !== 0 || diffCheck.error) {
    const report = buildGateResult({
      status: "fail",
      indexTree: exactIndexTree,
      stagedFiles: files,
      completedSteps,
      failure: failure("staged-diff-integrity", "Git found whitespace errors or unresolved conflict markers in the staged diff.", "git diff --cached --check"),
    });
    return { report, evidence: writeEvidence(report) };
  }
  completedSteps.push("staged-diff-integrity");

  const changedPlan = run(process.execPath, [
    "scripts/developer-diagnostics/test-changed.mjs",
    "--plan",
    "--files",
    files.join(","),
  ]);
  if (changedPlan.status !== 0 || changedPlan.error) {
    const report = buildGateResult({
      status: "fail",
      indexTree: exactIndexTree,
      stagedFiles: files,
      completedSteps,
      failure: failure("changed-test-selection", "The staged files could not be mapped safely to focused deterministic tests.", `node scripts/developer-diagnostics/test-changed.mjs --plan --files ${files.join(",")}`),
    });
    return { report, evidence: writeEvidence(report) };
  }
  completedSteps.push("changed-test-selection");

  const report = buildGateResult({ status: "pass", indexTree: exactIndexTree, stagedFiles: files, completedSteps });
  return { report, evidence: writeEvidence(report) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = runPreCommitGate();
    process.stdout.write(`PlotPickle pre-commit gate: ${result.report.status.toUpperCase()}\n`);
    process.stdout.write(`Scope: ${result.report.stagedFiles.length} staged file(s)\n`);
    process.stdout.write(`Evidence: ${result.evidence}\n`);
    if (result.report.failure) {
      process.stderr.write(`${result.report.failure.rule}: ${result.report.failure.reason}\n`);
      process.stderr.write(`Rerun: ${result.report.failure.rerun}\n`);
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`PlotPickle pre-commit gate could not run: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
