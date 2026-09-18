import { readFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export function renderGitHubSummary(payload = {}) {
  const reportDate = String(payload.reportDate || "").trim() || "unknown date";
  const reportUrl = String(payload.reportUrl || "").trim();
  const reviewCount = Number(payload.reviewCount || 0);
  const reviewTarget = Number(payload.reviewTarget || 0);
  const publicDigest = String(payload.publicDigest || "").trim();

  return [
    `# PlotPickle OSS Radar — ${reportDate}`,
    "",
    reportUrl ? `[Open the full OSS Radar report](${reportUrl})` : "Full Radar report link unavailable.",
    "",
    `Architecture findings: ${reviewCount}/${reviewTarget || reviewCount}`,
    "",
    "## X-ready post",
    "",
    "```text",
    publicDigest || "No X-ready public digest was generated.",
    "```",
    "",
    "---",
    "",
    "Presented by PlotPickle — Today’s OSS Radar.",
    "",
  ].join("\n");
}

export async function appendGitHubSummary({ resultPath, summaryPath } = {}) {
  if (!resultPath) throw new Error("OSS Radar GitHub summary requires a result JSON path.");
  if (!summaryPath) throw new Error("OSS Radar GitHub summary requires GITHUB_STEP_SUMMARY.");
  const payload = JSON.parse(await readFile(resultPath, "utf8"));
  await appendFile(summaryPath, renderGitHubSummary(payload), "utf8");
}

const directUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (directUrl && import.meta.url === directUrl) {
  const [, , resultPath] = process.argv;
  appendGitHubSummary({ resultPath, summaryPath: process.env.GITHUB_STEP_SUMMARY })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
