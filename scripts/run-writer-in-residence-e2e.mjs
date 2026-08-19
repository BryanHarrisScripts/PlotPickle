#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { McpClient, resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";
import { runWriterAcceptanceCompletion } from "./writer-journey-completion.mjs";
import { observeWriterJourneyFinalState } from "./writer-journey-final-state.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
};
const has = (name) => argv.includes(name);
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const sessionId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "writer-in-residence", sessionId)));
const githubReport = has("--github-report");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "browser-profile");
const reportPath = path.join(artifactRoot, "writer-in-residence-report.json");
const markdownPath = path.join(artifactRoot, "writer-in-residence-report.md");

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(44, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

function forwardedArgs() {
  const output = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--github-report") continue;
    if (value === "--artifact-root") {
      index += 1;
      continue;
    }
    output.push(value);
  }
  return output;
}

async function runChild(script, args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(Number(code ?? 1)));
  });
}

function expandMcp(value) {
  return String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
}

async function openMcp() {
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Writer end-to-end observer requires the local Playwright MCP runtime.");
  const client = new McpClient(expandMcp(server.command), (server.args || []).map(expandMcp), {
    cwd: expandMcp(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expandMcp(value)])),
  });
  await client.initialize();
  const tools = await client.tools();
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot", "browser_evaluate"]) {
    if (!toolMap.has(required)) throw new Error(`Writer end-to-end observer is missing Playwright MCP tool ${required}.`);
  }
  return { client, tools, toolMap };
}

async function captureScreenshot(client, toolMap, name) {
  const tool = toolMap.get("browser_take_screenshot");
  if (!tool) return false;
  try {
    await client.call("browser_take_screenshot", toolArguments(tool, {
      type: "png",
      filename: `${name}.png`,
      fullPage: true,
    }));
    return true;
  } catch {
    return false;
  }
}

function failureFinding(check) {
  const fingerprint = createHash("sha256")
    .update(`final-state\n${check.id}\n${check.detail}`)
    .digest("hex")
    .slice(0, 20);
  const route = check.id.startsWith("learn") || check.id.startsWith("marquee")
    ? "/?workspace=learn"
    : check.id.startsWith("plan")
      ? "/?workspace=plan&section=foundations"
      : check.id.startsWith("build")
        ? "/?workspace=build&section=foundations"
        : "/?workspace=dashboard";
  return {
    fingerprint: `writer.final.${fingerprint}`,
    kind: "bug",
    severity: "high",
    actionable: true,
    summary: `Final-state audit failed: ${check.label}. ${check.detail}`.slice(0, 400),
    expectation: "A completed Writer-in-Residence run must reopen the actual persisted product and prove this milestone from real saved state and rendered UI.",
    impact: "Turn-level success can otherwise hide a broken end-to-end writer journey and present a false PASS.",
    turn: "final-state",
    route,
    source: "final-state-observer",
    evidence: JSON.stringify(check.evidence || {}).slice(0, 1_500),
  };
}

