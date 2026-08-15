#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
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
const allowedKinds = new Set(["positive", "confusion", "friction", "need", "bug", "abandonment-risk"]);
const allowedRoutes = new Set(config.allowedRoutes);
const routeOrder = ["/?workspace=learn", "/?workspace=plan&section=foundations", "/?workspace=wyrmwood"];
const unsafeControl = /delete|reset|clear|remove|connect|sign in|cloud|purchase|buy|generate image|generate video/i;

function cleanSnapshot(value, maximum = 5_000) {
  return String(value || "").replace(/file:\/\/\/[^\s]+/gi, "[local-file]").slice(0, maximum);
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

function visibleControls(snapshot) {
  const controls = [];
  const pattern = /(?:^|\n)\s*-\s*(button|link|tab|textbox|searchbox|combobox)\s+(?:"([^"]*)")?[^\n]*?\[ref=([^\]]+)\]/gi;
  let match;
  while ((match = pattern.exec(String(snapshot)))) {
    const label = String(match[2] || "").trim();
    if (!label) continue;
    controls.push({ role: match[1].toLowerCase(), label, ref: match[3] });
  }
  return controls;
}

function exactControl(controls, label, failedTargets) {
  const wanted = String(label || "").trim().toLowerCase();
  if (!wanted) return null;
  return controls.find((item) => item.label.toLowerCase() === wanted && !failedTargets.has(item.label.toLowerCase())) || null;
}

function mentionedControl(controls, raw, failedTargets) {
  const text = String(raw || "").toLowerCase();
  return controls
    .filter((item) => !unsafeControl.test(item.label) && !failedTargets.has(item.label.toLowerCase()) && text.includes(item.label.toLowerCase()))
    .sort((a, b) => b.label.length - a.label.length)[0] || null;
}

function nextSafeRoute(currentRoute, turn) {
  const current = routeOrder.indexOf(currentRoute);
  if (current >= 0) return routeOrder[(current + 1) % routeOrder.length];
  return routeOrder[(turn - 1) % routeOrder.length];
}

