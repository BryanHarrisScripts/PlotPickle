#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { McpClient, resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";
import { writerExplorationAcceptance } from "./writer-e2e-acceptance-policy.mjs";
import { runWriterAcceptanceCompletion } from "./writer-journey-completion.mjs";
import { observeWriterJourneyFinalState } from "./writer-journey-final-state.mjs";
import { runSageAcceptance } from "./writer-sage-acceptance.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function cliValue(flag) {
  const marker = argv.indexOf(flag);
  if (marker < 0) return "";
  return String(argv[marker + 1] || "").trim();
}

const has = (name) => argv.includes(name);
const baseUrl = cliValue("--base-url") || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173";
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const sessionId = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const artifactRoot = path.resolve(cliValue("--artifact-root") || path.join(localRoot, "PlotPickle", "writer-in-residence", sessionId));
const githubReport = has("--github-report");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "browser-profile");
const reportPath = path.join(artifactRoot, "writer-in-residence-report.json");
const markdownPath = path.join(artifactRoot, "writer-in-residence-report.md");

function exactHeadProvenance() {
  const testedCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  const workingTreeClean = execFileSync("git", ["status", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
  }).trim() === "";
  return Object.freeze({
    testedCommit,
    workingTreeClean,
    platform: process.platform,
    platformRelease: os.release(),
    nodeVersion: process.version,
    endpoint: baseUrl,
    runtimeSource: process.env.PLOTPICKLE_WRITER_RUNTIME_SOURCE || "unknown",
  });
}

let runProvenance = null;

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
  if (!server || server.type !== "stdio") throw new Error("Writer end-to-end acceptance requires the local Playwright MCP runtime.");
  const client = new McpClient(expandMcp(server.command), (server.args || []).map(expandMcp), {
    cwd: expandMcp(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expandMcp(value)])),
  });
  await client.initialize();
  const tools = await client.tools();
  const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot", "browser_evaluate"]) {
    if (!toolMap.has(required)) throw new Error(`Writer end-to-end acceptance is missing Playwright MCP tool ${required}.`);
  }
  return { client, tools, toolMap };
}

async function captureScreenshot(client, toolMap, name) {
  const tool = toolMap.get("browser_take_screenshot");
  if (!tool) throw new Error("Writer final-state observer requires browser_take_screenshot evidence.");
  await client.call("browser_take_screenshot", toolArguments(tool, {
    type: "png",
    filename: `${name}.png`,
    fullPage: true,
  }));
  return true;
}

function findingRoute(id) {
  if (id.startsWith("world.plan")) return "/?workspace=plan&section=world";
  if (id.startsWith("world.build")) return "/?workspace=build&section=world";
  if (id.startsWith("learn") || id.startsWith("world.learn") || id.startsWith("marquee")) return "/?workspace=learn";
  if (id.startsWith("plan")) return "/?workspace=plan&section=foundations";
  if (id.startsWith("build")) return "/?workspace=build&section=foundations";
  return "/?workspace=dashboard";
}

function failureFinding(check) {
  const fingerprint = createHash("sha256")
    .update(`final-state\n${check.id}\n${check.detail}`)
    .digest("hex")
    .slice(0, 20);
  return {
    fingerprint: `writer.final.${fingerprint}`,
    kind: "bug",
    severity: "high",
    actionable: true,
    summary: `Final-state audit failed: ${check.label}. ${check.detail}`.slice(0, 400),
    expectation: "A completed Writer-in-Residence run must reopen the actual persisted product and prove this milestone from real saved state and rendered UI.",
    impact: "Turn-level success can otherwise hide a broken end-to-end writer journey and present a false PASS.",
    turn: "final-state",
    route: findingRoute(check.id),
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
    route: step.id === "world-plan"
      ? "/?workspace=plan&section=world"
      : step.id === "world-build"
        ? "/?workspace=build&section=world"
        : step.id === "plan"
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
    route: findingRoute(item.id),
    summary: `${item.passed ? "PASS" : "FAIL"} · ${item.label} · ${item.detail}`,
    action: { type: "read-only-observe", target: item.id },
    result: { ok: item.passed, recovered: false, detail: item.detail },
    observations: [],
  }));
}

function sageFromBaseReport(report) {
  const requested = Number(report?.sageConversation?.requested || 0);
  const completed = Number(report?.sageConversation?.completed || 0);
  return {
    schemaVersion: 1,
    authority: "synthetic-writer-visible-ui-only",
    requested,
    completed,
    passed: requested > 0 && completed === requested,
    source: "v4-exploration",
    failures: [],
  };
}

