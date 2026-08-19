#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policyPath = path.join(repoRoot, "config", "ben-code-quality.json");
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.capture === false ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  return result;
}

function requireSuccess(result, label) {
  if (result.status === 0) return;
  const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
  throw new Error(`BEN ${label} failed with exit code ${result.status}.${detail ? `\n${detail}` : ""}`);
}

async function writeScannerEvidence(filePath, output, label) {
  const value = String(output || "").trim();
  if (!value) throw new Error(`BEN ${label} produced no evidence output.`);
  await writeFile(filePath, `${value}\n`, "utf8");
}

function slopScanArgs(...args) {
  return ["--yes", `${policy.slopScan.package}@${policy.slopScan.version}`, ...args];
}

function changedPathsSince(baseRef) {
  const diff = run("git", ["diff", "--name-only", `${baseRef}...HEAD`]);
  requireSuccess(diff, `git changed paths from ${baseRef}`);
  return String(diff.stdout || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim().replaceAll("\\", "/"))
    .filter(Boolean);
}

function pathIntersectsChange(findingPath, changedPaths) {
  const normalized = String(findingPath || "").trim().replaceAll("\\", "/").replace(/\/$/, "");
  if (!normalized) return true;
  return changedPaths.some((changedPath) => (
    changedPath === normalized
    || changedPath.startsWith(`${normalized}/`)
    || normalized.startsWith(`${changedPath}/`)
  ));
}

function relevantDeltaFindings(report, changedPaths) {
  const failOn = new Set(policy.slopScan.failOn);
  const relevant = [];
  for (const pathReport of report?.paths || []) {
    for (const change of pathReport?.changes || []) {
      if (!failOn.has(change?.status)) continue;
      const findingPath = change?.head?.path || change?.path || pathReport?.path || "";
      if (pathIntersectsChange(findingPath, changedPaths)) relevant.push(change);
    }
  }
  for (const change of report?.repoChanges || []) {
    if (failOn.has(change?.status)) relevant.push(change);
  }
  return relevant;
}

function parseDeltaReport(output) {
  const value = String(output || "").trim();
  if (!value) throw new Error("BEN delta produced no evidence output.");
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`BEN delta produced invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const baseRef = argumentValue("--base-ref");
  const configuredReportDirectory = path.resolve(repoRoot, policy.slopScan.reportDirectory);
  const reportDirectory = argumentValue("--report-dir")
    ? path.resolve(repoRoot, argumentValue("--report-dir"))
    : configuredReportDirectory;
  await mkdir(reportDirectory, { recursive: true });

  const scanReport = path.join(reportDirectory, "scan.json");
  const deltaReport = path.join(reportDirectory, "delta.json");
  const resultReport = path.join(reportDirectory, "ben-result.json");

  if (!baseRef) {
    const scan = run(npxCommand, slopScanArgs("scan", repoRoot, "--json"));
    requireSuccess(scan, "current-tree slop-scan");
    await writeScannerEvidence(scanReport, scan.stdout, "current-tree scan");
    await writeFile(resultReport, `${JSON.stringify({
      schemaVersion: 1,
      agentProfileId: policy.agentProfileId,
      mode: "scan",
      slopScanVersion: policy.slopScan.version,
      evidence: path.relative(repoRoot, scanReport).replaceAll("\\", "/"),
      authoritative: false,
      note: "Current-tree scan completed. Delta enforcement requires --base-ref.",
    }, null, 2)}\n`, "utf8");
    process.stdout.write(`BEN code-quality scan PASS: ${path.relative(repoRoot, scanReport)}\n`);
    return;
  }

  const worktreeRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-ben-base-"));
  let worktreeAdded = false;
  try {
    const addWorktree = run("git", ["worktree", "add", "--detach", worktreeRoot, baseRef]);
    requireSuccess(addWorktree, `git worktree baseline ${baseRef}`);
    worktreeAdded = true;

    const failOn = policy.slopScan.failOn.join(",");
    const delta = run(npxCommand, slopScanArgs(
      "delta",
      "--base", worktreeRoot,
      "--head", repoRoot,
      "--json",
      "--fail-on", failOn,
    ));

    const report = parseDeltaReport(delta.stdout);
    await writeScannerEvidence(deltaReport, delta.stdout, "delta");
    const changedPaths = changedPathsSince(baseRef);
    const relevantFindings = relevantDeltaFindings(report, changedPaths);
    const scannerFailed = delta.status !== 0 && delta.status !== 1;
    const passed = !scannerFailed && relevantFindings.length === 0;
    await writeFile(resultReport, `${JSON.stringify({
      schemaVersion: 1,
      agentProfileId: policy.agentProfileId,
      mode: "delta",
      baseRef,
      slopScanVersion: policy.slopScan.version,
      failOn: policy.slopScan.failOn,
      passed,
      changedPaths,
      relevantFindingCount: relevantFindings.length,
      scannerExitCode: delta.status,
      authoritative: false,
      evidence: path.relative(repoRoot, deltaReport).replaceAll("\\", "/"),
      note: "BEN records the full repository delta but blocks only added/worsened findings intersecting PR-touched paths, plus repository-wide findings. It cannot waive tests, Full Verification or repository merge gates.",
    }, null, 2)}\n`, "utf8");

    if (!passed) {
      const detail = [delta.stderr, delta.stdout].filter(Boolean).join("\n").trim();
      const reason = scannerFailed
        ? `scanner failed (exit ${delta.status})`
        : `${relevantFindings.length} added/worsened finding(s) intersect PR-touched paths`;
      throw new Error(`BEN code-quality delta failed: ${reason}.${detail ? `\n${detail}` : ""}`);
    }

    if (delta.status === 1) {
      process.stdout.write(`BEN recorded repository-wide slop changes outside this PR's ${changedPaths.length} touched path(s); they remain in delta evidence but do not block this PR.\n`);
    }
    process.stdout.write(`BEN code-quality delta PASS against ${baseRef}.\n`);
  } finally {
    if (worktreeAdded) run("git", ["worktree", "remove", "--force", worktreeRoot], { capture: false });
    await rm(worktreeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
