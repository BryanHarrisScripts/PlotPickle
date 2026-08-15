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
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "browser-profile");
const minimumTurnsPerArea = Math.max(2, Number(argument("--turns-per-area", "2")) || 2);

const severityRank = { low: 1, medium: 2, high: 3 };
const allowedKinds = new Set(["positive", "confusion", "friction", "need", "bug", "abandonment-risk"]);
const allowedRoutes = new Set(config.allowedRoutes);
const unsafeControl = /delete|reset|clear|remove|connect|sign in|purchase|buy|generate image|generate video|switch to cloud|use local-first setup|set up sage and plan|test sage|test plan|managed llama/i;
const settingsNavigationControl = /advanced setup|advanced runtime details|advanced ai routing|cloud and legacy provider overrides|back to plotpickle settings|return to learn|return to plan/i;

function status(label, state, detail = "") {
  const left = String(label).padEnd(38, ".");
  process.stdout.write(`${left} ${state}${detail ? `  ${detail}` : ""}\n`);
}

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
    if (label) controls.push({ role: match[1].toLowerCase(), label, ref: match[3] });
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
    const body = await response.json();
    return body?.localRuntime?.models?.quality?.available ? "quality" : "fast";
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

function writerPrompt({ mission, snapshot, controls, turn, storyMemory, modelRole, recentDiary, visualFacts }) {
  const controlList = controls.slice(0, 40).map((item) => `${item.role.toUpperCase()}: ${item.label}`).join("\n");
  return [
    "You are Avery North, PlotPickle's disclosed synthetic first-time screenwriter. Behave like a real writer, not a QA engineer.",
    `Story: ${config.storySeed.title}. ${config.storySeed.premise}`,
    `Creative goal: ${config.storySeed.creativeGoal}`,
    `Story memory: ${storyMemory || "Only the seed is established."}`,
    `Current mission: spend time using ${mission.label} as a first-time writer. This is writer interaction ${turn} in this area.`,
    `Local model role: ${modelRole}.`,
    recentDiary ? `Recent writer journey:\n${recentDiary}` : "",
    visualFacts ? `Read-only visible layout summary: ${visualFacts}` : "",
    "",
    "Choose ONE next visible action that makes sense for a writer on this screen. Read, open, type, ask, play, or explore. Do not try to make a test pass.",
    "In SETTINGS you may follow visible Advanced/pill/tab/disclosure navigation, but never change provider, model, checkbox, radio, routing, account, payment, cloud, or destructive values.",
    "Do not finish the whole session yet; PlotPickle will tell you when all four areas have been explored.",
    "Reply with one NEXT line:",
    "NEXT|CLICK|exact visible control name|short first-person intention",
    "NEXT|TYPE|exact visible field name|natural text to type",
    "NEXT|NAVIGATE|LEARN|short intention  (or PLAN, WYRMWOOD, SETTINGS)",
    "NEXT|WAIT||short intention",
    "NEXT|FINISH||short reason",
    "Optional: STORY|short cumulative story choices",
    "Optional observations, maximum two:",
    "OBS|positive|low|false|summary|expectation|impact",
    "OBS|confusion|medium|true|summary|expectation|impact",
    "Kinds: positive, confusion, friction, need, bug, abandonment-risk. Severities: low, medium, high.",
    "Do not invent defects or request source, DOM, localStorage, tests, GitHub, logs, credentials, or developer tools.",
    "",
    "CURRENT VISIBLE CONTROLS:",
    controlList || "No named interactive controls were found.",
    "",
    "VISIBLE ACCESSIBILITY SNAPSHOT:",
    cleanSnapshot(snapshot),
  ].filter(Boolean).join("\n");
}

