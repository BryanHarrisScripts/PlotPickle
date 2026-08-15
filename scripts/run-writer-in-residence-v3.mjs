#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { delay, McpClient, resultText, toolArguments } from "./creative-uat/mcp-runtime.mjs";
import { observeRenderedUi, reviewRenderedUi, visualFactsForWriter } from "./writer-visual-observer.mjs";

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
const routeOrder = config.reviewScreens.map((screen) => screen.route);
const unsafeControl = /delete|reset|clear|remove|connect|sign in|purchase|buy|generate image|generate video|switch to cloud|use local-first setup|set up sage and plan|test sage|test plan|managed llama/i;
const settingsNavigationControl = /advanced setup|advanced runtime details|advanced ai routing|cloud and legacy provider overrides|back to plotpickle settings|return to learn|return to plan/i;

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
  const pattern = /(?:^|\n)\s*-\s*(button|link|tab|textbox|searchbox|combobox|checkbox|radio)\s+(?:"([^"]*)")?[^\n]*?\[ref=([^\]]+)\]/gi;
  let match;
  while ((match = pattern.exec(String(snapshot)))) {
    const label = String(match[2] || "").trim();
    if (!label) continue;
    controls.push({ role: match[1].toLowerCase(), label, ref: match[3] });
  }
  return controls;
}

function controlMatching(controls, pattern, roles = null) {
  return controls.find((item) => (!roles || roles.includes(item.role)) && pattern.test(item.label)) || null;
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
  return routeOrder[(turn - 1) % routeOrder.length] || "/?workspace=learn";
}

function fingerprint(kind, summary) {
  return createHash("sha256").update(`${kind}\n${String(summary).toLowerCase().replace(/\s+/g, " ").trim()}`).digest("hex").slice(0, 20);
}

function makeObservation(raw, turn, route, evidence = "", source = "writer") {
  if (!raw || !allowedKinds.has(raw.kind) || !["low", "medium", "high"].includes(raw.severity) || !String(raw.summary || "").trim()) return null;
  const summary = String(raw.summary).trim().slice(0, 400);
  return {
    fingerprint: `writer.${fingerprint(raw.kind, summary)}`,
    kind: raw.kind,
    severity: raw.severity,
    actionable: raw.actionable === true,
    summary,
    expectation: String(raw.expectation || "").trim().slice(0, 500),
    impact: String(raw.impact || "").trim().slice(0, 500),
    turn,
    route,
    source,
    evidence: cleanSnapshot(evidence, 1_500),
  };
}

