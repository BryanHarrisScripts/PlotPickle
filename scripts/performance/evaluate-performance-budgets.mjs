#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { analyzeBaselines } from "./analyze-real-machine-baselines.mjs";

const identityFields = [
  "platform",
  "arch",
  "node",
  "afterglowFixture",
  "ppfStartingRevision",
  "curriculumIdentity",
  "buzzMode",
];

function metricMax(summary) {
  return summary && Number.isFinite(summary.max) ? summary.max : null;
}

function addThresholdCheck(result, mode, metric, observed, budget) {
  if (!Number.isFinite(observed)) {
    result.failures.push(`${mode} ${metric}: measurement missing or non-finite.`);
    return;
  }
  const check = { mode, metric, observed, warningMax: budget.warningMax ?? null, hardMax: budget.hardMax ?? null, status: "pass" };
  if (Number.isFinite(budget.hardMax) && observed > budget.hardMax) {
    check.status = "fail";
    result.failures.push(`${mode} ${metric}: ${observed} exceeds hard maximum ${budget.hardMax}.`);
  } else if (Number.isFinite(budget.warningMax) && observed > budget.warningMax) {
    check.status = "warn";
    result.warnings.push(`${mode} ${metric}: ${observed} exceeds warning maximum ${budget.warningMax}.`);
  }
  result.checks.push(check);
}

function addHardMaxCheck(result, mode, metric, observed, hardMax) {
  addThresholdCheck(result, mode, metric, observed, { hardMax });
}

function validateEvidenceIdentity(result, contract, evidence, requestedModes) {
  for (const mode of requestedModes) {
    const samples = evidence.filter((entry) => entry?.mode === mode);
    if (samples.length < contract.identity.minimumHealthySamplesPerMode) {
      result.failures.push(`${mode}: expected at least ${contract.identity.minimumHealthySamplesPerMode} raw samples, found ${samples.length}.`);
      continue;
    }
    for (const [index, sample] of samples.entries()) {
      for (const field of identityFields) {
        if (sample.environment?.[field] !== contract.identity[field]) {
          result.failures.push(`${mode} sample ${index + 1}: environment.${field}=${JSON.stringify(sample.environment?.[field] ?? null)} does not match ratified ${JSON.stringify(contract.identity[field])}.`);
        }
      }
      if ((sample.environment?.optionalIntegrations?.length ?? 0) !== 0) {
        result.failures.push(`${mode} sample ${index + 1}: optional integrations must be absent from the ratified core/local budget workload.`);
      }
    }
  }
}

