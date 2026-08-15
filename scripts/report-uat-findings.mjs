#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const args = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const reportPath = argument("--report");
const repository = argument("--repository", process.env.GITHUB_REPOSITORY || "BryanHarrisScripts/PlotPickle");
if (!reportPath) throw new Error("Use --report <path-to-uat-findings.json>.");

async function gh(...ghArgs) {
  const { stdout } = await exec("gh", ghArgs, { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return stdout.trim();
}

function marker(fingerprint) {
  return `<!-- plotpickle-uat-fingerprint:${fingerprint} -->`;
}

function findingBody(finding) {
  return [
    marker(finding.fingerprint),
    "## Automated PlotPickle UAT finding",
    "",
    `**Fingerprint:** \`${finding.fingerprint}\``,
    `**Area:** ${finding.area || "focused-uat"}`,
    `**Severity:** ${finding.severity || "blocker"}`,
    "",
    finding.message || "Focused UAT reported a blocker.",
    "",
    "### Evidence",
    "",
    "```json",
    JSON.stringify(finding.evidence || {}, null, 2),
    "```",
    "",
    "### Repair contract",
    "",
    "1. The local Qwen3.8-27B UAT Repair Agent reproduces this finding inside an isolated git worktree.",
    "2. Add or strengthen the focused regression test before changing product behavior.",
    "3. Fix the architectural root cause without weakening the UAT assertion.",
    "4. Run focused UAT contracts and the production build before creating the draft repair PR.",
    "5. GitHub CI remains the independent merge gate; the repair agent never merges its own work.",
  ].join("\n");
}

async function ensureLabels() {
  await gh("label", "create", "uat:autopilot", "--repo", repository, "--color", "0E8A16", "--description", "Created or updated by PlotPickle focused UAT", "--force");
  await gh("label", "create", "uat:auto-repair", "--repo", repository, "--color", "D93F0B", "--description", "Queue for the local PlotPickle UAT Repair Agent", "--force");
}

async function existingIssue(fingerprint) {
  const raw = await gh("issue", "list", "--repo", repository, "--state", "open", "--label", "uat:autopilot", "--limit", "100", "--json", "number,body,title");
  const issues = JSON.parse(raw || "[]");
  return issues.find((issue) => String(issue.body || "").includes(marker(fingerprint))) || null;
}

async function main() {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const findings = Array.isArray(report.findings) ? report.findings : [];
  if (!findings.length) {
    process.stdout.write("No UAT blockers to report to GitHub.\n");
    return;
  }
  await gh("auth", "status", "--hostname", "github.com");
  await ensureLabels();

  for (const finding of findings) {
    const current = await existingIssue(finding.fingerprint);
    const body = findingBody(finding);
    if (current) {
      await gh("issue", "comment", String(current.number), "--repo", repository, "--body", body);
      process.stdout.write(`Updated UAT issue #${current.number}: ${finding.fingerprint}\n`);
      continue;
    }
    const url = await gh(
      "issue", "create",
      "--repo", repository,
      "--title", `[UAT] ${finding.title || finding.fingerprint}`,
      "--body", body,
      "--label", "uat:autopilot",
      "--label", "uat:auto-repair",
    );
    process.stdout.write(`Created UAT issue: ${url}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
