#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const ALLOWED_FAILURE_RULES = new Set(["staged-diff-integrity", "changed-test-selection"]);
const MAX_STAGED_FILES = 128;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : "";
}

function runGit(repositoryRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    stdio: "pipe",
  });
  if (result.error) throw result.error;
  return result;
}

function gitValue(repositoryRoot, args, required = true) {
  const result = runGit(repositoryRoot, args);
  if (result.status === 0) return result.stdout.trim();
  if (!required) return "";
  throw new Error(`git ${args.join(" ")} failed with exit ${result.status}.`);
}

function cleanText(value, limit = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanPath(value) {
  return cleanText(value, 320).replaceAll("\\", "/");
}

function unavailable(state, summary, detail, hooksEnabled = false) {
  return {
    schemaVersion: 1,
    state,
    summary,
    detail,
    hooksEnabled,
    current: false,
    repairEligible: false,
    evidence: null,
  };
}

function evidenceFile(repositoryRoot) {
  const gitPath = gitValue(repositoryRoot, ["rev-parse", "--git-path", "plotpickle/pre-commit-result.json"]);
  return path.isAbsolute(gitPath) ? gitPath : path.resolve(repositoryRoot, gitPath);
}

function normalizedFailure(raw) {
  const rule = cleanText(raw?.rule, 100);
  if (!ALLOWED_FAILURE_RULES.has(rule)) return null;
  return {
    rule,
    reason: cleanText(raw?.reason, 600),
    rerun: cleanText(raw?.rerun, 1000),
    evidenceRef: "git:plotpickle/pre-commit-result.json",
  };
}

export function summarizeLocalGateEvidence(raw, { currentIndexTree, hooksEnabled }) {
  if (raw?.schemaVersion !== 1 || raw?.gateId !== "plotpickle-pre-commit" || raw?.scope !== "staged-files") {
    return unavailable("blocked", "BLOCKED", "Local gate evidence has an unsupported contract.", hooksEnabled);
  }
  const recordedTree = cleanText(raw.indexTree, 80);
  if (!recordedTree || recordedTree !== currentIndexTree) {
    return unavailable("stale", "STALE", "The Git index changed after this local gate result. Rerun the pre-commit gate.", hooksEnabled);
  }
  if (raw.status !== "pass" && raw.status !== "fail") {
    return unavailable("blocked", "BLOCKED", "Local gate evidence has an invalid deterministic result.", hooksEnabled);
  }

  const failure = raw.status === "fail" ? normalizedFailure(raw.failure) : null;
  if (raw.status === "fail" && !failure) {
    return unavailable("blocked", "BLOCKED", "Local gate failure evidence is not eligible for repair handoff.", hooksEnabled);
  }

  const stagedFiles = [...new Set((Array.isArray(raw.stagedFiles) ? raw.stagedFiles : [])
    .map(cleanPath)
    .filter(Boolean))]
    .slice(0, MAX_STAGED_FILES);
  const completedSteps = [...new Set((Array.isArray(raw.completedSteps) ? raw.completedSteps : [])
    .map((value) => cleanText(value, 100))
    .filter(Boolean))];
  const passed = raw.status === "pass";
  return {
    schemaVersion: 1,
    state: passed ? "green" : "red",
    summary: passed ? "GREEN" : "RED",
    detail: passed
      ? `The deterministic pre-commit gate passed for index tree ${recordedTree.slice(0, 12)}.`
      : `${failure.rule}: ${failure.reason}`,
    hooksEnabled,
    current: true,
    repairEligible: !passed,
    evidence: {
      gateId: "plotpickle-pre-commit",
      status: raw.status,
      scope: "staged-files",
      indexTree: recordedTree,
      stagedFiles,
      completedSteps,
      failure,
      nextAction: passed ? "commit" : "review-confirmed-local-gate-failure",
    },
  };
}

export function readLocalGateStatus(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  if (root !== path.resolve(process.cwd())) {
    throw new Error("repositoryPath must match the host-selected working directory.");
  }
  if (!existsSync(path.join(root, "AGENTS.md")) || !existsSync(path.join(root, "package.json"))) {
    throw new Error("The selected directory is not a PlotPickle repository.");
  }
  const hookPath = gitValue(root, ["config", "--local", "--get", "core.hooksPath"], false);
  const hooksEnabled = hookPath.replaceAll("\\", "/").replace(/^\.\//, "") === ".githooks";
  if (!hooksEnabled) return unavailable("disabled", "DISABLED", "Enable the repository-local PlotPickle hooks to produce local gate evidence.");

  const target = evidenceFile(root);
  if (!existsSync(target)) return unavailable("not-run", "NOT RUN", "The local pre-commit gate has not produced evidence for this checkout.", true);
  let raw;
  try {
    raw = JSON.parse(readFileSync(target, "utf8"));
  } catch {
    return unavailable("blocked", "BLOCKED", "Local gate evidence is malformed. Rerun the pre-commit gate.", true);
  }
  const currentIndexTree = gitValue(root, ["write-tree"]);
  return summarizeLocalGateEvidence(raw, { currentIndexTree, hooksEnabled: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = readLocalGateStatus(argument("--repository") || process.cwd());
    process.stdout.write(`${JSON.stringify(report, null, process.argv.includes("--json") ? 2 : 0)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
