import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function renderFailureSummary(summary) {
  const lines = [
    "# PlotPickle developer diagnostics",
    "",
    `Result: ${summary.passed ? "PASS" : "FAIL"}`,
    `Failures: ${summary.counts.failures}`,
    `Affected test files: ${summary.counts.affectedFiles}`,
    `Cause clusters: ${summary.counts.clusters}`,
    "",
  ];

  if (summary.clusters.length) {
    lines.push("## Cause clusters", "");
    for (const cluster of summary.clusters) {
      lines.push(`- **${cluster.classification}** · ${cluster.count} failure${cluster.count === 1 ? "" : "s"} · confidence ${cluster.confidence}`);
      lines.push(`  - Evidence: ${cluster.message || "No normalized message available."}`);
      if (cluster.contracts.length) lines.push(`  - Contracts: ${cluster.contracts.join(", ")}`);
      if (cluster.testFiles.length) lines.push(`  - Tests: ${cluster.testFiles.join(", ")}`);
      if (cluster.sharedCause) lines.push("  - Shared cause candidate: yes; verification is still required.");
    }
    lines.push("");
  }

  if (summary.failures.length) {
    lines.push("## Failed tests", "");
    for (const failure of summary.failures) {
      const where = failure.testFile
        ? `${failure.testFile}${failure.line ? `:${failure.line}${failure.column ? `:${failure.column}` : ""}` : ""}`
        : "location unavailable";
      lines.push(`- ${failure.name}`);
      lines.push(`  - Location: ${where}`);
      lines.push(`  - Classification: ${failure.classification}`);
      lines.push(`  - Message: ${failure.message}`);
      if (failure.contracts.length) {
        lines.push(`  - Contract owners: ${failure.contracts.map((contract) => `${contract.id} → ${contract.owners.map((owner) => owner.path).join(" | ")}`).join("; ")}`);
      }
    }
    lines.push("");
  }

  if (summary.focusedCommandText) {
    lines.push("## Focused rerun", "", "```text", summary.focusedCommandText, "```", "");
  }

  if (summary.scope && !summary.scope.withinPlan) {
    lines.push("## Scope boundary", "", `Stopped: failures were reported outside the selected plan: ${summary.scope.outOfPlan.join(", ")}`, "");
  }

  return `${lines.join("\n")}\n`;
}

export async function writeFailureSummary(summary, options = {}) {
  const directory = path.resolve(options.root || process.cwd(), options.reportDirectory || "reports/developer-diagnostics");
  await mkdir(directory, { recursive: true });
  const jsonPath = path.join(directory, "summary.json");
  const markdownPath = path.join(directory, "summary.md");
  const markdown = renderFailureSummary(summary);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, markdown, "utf8"),
  ]);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n${markdown}`, "utf8");
  }
  return { directory, jsonPath, markdownPath };
}
