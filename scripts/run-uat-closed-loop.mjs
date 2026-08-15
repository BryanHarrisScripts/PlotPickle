#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildUatFinding } from "../lib/sage-conversation-uat.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat-focused")));
const githubReport = args.includes("--github-report");
const repair = args.includes("--repair");

function run(script, scriptArgs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(repoRoot, script), ...scriptArgs], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const coreRoot = path.join(artifactRoot, "core");
  const sageRoot = path.join(artifactRoot, "sage-conversation");
  const coreRun = await run("scripts/run-uat-autopilot.mjs", ["--base-url", baseUrl, "--artifact-root", coreRoot]);
  const sageRun = await run("scripts/run-sage-conversation-uat.mjs", ["--base-url", baseUrl, "--artifact-root", sageRoot]);
  const [core, sage] = await Promise.all([
    readJson(path.join(coreRoot, "autopilot-report.json")),
    readJson(path.join(sageRoot, "sage-conversation-report.json")),
  ]);

  const findings = [];
  for (const message of core?.blockers || []) {
    findings.push(buildUatFinding({ message, area: "focused-uat", evidence: { target: baseUrl, source: "autopilot-report.json" } }));
  }
  for (const finding of sage?.findings || []) findings.push(finding);
  const deduped = [...new Map(findings.map((finding) => [finding.fingerprint, finding])).values()];
  const reportPath = path.join(artifactRoot, "uat-findings.json");
  const combined = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: baseUrl,
    overall: coreRun.code || sageRun.code || deduped.length ? "FAIL" : "PASS",
    runs: { focused: coreRun, sageConversation: sageRun },
    findings: deduped,
  };
  await writeFile(reportPath, `${JSON.stringify(combined, null, 2)}\n`, "utf8");

  if (githubReport && deduped.length) {
    const reporter = await run("scripts/report-uat-findings.mjs", ["--report", reportPath]);
    if (reporter.code !== 0) process.exitCode = 1;
  }

  if (repair && deduped.length) {
    for (const finding of deduped) {
      const repairRun = await run("scripts/run-uat-repair-agent.mjs", ["--report", reportPath, "--fingerprint", finding.fingerprint]);
      if (repairRun.code !== 0) {
        process.stderr.write(`UAT repair agent did not complete ${finding.fingerprint}. The blocker remains open for manual repair.\n`);
        process.exitCode = 1;
      }
    }
  }

  if (combined.overall === "FAIL") process.exitCode = 1;
  process.stdout.write(`Closed-loop UAT ${combined.overall}: ${deduped.length} unique blocker(s). Findings: ${reportPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