function parseObservation(line, turn, route, snapshot) {
  const parts = String(line).split("|");
  if (parts.length < 5 || parts[0].trim().toUpperCase() !== "OBS") return null;
  return makeObservation({
    kind: parts[1]?.trim().toLowerCase(),
    severity: parts[2]?.trim().toLowerCase(),
    actionable: /^(true|yes|1)$/i.test(parts[3]?.trim() || ""),
    summary: parts[4],
    expectation: parts[5],
    impact: parts.slice(6).join("|"),
  }, turn, route, snapshot, "writer");
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

function writerPrompt({ snapshot, controls, turn, diary, storyMemory, modelRole, visualFacts, visitedScreens }) {
  const controlList = controls.slice(0, 40).map((item) => `${item.role.toUpperCase()}: ${item.label}`).join("\n");
  const recent = diary.slice(-5).map((entry) => `${entry.turn}:${entry.action.type}:${entry.action.target || entry.action.route || ""}:${entry.result.detail}`).join("\n");
  const unvisited = config.reviewScreens.filter((screen) => !visitedScreens.has(screen.id)).map((screen) => screen.label);
  return [
    "You are Avery North, PlotPickle's disclosed synthetic first-time screenwriter. Act like a writer pursuing a story, not a QA engineer.",
    `Story: ${config.storySeed.title}. ${config.storySeed.premise}`,
    `Creative goal: ${config.storySeed.creativeGoal}`,
    `Story memory: ${storyMemory || "Only the seed is established."}`,
    `Turn ${turn}/${maxTurns}. Local model role ${modelRole}.`,
    recent ? `Recent journey:\n${recent}` : "",
    unvisited.length ? `Still worth exploring: ${unvisited.join(", ")}.` : "You have seen each required top-level area at least once.",
    visualFacts ? `Read-only visible layout summary for this rendered screen: ${visualFacts}` : "",
    "",
    "Choose ONE next visible action. Use PlotPickle naturally: read LEARN, talk to Sage, put story thinking into PLAN, play with GAME/Wyrmwood, and inspect SETTINGS without changing runtime/provider choices.",
    "When SETTINGS offers pills, summaries, tabs, or Advanced controls, it is useful to follow them down and then use the visible Back/Return path to come back up. Do not change provider/model/toggle values.",
    "Reply with one NEXT line:",
    "NEXT|CLICK|exact visible control name|short first-person intention",
    "NEXT|TYPE|exact visible field name|natural text to type",
    "NEXT|NAVIGATE|LEARN|short intention   (or PLAN, WYRMWOOD, SETTINGS)",
    "NEXT|WAIT||short intention",
    "NEXT|FINISH||short reason",
    "Optional: STORY|short cumulative story choices",
    "Optional visible-experience observations (maximum two):",
    "OBS|positive|low|false|summary|expectation|impact",
    "OBS|confusion|medium|true|summary|expectation|impact",
    "Kinds: positive, confusion, friction, need, bug, abandonment-risk. Severities: low, medium, high.",
    "Do not invent a defect. Use bug only for visible behavior that contradicts a reasonable writer expectation. Do not request source, DOM, tests, GitHub, localStorage, logs, or developer tools.",
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
      const key = target.toUpperCase();
      const route = key === "PLAN" ? "/?workspace=plan&section=foundations" : key === "WYRMWOOD" || key === "GAME" ? "/?workspace=wyrmwood" : key === "SETTINGS" ? "/?workspace=settings" : "/?workspace=learn";
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
      action = isField ? { type: "wait", target: "", text: "", route: "", seconds: 1 } : { type: "click", target: control.label, text: "", route: "", seconds: 1 };
      summary = `I want to try ${control.label} and see where it takes me.`;
    }
  }
  if (!action) {
    const route = nextSafeRoute(currentRoute, turn);
    action = { type: "navigate", target: "", text: "", route, seconds: 1 };
    summary = "I want to move to another part of the writing journey and keep exploring.";
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
  await delay(750);
  return { ok: true, finished: false, recovered: false, detail: `Navigated to ${route}.` };
}

async function freshSnapshot(client) {
  return resultText(await client.call("browser_snapshot", {}));
}

async function clickNamed(client, toolMap, pattern, roles = ["button", "link", "tab"]) {
  const snapshot = await freshSnapshot(client);
  const control = controlMatching(visibleControls(snapshot), pattern, roles);
  if (!control) return { ok: false, snapshot, detail: `Could not find visible control matching ${pattern}.` };
  const tool = toolMap.get("browser_click");
  try {
    await client.call("browser_click", actionArgs(tool, { ref: control.ref, element: control.label }));
    await delay(650);
    return { ok: true, snapshot: await freshSnapshot(client), label: control.label, detail: `Opened ${control.label}.` };
  } catch (error) {
    return { ok: false, snapshot, label: control.label, detail: `Could not open ${control.label}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function screenshot(client, toolMap, name) {
  const tool = toolMap.get("browser_take_screenshot");
  if (!tool) return;
  await client.call("browser_take_screenshot", toolArguments(tool, {
    type: "png",
    filename: `writer-in-residence/${name}.png`,
    fullPage: true,
  }));
}

async function performSillySageConversation(client, toolMap, diary, observations, runnerFindings) {
  await navigate(client, "/?workspace=learn");
  const questions = Array.isArray(config.requiredSageConversation) ? config.requiredSageConversation : [];
  let completed = 0;
  for (let index = 0; index < questions.length; index += 1) {
    const question = String(questions[index] || "").trim();
    if (!question) continue;
    const snapshot = await freshSnapshot(client);
    const controls = visibleControls(snapshot);
    const textbox = controlMatching(controls, /ask in your own words|creative room|question/i, ["textbox"])
      || controls.find((item) => item.role === "textbox");
    if (!textbox) {
      const observation = makeObservation({
        kind: "friction", severity: "medium", actionable: true,
        summary: "LEARN: Avery could not find a visible Sage conversation field for an ordinary off-topic message.",
        expectation: "A first-time writer should be able to notice where to type to Sage without knowing product internals.",
        impact: "The Creative Room can feel decorative instead of conversational.",
      }, -(index + 1), "/?workspace=learn", snapshot, "required-sage-probe");
      if (observation) observations.push(observation);
      runnerFindings.push({ turn: `sage-${index + 1}`, message: "Visible Sage textbox was not found." });
      break;
    }
    try {
      await client.call("browser_type", actionArgs(toolMap.get("browser_type"), { ref: textbox.ref, element: textbox.label, text: question }));
      await delay(300);
      const typedSnapshot = await freshSnapshot(client);
      const ask = controlMatching(visibleControls(typedSnapshot), /ask the guide/i, ["button"]);
      if (!ask) throw new Error("Ask the Guide button was not visible after typing.");
      await client.call("browser_click", actionArgs(toolMap.get("browser_click"), { ref: ask.ref, element: ask.label }));
      await delay(1_200);
      let answered = false;
      let answerSnapshot = "";
      for (let attempt = 0; attempt < 40; attempt += 1) {
        answerSnapshot = await freshSnapshot(client);
        if (answerSnapshot.includes(question) && !/Thinking about your question/i.test(answerSnapshot)) {
          answered = true;
          break;
        }
        await delay(700);
      }
      diary.push({
        turn: `sage-${index + 1}`,
        route: "/?workspace=learn",
        summary: `I asked Sage something deliberately silly: ${question}`,
        action: { type: "type+submit", target: "Ask in your own words" },
        result: { ok: answered, recovered: false, detail: answered ? "Sage completed the conversational reply." : "Sage did not visibly finish the reply within the probe window." },
        observations: [],
      });
      if (!answered) throw new Error("Sage did not visibly finish the conversational reply within the probe window.");
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runnerFindings.push({ turn: `sage-${index + 1}`, message });
      const observation = makeObservation({
        kind: "friction", severity: "medium", actionable: true,
        summary: `LEARN: Avery's silly Sage conversation could not complete (${message}).`,
        expectation: "Sage should handle ordinary playful conversation as reliably as curriculum questions.",
        impact: "A writer may stop treating Sage as a persistent creative-room companion.",
      }, -(index + 1), "/?workspace=learn", question, "required-sage-probe");
      if (observation) observations.push(observation);
      break;
    }
  }
  return { requested: questions.length, completed };
}

