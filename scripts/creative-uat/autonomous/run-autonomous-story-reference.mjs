#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createAutonomousReferenceLifecycleProof } from "../../../lib/verification/autonomous-reference-lifecycle.mjs";
import { createManagedPlotPickleLifecycle } from "./application-lifecycle.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const argv = process.argv.slice(2);
const optionValues = new Map();
for (let index = 0; index < argv.length - 1; index += 1) {
  const name = argv[index];
  const value = argv[index + 1];
  if (name.startsWith("--") && value && !value.startsWith("--")) optionValues.set(name, value);
}

const baseUrl = optionValues.get("--base-url") || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173";
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(optionValues.get("--artifact-root") || path.join(localRoot, "PlotPickle", "uat-autonomous-story-reference"));
const routeInputsPath = optionValues.get("--route-inputs") || "";
const autonomousRunId = optionValues.get("--autonomous-run-id") || process.env.PLOTPICKLE_AUTONOMOUS_RUN_ID || "afterglow-reference-v1";
const autonomousOperatorId = optionValues.get("--autonomous-operator-id") || process.env.PLOTPICKLE_AUTONOMOUS_OPERATOR_ID || "plotpickle-autonomous-reference";
const bootstrapRunner = path.join(repoRoot, "scripts", "creative-uat", "autonomous", "bootstrap-afterglow-working-copy.mjs");
const bootstrapReportPath = path.join(artifactRoot, "afterglow-working-copy-bootstrap.json");
const routeRunner = path.join(repoRoot, "scripts", "creative-uat", "autonomous", "run-autonomous-story-routes.mjs");
const routeReportPath = path.join(artifactRoot, "autonomous-story-routes.json");
const generatedRouteInputsPath = path.join(artifactRoot, "autonomous-route-inputs.json");
const reportPath = path.join(artifactRoot, "autonomous-story-reference.md");
const jsonPath = path.join(artifactRoot, "autonomous-story-reference.json");
const referenceTasksUrl = new URL("/api/autonomous-guest/reference-tasks", baseUrl).toString();

function runChild(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
}

async function runAfterglowBootstrap() {
  process.stdout.write("Autonomous reference bootstrap: loading Afterglow through Library.\n");
  const child = await runChild(process.execPath, [bootstrapRunner, "--base-url", baseUrl, "--artifact-root", artifactRoot]);
  let report = null;
  try {
    report = JSON.parse(await readFile(bootstrapReportPath, "utf8"));
  } catch (error) {
    return { child, report: null, error: error instanceof Error ? error.message : String(error) };
  }
  return { child, report, error: "" };
}

async function runRoutePass(label, inputsPath = routeInputsPath) {
  const args = [routeRunner, "--base-url", baseUrl, "--artifact-root", artifactRoot];
  if (inputsPath) args.push("--route-inputs", inputsPath);
  process.stdout.write(`Autonomous reference ${label}: running registered PlotPickle routes.\n`);
  const child = await runChild(process.execPath, args);
  let report = null;
  try {
    report = JSON.parse(await readFile(routeReportPath, "utf8"));
  } catch (error) {
    return { label, child, report: null, error: error instanceof Error ? error.message : String(error) };
  }
  return { label, child, report, error: "" };
}

async function referenceTaskAction(input) {
  const response = await fetch(referenceTasksUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value?.message || `Autonomous Guest reference task API returned ${response.status}.`);
  return value;
}

function continuitySurfaces(report) {
  return Array.isArray(report?.restartProof?.surfaces) ? report.restartProof.surfaces : [];
}

function canonicalRevision(report, projectId) {
  const surface = continuitySurfaces(report).find((candidate) => candidate?.projectId === projectId && candidate?.revision);
  return String(surface?.revision || "").trim();
}

function routeResult(report, routeId) {
  return Array.isArray(report?.results) ? report.results.find((result) => result?.id === routeId) || null : null;
}

