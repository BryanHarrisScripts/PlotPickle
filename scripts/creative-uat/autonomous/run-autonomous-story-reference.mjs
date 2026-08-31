#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
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
const bootstrapRunner = path.join(repoRoot, "scripts", "creative-uat", "autonomous", "bootstrap-afterglow-working-copy.mjs");
const bootstrapReportPath = path.join(artifactRoot, "afterglow-working-copy-bootstrap.json");
const routeRunner = path.join(repoRoot, "scripts", "creative-uat", "autonomous", "run-autonomous-story-routes.mjs");
const routeReportPath = path.join(artifactRoot, "autonomous-story-routes.json");
const reportPath = path.join(artifactRoot, "autonomous-story-reference.md");
const jsonPath = path.join(artifactRoot, "autonomous-story-reference.json");

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

async function runRoutePass(label) {
  const args = [routeRunner, "--base-url", baseUrl, "--artifact-root", artifactRoot];
  if (routeInputsPath) args.push("--route-inputs", routeInputsPath);
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

function continuitySurfaces(report) {
  return Array.isArray(report?.restartProof?.surfaces) ? report.restartProof.surfaces : [];
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
    "## Route passes",
    "",
    `Before restart: ${machine.routePasses.before.overall || "unknown"} (exit ${machine.routePasses.before.exitCode})`,
    `After restart: ${machine.routePasses.after.overall || "unknown"} (exit ${machine.routePasses.after.exitCode})`,
  ];
  if (machine.blockers.length) {
    lines.push("", "## Blockers", "");
    for (const mismatch of machine.blockers) lines.push(`- ${mismatch}`);
  }
  lines.push("", "Evidence contains bounded process identities, working-copy identity, canonical project/revision/state digests and route outcomes only; no hidden reasoning, credentials or private story text is stored.", "");
  return lines.join("\n");
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const lifecycle = createManagedPlotPickleLifecycle({ repoRoot, baseUrl });
  let firstStart = null;
  let bootstrap = null;
  let before = null;
  let lifecycleRestart = null;
  let after = null;
  let finalStop = null;
  try {
    firstStart = await lifecycle.start();
    bootstrap = await runAfterglowBootstrap();
    if (bootstrap.child.code !== 0 || !bootstrap.report?.projectId) {
      throw new Error(bootstrap.error || bootstrap.child.error || "Afterglow working copy was not created through the normal Library flow.");
    }
    before = await runRoutePass("before application restart");
    lifecycleRestart = await lifecycle.restart();
    after = await runRoutePass("after application restart");
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
  const blockers = [...restartProof.mismatches];
  if (!afterglowBootstrap.ready || afterglowBootstrap.sourceCatalogId !== "afterglow-v9" || afterglowBootstrap.sourceImmutable !== true) blockers.push("The deterministic Afterglow working copy was not proven through the normal immutable Library source flow.");
  if (routePasses.before.exitCode !== 0 || routePasses.before.overall === "FAIL") blockers.push("The pre-restart autonomous route pass did not complete successfully.");
  if (routePasses.after.exitCode !== 0 || routePasses.after.overall === "FAIL") blockers.push("The post-restart autonomous route pass did not complete successfully.");
  if (finalStop?.stopped !== true || finalStop?.endpointUnavailable !== true) blockers.push("The final PlotPickle application process did not stop cleanly.");

  const machine = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    target: baseUrl,
    overall: blockers.length ? "FAIL" : "PASS",
    afterglowBootstrap,
    applicationLifecycle: {
      initialProcess: firstStart,
      restart: lifecycleRestart,
      finalStop,
    },
    routePasses,
    restartProof,
    blockers: [...new Set(blockers)],
    evidencePolicy: "No page text, hidden reasoning, credentials or private story content is persisted by the autonomous reference controller.",
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