function parseDecision(raw, controls, route, turn, failedTargets, snapshot) {
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
    if (kind === "CLICK") action = { type: "click", target, text: "", route: "" };
    else if (kind === "TYPE") action = { type: "type", target, text: payload.slice(0, 4_000), route: "" };
    else if (kind === "NAVIGATE") {
      const key = target.toUpperCase();
      const destination = key === "PLAN" ? "/?workspace=plan&section=foundations" : key === "WYRMWOOD" || key === "GAME" ? "/?workspace=wyrmwood" : key === "SETTINGS" ? "/?workspace=settings" : "/?workspace=learn";
      action = { type: "navigate", target: "", text: "", route: destination };
      summary = payload;
    } else if (kind === "WAIT" || kind === "FINISH") action = { type: "wait", target: "", text: "", route: "" };
    if (!summary && kind !== "TYPE") summary = payload;
    if (kind === "TYPE") summary = `I want to write into ${target}.`;
  }
  if (action && (action.type === "click" || action.type === "type") && !exactControl(controls, action.target, failedTargets)) action = null;
  if (!action) {
    const control = mentionedControl(controls, raw, failedTargets);
    if (control && !unsafeControl.test(control.label)) {
      action = ["textbox", "searchbox"].includes(control.role)
        ? { type: "wait", target: "", text: "", route: "" }
        : { type: "click", target: control.label, text: "", route: "" };
      summary = `I want to try ${control.label} and see what happens.`;
    }
  }
  if (!action) {
    action = { type: "wait", target: "", text: "", route: "" };
    summary = "I want a moment to understand this screen before continuing.";
  }
  return {
    action,
    summary: summary || "I want to keep exploring this part of PlotPickle.",
    storyMemory: storyLine ? storyLine.slice(storyLine.indexOf("|") + 1).trim().slice(0, 2_000) : "",
    observations: lines.map((line) => parseObservation(line, turn, route, snapshot)).filter(Boolean),
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
}

async function freshSnapshot(client) {
  return resultText(await client.call("browser_snapshot", {}));
}

async function safeScreenshot(client, toolMap, name, runnerFindings) {
  const tool = toolMap.get("browser_take_screenshot");
  if (!tool) return false;
  try {
    await client.call("browser_take_screenshot", toolArguments(tool, { type: "png", filename: `${name}.png`, fullPage: true }));
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runnerFindings.push({ turn: `screenshot:${name}`, message });
    status(`Screenshot ${name}`, "WARN", message.slice(0, 100));
    return false;
  }
}