function compareAcrossApplicationRestart(beforeReport, afterReport, lifecycleRestart) {
  const before = continuitySurfaces(beforeReport).filter((surface) => surface?.signature);
  const afterById = new Map(continuitySurfaces(afterReport).map((surface) => [surface.id, surface]));
  const mismatches = [];
  if (lifecycleRestart?.restarted !== true || lifecycleRestart?.stopped?.endpointUnavailable !== true || lifecycleRestart?.newProcessIdentity !== true) {
    mismatches.push("PlotPickle application process restart was not fully verified.");
  }
  if (before.length < 2) mismatches.push("Fewer than two canonical visual surfaces were available before application restart.");
  if (!before.some((surface) => surface.projectId && surface.revision)) {
    mismatches.push("No canonical restart surface exposed both project identity and PPF revision.");
  }
  for (const surface of before) {
    const reopened = afterById.get(surface.id);
    if (!reopened?.signature) mismatches.push(`${surface.id} was unavailable after PlotPickle application restart.`);
    else if (surface.signature !== reopened.signature) mismatches.push(`${surface.id} changed across PlotPickle application restart.`);
  }
  return {
    attempted: true,
    verified: mismatches.length === 0,
    boundary: "managed-plotpickle-application-process-plus-fresh-playwright-mcp",
    applicationProcessRestarted: lifecycleRestart?.restarted === true && lifecycleRestart?.stopped?.endpointUnavailable === true && lifecycleRestart?.newProcessIdentity === true,
    previousProcess: lifecycleRestart?.previousProcess || null,
    currentProcess: lifecycleRestart?.currentProcess || null,
    surfaces: before.map((surface) => ({
      id: surface.id,
      actualRoute: surface.actualRoute,
      projectId: surface.projectId,
      revision: surface.revision,
      signature: surface.signature,
      matchedAfterApplicationRestart: surface.signature === afterById.get(surface.id)?.signature,
    })),
    mismatches,
  };
}