export function evaluatePerformanceBudgets({ contract, evidence, scope }) {
  const requestedModes = contract.scopes?.[scope];
  if (!Array.isArray(requestedModes) || requestedModes.length === 0) throw new Error(`Unknown or empty budget scope: ${scope}`);
  const scopedEvidence = evidence.filter((entry) => requestedModes.includes(entry?.mode));
  const analysis = analyzeBaselines(scopedEvidence);
  const result = {
    schemaVersion: 1,
    benchmarkIssue: 1411,
    baselineVersion: contract.baselineVersion,
    scope,
    requestedModes,
    warnings: [],
    failures: [],
    checks: [],
    analysisReadyForBudgetRatification: analysis.readyForBudgetRatification,
  };

  validateEvidenceIdentity(result, contract, scopedEvidence, requestedModes);

  for (const mode of requestedModes) {
    const measured = analysis.modes?.[mode];
    const budget = contract.modes?.[mode];
    if (!budget) {
      result.failures.push(`${mode}: no ratified budget exists.`);
      continue;
    }
    if (!measured) {
      result.failures.push(`${mode}: no authoritative analysis exists.`);
      continue;
    }
    if (!measured.identityStable) result.failures.push(`${mode}: repeated evidence identity is not stable.`);
    if (!measured.readyForBudgetRatification) result.failures.push(`${mode}: repeated authoritative evidence is not ratification-ready.`);
    if (measured.healthySampleCount < contract.identity.minimumHealthySamplesPerMode) {
      result.failures.push(`${mode}: only ${measured.healthySampleCount} healthy authoritative samples remain after validation.`);
    }

    for (const [field, threshold] of Object.entries(budget.startup ?? {})) {
      addThresholdCheck(result, mode, `startup.${field}.max`, metricMax(measured.startup?.[field]), threshold);
    }
    for (const [route, threshold] of Object.entries(budget.repeatedUsefulInteractiveMs ?? {})) {
      addThresholdCheck(result, mode, `browser.repeatedAccess.${route}.usefulInteractiveMs.max`, metricMax(measured.browser?.repeatedAccess?.[route]?.usefulInteractiveMs), threshold);
    }

    const idle = contract.sharedHardLimits.idle;
    for (const field of ["sameOriginRequestCount", "apiRequestCount", "externalRequestCount", "domMutationCount"]) {
      addHardMaxCheck(result, mode, `browser.idle.${field}.max`, metricMax(measured.browser?.idle?.[field]), idle[field]);
    }
    addHardMaxCheck(result, mode, "processIdle.explicitAgentOrModelProcessCount.max", metricMax(measured.processIdle?.explicitAgentOrModelProcessCount), idle.explicitAgentOrModelProcessCount);

    for (const [field, threshold] of Object.entries(contract.sharedHardLimits.processMemory ?? {})) {
      addThresholdCheck(result, mode, `processIdle.${field}.max`, metricMax(measured.processIdle?.[field]), threshold);
    }

    if (budget.workflowHardMax) {
      const comparison = measured.workflow?.comparison;
      addHardMaxCheck(result, mode, "workflow.comparison.workItemRatio.max", metricMax(comparison?.workItemRatio), budget.workflowHardMax.workItemRatio);
      addHardMaxCheck(result, mode, "workflow.comparison.specialistRatio.max", metricMax(comparison?.specialistRatio), budget.workflowHardMax.specialistRatio);
      addHardMaxCheck(result, mode, "workflow.comparison.contextByteRatio.max", metricMax(comparison?.contextByteRatio), budget.workflowHardMax.contextByteRatio);
      if (budget.workflowRequirements?.allSamplesBounded && comparison?.boundedSamples !== measured.workflow?.samples) {
        result.failures.push(`${mode}: bounded targeted re-evaluation was not proven in every healthy sample.`);
      }
      if (budget.workflowRequirements?.allSamplesPreserveUnaffected && measured.workflow?.targetedReevaluation?.preservedUnaffectedSamples !== measured.workflow?.samples) {
        result.failures.push(`${mode}: unaffected completed work was not preserved in every healthy sample.`);
      }
    }
  }

  result.status = result.failures.length > 0 ? "fail" : result.warnings.length > 0 ? "warn" : "pass";
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name, fallback = null) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const contractPath = option("--contract", new URL("./performance-budgets.json", import.meta.url).pathname);
  const scope = option("--scope");
  const output = option("--output");
  if (!scope) throw new Error("Pass --scope startup or --scope story-workflow-local.");
  const consumed = new Set();
  for (const name of ["--contract", "--scope", "--output"]) {
    const index = args.indexOf(name);
    if (index >= 0) {
      consumed.add(index);
      consumed.add(index + 1);
    }
  }
  const inputFiles = args.filter((_, index) => !consumed.has(index));
  if (inputFiles.length === 0) throw new Error("Pass the raw repeated #1411 evidence JSON files to evaluate.");
  const contract = JSON.parse(await readFile(path.resolve(contractPath), "utf8"));
  const evidence = await Promise.all(inputFiles.map(async (file) => JSON.parse(await readFile(path.resolve(file), "utf8"))));
  const report = evaluatePerformanceBudgets({ contract, evidence, scope });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) await writeFile(path.resolve(output), json, "utf8");
  process.stdout.write(json);
  if (report.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1]).replaceAll("\\", "/")}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
