#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildUatFinding } from "../lib/sage-conversation-uat.mjs";
import { bestEffortLiveBuzzActivity } from "./buzz-live-activity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const repairWorker = argument("--repair-worker", process.env.PLOTPICKLE_REPAIR_WORKER || "pi");
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

async function mirrorUatResult(combined, findings) {
  const failed = combined.overall === "FAIL";
  await bestEffortLiveBuzzActivity({
    type: "uat.result",
    actorId: "bram-gatewick",
    summary: `Closed-loop UAT ${combined.overall}: ${findings.length} unique blocker${findings.length === 1 ? "" : "s"}.`,
    severity: failed ? "high" : "info",
    target: "Startup · Settings · LEARN · PLAN · Wyrmwood",
    verified: true,
    actionable: failed,
    evidence: [{ label: "UAT report", ref: "uat-findings.json" }],
  }, { baseUrl });
}

async function mirrorRepair(finding, summary, severity = "high") {
  await bestEffortLiveBuzzActivity({
    type: "repair.request",
    actorId: "rook-ironquill",
    summary,
    severity,
    target: finding.area || "focused-uat",
    verified: true,
    actionable: true,
    evidence: [{ label: "UAT fingerprint", ref: finding.fingerprint }],
  }, { baseUrl });
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
  await mirrorUatResult(combined, deduped);

  if (githubReport && deduped.length) {
    const reporter = await run("scripts/report-uat-findings.mjs", ["--report", reportPath]);
    if (reporter.code !== 0) process.exitCode = 1;
  }

  if (repair && deduped.length) {
    const repairScript = "scripts/run-uat-repair-agent.mjs";
    const ensureRun = await run("scripts/ensure-local-repair-model.mjs", ["--worker", repairWorker]);
    if (ensureRun.code !== 0) {
      process.stderr.write("Automatic LM Studio repair-model load did not complete; continuing to the normal local-only repair preflight.\n");
    }
    const preflight = await run(repairScript, ["--worker", repairWorker, "--preflight", "--require-ready"]);
    if (preflight.code !== 0) {
      process.stderr.write(`Developer repair worker ${repairWorker} is not ready. UAT findings remain open; no model was downloaded and no cloud/story-model fallback was attempted.\n`);
      for (const finding of deduped) await mirrorRepair(finding, `Repair worker ${repairWorker} is not ready for ${finding.fingerprint}; the blocker remains open.`, "medium");
      process.exitCode = 1;
    } else {
      for (const finding of deduped) {
        await mirrorRepair(finding, `Repair requested for verified UAT blocker ${finding.fingerprint} using ${repairWorker}.`);
        const repairRun = await run(repairScript, ["--worker", repairWorker, "--report", reportPath, "--fingerprint", finding.fingerprint]);
        if (repairRun.code !== 0) {
          process.stderr.write(`UAT repair worker ${repairWorker} did not complete ${finding.fingerprint}. The blocker remains open for manual repair.\n`);
          await mirrorRepair(finding, `Repair worker ${repairWorker} did not complete ${finding.fingerprint}; manual repair is still required.`, "high");
          process.exitCode = 1;
        } else {
          await mirrorRepair(finding, `Repair worker ${repairWorker} completed the local repair workflow for ${finding.fingerprint}; GitHub CI remains the merge gate.`, "info");
        }
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