async function focusedVisualReview(client, toolMap, observations, runnerFindings) {
  const results = [];
  for (const screen of config.reviewScreens) {
    await navigate(client, screen.route);
    const snapshot = await freshSnapshot(client);
    await screenshot(client, toolMap, `review-${screen.id}`);
    const facts = await observeRenderedUi(client, resultText);
    const findings = reviewRenderedUi(screen.label, facts);
    for (const raw of findings) {
      const observation = makeObservation(raw, 0, screen.route, `${visualFactsForWriter(facts)}\n${cleanSnapshot(snapshot, 900)}`, "rendered-visual-observer");
      if (observation) observations.push(observation);
    }
    results.push({ ...screen, facts, findings });
  }

  const settingsDepth = { advancedSetup: false, advancedRuntime: false, advancedRouting: false, routingDetails: false, returnedToSettings: false };
  await navigate(client, "/?workspace=settings");
  for (const probe of [
    { key: "advancedSetup", pattern: /^Advanced Setup$/i, screenshot: "settings-advanced-setup" },
    { key: "advancedRuntime", pattern: /^Advanced runtime details$/i, screenshot: "settings-advanced-runtime" },
  ]) {
    const opened = await clickNamed(client, toolMap, probe.pattern);
    if (opened.ok) {
      settingsDepth[probe.key] = true;
      await screenshot(client, toolMap, probe.screenshot);
      const closed = await clickNamed(client, toolMap, probe.pattern);
      if (!closed.ok) runnerFindings.push({ turn: `settings-${probe.key}`, message: `Opened ${opened.label} but could not close it to return up one level.` });
    } else {
      runnerFindings.push({ turn: `settings-${probe.key}`, message: opened.detail });
    }
  }

  const routing = await clickNamed(client, toolMap, /^Advanced AI routing$/i, ["link", "button"]);
  if (routing.ok) {
    settingsDepth.advancedRouting = true;
    await screenshot(client, toolMap, "settings-advanced-ai-routing");
    const routingSnapshot = await freshSnapshot(client);
    const routingFacts = await observeRenderedUi(client, resultText);
    const routingFindings = reviewRenderedUi("SETTINGS · Advanced AI routing", routingFacts);
    for (const raw of routingFindings) {
      const observation = makeObservation(raw, 0, "/ai-routing", `${visualFactsForWriter(routingFacts)}\n${cleanSnapshot(routingSnapshot, 900)}`, "rendered-visual-observer");
      if (observation) observations.push(observation);
    }
    results.push({ id: "advanced-ai-routing", label: "SETTINGS · Advanced AI routing", route: "/ai-routing", facts: routingFacts, findings: routingFindings });

    const compatibility = await clickNamed(client, toolMap, /^Cloud and legacy provider overrides$/i, ["button"]);
    if (compatibility.ok) {
      settingsDepth.routingDetails = true;
      await screenshot(client, toolMap, "settings-routing-compatibility-details");
      const closed = await clickNamed(client, toolMap, /^Cloud and legacy provider overrides$/i, ["button"]);
      if (!closed.ok) runnerFindings.push({ turn: "settings-routing-details", message: "Opened compatibility details but could not close them to return up one level." });
    }

    const back = await clickNamed(client, toolMap, /Back to PlotPickle Settings/i, ["link", "button"]);
    if (back.ok) {
      const returned = routeFromSnapshot(back.snapshot);
      settingsDepth.returnedToSettings = returned.includes("workspace=settings");
      if (!settingsDepth.returnedToSettings) runnerFindings.push({ turn: "settings-return", message: `Back control did not return to Settings; landed on ${returned}.` });
    } else {
      runnerFindings.push({ turn: "settings-return", message: back.detail });
    }
  } else {
    runnerFindings.push({ turn: "settings-routing", message: routing.detail });
  }

  if (!settingsDepth.advancedSetup || !settingsDepth.advancedRuntime || !settingsDepth.advancedRouting || !settingsDepth.returnedToSettings) {
    const observation = makeObservation({
      kind: "friction", severity: "medium", actionable: true,
      summary: "SETTINGS: the required down-and-back-up exploration path could not be completed cleanly through visible controls.",
      expectation: "A writer should be able to enter advanced settings, inspect deeper details, and return to the parent Settings screen without getting lost.",
      impact: "Advanced configuration can become a one-way rabbit hole for a nontechnical writer.",
    }, 0, "/?workspace=settings", JSON.stringify(settingsDepth), "settings-depth-probe");
    if (observation) observations.push(observation);
  }
  await navigate(client, "/?workspace=learn");
  return { screens: results, settingsDepth };
}

