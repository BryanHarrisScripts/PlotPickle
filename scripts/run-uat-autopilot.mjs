#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  assessFocusedUat,
  contractTestsFromRegistry,
  validateUatRegistry,
} from "../lib/uat-autopilot.mjs";
import {
  consoleHasErrors,
  McpClient,
  resultText,
  toolArguments,
} from "./creative-uat/mcp-runtime.mjs";
import { waitForRenderedArea } from "./creative-uat/render-readiness.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
};
const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat-focused")));
const registryPath = path.join(repoRoot, "config", "uat-autopilot-registry.json");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const reportPath = path.join(artifactRoot, "autopilot-report.md");
const jsonPath = path.join(artifactRoot, "autopilot-report.json");
const snapshotsPath = path.join(artifactRoot, "snapshots");
const contractsOnly = argv.includes("--contracts-only");

function runContracts(files) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test", ...files], {
      cwd: repoRoot,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", (error) => resolve({ code: 1, error: error.message }));
    child.once("exit", (code) => resolve({ code: Number(code ?? 1), error: "" }));
  });
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

function parsePlannerValues(value, fieldIds) {
  const unfenced = String(value || "")
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    const parsed = JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed.values && typeof parsed.values === "object" && !Array.isArray(parsed.values)
      ? parsed.values
      : parsed;
    const values = {};
    for (const fieldId of fieldIds) {
      const text = typeof candidate?.[fieldId] === "string" ? candidate[fieldId].trim() : "";
      if (text.length < 20 || /^provisional\s*[—:-]?\s*$/i.test(text) || /placeholder for a concrete working choice/i.test(text)) return null;
      values[fieldId] = text;
    }
    return values;
  } catch {
    return null;
  }
}

async function plannerChat(fieldIds, message, timeoutMs = 75_000) {
  return chat({
    agentId: "foundations-planner",
    provider: "local",
    modelRole: "quality",
    tone: "direct",
    foundationFieldIds: fieldIds,
    message,
  }, timeoutMs);
}

async function probePlannerStructuredOutput() {
  const fieldIds = ["output-1", "output-2"];
  const facts = {
    "output-1": "A cartographer discovers her coastal maps are changing overnight.",
    "output-2": "She must decide whether to expose the impossible changes or protect the town that depends on her charts.",
  };
  const message = "Use only these disposable UAT facts. output-1: A cartographer discovers her coastal maps are changing overnight. output-2: She must decide whether to expose the impossible changes or protect the town that depends on her charts. Return JSON only as {\"values\":{\"output-1\":\"...\",\"output-2\":\"...\"}} with both fields answered substantively.";
  const repair = "FOCUSED UAT PLAN STRUCTURED RETRY. Return JSON only in the exact requested values shape. Include every requested field ID with a substantive story answer. Do not omit fields, copy labels, return only Provisional, or add prose outside JSON.";
  let attempts = 0;

  for (const attemptMessage of [message, `${repair}\n\n${message}`]) {
    const response = await plannerChat(fieldIds, attemptMessage);
    attempts += 1;
    if (parsePlannerValues(response?.text, fieldIds)) {
      return { passed: true, route: attempts === 1 ? "Quality" : "Quality retry", attempts };
    }
  }

  const recovered = {};
  for (const fieldId of fieldIds) {
    const oneField = `${repair}\nField ID: ${fieldId}\nDisposable UAT fact: ${facts[fieldId]}\nReturn only {\"values\":{\"${fieldId}\":\"a substantive answer\"}}.`;
    let parsed = null;
    for (const attemptMessage of [oneField, `${repair}\n\n${oneField}`]) {
      const response = await plannerChat([fieldId], attemptMessage, 45_000);
      attempts += 1;
      parsed = parsePlannerValues(response?.text, [fieldId]);
      if (parsed) break;
    }
    if (!parsed) return { passed: false, route: "failed", attempts };
    recovered[fieldId] = parsed[fieldId];
  }
  return {
    passed: fieldIds.every((fieldId) => Boolean(recovered[fieldId])),
    route: "per-field recovery",
    attempts,
  };
}