function markdownReport(machine) {
  const lines = [
    "# PlotPickle Autonomous Story Reference Run",
    "",
    `Overall: ${machine.overall}`,
    `Generated: ${machine.generatedAt}`,
    `Target: ${machine.target}`,
    "",
    "## Authority",
    "",
    `Authority class: ${machine.authority.authorityClass}`,
    `Delegated: ${machine.authority.delegated ? "yes" : "no"}`,
    `Human profile authority: ${machine.authority.humanProfileId ? "present" : "none"}`,
    `Run: ${machine.authority.autonomousRunId}`,
    "",
    "## Lifecycle",
    "",
    `Canonical lifecycle proven: ${machine.lifecycleProof ? "yes" : "no"}`,
    `Stages: ${machine.lifecycleProof?.stageSequence?.join(" → ") || "unavailable"}`,
    `Autonomous policy persistence: ${machine.lifecycleProof?.authority?.autonomousPolicyApproved ? "yes" : "no"}`,
    `Human approval claimed: ${machine.lifecycleProof?.authority?.humanApproved ? "yes" : "no"}`,
    `Bounded failure/stop contract: ${machine.lifecycleProof?.boundedFailureStopProof?.contractSuitePassed ? "pass" : "unavailable"}`,
    `Continuation after restart: ${machine.lifecycleProof?.restart?.idempotentContinuation ? "verified" : "unavailable"}`,
    "",
    "## Afterglow working copy",
    "",
    `Ready: ${machine.afterglowBootstrap.ready ? "yes" : "no"}`,
    `Project: ${machine.afterglowBootstrap.projectId || "unavailable"}`,
    `Path: ${machine.afterglowBootstrap.workingCopyCreatedThrough || "Library bootstrap failed"}`,
    "",
    "## Application lifecycle",
    "",
    `Application process restarted: ${machine.restartProof.applicationProcessRestarted ? "yes" : "no"}`,
    `Boundary: ${machine.restartProof.boundary}`,
    `State continuity verified: ${machine.restartProof.verified ? "yes" : "no"}`,
    "",
    "## Durable Guest task proof",
    "",
    `Initialized before restart: ${machine.taskLedgerProof.initialized ? "yes" : "no"}`,
    `Claimed after restart: ${machine.taskLedgerProof.claimedAfterRestart ? "yes" : "no"}`,
    `Completed from operated route receipt: ${machine.taskLedgerProof.completedFromOperatedRoute ? "yes" : "no"}`,
    `Final state: ${machine.taskLedgerProof.finalState || "unavailable"}`,
    "",
    "## Route passes",
    "",
    `Before restart: ${machine.routePasses.before.overall || "unknown"} (exit ${machine.routePasses.before.exitCode})`,
    `After restart: ${machine.routePasses.after.overall || "unknown"} (exit ${machine.routePasses.after.exitCode})`,
  ];
  if (machine.blockers.length) {
    lines.push("", "## Blockers", "");
    for (const mismatch of machine.blockers) lines.push(`- ${mismatch}`);
  }
  lines.push("", "Evidence contains bounded autonomous Guest authority, process identities, working-copy identity, canonical project/revision/state digests, task lifecycle state and route outcomes only; no hidden reasoning, credentials or private Human story text is stored.", "");
  return lines.join("\n");
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const lifecycle = createManagedPlotPickleLifecycle({
    repoRoot,
    baseUrl,
    env: {
      PLOTPICKLE_AUTONOMOUS_GUEST_ENABLED: "true",
      PLOTPICKLE_AUTONOMOUS_RUN_ID: autonomousRunId,
      PLOTPICKLE_AUTONOMOUS_OPERATOR_ID: autonomousOperatorId,
    },
  });
  let firstStart = null;
  let bootstrap = null;
  let before = null;
  let lifecycleRestart = null;
  let after = null;
  let finalStop = null;
  let initializedTask = null;
  let claimedTask = null;
  let completedTask = null;
  let finalTaskStatus = null;
  try {
    firstStart = await lifecycle.start();
    bootstrap = await runAfterglowBootstrap();
    if (bootstrap.child.code !== 0 || !bootstrap.report?.projectId) {
      throw new Error(bootstrap.error || bootstrap.child.error || "Afterglow working copy was not created through the normal Library flow.");
    }
    before = await runRoutePass("before application restart");
    const operatedDecision = routeResult(before?.report, "story-decisions")?.action;
    if (!operatedDecision?.decisionId || !["applied", "completed-no-change"].includes(operatedDecision.outcome)) {
      throw new Error("Autonomous reference did not earn and operate a Story Decision before restart.");
    }
    await writeFile(generatedRouteInputsPath, `${JSON.stringify({ decisionId: operatedDecision.decisionId }, null, 2)}\n`, "utf8");
    const currentRevision = canonicalRevision(before?.report, bootstrap.report.projectId);
    if (!currentRevision) throw new Error("Autonomous reference could not derive the real Afterglow PPF revision before task scheduling.");
    initializedTask = await referenceTaskAction({
      action: "initialize",
      projectId: bootstrap.report.projectId,
      currentRevision,
      routeIds: ["library"],
    });
    lifecycleRestart = await lifecycle.restart();
    claimedTask = await referenceTaskAction({ action: "claim", routeId: "library" });
    if (claimedTask?.state !== "running" || !claimedTask?.taskId || !claimedTask?.leaseId) {
      throw new Error("Autonomous Guest Library reference task did not survive restart into a claimable running lease.");
    }
    after = await runRoutePass("after application restart");
    const library = routeResult(after?.report, "library");
    completedTask = await referenceTaskAction({
      action: "finish",
      routeId: "library",
      taskId: claimedTask.taskId,
      leaseId: claimedTask.leaseId,
      disposition: library?.disposition || "failed-defect",
      actionId: library?.action?.actionId || "",
      revision: library?.action?.revision || "",
    });
    finalTaskStatus = await referenceTaskAction({ action: "status" });
  } finally {
    finalStop = await lifecycle.stop();
  }

  const restartProof = compareAcrossApplicationRestart(before?.report, after?.report, lifecycleRestart);
  const routePasses = {
    before: { exitCode: before?.child?.code ?? 1, overall: before?.report?.overall || "FAIL", error: before?.error || before?.child?.error || "" },
    after: { exitCode: after?.child?.code ?? 1, overall: after?.report?.overall || "FAIL", error: after?.error || after?.child?.error || "" },
  };
  const afterglowBootstrap = {
    ready: bootstrap?.child?.code === 0 && Boolean(bootstrap?.report?.projectId),
    action: bootstrap?.report?.action || "failed",
    projectId: bootstrap?.report?.projectId || "",
    sourceCatalogId: bootstrap?.report?.sourceCatalogId || "",
    sourceImmutable: bootstrap?.report?.sourceImmutable === true,
    workingCopyCreatedThrough: bootstrap?.report?.workingCopyCreatedThrough || "",
  };
  const authority = {
    authorityClass: "delegated-guest-autonomous-operator",
    delegated: true,
    humanProfileId: "",
    autonomousRunId,
    operatorId: autonomousOperatorId,
  };
  const finalLibraryTask = Array.isArray(finalTaskStatus?.tasks)
    ? finalTaskStatus.tasks.find((task) => task?.routeId === "library") || null
    : null;
  const beforeDecision = routeResult(before?.report, "story-decisions");
  const beforeWorkbench = routeResult(before?.report, "story-workbench");
  const afterDecision = routeResult(after?.report, "story-decisions");
  const afterWorkbench = routeResult(after?.report, "story-workbench");
  const decisionWorkbenchProof = {
    decisionId: String(beforeDecision?.action?.decisionId || ""),
    decisionOutcome: String(beforeDecision?.action?.outcome || ""),
    decisionOperated: beforeDecision?.disposition === "operated" && beforeDecision?.action?.succeeded === true,
    workbenchOperatedBeforeRestart: beforeWorkbench?.disposition === "operated" && beforeWorkbench?.action?.succeeded === true,
    decisionPersistedAfterRestart: afterDecision?.disposition === "operated"
      && afterDecision?.action?.outcome === "verified-existing-autonomous-decision"
      && afterDecision?.action?.decisionId === beforeDecision?.action?.decisionId,
    workbenchAfterRestart: String(afterWorkbench?.disposition || ""),
    canonChanged: beforeDecision?.action?.writesCanon === true,
    baseRevision: String(beforeDecision?.action?.receipt?.baseRevision || ""),
    resultingRevision: String(beforeDecision?.action?.revision || ""),
  };
  const taskLedgerProof = {
    routeId: "library",
    taskId: String(finalLibraryTask?.taskId || claimedTask?.taskId || ""),
    initialized: Array.isArray(initializedTask?.tasks) && initializedTask.tasks.some((task) => task?.routeId === "library"),
    claimedAfterRestart: claimedTask?.state === "running" && Boolean(claimedTask?.leaseId),
    completedFromOperatedRoute: completedTask?.state === "completed" && finalLibraryTask?.resultRefs?.includes("disposition:operated") === true,
    attempt: Number(finalLibraryTask?.attempt || 0),
    finalState: String(finalLibraryTask?.state || completedTask?.state || ""),
    resultRefs: Array.isArray(finalLibraryTask?.resultRefs) ? finalLibraryTask.resultRefs : [],
  };
  const blockers = [...restartProof.mismatches];
  if (!afterglowBootstrap.ready || afterglowBootstrap.sourceCatalogId !== "afterglow-v9" || afterglowBootstrap.sourceImmutable !== true) blockers.push("The deterministic Afterglow working copy was not proven through the normal immutable Library source flow.");
  if (routePasses.before.exitCode !== 0 || routePasses.before.overall === "FAIL") blockers.push("The pre-restart autonomous route pass did not complete successfully.");
  if (routePasses.after.exitCode !== 0 || routePasses.after.overall === "FAIL") blockers.push("The post-restart autonomous route pass did not complete successfully.");
  if (!taskLedgerProof.initialized || !taskLedgerProof.claimedAfterRestart || !taskLedgerProof.completedFromOperatedRoute || taskLedgerProof.finalState !== "completed") {
    blockers.push("The #1553 one-command reference did not prove a durable Guest task survived restart and completed from a real operated route receipt.");
  }
  if (!decisionWorkbenchProof.decisionId || !decisionWorkbenchProof.decisionOperated || !decisionWorkbenchProof.workbenchOperatedBeforeRestart || !decisionWorkbenchProof.decisionPersistedAfterRestart) {
    blockers.push("The autonomous reference did not earn and answer one Story Decision, apply it through the real Story Workbench route, and recover that answered Decision after restart.");
  }
  if (decisionWorkbenchProof.decisionOutcome !== "applied" || !decisionWorkbenchProof.canonChanged || !decisionWorkbenchProof.resultingRevision) {
    blockers.push("The autonomous Story Workbench did not prove one revision-safe canonical change.");
  }
  if (finalStop?.stopped !== true || finalStop?.endpointUnavailable !== true) blockers.push("The final PlotPickle application process did not stop cleanly.");

  let lifecycleProof = null;
  try {
    lifecycleProof = createAutonomousReferenceLifecycleProof({
      runId: autonomousRunId,
      operatorId: autonomousOperatorId,
      projectId: afterglowBootstrap.projectId,
      baseRevision: decisionWorkbenchProof.baseRevision,
      resultingRevision: decisionWorkbenchProof.resultingRevision,
      decisionId: decisionWorkbenchProof.decisionId,
      taskId: taskLedgerProof.taskId,
      workbenchEvidenceRef: `story-workbench-receipt:${decisionWorkbenchProof.decisionId}@${decisionWorkbenchProof.resultingRevision}`,
      beforeRouteEvidenceRef: `autonomous-route-pass:before:${afterglowBootstrap.projectId}@${decisionWorkbenchProof.resultingRevision}`,
      afterRouteEvidenceRef: `autonomous-route-pass:after:${afterglowBootstrap.projectId}@${decisionWorkbenchProof.resultingRevision}`,
      packageRef: `autonomous-reference-package:${afterglowBootstrap.projectId}@${decisionWorkbenchProof.resultingRevision}`,
      continuationRef: `guest-task:${taskLedgerProof.taskId}`,
      restartVerified: restartProof.verified === true,
      taskCompleted: taskLedgerProof.finalState === "completed" && taskLedgerProof.completedFromOperatedRoute,
      decisionApplied: decisionWorkbenchProof.decisionOutcome === "applied" && decisionWorkbenchProof.canonChanged,
      contractsPassed: before?.report?.contracts?.code === 0 && after?.report?.contracts?.code === 0,
      idempotentContinuation: decisionWorkbenchProof.decisionPersistedAfterRestart && taskLedgerProof.finalState === "completed" && routePasses.after.overall !== "FAIL",
    });
  } catch (error) {
    blockers.push(`Canonical lifecycle proof failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!lifecycleProof) blockers.push("The real autonomous Guest reference journey did not project through all seven canonical lifecycle stages.");

  const machine = {
    schemaVersion: 6,
    generatedAt: new Date().toISOString(),
    target: baseUrl,
    overall: blockers.length ? "FAIL" : "PASS",
    authority,
    lifecycleProof,
    afterglowBootstrap,
    applicationLifecycle: {
      initialProcess: firstStart,
      restart: lifecycleRestart,
      finalStop,
    },
    taskLedgerProof,
    decisionWorkbenchProof,
    routePasses,
    restartProof,
    blockers: [...new Set(blockers)],
    evidencePolicy: "No page text, hidden reasoning, credentials or private Human story content is persisted by the autonomous reference controller.",
  };
  await writeFile(jsonPath, `${JSON.stringify(machine, null, 2)}\n`, "utf8");
  await writeFile(reportPath, markdownReport(machine), "utf8");
  process.stdout.write(`Autonomous story reference ${machine.overall}. Report: ${reportPath}\n`);
  process.exitCode = machine.overall === "PASS" ? 0 : 1;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportPath, `# PlotPickle Autonomous Story Reference Run\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});