async function clickNamed(client, toolMap, pattern, roles = ["button", "link", "tab"]) {
  const snapshot = await freshSnapshot(client);
  const control = controlMatching(visibleControls(snapshot), pattern, roles);
  if (!control) return { ok: false, snapshot, detail: `Could not find visible control matching ${pattern}.` };
  try {
    await client.call("browser_click", actionArgs(toolMap.get("browser_click"), { ref: control.ref, element: control.label }));
    await delay(650);
    return { ok: true, label: control.label, snapshot: await freshSnapshot(client), detail: `Opened ${control.label}.` };
  } catch (error) {
    return { ok: false, snapshot, label: control.label, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function executeAction(client, toolMap, decision, snapshot, failedTargets, mission) {
  const action = decision.action;
  if (action.type === "wait") {
    await delay(900);
    return { ok: true, recovered: false, detail: "Waited to understand the current screen." };
  }
  if (action.type === "navigate") {
    if (!allowedRoutes.has(action.route)) return { ok: false, recovered: true, detail: `Ignored unapproved route ${action.route}.` };
    await navigate(client, action.route);
    return { ok: true, recovered: false, detail: `Navigated to ${action.route}.` };
  }
  const controls = visibleControls(snapshot);
  const control = exactControl(controls, action.target, failedTargets);
  const inSettings = mission.id === "settings" || routeFromSnapshot(snapshot).startsWith("/ai-routing");
  if (!control || unsafeControl.test(control.label) || (inSettings && (["checkbox", "radio", "combobox"].includes(control.role) || !settingsNavigationControl.test(control.label)))) {
    return { ok: true, recovered: true, detail: `Skipped unavailable or potentially mutating control ${action.target || "(unknown)"}.` };
  }
  const toolName = action.type === "type" ? "browser_type" : "browser_click";
  try {
    await client.call(toolName, actionArgs(toolMap.get(toolName), { ref: control.ref, element: control.label, text: action.type === "type" ? action.text : undefined }));
    await delay(action.type === "type" ? 450 : 700);
    return { ok: true, recovered: false, detail: `${action.type} completed for ${control.label}.` };
  } catch (error) {
    failedTargets.add(control.label.toLowerCase());
    return { ok: false, recovered: true, detail: `${toolName} failed for ${control.label}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function performSillySageConversation(client, toolMap, diary, observations, runnerFindings) {
  status("Phase 1 · silly Sage conversation", "START");
  await navigate(client, "/?workspace=learn");
  const questions = Array.isArray(config.requiredSageConversation) ? config.requiredSageConversation : [];
  let completed = 0;
  for (let index = 0; index < questions.length; index += 1) {
    const question = String(questions[index] || "").trim();
    const snapshot = await freshSnapshot(client);
    const controls = visibleControls(snapshot);
    const textbox = controlMatching(controls, /ask in your own words|creative room|question/i, ["textbox"]) || controls.find((item) => item.role === "textbox");
    if (!textbox) {
      runnerFindings.push({ turn: `sage-${index + 1}`, message: "Visible Sage textbox was not found." });
      break;
    }
    try {
      await client.call("browser_type", actionArgs(toolMap.get("browser_type"), { ref: textbox.ref, element: textbox.label, text: question }));
      await delay(250);
      const typed = await freshSnapshot(client);
      const ask = controlMatching(visibleControls(typed), /ask the guide/i, ["button"]);
      if (!ask) throw new Error("Ask the Guide button was not visible after typing.");
      await client.call("browser_click", actionArgs(toolMap.get("browser_click"), { ref: ask.ref, element: ask.label }));
      let answerSnapshot = "";
      let answered = false;
      for (let attempt = 0; attempt < 45; attempt += 1) {
        await delay(700);
        answerSnapshot = await freshSnapshot(client);
        if (answerSnapshot.includes(question) && !/Thinking about your question/i.test(answerSnapshot)) {
          answered = true;
          break;
        }
      }
      diary.push({ turn: `sage-${index + 1}`, area: "learn", route: "/?workspace=learn", summary: `I asked Sage something deliberately silly: ${question}`, action: { type: "type+submit", target: "Ask in your own words" }, result: { ok: answered, recovered: false, detail: answered ? "Sage completed the conversational reply." : "Sage did not visibly finish in time." }, observations: [] });
      status(`Sage silly message ${index + 1}`, answered ? "PASS" : "WARN");
      if (!answered) throw new Error("Sage did not visibly finish the conversational reply within the probe window.");
      completed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runnerFindings.push({ turn: `sage-${index + 1}`, message });
      const observation = makeObservation({ kind: "friction", severity: "medium", actionable: true, summary: `LEARN: Avery's silly Sage conversation could not complete (${message}).`, expectation: "Sage should handle ordinary playful conversation as reliably as curriculum questions.", impact: "A writer may stop treating Sage as a persistent creative-room companion." }, `sage-${index + 1}`, "/?workspace=learn", question, "required-sage-probe");
      if (observation) observations.push(observation);
      break;
    }
  }
  status("Phase 1 · silly Sage conversation", completed === questions.length ? "PASS" : "WARN", `${completed}/${questions.length}`);
  return { requested: questions.length, completed };
}

async function runWriterJourney(client, toolMap, diary, observations, runnerFindings, modelRole) {
  status("Phase 2 · Avery four-area journey", "START", `${minimumTurnsPerArea} turn(s) per area`);
  const failedTargets = new Set();
  const writerVisitedScreens = new Set();
  let storyMemory = "";
  let model = "";
  let numericTurn = 0;
  const areaCounts = {};

  for (const mission of config.reviewScreens) {
    status(`Avery area · ${mission.label}`, "START");
    try {
      await navigate(client, mission.route);
      writerVisitedScreens.add(mission.id);
    } catch (error) {
      runnerFindings.push({ turn: `area:${mission.id}`, message: `Could not open ${mission.label}: ${error instanceof Error ? error.message : String(error)}` });
      status(`Avery area · ${mission.label}`, "WARN", "navigation failed");
      continue;
    }
    areaCounts[mission.id] = 0;
    for (let localTurn = 1; localTurn <= minimumTurnsPerArea; localTurn += 1) {
      numericTurn += 1;
      try {
        const snapshot = await freshSnapshot(client);
        const route = routeFromSnapshot(snapshot, mission.route);
        const controls = visibleControls(snapshot);
        let visualFacts = "";
        try {
          const facts = await observeRenderedUi(client, resultText);
          visualFacts = visualFactsForWriter(facts);
        } catch {}
        const recentDiary = diary.slice(-4).map((entry) => `${entry.turn}:${entry.summary}:${entry.result?.detail || ""}`).join("\n");
        const response = await callWriter(writerPrompt({ mission, snapshot, controls, turn: localTurn, storyMemory, modelRole, recentDiary, visualFacts }), modelRole);
        model = response.model || model;
        const decision = parseDecision(response.text, controls, route, numericTurn, failedTargets, snapshot);
        if (decision.storyMemory) storyMemory = decision.storyMemory;
        observations.push(...decision.observations);
        const result = await executeAction(client, toolMap, decision, snapshot, failedTargets, mission);
        if (!decision.protocol) runnerFindings.push({ turn: numericTurn, message: `Local model ignored NEXT protocol in ${mission.label}; recovered from visible text.` });
        if (result.recovered) runnerFindings.push({ turn: numericTurn, message: result.detail });
        diary.push({ turn: numericTurn, area: mission.id, route, summary: decision.summary, action: decision.action, result, observations: decision.observations });
        areaCounts[mission.id] += 1;
        process.stdout.write(`Writer turn ${String(numericTurn).padStart(2, "0")} · ${mission.label.padEnd(18)} ${result.recovered ? "RECOVERED" : result.ok ? "OK" : "RETRY"}  ${decision.summary}\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runnerFindings.push({ turn: numericTurn, message: `${mission.label} turn recovered: ${message}` });
        process.stdout.write(`Writer turn ${String(numericTurn).padStart(2, "0")} · ${mission.label.padEnd(18)} RECOVERED  ${message}\n`);
        try { await navigate(client, mission.route); } catch {}
      }
    }
    status(`Avery area · ${mission.label}`, areaCounts[mission.id] >= minimumTurnsPerArea ? "PASS" : "WARN", `${areaCounts[mission.id]}/${minimumTurnsPerArea} writer turns`);
  }

  const complete = config.reviewScreens.every((screen) => writerVisitedScreens.has(screen.id) && Number(areaCounts[screen.id] || 0) >= minimumTurnsPerArea);
  status("Phase 2 · Avery four-area journey", complete ? "PASS" : "WARN", `${numericTurn} writer turn(s)`);
  return { complete, storyMemory, model, writerVisitedScreens: [...writerVisitedScreens], areaCounts, numericTurn };
}

async function runSettingsDepth(client, toolMap, runnerFindings) {
  status("Phase 3 · Settings depth/down-up", "START");
  const depth = { advancedSetup: false, advancedRuntime: false, advancedRouting: false, routingDetails: false, returnedToSettings: false };
  try { await navigate(client, "/?workspace=settings"); } catch (error) {
    runnerFindings.push({ turn: "settings-depth", message: error instanceof Error ? error.message : String(error) });
    return depth;
  }
  for (const probe of [
    { key: "advancedSetup", pattern: /^Advanced Setup$/i },
    { key: "advancedRuntime", pattern: /^Advanced runtime details$/i },
  ]) {
    const opened = await clickNamed(client, toolMap, probe.pattern);
    if (opened.ok) {
      depth[probe.key] = true;
      status(`Settings · ${opened.label}`, "DOWN");
      const closed = await clickNamed(client, toolMap, probe.pattern);
      status(`Settings · ${opened.label}`, closed.ok ? "UP" : "WARN");
      if (!closed.ok) runnerFindings.push({ turn: `settings:${probe.key}`, message: closed.detail });
    } else runnerFindings.push({ turn: `settings:${probe.key}`, message: opened.detail });
  }
  const routing = await clickNamed(client, toolMap, /^Advanced AI routing$/i, ["link", "button"]);
  if (routing.ok) {
    depth.advancedRouting = true;
    status("Settings · Advanced AI routing", "DOWN");
    const compatibility = await clickNamed(client, toolMap, /^Cloud and legacy provider overrides$/i, ["button"]);
    if (compatibility.ok) {
      depth.routingDetails = true;
      status("Settings · provider overrides", "DOWN");
      const closed = await clickNamed(client, toolMap, /^Cloud and legacy provider overrides$/i, ["button"]);
      status("Settings · provider overrides", closed.ok ? "UP" : "WARN");
      if (!closed.ok) runnerFindings.push({ turn: "settings:routing-details", message: closed.detail });
    }
    const back = await clickNamed(client, toolMap, /Back to PlotPickle Settings/i, ["link", "button"]);
    if (back.ok) {
      depth.returnedToSettings = routeFromSnapshot(back.snapshot).includes("workspace=settings");
      status("Settings · Back to PlotPickle Settings", depth.returnedToSettings ? "UP" : "WARN");
    } else runnerFindings.push({ turn: "settings:return", message: back.detail });
  } else runnerFindings.push({ turn: "settings:routing", message: routing.detail });
  const complete = depth.advancedSetup && depth.advancedRuntime && depth.advancedRouting && depth.returnedToSettings;
  status("Phase 3 · Settings depth/down-up", complete ? "PASS" : "WARN", JSON.stringify(depth));
  return depth;
}

async function runVisualReview(client, toolMap, observations, runnerFindings) {
  status("Phase 4 · rendered visual review", "START");
  const screens = [];
  for (const screen of config.reviewScreens) {
    try {
      await navigate(client, screen.route);
      const snapshot = await freshSnapshot(client);
      await safeScreenshot(client, toolMap, `writer-review-${screen.id}`, runnerFindings);
      const facts = await observeRenderedUi(client, resultText);
      const findings = facts?.error ? [] : reviewRenderedUi(screen.label, facts);
      if (facts?.error) runnerFindings.push({ turn: `visual:${screen.id}`, message: facts.error });
      for (const raw of findings) {
        const observation = makeObservation(raw, `visual:${screen.id}`, screen.route, `${visualFactsForWriter(facts)}\n${cleanSnapshot(snapshot, 900)}`, "rendered-visual-observer");
        if (observation) observations.push(observation);
      }
      screens.push({ ...screen, facts, findings });
      status(`Visual · ${screen.label}`, facts?.error ? "WARN" : findings.length ? "REVIEW" : "PASS", visualFactsForWriter(facts));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      runnerFindings.push({ turn: `visual:${screen.id}`, message });
      screens.push({ ...screen, facts: { error: message }, findings: [] });
      status(`Visual · ${screen.label}`, "WARN", message.slice(0, 100));
    }
  }
  try {
    await navigate(client, "/ai-routing");
    const snapshot = await freshSnapshot(client);
    await safeScreenshot(client, toolMap, "writer-review-advanced-ai-routing", runnerFindings);
    const facts = await observeRenderedUi(client, resultText);
    const findings = facts?.error ? [] : reviewRenderedUi("SETTINGS · Advanced AI routing", facts);
    for (const raw of findings) {
      const observation = makeObservation(raw, "visual:advanced-ai-routing", "/ai-routing", `${visualFactsForWriter(facts)}\n${cleanSnapshot(snapshot, 900)}`, "rendered-visual-observer");
      if (observation) observations.push(observation);
    }
    screens.push({ id: "advanced-ai-routing", label: "SETTINGS · Advanced AI routing", route: "/ai-routing", facts, findings });
    status("Visual · Advanced AI routing", facts?.error ? "WARN" : findings.length ? "REVIEW" : "PASS", visualFactsForWriter(facts));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runnerFindings.push({ turn: "visual:advanced-ai-routing", message });
    status("Visual · Advanced AI routing", "WARN", message.slice(0, 100));
  }
  status("Phase 4 · rendered visual review", "PASS", `${screens.length} screen(s) inspected; failures are nonfatal and recorded`);
  return { screens };
}

async function writeReport({ diary, observations, runnerFindings, modelRole, journey, sageConversation, settingsDepth, visualReview, finishedReason }) {
  const deduped = [...new Map(observations.map((item) => [item.fingerprint, item])).values()];
  const minimumRank = severityRank[config.minimumPromotedSeverity] || severityRank.medium;
  const promoted = deduped
    .filter((item) => item.actionable && severityRank[item.severity] >= minimumRank)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, config.maxPromotedFindings || 8);
  const report = {
    schemaVersion: 5,
    generatedAt: new Date().toISOString(),
    persona: config.persona,
    storySeed: config.storySeed,
    target: baseUrl,
    modelRole,
    model: journey.model,
    finishedReason,
    storyMemory: journey.storyMemory,
    sageConversation,
    journeyCoverage: { complete: journey.complete, writerVisitedScreens: journey.writerVisitedScreens, areaCounts: journey.areaCounts, minimumTurnsPerArea },
    settingsDepth,
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
    `**Silly Sage conversation:** ${sageConversation.completed}/${sageConversation.requested}`,
    `**Avery journey complete:** ${journey.complete ? "YES" : "NO"}`,
    `**Writer turns:** ${journey.numericTurn}`,
    `**Writer turns by area:** ${JSON.stringify(journey.areaCounts)}`,
    `**Settings depth:** ${JSON.stringify(settingsDepth)}`,
    `**Promoted findings:** ${promoted.length}`,
    `**Finished:** ${finishedReason}`,
    "",
    "## Writer diary",
    ...diary.flatMap((entry) => [
      `### ${entry.turn} · ${entry.area || "probe"} · ${entry.route}`,
      entry.summary,
      `Result: ${entry.result?.detail || "recorded"}`,
      ...(entry.observations?.length ? entry.observations.map((item) => `- ${item.kind.toUpperCase()} / ${item.severity}: ${item.summary}`) : ["- No writer observation recorded."]),
      "",
    ]),
    "## Visual review",
    ...visualReview.screens.flatMap((screen) => [
      `### ${screen.label}`,
      visualFactsForWriter(screen.facts),
      ...(screen.findings?.length ? screen.findings.map((item) => `- ${item.severity.toUpperCase()}: ${item.summary}`) : ["- No deterministic visual-layout finding."]),
      "",
    ]),
    "## Actionable product feedback",
    ...(promoted.length ? promoted.map((item) => `- **${item.kind} / ${item.severity} / ${item.source}** — ${item.summary}`) : ["- No medium/high actionable findings were promoted from this session."]),
    "",
    "## Runner findings",
    ...(runnerFindings.length ? runnerFindings.map((item) => `- ${item.turn}: ${item.message}`) : ["- No runner recovery was required."]),
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
  let tools = [];
  let modelRole = "fast";
  let fatalError = null;
  let sageConversation = { requested: 0, completed: 0 };
  let journey = { complete: false, storyMemory: "", model: "", writerVisitedScreens: [], areaCounts: {}, numericTurn: 0 };
  let settingsDepth = {};
  let visualReview = { screens: [] };

  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    for (const required of ["browser_navigate", "browser_snapshot", "browser_click", "browser_type", "browser_take_screenshot", "browser_evaluate"]) {
      if (!toolMap.has(required)) throw new Error(`Writer-in-Residence is missing Playwright MCP tool ${required}.`);
    }
    process.stdout.write("Writer-in-Residence boundary ........ UI ONLY  Avery never receives browser_evaluate; a separate visual observer uses it only for rendered layout facts.\n");
    modelRole = await writerModelRole();
    sageConversation = await performSillySageConversation(client, toolMap, diary, observations, runnerFindings);
    journey = await runWriterJourney(client, toolMap, diary, observations, runnerFindings, modelRole);
    settingsDepth = await runSettingsDepth(client, toolMap, runnerFindings);
    visualReview = await runVisualReview(client, toolMap, observations, runnerFindings);
  } catch (error) {
    fatalError = error;
    runnerFindings.push({ turn: "fatal", message: error instanceof Error ? error.message : String(error) });
    status("Writer-in-Residence fatal boundary", "ERROR", error instanceof Error ? error.message : String(error));
  } finally {
    try { if (tools.some((tool) => tool.name === "browser_close")) await client.call("browser_close", {}); } catch {}
    await client.close().catch(() => {});
  }

  const settingsComplete = Boolean(settingsDepth.advancedSetup && settingsDepth.advancedRuntime && settingsDepth.advancedRouting && settingsDepth.returnedToSettings);
  const complete = !fatalError && journey.complete && sageConversation.completed === sageConversation.requested && settingsComplete;
  const finishedReason = complete ? "complete-journey" : fatalError ? "runner-error" : "incomplete-journey";
  const { reportJson, deduped, promoted } = await writeReport({ diary, observations, runnerFindings, modelRole, journey, sageConversation, settingsDepth, visualReview, finishedReason });
  if (githubReport && promoted.length) {
    const reporter = path.join(repoRoot, "scripts", "report-writer-in-residence.mjs");
    const code = await new Promise((resolve) => {
      const child = spawn(process.execPath, [reporter, "--report", reportJson], { cwd: repoRoot, env: process.env, stdio: "inherit", windowsHide: true });
      child.once("error", () => resolve(1));
      child.once("exit", (value) => resolve(Number(value ?? 1)));
    });
    if (code !== 0) process.exitCode = 1;
  }
  if (!complete) process.exitCode = 1;
  const state = complete ? "COMPLETE" : "INCOMPLETE";
  process.stdout.write(`Writer-in-Residence ${state}: ${journey.numericTurn} writer turn(s) + ${sageConversation.completed} Sage probe(s), ${deduped.length} observation(s), ${promoted.length} promoted finding(s). Report: ${artifactRoot}\n`);
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(path.join(artifactRoot, "writer-in-residence-error.txt"), `${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
