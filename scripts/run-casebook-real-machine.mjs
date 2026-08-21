#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildAdequacyReport, loadCasebook } from "./casebook-contract.mjs";
import {
  CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION,
  createRecordedRealMachineAdapter,
  runCasebookRealIntegrationCase,
} from "./casebook-real-integrations.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index];
  if (!token.startsWith("--")) continue;
  const value = process.argv[index + 1];
  if (value && !value.startsWith("--")) {
    args.set(token, value);
    index += 1;
  } else {
    args.set(token, "true");
  }
}

function percent(value) {
  return value == null ? "not measured" : `${(value * 100).toFixed(1)}%`;
}

function blockedRecord(caseDefinition) {
  return {
    schemaVersion: CASEBOOK_REAL_INTEGRATION_SCHEMA_VERSION,
    caseId: caseDefinition.id,
    mode: "real-machine",
    steps: [],
    faults: [],
    independentVerification: {
      id: `${caseDefinition.id}-real-machine-evidence-missing`,
      kind: "evaluation",
      status: "unverified",
      source: caseDefinition.independentVerification.source,
      independent: true,
      summary: "Real-machine evidence has not been recorded for this Case.",
    },
  };
}

async function readRecord(recordDir, caseDefinition) {
  const file = path.join(recordDir, `${caseDefinition.id}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return blockedRecord(caseDefinition);
    throw new Error(`Could not read real-machine evidence for ${caseDefinition.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function reportMarkdown(report, results) {
  const rows = results.map((result) => `| ${result.caseId} | ${result.status.toUpperCase()} | ${result.realIntegrationVerified ? "yes" : "no"} | ${(result.faultResults || []).filter((item) => item.injected && item.detected).length}/${(result.faultResults || []).filter((item) => item.injected).length} |`);
  return [
    "# PlotPickle Casebook real-machine verification",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| Business Case | Result | Real integration | Injected faults detected |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## Quantitative adequacy",
    "",
    `- Journey completion: ${percent(report.metrics.journeyCompletionRate)}`,
    `- Outcome-proof coverage: ${percent(report.metrics.requiredOutcomeProofCoverage)}`,
    `- Independent-verification coverage: ${percent(report.metrics.independentVerificationCoverage)}`,
    `- Real-integration coverage: ${percent(report.metrics.realIntegrationCoverage)}`,
    `- Injected-failure detection rate: ${percent(report.metrics.injectedFailureDetectionRate)}`,
    `- Visual-evidence coverage: ${percent(report.metrics.visualEvidenceCoverage)}`,
    `- Unreached critical interactions: ${report.metrics.unreachedCriticalInteractions}`,
    "",
    "BLOCKED and UNCERTAIN are intentionally non-green. Missing real-machine observations must never be converted into PASS by a worker claim or contract-only test.",
    "",
  ].join("\n");
}

async function main() {
  const casebook = await loadCasebook();
  const recordDir = path.resolve(args.get("--record-dir") || path.join(repoRoot, "reports", "casebook-real-machine", "records"));
  const outputDir = path.resolve(args.get("--output-dir") || path.join(repoRoot, "reports", "casebook-real-machine"));
  const maxFaults = Math.max(1, Number(args.get("--max-faults") || 1));
  const results = [];
  const manifests = [];

  for (const caseDefinition of casebook.cases.filter((item) => item.priority === "P0")) {
    const record = await readRecord(recordDir, caseDefinition);
    const adapter = createRecordedRealMachineAdapter(caseDefinition, record);
    const run = await runCasebookRealIntegrationCase(caseDefinition, adapter, {
      runId: `${caseDefinition.id}:real-machine:${Date.now()}`,
      maxFaults,
      criticalInteractionsUnreached: Number(record.criticalInteractionsUnreached || 0),
      blockers: Array.isArray(record.blockers) ? record.blockers : [],
    });
    results.push(run.result);
    manifests.push(run.manifest);
    process.stdout.write(`${caseDefinition.title.padEnd(48)} ${run.result.status.toUpperCase()}\n`);
  }

  const report = buildAdequacyReport(casebook, results);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "results.json"), `${JSON.stringify({ schemaVersion: 1, results }, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "evidence-manifests.json"), `${JSON.stringify({ schemaVersion: 1, manifests }, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "adequacy-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "adequacy-report.md"), reportMarkdown(report, results), "utf8");

  process.stdout.write(`\n${reportMarkdown(report, results)}`);
  if (results.some((item) => item.status !== "pass" || !item.realIntegrationVerified)) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
