#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  ENGINEERING_REPAIR_PHASE_PROFILE,
  beginSemanticAction,
  buildSemanticExperienceCandidate,
  completeSemanticAction,
  createSemanticExecution,
  recordSemanticEvaluation,
  recordSemanticObservation,
  safeSemanticExecutionRecord,
  transitionSemanticExecution,
  validateSemanticExecutionRecord,
} from "./semantic-execution.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const optionValues = new Map();
for (let index = 0; index < args.length; index += 1) {
  const name = args[index];
  const value = args[index + 1];
  if (name?.startsWith("--") && value && !value.startsWith("--")) optionValues.set(name, value);
}
const has = (name) => args.includes(name);
const worker = optionValues.get("--worker") || process.env.PLOTPICKLE_REPAIR_WORKER || "pi";
const fingerprint = optionValues.get("--fingerprint") || "";
const issue = optionValues.get("--issue") || "";
const reportPath = optionValues.get("--report") || "";
const targetId = fingerprint || (issue ? `issue-${issue}` : "verified-uat-finding");
const semanticTarget = `uat:${targetId}`;
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(process.env.PLOTPICKLE_SEMANTIC_EXECUTION_ROOT || (
  process.platform === "win32"
    ? path.join(localRoot, "PlotPickle", "semantic-execution")
    : path.join(repoRoot, ".artifacts", "semantic-execution")
));

function runRepairAgent() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "run-uat-repair-agent.mjs"), ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
}

async function findingSummary() {
  if (!reportPath || !fingerprint) return { summary: `Verified UAT repair target ${targetId}.`, area: "uat", evidence: [] };
  try {
    const report = JSON.parse(await readFile(path.resolve(reportPath), "utf8"));
    const finding = (Array.isArray(report?.findings) ? report.findings : []).find((item) => item?.fingerprint === fingerprint);
    if (!finding) return { summary: `Verified UAT repair target ${targetId}.`, area: "uat", evidence: [] };
    return {
      summary: String(finding.message || finding.title || `Verified UAT repair target ${targetId}.`),
      area: String(finding.area || "uat"),
      evidence: [{ kind: "uat-finding", ref: fingerprint, summary: String(finding.title || finding.message || fingerprint) }],
    };
  } catch {
    return { summary: `Verified UAT repair target ${targetId}.`, area: "uat", evidence: [] };
  }
}

