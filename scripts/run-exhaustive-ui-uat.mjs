#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildUatFinding } from "../lib/sage-conversation-uat.mjs";
import { McpClient } from "./creative-uat/mcp-runtime.mjs";
import { runExhaustiveUiControlAudit } from "./exhaustive-ui-control-audit.mjs";
import { bestEffortLiveBuzzActivity } from "./buzz-live-activity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
};
const has = (name) => args.includes(name);
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat-exhaustive")));
const githubReport = has("--github-report");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "browser-profile");

function status(label, state, detail = "") {
  const left = String(label).padEnd(38, ".");
  process.stdout.write(`${left} ${state}${detail ? `  ${detail}` : ""}\n`);
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(pluginData, { recursive: true });
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Exhaustive PlotPickle UAT requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), (server.args || []).map(expand), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });

  let audit;
  let tools = [];
  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_evaluate"]) {
      if (!toolMap.has(required)) throw new Error(`Exhaustive PlotPickle UAT is missing Playwright MCP tool ${required}.`);
    }
    status("Synthetic UAT boundary", "READY", "code-aware inspector + rendered UI/UX; no credentials, destructive actions, paid generation, or cloud switching");
    audit = await runExhaustiveUiControlAudit({ client, toolMap, baseUrl, repoRoot, status });
  } finally {
    try { if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {}); } catch {}
    await client.close().catch(() => {});
  }

  const findings = (audit.findings || []).map((item) => buildUatFinding({
    message: item.summary,
    area: "exhaustive-ui-ux",
    evidence: {
      target: baseUrl,
      expectation: item.expectation,
      impact: item.impact,
      detail: item.evidence,
      source: "code-aware-exhaustive-ui-control-audit",
    },
  }));
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: baseUrl,
    overall: audit.complete ? "PASS" : "FAIL",
    audit,
    findings,
  };
  const reportPath = path.join(artifactRoot, "exhaustive-ui-uat-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(artifactRoot, "exhaustive-ui-uat-report.md"), [
    "# PlotPickle exhaustive synthetic UAT",
    "",
    `Overall: ${report.overall}`,
    `Safe controls: ${audit.totals.safe}`,
    `Passed: ${audit.totals.passed}`,
    `Blocked by safety boundary: ${audit.totals.blocked}`,
    `Dead controls: ${audit.totals.dead}`,
    `Untested safe controls: ${audit.totals.untested}`,
    "",
    "## Screen coverage",
    ...(audit.screens || []).map((screen) => `- ${screen.label}: ${screen.complete ? "PASS" : "FAIL"} — ${screen.passed}/${screen.safe} safe controls, ${screen.blocked} blocked, ${screen.dead} dead, ${screen.untested} untested`),
    "",
    "## Findings",
    ...(findings.length ? findings.map((finding) => `- ${finding.fingerprint}: ${finding.message}`) : ["- No exhaustive UAT blockers."]),
    "",
    `No-loop policy: ${audit.noLoopPolicy}`,
    `Settings policy: ${audit.settingsPolicy}`,
    "",
  ].join("\n"), "utf8");

  await bestEffortLiveBuzzActivity({
    type: "uat.result",
    actorId: "bram-gatewick",
    summary: `Exhaustive code/UI/UX UAT ${report.overall}: ${audit.totals.passed}/${audit.totals.safe} safe controls completed; dead=${audit.totals.dead}; untested=${audit.totals.untested}.`,
    severity: audit.complete ? "info" : "high",
    target: "all active PlotPickle screens and Settings controls",
    verified: true,
    actionable: !audit.complete,
    evidence: [{ label: "Exhaustive UAT report", ref: "exhaustive-ui-uat-report.json" }],
  }, { baseUrl });

  if (githubReport && findings.length) {
    const { spawn } = await import("node:child_process");
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "report-uat-findings.mjs"), "--report", reportPath], { cwd: repoRoot, env: process.env, stdio: "inherit", windowsHide: true });
      child.once("error", () => resolve(1));
      child.once("exit", (value) => resolve(Number(value ?? 1)));
    });
    if (code !== 0) process.exitCode = 1;
  }
  if (!audit.complete) process.exitCode = 1;
  status("Exhaustive synthetic UAT", audit.complete ? "PASS" : "FAIL", `report: ${reportPath}`);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactRoot, "exhaustive-ui-uat-error.txt"), `${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