function fingerprint(kind, summary) {
  return createHash("sha256").update(`${kind}\n${String(summary).toLowerCase().replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 20);
}

function parseObservation(line, turn, route, snapshot) {
  const parts = String(line).split("|");
  if (parts.length < 5 || parts[0].trim().toUpperCase() !== "OBS") return null;
  const kind = parts[1]?.trim().toLowerCase();
  const severity = parts[2]?.trim().toLowerCase();
  const actionable = /^(true|yes|1)$/i.test(parts[3]?.trim() || "");
  const summary = String(parts[4] || "").trim().slice(0, 400);
  if (!allowedKinds.has(kind) || !["low", "medium", "high"].includes(severity) || !summary) return null;
  return {
    fingerprint: `writer.${fingerprint(kind, summary)}`,
    kind,
    severity,
    actionable,
    summary,
    expectation: String(parts[5] || "").trim().slice(0, 500),
    impact: String(parts.slice(6).join("|") || "").trim().slice(0, 500),
    turn,
    route,
    evidence: cleanSnapshot(snapshot, 1_500),
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

async function callWriter(message, role) {
  const response = await fetch(`${baseUrl}/api/writing-assistant/chat`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "local", agentId: "creative-director", modelRole: role, tone: "curious", message }),
    signal: AbortSignal.timeout(role === "quality" ? 65_000 : 40_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `Writer model HTTP ${response.status}`);
  return { text: String(body?.text || "").trim(), model: String(body?.model || "") };
}

function writerPrompt({ snapshot, controls, turn, diary, storyMemory, modelRole }) {
  const controlList = controls.slice(0, 36).map((item) => `${item.role.toUpperCase()}: ${item.label}`).join("\n");
  const recent = diary.slice(-4).map((entry) => `${entry.turn}:${entry.action.type}:${entry.action.target || entry.action.route || ""}:${entry.result.detail}`).join("\n");
  return [
    "You are Avery North, PlotPickle's disclosed synthetic first-time screenwriter. Act like a writer pursuing a story, not a QA engineer.",
    `Story: ${config.storySeed.title}. ${config.storySeed.premise}`,
    `Creative goal: ${config.storySeed.creativeGoal}`,
    `Story memory: ${storyMemory || "Only the seed is established."}`,
    `Turn ${turn}/${maxTurns}. Model role ${modelRole}.`,
    recent ? `Recent journey:\n${recent}` : "",
    "",
    "Choose ONE next visible action. Prefer using the product naturally: read LEARN, ask Sage when useful, apply learning in PLAN, and try Wyrmwood once if it seems relevant.",
    "Reply with one NEXT line. These are examples, not required literal choices:",
    "NEXT|CLICK|exact visible control name|short first-person intention",
    "NEXT|TYPE|exact visible field name|natural text to type",
    "NEXT|NAVIGATE|LEARN|short intention   (or PLAN or WYRMWOOD)",
    "NEXT|WAIT||short intention",
    "NEXT|FINISH||short reason",
    "Optional story-memory line: STORY|short cumulative story choices",
    "If the current screen itself creates a real experience observation, add at most two lines:",
    "OBS|positive|low|false|summary|expectation|impact",
    "OBS|confusion|medium|true|summary|expectation|impact",
    "Kinds: positive, confusion, friction, need, bug, abandonment-risk. Severities: low, medium, high.",
    "Do not invent a defect. Use bug only for visible behavior that contradicts a reasonable writer expectation. Do not output source, DOM, test, GitHub, localStorage, logs, or developer-tool requests.",
    "",
    "CURRENT VISIBLE CONTROLS (choose the exact label; PlotPickle resolves the current browser ref itself):",
    controlList || "No named interactive controls were found.",
    "",
    "VISIBLE ACCESSIBILITY SNAPSHOT:",
    cleanSnapshot(snapshot),
  ].filter(Boolean).join("\n");
}

function parseDecision(raw, controls, currentRoute, turn, failedTargets) {
  const lines = String(raw || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const next = lines.find((line) => /^NEXT\|/i.test(line));
  const storyLine = lines.find((line) => /^STORY\|/i.test(line));
  let action = null;
  let summary = "";
  let protocol = false;

  if (next) {
    const parts = next.split("|");
    const kind = String(parts[1] || "").trim().toUpperCase();
    const target = String(parts[2] || "").trim();
    const payload = String(parts.slice(3).join("|") || "").trim();
    protocol = true;
    if (kind === "CLICK") action = { type: "click", target, text: "", route: "", seconds: 1 };
    else if (kind === "TYPE") action = { type: "type", target, text: payload.slice(0, 4_000), route: "", seconds: 1 };
    else if (kind === "NAVIGATE") {
      const route = target.toUpperCase() === "PLAN" ? "/?workspace=plan&section=foundations" : target.toUpperCase() === "WYRMWOOD" ? "/?workspace=wyrmwood" : "/?workspace=learn";
      action = { type: "navigate", target: "", text: "", route, seconds: 1 };
      summary = payload;
    } else if (kind === "WAIT") action = { type: "wait", target: "", text: "", route: "", seconds: 1 };
    else if (kind === "FINISH") action = { type: "finish", target: "", text: "", route: "", seconds: 1 };
    if (!summary && kind !== "TYPE") summary = payload;
    if (kind === "TYPE") summary = `I want to write into ${target}.`;
  }

  if (action && (action.type === "click" || action.type === "type") && !exactControl(controls, action.target, failedTargets)) action = null;

  if (!action) {
    const control = mentionedControl(controls, raw, failedTargets);
    if (control) {
      const isField = ["textbox", "searchbox", "combobox"].includes(control.role);
      action = isField
        ? { type: "wait", target: "", text: "", route: "", seconds: 1 }
        : { type: "click", target: control.label, text: "", route: "", seconds: 1 };
      summary = `I want to try ${control.label} and see where it takes the story.`;
    }
  }

  if (!action) {
    const route = nextSafeRoute(currentRoute, turn);
    action = { type: "navigate", target: "", text: "", route, seconds: 1 };
    summary = "I want to move to the next part of the writing journey and keep exploring.";
  }

  const observations = lines.map((line) => parseObservation(line, turn, currentRoute, "")).filter(Boolean);
  return {
    action,
    summary: summary || "I want to keep exploring PlotPickle as a writer.",
    storyMemory: storyLine ? storyLine.slice(storyLine.indexOf("|") + 1).trim().slice(0, 2_000) : "",
    observations,
    protocol,
  };
}

function actionArgs(tool, values) {
  const props = tool?.inputSchema?.properties || {};
  const output = { element: values.element || "visible control" };
  if ("ref" in props) output.ref = values.ref;
  else if ("target" in props) output.target = values.ref;
  if (values.text !== undefined) {
    output.text = String(values.text || "");
    if ("slowly" in props) output.slowly = false;
    if ("submit" in props) output.submit = false;
  }
  return toolArguments(tool, output);
}

async function navigate(client, route) {
  await client.call("browser_navigate", { url: new URL(route, baseUrl).toString() });
  await delay(700);
  return { ok: true, finished: false, recovered: false, detail: `Navigated to ${route}.` };
}

async function executeAction(client, toolMap, action, snapshot, currentRoute, turn, failedTargets) {
  if (action.type === "finish") return { ok: true, finished: true, recovered: false, detail: "Writer chose to finish the session." };
  if (action.type === "wait") {
    await delay(Math.max(1, Math.min(4, Number(action.seconds || 1))) * 1_000);
    return { ok: true, finished: false, recovered: false, detail: "Waited to understand the screen." };
  }
  if (action.type === "navigate") {
    if (!allowedRoutes.has(action.route)) return navigate(client, nextSafeRoute(currentRoute, turn));
    return navigate(client, action.route);
  }

  const controls = visibleControls(snapshot);
  const control = exactControl(controls, action.target, failedTargets);
  if (!control) {
    const route = nextSafeRoute(currentRoute, turn);
    const moved = await navigate(client, route);
    return { ...moved, recovered: true, attempted: action.target, detail: `Could not resolve ${action.target || "the requested control"}; safely moved to ${route}.` };
  }

  const toolName = action.type === "type" ? "browser_type" : "browser_click";
  const tool = toolMap.get(toolName);
  if (!tool) return { ok: false, finished: false, recovered: false, detail: `Playwright MCP is missing ${toolName}.` };
  try {
    await client.call(toolName, actionArgs(tool, { ref: control.ref, element: control.label, text: action.type === "type" ? action.text : undefined }));
    await delay(action.type === "type" ? 450 : 700);
    return { ok: true, finished: false, recovered: false, detail: `${action.type} completed for ${control.label}.` };
  } catch (error) {
    failedTargets.add(control.label.toLowerCase());
    const route = nextSafeRoute(currentRoute, turn);
    try {
      await navigate(client, route);
      return { ok: true, finished: false, recovered: true, attempted: control.label, detail: `${toolName} failed for ${control.label}; safely moved to ${route}.` };
    } catch {
      return { ok: false, finished: false, recovered: false, attempted: control.label, detail: `${toolName} failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

async function writeReport({ diary, observations, runnerFindings, storyMemory, modelRole, model, finishedReason }) {
  const deduped = [...new Map(observations.map((item) => [item.fingerprint, item])).values()];
  const minimumRank = severityRank[config.minimumPromotedSeverity] || severityRank.medium;
  const promoted = deduped
    .filter((item) => item.actionable && severityRank[item.severity] >= minimumRank)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, config.maxPromotedFindings || 5);
  const report = {
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
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
    runnerFindings,
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
    `**Finished:** ${finishedReason}`,
    "",
    "## Experience diary",
    ...diary.flatMap((entry) => [
      `### Turn ${entry.turn} · ${entry.route}`,
      entry.summary,
      `Action: ${entry.action.type}${entry.action.target ? ` — ${entry.action.target}` : entry.action.route ? ` — ${entry.action.route}` : ""}`,
      `Result: ${entry.result.detail}`,
      ...(entry.observations.length ? entry.observations.map((item) => `- ${item.kind.toUpperCase()} / ${item.severity}: ${item.summary}`) : ["- No experience finding recorded."]),
      "",
    ]),
    "## Actionable product feedback",
    ...(promoted.length ? promoted.map((item) => `- **${item.kind} / ${item.severity}** — ${item.summary}`) : ["- No medium/high actionable findings were promoted from this session."]),
    "",
    "## Runner findings",
    ...(runnerFindings.length ? runnerFindings.map((item) => `- Turn ${item.turn}: ${item.message}`) : ["- No runner recovery was required."]),
    "",
    "## Safety boundary",
    "This synthetic writer used only Playwright MCP accessibility snapshots and visible click/type/navigation actions inside an isolated browser profile. It did not inspect source code, DOM internals, localStorage, logs, test files, repository files, credentials, or GitHub. GitHub reporting is deterministic and every promoted issue remains explicitly synthetic.",
  ].join("\n");
  await writeFile(path.join(artifactRoot, "writer-in-residence-report.md"), `${markdown}\n`, "utf8");
  return { reportJson, deduped, promoted };
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
  const runnerFindings = [];
  const failedTargets = new Set();
  let storyMemory = "";
  let modelRole = "fast";
  let model = "";
  let tools = [];
  let finishedReason = "turn-limit";
  let fatalError = null;

  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot"]) {
      if (!toolMap.has(required)) throw new Error(`Writer-in-Residence is missing Playwright MCP tool ${required}.`);
    }
    if (toolMap.has("browser_evaluate")) process.stdout.write("Writer-in-Residence boundary ........ UI ONLY  browser_evaluate is available to MCP but deliberately never used by this agent.\n");

    modelRole = await writerModelRole();
    await navigate(client, "/?workspace=learn");

    let consecutiveTurnErrors = 0;
    for (let turn = 1; turn <= maxTurns; turn += 1) {
      try {
        const snapshot = resultText(await client.call("browser_snapshot", {}));
        const route = routeFromSnapshot(snapshot);
        const controls = visibleControls(snapshot);
        const response = await callWriter(writerPrompt({ snapshot, controls, turn, diary, storyMemory, modelRole }), modelRole);
        model = response.model || model;
        const decision = parseDecision(response.text, controls, route, turn, failedTargets);
        if (decision.storyMemory) storyMemory = decision.storyMemory;
        const turnObservations = decision.observations.map((item) => ({ ...item, evidence: cleanSnapshot(snapshot, 1_500) }));
        observations.push(...turnObservations);

        if (turnObservations.some((item) => item.actionable)) {
          const screenshotTool = toolMap.get("browser_take_screenshot");
          await client.call("browser_take_screenshot", toolArguments(screenshotTool, {
            type: "png",
            filename: `writer-in-residence/turn-${String(turn).padStart(2, "0")}.png`,
            fullPage: true,
          }));
        }

        const result = await executeAction(client, toolMap, decision.action, snapshot, route, turn, failedTargets);
        if (!decision.protocol) runnerFindings.push({ turn, message: "Local model ignored the compact NEXT protocol; action recovered from visible text/current route." });
        if (result.recovered) runnerFindings.push({ turn, message: result.detail });
        diary.push({ turn, route, summary: decision.summary, action: decision.action, result, observations: turnObservations });
        process.stdout.write(`Writer turn ${String(turn).padStart(2, "0")} ...................... ${result.recovered ? "RECOVERED" : result.ok ? "OK" : "RETRY"}  ${decision.summary}\n`);
        consecutiveTurnErrors = 0;
        if (result.finished) {
          finishedReason = "writer-finished";
          break;
        }
      } catch (error) {
        consecutiveTurnErrors += 1;
        const message = error instanceof Error ? error.message : String(error);
        runnerFindings.push({ turn, message: `Turn recovered after runner/model error: ${message}` });
        process.stdout.write(`Writer turn ${String(turn).padStart(2, "0")} ...................... RECOVERED  ${message}\n`);
        try { await navigate(client, routeOrder[turn % routeOrder.length]); } catch {}
        if (consecutiveTurnErrors >= 3) {
          finishedReason = "runner-error-limit";
          break;
        }
      }
    }
  } catch (error) {
    fatalError = error;
    finishedReason = "runner-error";
    runnerFindings.push({ turn: diary.length + 1, message: error instanceof Error ? error.message : String(error) });
  } finally {
    try { if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {}); } catch {}
    await client.close().catch(() => {});
  }

  const { reportJson, deduped, promoted } = await writeReport({ diary, observations, runnerFindings, storyMemory, modelRole, model, finishedReason });

  if (githubReport && promoted.length) {
    const reporter = path.join(repoRoot, "scripts", "report-writer-in-residence.mjs");
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [reporter, "--report", reportJson], { cwd: repoRoot, env: process.env, stdio: "inherit", windowsHide: true });
      child.once("error", () => resolve(1));
      child.once("exit", (value) => resolve(Number(value ?? 1)));
    });
    if (code !== 0) process.exitCode = 1;
  }

  if (fatalError) process.exitCode = 1;
  process.stdout.write(`Writer-in-Residence COMPLETE: ${diary.length} turn(s), ${deduped.length} observation(s), ${promoted.length} promoted finding(s). Report: ${artifactRoot}\n`);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactRoot, "writer-in-residence-error.txt"), `${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
