#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { assessAutopilotEvidence, parseAcceptanceReport, parseContinuityReport } from "../lib/uat-autopilot.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
};
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat")));
const snapshotRoot = path.join(artifactRoot, "snapshots");
const browserReportPath = path.join(artifactRoot, "acceptance-report.md");
const continuityReportPath = path.join(artifactRoot, "ui-continuity-report.md");
const jsonReportPath = path.join(artifactRoot, "autopilot-report.json");
const markdownReportPath = path.join(artifactRoot, "autopilot-report.md");
const evidenceOnly = argv.includes("--evidence-only");

function runNode(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
}

async function readText(file) {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function snapshotLengths() {
  const lengths = {};
  try {
    const files = await readdir(snapshotRoot);
    for (const file of files.filter((name) => name.endsWith(".md"))) {
      lengths[file] = (await readText(path.join(snapshotRoot, file))).trim().length;
    }
  } catch {}
  return lengths;
}

async function fetchJson(url, init, timeoutMs = 15_000) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message || `${response.status} ${response.statusText}`);
  return payload;
}

async function probeLearn() {
  try {
    const url = new URL("/?workspace=learn", baseUrl);
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await response.text();
    const looksLikeLearn = /learn|curriculum|foundation/i.test(body);
    return {
      ok: response.ok && looksLikeLearn,
      status: response.status,
      bodyLength: body.length,
      message: response.ok && looksLikeLearn ? "" : `LEARN route returned HTTP ${response.status} without recognizable LEARN content.`,
    };
  } catch (error) {
    return { ok: false, status: 0, bodyLength: 0, message: `LEARN route probe failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function normalized(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sageAnswerPass(answer, question) {
  const text = String(answer || "").trim();
  if (text.length < 80) return false;
  const a = normalized(text);
  const q = normalized(question);
  if (!a || a === q) return false;
  if (a.includes(q) && a.split(/\s+/).length <= q.split(/\s+/).length + 8) return false;
  return !/(?:i cannot|i can't|unable to help|as an ai language model)/i.test(text);
}

async function loadRole(role) {
  return fetchJson(`${baseUrl}/api/local-ai/runtime/model/${role}/load`, { method: "POST" }, 45_000);
}

async function chat(body, timeoutMs = 75_000) {
  return fetchJson(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    body: JSON.stringify(body),
  }, timeoutMs);
}

async function probeAgents() {
  const result = {
    statusOk: false,
    statusMessage: "",
    mastraReady: false,
    sageRegistered: false,
    foundationsRegistered: false,
    fastAvailable: false,
    qualityAvailable: false,
    sageAttempted: false,
    sagePassed: false,
    sageMessage: "",
    plannerAttempted: false,
    plannerPassed: false,
    plannerMessage: "",
  };

  let status;
  try {
    status = await fetchJson(`${baseUrl}/api/writing-assistant/status`, undefined, 15_000);
    result.statusOk = true;
  } catch (error) {
    result.statusMessage = `Writing-assistant status failed: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }

  result.mastraReady = status?.mastra?.ready === true;
  const agents = Array.isArray(status?.mastra?.agents) ? status.mastra.agents : [];
  result.sageRegistered = agents.includes("curriculum-guide");
  result.foundationsRegistered = agents.includes("foundations-planner");
  result.fastAvailable = status?.localRuntime?.models?.fast?.available === true;
  result.qualityAvailable = status?.localRuntime?.models?.quality?.available === true;

  if (result.fastAvailable && result.sageRegistered) {
    result.sageAttempted = true;
    const question = "What is theme, and how can I use it while planning my story?";
    try {
      await loadRole("fast");
      const response = await chat({
        agentId: "curriculum-guide",
        provider: "local",
        modelRole: "fast",
        tone: "gentle",
        message: question,
      }, 60_000);
      const answer = String(response?.text || "").trim();
      result.sagePassed = sageAnswerPass(answer, question);
      if (!result.sagePassed) result.sageMessage = "Sage returned an empty, overly short, echoed, or generic failure response.";
    } catch (error) {
      result.sageMessage = `Sage live-response probe failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (result.qualityAvailable && result.foundationsRegistered) {
    result.plannerAttempted = true;
    try {
      await loadRole("quality");
      const response = await chat({
        agentId: "foundations-planner",
        provider: "local",
        modelRole: "quality",
        tone: "direct",
        foundationFieldIds: ["output-1", "output-2"],
        message: "Use only these disposable UAT facts. output-1: A cartographer discovers her coastal maps are changing overnight. output-2: She must decide whether to expose the impossible changes or protect the town that depends on her charts. Return only the requested structured proposal.",
      });
      const parsed = JSON.parse(String(response?.text || ""));
      result.plannerPassed = Boolean(parsed?.values?.["output-1"]?.trim() && parsed?.values?.["output-2"]?.trim());
      if (!result.plannerPassed) result.plannerMessage = "Foundations Planner response did not contain both requested structured fields.";
    } catch (error) {
      result.plannerMessage = `Foundations Planner structured-output probe failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return result;
}

function markdownSummary(assessment, details) {
  const lines = [
    "# PlotPickle UAT Autopilot",
    "",
    `Overall: ${assessment.overall}`,
    `Target: ${baseUrl}`,
    `Generated: ${details.generatedAt}`,
    "",
    "## Coverage",
    "",
    `Browser journey screens: ${assessment.metrics.browserScreens}`,
    `UI Continuity screens: ${assessment.metrics.continuityScreens}`,
    `Accessibility snapshots above content floor: ${assessment.metrics.snapshotCount}`,
    `Sage live probe: ${details.agents.sageAttempted ? (details.agents.sagePassed ? "PASS" : "FAIL") : "SKIP"}`,
    `Foundations Planner structured JSON: ${details.agents.plannerAttempted ? (details.agents.plannerPassed ? "PASS" : "FAIL") : "SKIP"}`,
    "",
    "## Blocking findings",
    "",
  ];
  if (assessment.blockers.length) lines.push(...assessment.blockers.map((item) => `- FAIL: ${item}`));
  else lines.push("None.");
  lines.push("", "## Review findings", "");
  if (assessment.warnings.length) lines.push(...assessment.warnings.map((item) => `- WARN: ${item}`));
  else lines.push("None.");
  lines.push(
    "",
    "## Evidence",
    "",
    `Browser report: ${browserReportPath}`,
    `UI continuity report: ${continuityReportPath}`,
    `Machine-readable report: ${jsonReportPath}`,
    "",
    "Human UAT should now focus on creative taste, clarity, and whether the product feels right. Repeatable functional, visual-contract, content-presence, console, and local-agent failures are expected to be caught here first.",
    "",
  );
  return lines.join("\n");
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  let browserRun = { code: 0, error: "" };
  let continuityRun = { code: 0, error: "" };

  if (!evidenceOnly) {
    browserRun = await runNode(path.join(repoRoot, "scripts", "run-local-browser-uat.mjs"), [
      "--base-url", baseUrl,
      "--scope", "full",
      "--artifact-root", artifactRoot,
    ]);
    continuityRun = await runNode(path.join(repoRoot, "scripts", "ui-continuity-agent.mjs"), [
      "--server", baseUrl,
      "--report", continuityReportPath,
    ]);
  }

  const [browserText, continuityText, lengths, learn, agents] = await Promise.all([
    readText(browserReportPath),
    readText(continuityReportPath),
    snapshotLengths(),
    probeLearn(),
    probeAgents(),
  ]);

  const browser = parseAcceptanceReport(browserText);
  const continuity = parseContinuityReport(continuityText);
  const assessment = assessAutopilotEvidence({
    browser,
    continuity,
    snapshotLengths: lengths,
    learn,
    agents,
    browserExitCode: browserRun.code,
    continuityExitCode: continuityRun.code,
  });
  const generatedAt = new Date().toISOString();
  const machineReport = {
    schemaVersion: 1,
    generatedAt,
    target: baseUrl,
    overall: assessment.overall,
    blockers: assessment.blockers,
    warnings: assessment.warnings,
    metrics: assessment.metrics,
    browser,
    continuity,
    learn,
    agents,
    processes: { browser: browserRun, continuity: continuityRun },
  };
  await writeFile(jsonReportPath, `${JSON.stringify(machineReport, null, 2)}\n`, "utf8");
  await writeFile(markdownReportPath, markdownSummary(assessment, { generatedAt, agents }), "utf8");
  process.stdout.write(`UAT Autopilot ${assessment.overall}: ${assessment.blockers.length} blocker(s), ${assessment.warnings.length} warning(s). Report: ${markdownReportPath}\n`);
  process.exitCode = assessment.overall === "FAIL" ? 1 : 0;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(markdownReportPath, `# PlotPickle UAT Autopilot\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
