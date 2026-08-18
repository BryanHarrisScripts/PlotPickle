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

async function writeJsonText(filePath, text, label) {
  const value = String(text || "").trim();
  if (!value) throw new Error(`BEN ${label} produced no JSON output.`);
  JSON.parse(value);
  await writeFile(filePath, `${value}\n`, "utf8");
}

function slopScanArgs(...args) {
  return ["--yes", `${policy.slopScan.package}@${policy.slopScan.version}`, ...args];
}

async function scanRepository(targetPath, reportPath) {
  const result = run(npxCommand, slopScanArgs("scan", targetPath, "--json"));
  requireSuccess(result, `slop-scan scan for ${targetPath}`);
  await writeJsonText(reportPath, result.stdout, "scan");
}

async function main() {
  const baseRef = argumentValue("--base-ref");
  const configuredReportDirectory = path.resolve(repoRoot, policy.slopScan.reportDirectory);
  const reportDirectory = argumentValue("--report-dir")
    ? path.resolve(repoRoot, argumentValue("--report-dir"))
    : configuredReportDirectory;
  await mkdir(reportDirectory, { recursive: true });

  const headReport = path.join(reportDirectory, "head.json");
  const baseReport = path.join(reportDirectory, "base.json");
  const deltaReport = path.join(reportDirectory, "delta.json");
  const resultReport = path.join(reportDirectory, "ben-result.json");

  await scanRepository(repoRoot, headReport);

  if (!baseRef) {
    await writeFile(resultReport, `${JSON.stringify({
      schemaVersion: 1,
      agentProfileId: policy.agentProfileId,
      mode: "scan",
      slopScanVersion: policy.slopScan.version,
      headReport: path.relative(repoRoot, headReport).replaceAll("\\", "/"),
      authoritative: false,
      note: "Current-tree scan completed. Delta enforcement requires --base-ref.",
    }, null, 2)}\n`, "utf8");
    process.stdout.write(`BEN code-quality scan PASS: ${path.relative(repoRoot, headReport)}\n`);
    return;
  }

  const worktreeRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-ben-base-"));
  let worktreeAdded = false;
  try {
    const addWorktree = run("git", ["worktree", "add", "--detach", worktreeRoot, baseRef]);
    requireSuccess(addWorktree, `git worktree baseline ${baseRef}`);
    worktreeAdded = true;

    await scanRepository(worktreeRoot, baseReport);

    const failOn = policy.slopScan.failOn.join(",");
    const delta = run(npxCommand, slopScanArgs(
      "delta",
      "--base-report", baseReport,
      "--head-report", headReport,
      "--json",
      "--fail-on", failOn,
    ));

    if (String(delta.stdout || "").trim()) await writeJsonText(deltaReport, delta.stdout, "delta");
    const passed = delta.status === 0;
    await writeFile(resultReport, `${JSON.stringify({
      schemaVersion: 1,
      agentProfileId: policy.agentProfileId,
      mode: "delta",
      baseRef,
      slopScanVersion: policy.slopScan.version,
      failOn: policy.slopScan.failOn,
      passed,
      authoritative: false,
      evidence: {
        base: path.relative(repoRoot, baseReport).replaceAll("\\", "/"),
        head: path.relative(repoRoot, headReport).replaceAll("\\", "/"),
        delta: String(delta.stdout || "").trim() ? path.relative(repoRoot, deltaReport).replaceAll("\\", "/") : "",
      },
      note: "BEN evidence cannot waive tests, Full Verification or repository merge gates.",
    }, null, 2)}\n`, "utf8");

    if (!passed) {
      const detail = [delta.stderr, delta.stdout].filter(Boolean).join("\n").trim();
      throw new Error(`BEN code-quality delta found added/worsened findings or the scanner failed (exit ${delta.status}).${detail ? `\n${detail}` : ""}`);
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