async function copyMarketingPoster(audit) {
  const assetUrl = audit?.marketingReference?.assetUrl;
  if (!assetUrl || !assetUrl.startsWith("/api/local-ai/assets/")) return "";
  const response = await fetch(new URL(assetUrl, baseUrl), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Marketing Reference asset returned HTTP ${response.status}.`);
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const extension = contentType.includes("webp") ? ".webp" : contentType.includes("jpeg") ? ".jpg" : ".png";
  const directory = path.join(artifactRoot, "final-state");
  await mkdir(directory, { recursive: true });
  const output = path.join(directory, `poster-marketing-reference${extension}`);
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
  return output;
}

function completionDiary(completion) {
  return (completion?.steps || []).map((step, index) => ({
    turn: `acceptance-${index + 1}`,
    area: step.id,
    route: step.id === "plan"
      ? "/?workspace=plan&section=foundations"
      : step.id === "build"
        ? "/?workspace=build&section=foundations"
        : "/?workspace=learn",
    summary: step.detail,
    action: { type: "visible-ui-acceptance", target: step.id },
    result: { ok: true, recovered: false, detail: step.detail },
    observations: [],
  }));
}

function auditDiary(audit) {
  return (audit?.checks || []).map((item, index) => ({
    turn: `final-audit-${index + 1}`,
    area: "final-state-audit",
    route: item.id.startsWith("plan")
      ? "/?workspace=plan&section=foundations"
      : item.id.startsWith("build")
        ? "/?workspace=build&section=foundations"
        : item.id.startsWith("dashboard")
          ? "/?workspace=dashboard"
          : "/?workspace=learn",
    summary: `${item.passed ? "PASS" : "FAIL"} · ${item.label} · ${item.detail}`,
    action: { type: "read-only-observe", target: item.id },
    result: { ok: item.passed, recovered: false, detail: item.detail },
    observations: [],
  }));
}

async function writeAugmentedReport({ baseExitCode, completion, audit, completionError }) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const failedChecks = (audit?.checks || []).filter((item) => !item.passed);
  const finalFindings = failedChecks.map(failureFinding);
  const existingObservations = Array.isArray(report.observations) ? report.observations : [];
  const existingPromoted = Array.isArray(report.promotedFindings) ? report.promotedFindings : [];
  const existingDiary = Array.isArray(report.diary) ? report.diary : [];
  const overallPass = baseExitCode === 0 && completion?.completed === true && audit?.passed === true && !completionError;

  report.schemaVersion = Math.max(6, Number(report.schemaVersion || 0));
  report.finishedReason = overallPass ? "complete-journey" : "final-state-audit-failed";
  report.completionJourney = completion;
  report.finalStateAudit = audit;
  report.session = {
    ...(report.session || {}),
    syntheticOwner: report.persona?.name || "Avery North",
    completionFrontier: "BUILD",
    finalStateAccepted: overallPass,
  };
  report.diary = [...existingDiary, ...completionDiary(completion), ...auditDiary(audit)];
  report.observations = [...existingObservations, ...finalFindings];
  report.promotedFindings = [...existingPromoted, ...finalFindings]
    .filter((item, index, list) => list.findIndex((candidate) => candidate.fingerprint === item.fingerprint) === index)
    .slice(0, Math.max(16, existingPromoted.length + finalFindings.length));
  report.runnerFindings = [
    ...(Array.isArray(report.runnerFindings) ? report.runnerFindings : []),
    ...(completionError ? [{ turn: "acceptance-completion", message: completionError }] : []),
  ];

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const appendix = [
    "",
    "## End-to-end final-state acceptance",
    "",
    `**Visible completion journey:** ${completion?.completed ? "PASS" : "FAIL"}`,
    `**Independent reopened-state audit:** ${audit?.passed ? "PASS" : "FAIL"}`,
    `**Overall Writer-in-Residence acceptance:** ${overallPass ? "PASS" : "FAIL"}`,
    completionError ? `**Completion error:** ${completionError}` : "",
    "",
    ...(audit?.checks || []).map((item) => `- ${item.passed ? "PASS" : "FAIL"} · ${item.label} — ${item.detail}`),
    "",
  ].filter(Boolean).join("\n");
  let existingMarkdown = "# PlotPickle Writer-in-Residence\n";
  try { existingMarkdown = await readFile(markdownPath, "utf8"); } catch {}
  await writeFile(markdownPath, `${existingMarkdown.trimEnd()}\n${appendix}\n`, "utf8");
  return { report, overallPass };
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(pluginData, { recursive: true });

  status("Writer v4 exploratory journey", "START");
  const baseExitCode = await runChild(path.join(repoRoot, "scripts", "run-writer-in-residence-v4.mjs"), [
    ...forwardedArgs(),
    "--artifact-root",
    artifactRoot,
  ]);
  status("Writer v4 exploratory journey", baseExitCode === 0 ? "PASS" : "WARN", `exit ${baseExitCode}`);

  const baseReport = JSON.parse(await readFile(reportPath, "utf8"));
  let completion = { schemaVersion: 1, completed: false, authority: "synthetic-writer-visible-ui-only", steps: [] };
  let audit = { schemaVersion: 1, passed: false, checks: [], marketingReference: null, ledger: [] };
  let completionError = "";
  let clientBundle = null;

  try {
    clientBundle = await openMcp();
    status("Avery visible acceptance completion", "START");
    completion = await runWriterAcceptanceCompletion({
      client: clientBundle.client,
      toolMap: clientBundle.toolMap,
      resultText,
      baseUrl,
      storySeed: baseReport.storySeed,
      onStatus: (id, detail) => status(`Acceptance · ${id}`, "PASS", detail),
    });
    status("Avery visible acceptance completion", "PASS", `${completion.steps.length} milestone(s)`);
  } catch (error) {
    completionError = error instanceof Error ? error.message : String(error);
    status("Avery visible acceptance completion", "FAIL", completionError);
  }

  try {
    if (!clientBundle) clientBundle = await openMcp();
    status("Independent final-state observer", "START");
    audit = await observeWriterJourneyFinalState({
      client: clientBundle.client,
      resultText,
      baseUrl,
      captureScreenshot: (name) => captureScreenshot(clientBundle.client, clientBundle.toolMap, name),
    });
    status("Independent final-state observer", audit.passed ? "PASS" : "FAIL", `${audit.checks.filter((item) => item.passed).length}/${audit.checks.length}`);
    if (audit.marketingReference) {
      const copied = await copyMarketingPoster(audit);
      if (copied) status("Dashboard session poster evidence", "PASS", path.relative(artifactRoot, copied));
    }
  } finally {
    if (clientBundle) {
      try {
        if (clientBundle.tools.some((tool) => tool.name === "browser_close")) await clientBundle.client.call("browser_close", {});
      } catch {}
      await clientBundle.client.close().catch(() => {});
    }
  }

  const { overallPass } = await writeAugmentedReport({ baseExitCode, completion, audit, completionError });

  if (githubReport) {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (Array.isArray(report.promotedFindings) && report.promotedFindings.length) {
      const reporterExit = await runChild(path.join(repoRoot, "scripts", "report-writer-in-residence.mjs"), ["--report", reportPath]);
      if (reporterExit !== 0) process.exitCode = 1;
    }
  }

  if (!overallPass) process.exitCode = 1;
  status("Writer-in-Residence end-to-end", overallPass ? "COMPLETE" : "INCOMPLETE", artifactRoot);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactRoot, "writer-in-residence-e2e-error.txt"), `${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
