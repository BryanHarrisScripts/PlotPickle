#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildAdequacyReport, loadCasebook } from "./casebook-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};

function percent(metric) {
  return metric == null ? "not measured" : `${(metric * 100).toFixed(1)}%`;
}

function markdown(report) {
  return [
    "# PlotPickle Casebook adequacy report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## P0 disposition",
    "",
    `- Defined: ${report.totals.p0CasesDefined}/${report.totals.p0CasesExpected}`,
    `- Results: ${report.totals.p0CasesWithResult}/${report.totals.p0CasesDefined}`,
    `- PASS: ${report.totals.pass}`,
    `- FAIL: ${report.totals.fail}`,
    `- BLOCKED: ${report.totals.blocked}`,
    `- UNCERTAIN: ${report.totals.uncertain}`,
    "",
    "## Adequacy metrics",
    "",
    `- Critical business-case coverage: ${percent(report.metrics.criticalBusinessCaseCoverage)}`,
    `- Journey completion rate: ${percent(report.metrics.journeyCompletionRate)}`,
    `- Required outcome-proof coverage: ${percent(report.metrics.requiredOutcomeProofCoverage)}`,
    `- Independent-verification coverage: ${percent(report.metrics.independentVerificationCoverage)}`,
    `- Injected-failure detection rate: ${percent(report.metrics.injectedFailureDetectionRate)}`,
    `- Unreached critical interactions: ${report.metrics.unreachedCriticalInteractions}`,
    `- Visual-evidence coverage: ${percent(report.metrics.visualEvidenceCoverage)}`,
    `- Real-integration coverage: ${percent(report.metrics.realIntegrationCoverage)}`,
    `- Flake rate: ${percent(report.metrics.flakeRate)}`,
    `- Escaped-defect rate: ${percent(report.metrics.escapedDefectRate)}`,
    "",
    "## Notes",
    "",
    ...report.notes.map((note) => `- ${note}`),
    "",
  ].join("\n");
}

async function main() {
  const casebookPath = value("--casebook", path.join(repoRoot, "config", "casebook", "p0-cases.json"));
  const resultsPath = value("--results");
  const outputDir = path.resolve(value("--output-dir", path.join(repoRoot, "reports", "casebook")));
  const casebook = await loadCasebook(path.resolve(casebookPath));
  const results = resultsPath ? JSON.parse(await readFile(path.resolve(resultsPath), "utf8")) : [];
  const normalizedResults = Array.isArray(results) ? results : results.results || [];
  const report = buildAdequacyReport(casebook, normalizedResults);
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "adequacy-report.json");
  const markdownPath = path.join(outputDir, "adequacy-report.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown(report), "utf8");
  process.stdout.write(`${markdown(report)}\nJSON: ${jsonPath}\nMarkdown: ${markdownPath}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