async function saveRecord(record) {
  await mkdir(artifactRoot, { recursive: true });
  const safeRecord = safeSemanticExecutionRecord(record);
  const validation = validateSemanticExecutionRecord(safeRecord);
  if (!validation.ok) throw new Error(`Semantic execution record is invalid: ${validation.errors.join(" ")}`);
  const experienceCandidate = buildSemanticExperienceCandidate(safeRecord);
  const file = path.join(artifactRoot, `${safeRecord.executionId}.json`);
  await writeFile(file, `${JSON.stringify({
    semanticExecution: safeRecord,
    experienceCandidate,
    memoryBoundary: "candidate-only; durable promotion remains owned by PlotPickle Memory Service #1200",
    hiddenReasoningStored: false,
  }, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  if (has("--preflight")) {
    const result = await runRepairAgent();
    if (result.error) process.stderr.write(`${result.error}\n`);
    process.exitCode = result.code;
    return;
  }

  const finding = await findingSummary();
  const record = createSemanticExecution({
    taskId: targetId,
    agentId: `developer-repair-${worker}`,
    domain: "engineering",
    scope: {
      nodeId: "local-node",
      sessionId: `repair-${process.pid}`,
      agentId: `developer-repair-${worker}`,
    },
    phaseProfile: ENGINEERING_REPAIR_PHASE_PROFILE,
    maxRepairAttempts: 1,
    intent: {
      objective: `Repair only the verified PlotPickle UAT finding ${targetId}.`,
      constraints: [
        "Observe the verified finding before acting.",
        "Use the existing isolated Developer Repair Worker and its worktree boundary.",
        "Do not broaden repair into unrelated cleanup or framework work.",
        "Deterministic validation remains authoritative; worker self-report is not PASS evidence.",
        "GitHub/merge authority remains outside the model worker.",
      ],
      success: "The existing repair wrapper exits 0 only after a changed worktree passes git diff check, focused UAT contracts and the production build, then publishes a draft PR.",
      allowedActionClasses: ["developer.repair"],
      allowedTargets: [semanticTarget],
      exclusions: ["credentials", "ppf-canon", "unrelated-subsystem"],
    },
  });

  recordSemanticObservation(record, {
    position: "state",
    source: "verified-uat-finding",
    summary: finding.summary,
    evidence: finding.evidence.length ? finding.evidence : [{ kind: "task", ref: targetId, summary: finding.summary }],
    truthStatus: "observed",
  });
  recordSemanticEvaluation(record, {
    status: "pass",
    verifier: "semantic-execution-host",
    evidence: [{ kind: "verified-finding", ref: targetId, summary: `Repair target identified in ${finding.area}.` }],
  });
  transitionSemanticExecution(record, "ACT", { reason: "Verified finding and bounded repair target are identified." });

  recordSemanticObservation(record, {
    position: "before",
    source: "repair-wrapper",
    summary: `About to invoke the existing bounded ${worker} Developer Repair Worker for ${targetId}.`,
    evidence: [{ kind: "worker", ref: "scripts/run-uat-repair-agent.mjs", summary: "Existing isolated repair authority." }],
  });
  beginSemanticAction(record, {
    actionClass: "developer.repair",
    capability: `developer.repair.${worker}`,
    target: semanticTarget,
    summary: `Run the existing isolated UAT repair worker for ${targetId}.`,
    evidence: [{ kind: "implementation", ref: "scripts/run-uat-repair-agent.mjs", summary: "Worker creates isolated worktree and owns bounded repair implementation." }],
  });

  const result = await runRepairAgent();
  completeSemanticAction(record, {
    status: result.code === 0 ? "pass" : "fail",
    resultSummary: result.code === 0
      ? "Bounded repair worker completed its deterministic validation and draft-PR publication path."
      : `Bounded repair worker exited ${result.code}; no semantic PASS is claimed.`,
    evidence: [{ kind: "process-exit", ref: "scripts/run-uat-repair-agent.mjs", summary: `exit=${result.code}` }],
  });
  recordSemanticObservation(record, {
    position: "after",
    source: "repair-wrapper",
    summary: result.code === 0
      ? "Observed repair wrapper exit 0 after its built-in deterministic validation sequence."
      : `Observed repair wrapper failure exit ${result.code}.`,
    evidence: [{ kind: "process-exit", ref: "scripts/run-uat-repair-agent.mjs", summary: `exit=${result.code}` }],
    truthStatus: "observed",
  });

  if (result.code !== 0) {
    recordSemanticEvaluation(record, {
      status: "fail",
      verifier: "semantic-execution-host",
      evidence: [{ kind: "process-exit", ref: "scripts/run-uat-repair-agent.mjs", summary: `exit=${result.code}` }],
      mismatch: result.error || `Developer Repair Worker failed with exit ${result.code}.`,
      failureClass: "developer-repair-worker-failed",
      repairAllowed: true,
    });
    transitionSemanticExecution(record, "REPAIR", { reason: "Verified repair worker failure requires bounded recovery." });
    recordSemanticObservation(record, {
      position: "state",
      source: "semantic-execution-host",
      summary: "A second autonomous worktree/PR attempt is not authorized by this wrapper because it could duplicate remote changes; stop and surface the verified worker failure.",
      evidence: [{ kind: "policy", ref: "#1218", summary: "Bounded repair does not silently expand or duplicate GitHub work." }],
      truthStatus: "observed",
    });
    recordSemanticEvaluation(record, {
      status: "blocked",
      verifier: "semantic-execution-host",
      evidence: [{ kind: "policy", ref: "#1218", summary: "Retry requires a fresh authorized repair execution." }],
      mismatch: "Automatic duplicate repair execution is not authorized.",
      failureClass: "bounded-retry-not-authorized",
      repairAllowed: false,
    });
    transitionSemanticExecution(record, "BLOCKED", { reason: "Repair remains bounded; a fresh authorized task is required for another worktree attempt." });
    const evidenceFile = await saveRecord(record);
    process.stderr.write(`Semantic repair execution .......... BLOCKED  ${evidenceFile}\n`);
    process.exitCode = result.code;
    return;
  }

  recordSemanticEvaluation(record, {
    status: "pass",
    verifier: "existing-repair-wrapper",
    evidence: [
      { kind: "git", ref: "git diff --check", summary: "Required by the existing repair validation wrapper." },
      { kind: "focused-uat", ref: "scripts/run-uat-autopilot.mjs --contracts-only", summary: "Required by the existing repair validation wrapper." },
      { kind: "production-build", ref: "npm run build", summary: "Required by the existing repair validation wrapper." },
    ],
  });
  transitionSemanticExecution(record, "VERIFY", { reason: "Bounded repair action completed; verify the deterministic wrapper evidence before completion." });
  recordSemanticObservation(record, {
    position: "state",
    source: "existing-repair-wrapper",
    summary: "The existing repair wrapper returned success only after git diff check, focused UAT contract verification, production build and draft PR publication.",
    evidence: [
      { kind: "source-contract", ref: "scripts/run-uat-repair-agent.mjs#validateRepair", summary: "Deterministic validation boundary." },
      { kind: "source-contract", ref: "scripts/run-uat-repair-agent.mjs#publishRepair", summary: "Draft PR publication remains outside the model worker." },
    ],
  });
  recordSemanticEvaluation(record, {
    status: "pass",
    verifier: "semantic-execution-host",
    evidence: [
      { kind: "deterministic-wrapper", ref: "scripts/run-uat-repair-agent.mjs#validateRepair", summary: "Focused UAT + production build completed before wrapper exit 0." },
      { kind: "publication-boundary", ref: "scripts/run-uat-repair-agent.mjs#publishRepair", summary: "Repair remains a draft PR; CI is still merge authority." },
    ],
  });
  transitionSemanticExecution(record, "COMPLETE", { reason: "Observed deterministic validation satisfies the declared repair success condition." });
  const evidenceFile = await saveRecord(record);
  process.stdout.write(`Semantic repair execution .......... PASS  ${evidenceFile}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});