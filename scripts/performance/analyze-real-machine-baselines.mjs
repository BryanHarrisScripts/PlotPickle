#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export function summarize(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mean = finite.reduce((sum, value) => sum + value, 0) / finite.length;
  const variance = finite.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / finite.length;
  return {
    samples: finite.length,
    min: finite[0],
    max: finite.at(-1),
    mean: Number(mean.toFixed(2)),
    standardDeviation: Number(Math.sqrt(variance).toFixed(2)),
  };
}

export function analyzeBaselines(evidenceList) {
  const authoritative = evidenceList.filter((entry) =>
    entry?.benchmarkIssue === 1411 &&
    entry?.authoritative === true &&
    entry?.environment?.platform === "win32"
  );
  const identities = new Set(authoritative.map((entry) => JSON.stringify({
    version: entry.environment?.plotpickleVersion ?? null,
    fixture: entry.environment?.afterglowFixture ?? null,
    curriculum: entry.environment?.curriculumIdentity ?? null,
    ppfRevision: entry.environment?.ppfStartingRevision ?? null,
    mode: entry.mode ?? null,
  })));
  const identityStable = identities.size <= 1;
  const routeLabels = new Set(authoritative.flatMap((entry) => entry.measurements?.navigation?.map((item) => item.label) ?? []));
  const navigation = Object.fromEntries([...routeLabels].sort().map((label) => [
    label,
    summarize(authoritative.flatMap((entry) => (entry.measurements?.navigation ?? []).filter((item) => item.label === label && item.ok).map((item) => item.elapsedMs))),
  ]));
  const memoryRss = summarize(authoritative.map((entry) => entry.measurements?.memory?.rssAfterBytes));
  const readyForBudgetRatification = authoritative.length >= 3 && identityStable;
  return {
    schemaVersion: 1,
    benchmarkIssue: 1411,
    authoritativeSampleCount: authoritative.length,
    identityStable,
    readyForBudgetRatification,
    navigation,
    memoryRss,
    budgetGuidance: readyForBudgetRatification
      ? "Repeated authoritative Windows samples exist with one stable workload identity. Human review may now ratify tolerances; this analyzer does not invent them."
      : "Keep budgets unratified until at least three authoritative Windows samples share one workload identity.",
  };
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const output = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const inputs = args.filter((arg, index) => arg !== "--output" && index !== outputIndex + 1);
  if (inputs.length === 0) throw new Error("Pass one or more #1411 benchmark evidence JSON files.");
  const evidence = await Promise.all(inputs.map(async (file) => JSON.parse(await readFile(file, "utf8"))));
  const report = analyzeBaselines(evidence);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (output) await writeFile(path.resolve(output), json, "utf8");
  else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1]).replaceAll("\\", "/")}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
