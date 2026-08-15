#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { delay, McpClient, resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";

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
const config = JSON.parse(await readFile(path.join(repoRoot, "config", "writer-in-residence.json"), "utf8"));
const maxTurns = Number(argument("--max-turns", String(config.maxTurns || 24)));
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "browser-profile");

const severityRank = { low: 1, medium: 2, high: 3 };
const allowedKinds = new Set(["none", "positive", "confusion", "friction", "need", "bug", "abandonment-risk"]);
const allowedActions = new Set(["click", "type", "navigate", "wait", "finish"]);

function cleanSnapshot(value) {
  return String(value || "").replace(/file:\/\/\/[^\s]+/gi, "[local-file]").slice(0, 6_500);
}

function routeFromSnapshot(snapshot, fallback = "/?workspace=learn") {
  const match = String(snapshot).match(/Page URL:\s*(https?:\/\/[^\s]+)/i);
  if (!match) return fallback;
  try {
    const url = new URL(match[1]);
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

function parseJsonObject(value) {
  const text = String(value || "").replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Writer-in-Residence returned no JSON decision.");
  return JSON.parse(text.slice(start, end + 1));
}

function fingerprint(kind, summary) {
  return createHash("sha256").update(`${kind}\n${String(summary).toLowerCase().replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 20);
}

function sanitizeObservation(raw, turn, route, snapshot) {
  if (!raw || typeof raw !== "object") return null;
  const kind = allowedKinds.has(raw.kind) ? raw.kind : "none";
  if (kind === "none") return null;
  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 400) : "";
  if (!summary) return null;
  const severity = ["low", "medium", "high"].includes(raw.severity) ? raw.severity : "low";
  const actionable = raw.actionable === true;
  return {
    fingerprint: `writer.${fingerprint(kind, summary)}`,
    kind,
    severity,
    actionable,
    summary,
    expectation: typeof raw.expectation === "string" ? raw.expectation.trim().slice(0, 500) : "",
    impact: typeof raw.impact === "string" ? raw.impact.trim().slice(0, 500) : "",
    turn,
    route,
    evidence: cleanSnapshot(snapshot).slice(0, 1_500),
  };
}

async function writerModelRole() {
  try {
    const response = await fetch(`${baseUrl}/api/writing-assistant/status`, { signal: AbortSignal.timeout(8_000) });
    const status = await response.json();
    return status?.localRuntime?.models?.quality?.available ? "quality" : "fast";
  } catch {
    return "fast";
  }
}

function writerPrompt({ snapshot, turn, diary, storyMemory, modelRole }) {
  const recent = diary.slice(-6).map((entry) => ({
    turn: entry.turn,
    action: entry.action,
    result: entry.result,
    observations: entry.observations.map((item) => ({ kind: item.kind, severity: item.severity, summary: item.summary })),
  }));
  return [
    "You are acting as PlotPickle's Writer-in-Residence synthetic user. This is product research, not software testing.",
    `Identity: ${config.persona.name}. ${config.persona.experience}`,
    `Disclosure: ${config.persona.disclosure}.`,
    "Behave like the writer described below. Do not behave like a QA engineer and do not try to make tests pass.",
    ...config.persona.behaviour.map((item) => `- ${item}`),
    "",
    `Story title: ${config.storySeed.title}`,
    `Premise: ${config.storySeed.premise}`,
    `Format: ${config.storySeed.format}`,
    `Creative goal: ${config.storySeed.creativeGoal}`,
    `Current story-memory summary: ${storyMemory || "Only the seed above is established so far."}`,
    "",
    "Journey goals:",
    ...config.journeyGoals.map((item) => `- ${item}`),
    "",
    `Turn: ${turn} of ${maxTurns}. Local model role: ${modelRole}.`,
    `Recent diary: ${JSON.stringify(recent)}`,
    "",
    "Choose exactly one next visible action. Use a ref exactly as shown in the accessibility snapshot for click/type actions.",
    `Allowed navigate routes: ${config.allowedRoutes.join(", ")}`,
    "Allowed actions: click, type, navigate, wait, finish.",
    "Do not request browser_evaluate, source code, DOM inspection, localStorage, filesystem inspection, test files, logs, GitHub, or developer tools.",
    "When typing story material, write naturally as Avery; do not paste product requirements or QA language.",
    "Report at most two experience observations about the screen you can actually see. An observation can be positive, confusion, friction, need, bug, or abandonment-risk. Use bug only when visible behaviour contradicts a reasonable user expectation; otherwise use friction/confusion/need.",
    "Mark actionable true only when a product team could reasonably act on the observation. Do not invent unseen failures.",
    "Do not provide hidden reasoning. decisionSummary is only a short user-level explanation of what Avery wants to do next.",
    "Return JSON only in this shape:",
    '{"decisionSummary":"...","storyMemory":"short cumulative story-choice summary","action":{"type":"click|type|navigate|wait|finish","ref":"snapshot ref when needed","element":"human-readable visible control","text":"text for type","route":"approved route for navigate","seconds":1},"observations":[{"kind":"positive|confusion|friction|need|bug|abandonment-risk","severity":"low|medium|high","actionable":true,"summary":"...","expectation":"...","impact":"..."}]}',
    "",
    "VISIBLE ACCESSIBILITY SNAPSHOT (this is all you may know about the application):",
    cleanSnapshot(snapshot),
  ].join("\n");
}

async function askWriter(snapshot, turn, diary, storyMemory, modelRole) {
  const message = writerPrompt({ snapshot, turn, diary, storyMemory, modelRole });
  let lastError = null;
  for (const role of [...new Set([modelRole, "fast"])]) {
    try {
      const response = await fetch(`${baseUrl}/api/writing-assistant/chat`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "local", agentId: "creative-director", modelRole: role, tone: "curious", message }),
        signal: AbortSignal.timeout(role === "quality" ? 80_000 : 50_000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || `Writer model HTTP ${response.status}`);
      return { decision: parseJsonObject(body.text), modelRole: role, model: body.model || "" };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Writer-in-Residence model failed.");
}

function actionArgs(tool, action) {
  const props = tool?.inputSchema?.properties || {};
  const values = { element: action.element || "visible control" };
  if ("ref" in props) values.ref = action.ref;
  else if ("target" in props) values.target = action.ref;
  if (action.type === "type") {
    values.text = String(action.text || "");
    if ("slowly" in props) values.slowly = false;
    if ("submit" in props) values.submit = false;
  }
  return toolArguments(tool, values);
}

async function executeAction(client, toolMap, action) {
  const type = allowedActions.has(action?.type) ? action.type : "wait";
  if (type === "finish") return { ok: true, finished: true, detail: "Writer chose to finish the session." };
  if (type === "wait") {
    const seconds = Math.max(1, Math.min(5, Number(action.seconds || 1)));
    await delay(seconds * 1_000);
    return { ok: true, finished: false, detail: `Waited ${seconds}s.` };
  }
  if (type === "navigate") {
    if (!config.allowedRoutes.includes(action.route)) return { ok: false, finished: false, detail: `Rejected unapproved route: ${action.route || "(missing)"}` };
    await client.call("browser_navigate", { url: new URL(action.route, baseUrl).toString() });
    await delay(700);
    return { ok: true, finished: false, detail: `Navigated to ${action.route}.` };
  }
  if (!action.ref) return { ok: false, finished: false, detail: `${type} action did not provide a visible snapshot ref.` };
  const toolName = type === "click" ? "browser_click" : "browser_type";
  const tool = toolMap.get(toolName);
  if (!tool) return { ok: false, finished: false, detail: `Playwright MCP does not expose ${toolName}.` };
  try {
    await client.call(toolName, actionArgs(tool, action));
    await delay(type === "type" ? 500 : 700);
    return { ok: true, finished: false, detail: `${type} completed for ${action.element || action.ref}.` };
  } catch (error) {
    return { ok: false, finished: false, detail: `${toolName} failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(pluginData, { recursive: true });
  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio") throw new Error("Writer-in-Residence requires the local Playwright MCP runtime.");
  const expand = (value) => String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
  const client = new McpClient(expand(server.command), (server.args || []).map(expand), {
    cwd: expand(server.cwd || pluginRoot),
    env: Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)])),
  });

  const diary = [];
  const observations = [];
  let storyMemory = "";
  let tools = [];
  let modelRole = "fast";
  let model = "";
  let finishedReason = "turn-limit";
  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot"]) {
      if (!toolMap.has(required)) throw new Error(`Writer-in-Residence is missing Playwright MCP tool ${required}.`);
    }
    if (toolMap.has("browser_evaluate")) {
      process.stdout.write("Writer-in-Residence boundary ........ UI ONLY  browser_evaluate is available to MCP but deliberately never used by this agent.\n");
    }
    modelRole = await writerModelRole();
    await client.call("browser_navigate", { url: new URL("/?workspace=learn", baseUrl).toString() });
    await delay(900);

    for (let turn = 1; turn <= maxTurns; turn += 1) {
      const snapshot = resultText(await client.call("browser_snapshot", {}));
      const route = routeFromSnapshot(snapshot);
      const { decision, modelRole: usedRole, model: usedModel } = await askWriter(snapshot, turn, diary, storyMemory, modelRole);
      modelRole = usedRole;
      model = usedModel || model;
      if (typeof decision.storyMemory === "string" && decision.storyMemory.trim()) storyMemory = decision.storyMemory.trim().slice(0, 2_000);
      const turnObservations = (Array.isArray(decision.observations) ? decision.observations : [])
        .slice(0, 2)
        .map((item) => sanitizeObservation(item, turn, route, snapshot))
        .filter(Boolean);
      observations.push(...turnObservations);
      if (turnObservations.some((item) => item.actionable)) {
        const screenshotTool = toolMap.get("browser_take_screenshot");
        await client.call("browser_take_screenshot", toolArguments(screenshotTool, {
          type: "png",
          filename: `writer-in-residence/turn-${String(turn).padStart(2, "0")}.png`,
          fullPage: true,
        }));
      }
      const result = await executeAction(client, toolMap, decision.action || { type: "wait", seconds: 1 });
      diary.push({
        turn,
        route,
        decisionSummary: typeof decision.decisionSummary === "string" ? decision.decisionSummary.slice(0, 500) : "",
        action: decision.action || { type: "wait" },
        result,
        observations: turnObservations,
      });
      process.stdout.write(`Writer turn ${String(turn).padStart(2, "0")} ...................... ${result.ok ? "OK" : "RETRY"}  ${decision.decisionSummary || result.detail}\n`);
      if (result.finished) {
        finishedReason = "writer-finished";
        break;
      }
    }
  } finally {
    try {
      if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {});
    } catch {}
    await client.close();
  }

  const deduped = [...new Map(observations.map((item) => [item.fingerprint, item])).values()];
  const minimumRank = severityRank[config.minimumPromotedSeverity] || severityRank.medium;
  const promoted = deduped
    .filter((item) => item.actionable && severityRank[item.severity] >= minimumRank)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, config.maxPromotedFindings || 5);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    synthetic: true,
    disclosure: config.persona.disclosure,
    persona: config.persona,
    storySeed: config.storySeed,
    target: baseUrl,
    modelRole,
    model,
    finishedReason,
    storyMemory,
    diary,
    observations: deduped,
    promotedFindings: promoted,
  };
  const reportJson = path.join(artifactRoot, "writer-in-residence-report.json");
  await writeFile(reportJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const markdown = [
    "# PlotPickle Writer-in-Residence",
    "",
    `**Synthetic persona:** ${config.persona.name} — not a real customer`,
    `**Story:** ${config.storySeed.title}`,
    `**Turns:** ${diary.length}`,
    `**Promoted findings:** ${promoted.length}`,
    `**Model:** ${model || modelRole}`,
    "",
    "## Experience diary",
    "",
    ...diary.flatMap((entry) => [
      `### Turn ${entry.turn} · ${entry.route}`,
      entry.decisionSummary || entry.result.detail,
      `Action: ${entry.action?.type || "unknown"} — ${entry.result.ok ? "completed" : entry.result.detail}`,
      ...(entry.observations.length ? entry.observations.map((item) => `- ${item.kind.toUpperCase()} / ${item.severity}: ${item.summary}`) : ["- No experience finding recorded."]),
      "",
    ]),
    "## Actionable product feedback",
    "",
    ...(promoted.length ? promoted.map((item) => `- **${item.kind} / ${item.severity}** — ${item.summary}`) : ["- No medium/high actionable findings were promoted from this session."]),
    "",
    "## Safety boundary",
    "",
    "This synthetic writer used only Playwright MCP accessibility snapshots and visible click/type/navigation actions inside an isolated browser profile. The writer agent did not inspect source code, DOM internals, localStorage, logs, test files, repository files, credentials, or GitHub. GitHub reporting is a deterministic post-session step and every issue is explicitly labeled synthetic.",
  ].join("\n");
  await writeFile(path.join(artifactRoot, "writer-in-residence-report.md"), markdown, "utf8");

  if (githubReport && promoted.length) {
    const reporter = path.join(repoRoot, "scripts", "report-writer-in-residence.mjs");
    const { spawn } = await import("node:child_process");
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [reporter, "--report", reportJson], { cwd: repoRoot, env: process.env, stdio: "inherit", windowsHide: true });
      child.once("error", () => resolve(1));
      child.once("exit", (value) => resolve(Number(value ?? 1)));
    });
    if (code !== 0) process.exitCode = 1;
  }

  process.stdout.write(`Writer-in-Residence COMPLETE: ${diary.length} turn(s), ${deduped.length} observation(s), ${promoted.length} promoted finding(s). Report: ${artifactRoot}\n`);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactRoot, "writer-in-residence-error.txt"), `${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