async function writeAugmentedReport({
  baseExitCode,
  sageAcceptance,
  completion,
  audit,
  completionError,
  auditError,
}) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  report.exploratoryExitCode = baseExitCode;
  const exploration = writerExplorationAcceptance(report, sageAcceptance);
  const failedChecks = (audit?.checks || []).filter((item) => !item.passed);
  const finalFindings = failedChecks.map(failureFinding);
  const existingObservations = Array.isArray(report.observations) ? report.observations : [];
  const existingPromoted = Array.isArray(report.promotedFindings) ? report.promotedFindings : [];
  const existingDiary = Array.isArray(report.diary) ? report.diary : [];
  const overallPass = exploration.passed
    && completion?.completed === true
    && audit?.passed === true
    && !completionError
    && !auditError;
  const worldPlanCheckpoint = audit?.ledger?.find((entry) => entry.id === "world-plan") || null;
  const discrepancyClassification = overallPass
    ? process.platform === "win32" && runProvenance.workingTreeClean && runProvenance.testedCommit !== "unknown"
      ? "STALE_EXTERNAL_TOPIC"
      : "UNCLASSIFIED_PENDING_EXACT_WINDOWS_LIVE_PROOF"
    : worldPlanCheckpoint?.status === "observer-failed"
        && ["payload-validation", "browser-evaluate", "result-parse"].includes(worldPlanCheckpoint.stage)
      ? "HARNESS_OR_RUNTIME_COMPATIBILITY_DEFECT"
      : worldPlanCheckpoint?.status === "product-state-failed"
        ? "PRODUCT_DOM_CONTRACT_DRIFT"
        : "RECURRENT_PRODUCT_OR_OBSERVER_DEFECT";

  report.schemaVersion = Math.max(8, Number(report.schemaVersion || 0));
  report.finishedReason = overallPass ? "complete-journey" : "end-to-end-acceptance-failed";
  report.explorationAcceptance = exploration;
  report.sageAcceptance = sageAcceptance;
  report.completionJourney = completion;
  report.finalStateAudit = audit;
  report.revalidation = {
    schemaVersion: 1,
    provenance: runProvenance,
    averyPhase: exploration.passed ? "PASS" : "FAIL",
    visibleCompletion: completion?.completed === true ? "PASS" : "FAIL",
    sage: sageAcceptance?.passed === true ? "PASS" : "FAIL",
    independentFinalStateObserver: audit?.passed === true ? "PASS" : "FAIL",
    worldPlanObserver: worldPlanCheckpoint ? {
      status: worldPlanCheckpoint.status,
      stage: worldPlanCheckpoint.stage,
      detail: worldPlanCheckpoint.detail,
    } : { status: "not-reached", stage: "missing-ledger", detail: "World PLAN has no final-state ledger entry." },
    finalWriterAcceptance: overallPass ? "PASS" : "FAIL",
    fullVerificationIntegration: process.env.PLOTPICKLE_FULL_VERIFICATION_RUN_ID || "not-run-in-writer-wrapper",
    discrepancyClassification,
  };
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
    ...(sageAcceptance?.failures || []).map((item) => ({ turn: `sage-acceptance-${item.index}`, message: item.detail })),
    ...(completionError ? [{ turn: "acceptance-completion", message: completionError }] : []),
    ...(auditError ? [{ turn: "final-state-observer", message: auditError }] : []),
  ];

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const appendix = [
    "",
    "## End-to-end final-state acceptance",
    "",
    `**Tested commit:** ${runProvenance.testedCommit}`,
    `**Runtime provenance:** ${runProvenance.platform} ${runProvenance.platformRelease} · Node ${runProvenance.nodeVersion} · ${runProvenance.endpoint} · ${runProvenance.runtimeSource} · working tree ${runProvenance.workingTreeClean ? "clean" : "dirty"}`,
    `**Exploratory screen coverage:** ${exploration.journeyComplete ? "PASS" : "FAIL"}`,
    `**Required Sage conversation:** ${sageAcceptance?.completed || 0}/${sageAcceptance?.requested || 0}`,
    `**Visible completion journey:** ${completion?.completed ? "PASS" : "FAIL"}`,
    `**Independent reopened-state audit:** ${audit?.passed ? "PASS" : "FAIL"}`,
    `**World PLAN observer:** ${worldPlanCheckpoint?.status || "not-reached"} · ${worldPlanCheckpoint?.stage || "missing-ledger"}`,
    `**Overall Writer-in-Residence acceptance:** ${overallPass ? "PASS" : "FAIL"}`,
    `**External discrepancy classification:** ${discrepancyClassification}`,
    completionError ? `**Completion error:** ${completionError}` : "",
    auditError ? `**Observer error:** ${auditError}` : "",
    exploration.settingsDepthComplete ? "**Exploratory Settings depth:** PASS" : "**Exploratory Settings depth:** WARN (recorded, nonblocking for the story frontier)",
    "",
    ...(audit?.checks || []).map((item) => `- ${item.passed ? "PASS" : "FAIL"} · ${item.label} — ${item.detail}`),
    "",
  ].filter(Boolean).join("\n");
  const existingMarkdown = await readFile(markdownPath, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return "# PlotPickle Writer-in-Residence\n";
    throw error;
  });
  await writeFile(markdownPath, `${existingMarkdown.trimEnd()}\n${appendix}\n`, "utf8");
  return { report, overallPass, exploration };
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(pluginData, { recursive: true });
  runProvenance = exactHeadProvenance();
  status("Writer exact-head provenance", "INFO", `${runProvenance.testedCommit} · ${runProvenance.workingTreeClean ? "clean" : "dirty"} · ${runProvenance.platform} · ${runProvenance.endpoint} · ${runProvenance.runtimeSource}`);

  status("Writer v4 exploratory journey", "START");
  const baseExitCode = await runChild(path.join(repoRoot, "scripts", "run-writer-in-residence-v4.mjs"), [
    ...forwardedArgs(),
    "--artifact-root",
    artifactRoot,
  ]);
  status("Writer v4 exploratory journey", baseExitCode === 0 ? "PASS" : "WARN", `exit ${baseExitCode}`);

  const baseReport = JSON.parse(await readFile(reportPath, "utf8"));
  const writerConfig = JSON.parse(await readFile(path.join(repoRoot, "config", "writer-in-residence.json"), "utf8"));
  let sageAcceptance = sageFromBaseReport(baseReport);
  let completion = { schemaVersion: 1, completed: false, authority: "synthetic-writer-visible-ui-only", steps: [] };
  let audit = { schemaVersion: 3, passed: false, checks: [], marketingReference: null, ledger: [], observerFailures: [] };
  let completionError = "";
  let auditError = "";
  let clientBundle = null;

  try {
    clientBundle = await openMcp();

    if (!sageAcceptance.passed) {
      status("Required Sage conversation retry", "START", `${sageAcceptance.completed}/${sageAcceptance.requested} completed in exploration`);
      sageAcceptance = await runSageAcceptance({
        client: clientBundle.client,
        toolMap: clientBundle.toolMap,
        resultText,
        baseUrl,
        questions: writerConfig.requiredSageConversation,
        onStatus: (index, state, detail) => status(`Sage acceptance ${index}`, state, detail),
      });
      status("Required Sage conversation retry", sageAcceptance.passed ? "PASS" : "FAIL", `${sageAcceptance.completed}/${sageAcceptance.requested}`);
    }

    try {
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
      status("Independent final-state observer", "START");
      audit = await observeWriterJourneyFinalState({
        client: clientBundle.client,
        resultText,
        baseUrl,
        captureScreenshot: (name) => captureScreenshot(clientBundle.client, clientBundle.toolMap, name),
        provenance: runProvenance,
      });
      status("Independent final-state observer", audit.passed ? "PASS" : "FAIL", `${audit.checks.filter((item) => item.passed).length}/${audit.checks.length}`);
      if (audit.marketingReference) {
        const copied = await copyMarketingPoster(audit);
        if (copied) status("Dashboard session poster evidence", "PASS", path.relative(artifactRoot, copied));
      }
    } catch (error) {
      auditError = error instanceof Error ? error.message : String(error);
      status("Independent final-state observer", "FAIL", auditError);
    }
  } finally {
    if (clientBundle) {
      try {
        if (clientBundle.tools.some((tool) => tool.name === "browser_close")) await clientBundle.client.call("browser_close", {});
      } catch (error) {
        status("Writer browser close", "WARN", error instanceof Error ? error.message : String(error));
      }
      await clientBundle.client.close().catch(() => {});
    }
  }

  const { overallPass, exploration } = await writeAugmentedReport({
    baseExitCode,
    sageAcceptance,
    completion,
    audit,
    completionError,
    auditError,
  });

  status(
    "Story frontier acceptance",
    exploration.passed ? "PASS" : "FAIL",
    `coverage=${exploration.journeyComplete ? "yes" : "no"}, Sage=${exploration.sageCompleted}/${exploration.sageRequested}, Settings-depth=${exploration.settingsDepthComplete ? "pass" : "warn/nonblocking"}`,
  );

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