async function probeStartup() {
  const result = {
    statusOk: false,
    message: "",
    mastraReady: false,
    embedded: false,
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
    plannerRoute: "",
  };

  let status;
  try {
    status = await fetchJson(`${baseUrl}/api/writing-assistant/status`, undefined, 15_000);
    result.statusOk = true;
  } catch (error) {
    result.message = `Startup status failed: ${error instanceof Error ? error.message : String(error)}`;
    return result;
  }

  result.mastraReady = status?.mastra?.ready === true;
  result.embedded = status?.mastra?.mode === "embedded";
  const agents = Array.isArray(status?.mastra?.agents) ? status.mastra.agents : [];
  result.sageRegistered = agents.includes("curriculum-guide");
  result.foundationsRegistered = agents.includes("foundations-planner");
  result.fastAvailable = status?.localRuntime?.models?.fast?.available === true;
  result.qualityAvailable = status?.localRuntime?.models?.quality?.available === true;

  if (result.fastAvailable && result.sageRegistered) {
    result.sageAttempted = true;
    const question = "What is theme, and how should I use it while building my Foundations?";
    try {
      await loadRole("fast");
      const response = await chat({
        agentId: "curriculum-guide",
        provider: "local",
        modelRole: "fast",
        tone: "gentle",
        message: question,
      }, 60_000);
      result.sagePassed = sageAnswerPass(response?.text, question);
      if (!result.sagePassed) result.sageMessage = "Sage returned an empty, echoed, overly short, or generic failure response.";
    } catch (error) {
      result.sageMessage = `Sage live-response probe failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (result.qualityAvailable && result.foundationsRegistered) {
    result.plannerAttempted = true;
    try {
      await loadRole("quality");
      const planner = await probePlannerStructuredOutput();
      result.plannerPassed = planner.passed;
      result.plannerRoute = planner.route;
      if (!planner.passed) result.plannerMessage = `Foundations Planner did not return both requested structured PLAN fields after ${planner.attempts} recovery attempts.`;
    } catch (error) {
      result.plannerMessage = `Foundations Planner structured-output probe failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return result;
}

async function inspectRegisteredAreas(registry) {
  await mkdir(snapshotsPath, { recursive: true });
  const pluginData = path.join(artifactRoot, "agent-plugin");
  await mkdir(pluginData, { recursive: true });
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Focused UAT requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), (server.args || []).map(expand), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });
  const rendered = [];
  let tools = [];
  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_evaluate", "browser_take_screenshot"]) {
      if (!toolMap.has(required)) throw new Error(`Playwright MCP is missing ${required}.`);
    }

    for (const area of registry.areas.filter((entry) => entry.route)) {
      let evidence = {
        id: area.id,
        reached: false,
        url: "",
        bodyText: "",
        bodyLength: 0,
        screenshotCaptured: false,
        consoleErrors: false,
        error: "",
      };
      try {
        await client.call("browser_navigate", { url: new URL(area.route, baseUrl).toString() });
        const state = await waitForRenderedArea(client, area);
        const snapshotText = resultText(await client.call("browser_snapshot", {}));
        await writeFile(path.join(snapshotsPath, `${area.id}.md`), snapshotText, "utf8");
        evidence = {
          ...evidence,
          reached: true,
          url: String(state.url || ""),
          bodyText: String(state.bodyText || snapshotText || ""),
          bodyLength: Number(state.bodyLength || String(state.bodyText || snapshotText || "").length),
        };
        const screenshotArgs = toolArguments(toolMap.get("browser_take_screenshot"), {
          type: "png",
          filename: `${area.id}.png`,
          fullPage: true,
        });
        await client.call("browser_take_screenshot", screenshotArgs);
        evidence.screenshotCaptured = true;
        if (toolMap.has("browser_console_messages")) {
          const consoleText = resultText(await client.call("browser_console_messages", toolArguments(toolMap.get("browser_console_messages"), { level: "error", all: false })));
          evidence.consoleErrors = consoleHasErrors(consoleText);
          if (consoleText) await writeFile(path.join(snapshotsPath, `${area.id}-console.txt`), consoleText, "utf8");
        }
      } catch (error) {
        evidence.error = error instanceof Error ? error.message : String(error);
      }
      rendered.push(evidence);
    }
  } finally {
    try {
      if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {});
    } catch {}
    await client.close();
  }
  return rendered;
}