function safeSettingsAction(currentRoute, control) {
  const inSettings = currentRoute.includes("workspace=settings") || currentRoute.startsWith("/ai-routing");
  if (!inSettings) return true;
  if (["checkbox", "radio", "combobox"].includes(control.role)) return false;
  return settingsNavigationControl.test(control.label) && !unsafeControl.test(control.label);
}

async function executeAction(client, toolMap, action, snapshot, currentRoute, turn, failedTargets) {
  if (action.type === "finish") return { ok: true, finished: true, recovered: false, detail: "Writer chose to finish the exploratory session." };
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
  if (!control || unsafeControl.test(control.label) || !safeSettingsAction(currentRoute, control)) {
    const route = nextSafeRoute(currentRoute, turn);
    const moved = await navigate(client, route);
    return { ...moved, recovered: true, attempted: action.target, detail: `Skipped an unavailable or potentially mutating control (${action.target || "unknown"}); safely moved to ${route}.` };
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

function screenIdForRoute(route) {
  return config.reviewScreens.find((screen) => route.startsWith(screen.route.split("&")[0]))?.id || "";
}

async function writeReport({ diary, observations, runnerFindings, storyMemory, modelRole, model, finishedReason, sageConversation, visualReview }) {
  const deduped = [...new Map(observations.map((item) => [item.fingerprint, item])).values()];
  const minimumRank = severityRank[config.minimumPromotedSeverity] || severityRank.medium;
  const promoted = deduped
    .filter((item) => item.actionable && severityRank[item.severity] >= minimumRank)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, config.maxPromotedFindings || 8);
  const report = {
    schemaVersion: 4,
    generatedAt: new Date().toISOString(),
    persona: config.persona,
    storySeed: config.storySeed,
    target: baseUrl,
    modelRole,
    model,
    finishedReason,
    storyMemory,
    sageConversation,
    visualReview,
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
    `**Exploratory turns:** ${diary.filter((entry) => typeof entry.turn === "number").length}`,
    `**Silly Sage conversation:** ${sageConversation.completed}/${sageConversation.requested} messages completed`,
    `**Settings depth:** ${JSON.stringify(visualReview.settingsDepth)}`,
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
    "## Visual consistency review",
    ...visualReview.screens.flatMap((screen) => [
      `### ${screen.label}`,
      visualFactsForWriter(screen.facts),
      ...(screen.findings.length ? screen.findings.map((item) => `- ${item.severity.toUpperCase()}: ${item.summary}`) : ["- No deterministic visual-layout finding."]),
      "",
    ]),
    "## Actionable product feedback",
    ...(promoted.length ? promoted.map((item) => `- **${item.kind} / ${item.severity} / ${item.source}** — ${item.summary}`) : ["- No medium/high actionable findings were promoted from this session."]),
    "",
    "## Runner findings",
    ...(runnerFindings.length ? runnerFindings.map((item) => `- ${item.turn}: ${item.message}`) : ["- No runner recovery was required."]),
    "",
    "## Safety boundary",
    "Avery used only visible Playwright accessibility controls in an isolated browser profile. A separate read-only visual observer measured rendered geometry and computed presentation facts solely to assess symmetry, clipping, overlap, and adoption of the current dark visual system. Neither layer reads story storage, source code, tests, credentials, logs, or GitHub. The Settings depth probe opens/closes navigation and disclosure controls but never changes provider/model/toggle values. GitHub reporting is deterministic and every promoted issue remains explicitly synthetic.",
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
  const visitedScreens = new Set();
  const visualByRoute = new Map();
  let storyMemory = "";
  let modelRole = "fast";
  let model = "";
  let tools = [];
  let finishedReason = "turn-limit";
  let fatalError = null;
  let sageConversation = { requested: 0, completed: 0 };
  let visualReview = { screens: [], settingsDepth: {} };

  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot", "browser_evaluate"]) {
      if (!toolMap.has(required)) throw new Error(`Writer-in-Residence is missing Playwright MCP tool ${required}.`);
    }
    process.stdout.write("Writer-in-Residence boundary ........ UI ONLY  Avery never receives browser_evaluate; the separate visual observer uses it only for rendered layout facts.\n");

    modelRole = await writerModelRole();
    sageConversation = await performSillySageConversation(client, toolMap, diary, observations, runnerFindings);
    visualReview = await focusedVisualReview(client, toolMap, observations, runnerFindings);
    for (const screen of visualReview.screens) {
      if (screen.id) visitedScreens.add(screen.id);
      if (screen.route) visualByRoute.set(screen.route, screen.facts);
    }

    await navigate(client, "/?workspace=learn");
    let consecutiveTurnErrors = 0;
    for (let turn = 1; turn <= maxTurns; turn += 1) {
      try {
        const snapshot = await freshSnapshot(client);
        const route = routeFromSnapshot(snapshot);
        const screenId = screenIdForRoute(route);
        if (screenId) visitedScreens.add(screenId);
        const controls = visibleControls(snapshot);
        const facts = visualByRoute.get(route) || visualByRoute.get(config.reviewScreens.find((screen) => route.startsWith(screen.route.split("&")[0]))?.route || "");
        const response = await callWriter(writerPrompt({ snapshot, controls, turn, diary, storyMemory, modelRole, visualFacts: facts ? visualFactsForWriter(facts) : "", visitedScreens }), modelRole);
        model = response.model || model;
        const decision = parseDecision(response.text, controls, route, turn, failedTargets);
        if (decision.storyMemory) storyMemory = decision.storyMemory;
        const turnObservations = decision.observations.map((item) => ({ ...item, evidence: cleanSnapshot(snapshot, 1_500) }));
        observations.push(...turnObservations);
        if (turnObservations.some((item) => item.actionable)) await screenshot(client, toolMap, `turn-${String(turn).padStart(2, "0")}`);
        const result = await executeAction(client, toolMap, decision.action, snapshot, route, turn, failedTargets);
        if (!decision.protocol) runnerFindings.push({ turn, message: "Local model ignored the compact NEXT protocol; action recovered from visible text/current route." });
        if (result.recovered) runnerFindings.push({ turn, message: result.detail });
        diary.push({ turn, route, summary: decision.summary, action: decision.action, result, observations: turnObservations });
        process.stdout.write(`Writer turn ${String(turn).padStart(2, "0")} ...................... ${result.recovered ? "RECOVERED" : result.ok ? "OK" : "RETRY"}  ${decision.summary}\n`);
        consecutiveTurnErrors = 0;
        if (result.finished && config.reviewScreens.every((screen) => visitedScreens.has(screen.id))) {
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

  const { reportJson, deduped, promoted } = await writeReport({ diary, observations, runnerFindings, storyMemory, modelRole, model, finishedReason, sageConversation, visualReview });
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
  process.stdout.write(`Writer-in-Residence COMPLETE: ${diary.length} diary entries, ${deduped.length} observation(s), ${promoted.length} promoted finding(s). Report: ${artifactRoot}\n`);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactRoot, "writer-in-residence-error.txt"), `${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