function reportMarkdown({ registry, contractRun, startup, rendered, assessment, generatedAt, mode }) {
  const lines = [
    "# PlotPickle Focused UAT Autopilot",
    "",
    `Overall: ${assessment.overall}`,
    `Mode: ${mode}`,
    `Generated: ${generatedAt}`,
    `Target: ${baseUrl}`,
    "",
    "## Current test scope",
    "",
  ];
  for (const area of registry.areas) lines.push(`- ${area.label}: ${area.tests.length} contract test${area.tests.length === 1 ? "" : "s"}${area.route ? ` · ${area.route}` : ""}`);
  lines.push("", `Focused contract test exit: ${contractRun.code}`, "", "## Live rendered areas", "");
  if (!rendered.length) lines.push("Skipped in contracts-only mode.");
  else for (const entry of rendered) lines.push(`- ${entry.id}: ${entry.reached ? "reached" : "not reached"}, ${entry.bodyLength} visible characters, screenshot ${entry.screenshotCaptured ? "captured" : "missing"}, console ${entry.consoleErrors ? "ERROR" : "clean"}`);
  lines.push("", "## Startup and local-agent probes", "");
  if (mode === "contracts-only") lines.push("Skipped in contracts-only mode.");
  else lines.push(
    `- Mastra ready: ${startup.mastraReady ? "yes" : "no"}`,
    `- Embedded runtime: ${startup.embedded ? "yes" : "no"}`,
    `- Sage registered: ${startup.sageRegistered ? "yes" : "no"}`,
    `- Foundations Planner registered: ${startup.foundationsRegistered ? "yes" : "no"}`,
    `- Sage live response: ${startup.sageAttempted ? (startup.sagePassed ? "PASS" : "FAIL") : "SKIP"}`,
    `- PLAN structured output: ${startup.plannerAttempted ? (startup.plannerPassed ? `PASS${startup.plannerRoute ? ` via ${startup.plannerRoute}` : ""}` : "FAIL") : "SKIP"}`,
  );
  lines.push("", "## Blocking findings", "");
  if (assessment.blockers.length) lines.push(...assessment.blockers.map((message) => `- FAIL: ${message}`));
  else lines.push("None.");
  lines.push("", "## Review findings", "");
  if (assessment.warnings.length) lines.push(...assessment.warnings.map((message) => `- WARN: ${message}`));
  else lines.push("None.");
  lines.push("", "Add future product areas by extending config/uat-autopilot-registry.json with the new route, rendered expectations, and focused contract tests.", "");
  return lines.join("\n");
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  const registryErrors = validateUatRegistry(registry);
  if (registryErrors.length) throw new Error(registryErrors.join("\n"));
  const contractTests = contractTestsFromRegistry(registry);
  const contractRun = await runContracts(contractTests);

  let startup = {
    statusOk: true,
    mastraReady: true,
    embedded: true,
    sageRegistered: true,
    foundationsRegistered: true,
    fastAvailable: true,
    qualityAvailable: true,
  };
  let rendered = [];
  let assessment;
  const mode = contractsOnly ? "contracts-only" : "focused-live";

  if (contractsOnly) {
    assessment = {
      overall: contractRun.code === 0 ? "PASS" : "FAIL",
      blockers: contractRun.code === 0 ? [] : [`Focused contract tests exited with code ${contractRun.code}.`],
      warnings: [],
      metrics: { areasRegistered: registry.areas.length, renderedAreas: 0, contractTests: contractTests.length },
    };
  } else {
    [startup, rendered] = await Promise.all([
      probeStartup(),
      inspectRegisteredAreas(registry),
    ]);
    assessment = assessFocusedUat({ registry, contractExitCode: contractRun.code, rendered, startup });
  }

  const generatedAt = new Date().toISOString();
  const machine = {
    schemaVersion: 1,
    generatedAt,
    target: baseUrl,
    mode,
    overall: assessment.overall,
    blockers: assessment.blockers,
    warnings: assessment.warnings,
    metrics: assessment.metrics,
    registry,
    contracts: contractRun,
    startup: contractsOnly ? null : startup,
    rendered,
  };
  await writeFile(jsonPath, `${JSON.stringify(machine, null, 2)}\n`, "utf8");
  await writeFile(reportPath, reportMarkdown({ registry, contractRun, startup, rendered, assessment, generatedAt, mode }), "utf8");
  process.stdout.write(`Focused UAT ${assessment.overall}: ${assessment.blockers.length} blocker(s), ${assessment.warnings.length} warning(s). Report: ${reportPath}\n`);
  process.exitCode = assessment.overall === "FAIL" ? 1 : 0;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportPath, `# PlotPickle Focused UAT Autopilot\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});