#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function argument(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
}

const baseUrl = argument("--base-url", process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173");
const scope = argument("--scope", process.env.PLOTPICKLE_ACCEPTANCE_SCOPE || "smoke");
const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const artifactRoot = path.resolve(argument("--artifact-root", path.join(localRoot, "PlotPickle", "uat")));
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");
const pluginData = path.join(artifactRoot, "agent-plugin");
const reportPath = path.join(artifactRoot, "acceptance-report.md");
const tracePath = path.join(artifactRoot, "local-browser-trace.jsonl");
const snapshotRoot = path.join(artifactRoot, "snapshots");
const ollamaReviewPath = path.join(artifactRoot, "ollama-review.md");
const mcpStderrPath = path.join(artifactRoot, "playwright-mcp.log");

if (!new Set(["smoke", "full"]).has(scope)) throw new Error(`Unsupported UAT scope: ${scope}`);

const smokeJourney = [
  { id: "dashboard", label: "Dashboard", query: "dashboard" },
  { id: "planner", label: "Plan", query: "plan" },
  { id: "visuals", label: "Storyboard", query: "storyboard" },
  { id: "script", label: "Write", query: "write" },
  { id: "edit", label: "Edit", path: "/edit" },
  { id: "pitch", label: "Graphic Novel", query: "pitch" },
  { id: "build", label: "Build", query: "build" },
  { id: "feedback", label: "Feedback", query: "feedback" },
];

const fullJourney = [
  ...smokeJourney,
  { id: "engines", label: "Refine", query: "refine" },
  { id: "reports", label: "Reports", query: "reports" },
  { id: "settings", label: "Settings", query: "settings" },
];

const journey = scope === "full" ? fullJourney : smokeJourney;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resultText(result) {
  return Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === "text").map((item) => item.text || "").join("\n")
    : "";
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function extractRef(text, label) {
  const lines = String(text || "").split(/\r?\n/);
  const normalizedLabel = label.toLowerCase();
  const candidates = lines.filter((line) => line.toLowerCase().includes(normalizedLabel));
  for (const line of [...candidates, ...lines]) {
    const match = line.match(/\[ref=([^\]]+)\]/i) || line.match(/\bref[=:]\s*([A-Za-z0-9_-]+)/i);
    if (match) return match[1];
  }
  return "";
}

function extractFirstJsonObject(text) {
  const raw = String(text || "");
  for (let start = raw.indexOf("{"); start >= 0; start = raw.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(raw.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

function extractPageState(text) {
  const raw = String(text || "");
  const marker = "### Result";
  const markerIndex = raw.indexOf(marker);
  const resultSection = markerIndex >= 0
    ? raw.slice(markerIndex + marker.length).split(/\r?\n###\s/)[0]
    : raw;
  const parsed = extractFirstJsonObject(resultSection) || extractFirstJsonObject(raw);
  if (parsed && typeof parsed === "object") return parsed;
  return { url: "", activeId: "", activeLabel: "", mainLength: 0, title: "" };
}

function consoleHasErrors(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const count = raw.match(/\bErrors:\s*(\d+)\b/i);
  if (count) return Number(count[1]) > 0;
  if (/Returning\s+0\s+messages\s+for\s+level\s+["']?error["']?/i.test(raw)) return false;
  return /(?:^|\n)\s*(?:\[?error\]?\s*[:\-]?|Error:|Uncaught\b|Unhandled\b)/im.test(raw);
}

function stateMatchesScreen(screen, state) {
  const activeId = String(state?.activeId || "");
  const urlText = String(state?.url || "");
  if (screen.id === "edit") {
    try {
      return new URL(urlText).pathname === "/edit";
    } catch {
      return urlText.includes("/edit");
    }
  }
  if (activeId) return activeId === screen.id;
  try {
    const url = new URL(urlText);
    const workspace = url.searchParams.get("workspace");
    if (workspace) return workspace === screen.query;
    return screen.id === "dashboard" && url.pathname === "/";
  } catch {
    return false;
  }
}

function parseParameterBillions(value) {
  if (!value) return 0;
  const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)\s*([BM])/i);
  if (!match) return 0;
  const number = Number(match[1]);
  return match[2].toUpperCase() === "B" ? number : number / 1000;
}

function chooseOllamaModel(models) {
  const override = process.env.PLOTPICKLE_UAT_OLLAMA_MODEL?.trim();
  if (override && models.some((model) => model.name === override || model.model === override)) return override;

  const scored = models.map((model) => {
    const name = String(model.name || model.model || "");
    const size = parseParameterBillions(model?.details?.parameter_size) || parseParameterBillions(name);
    if (!name || size < 3 || size > 32) return null;
    const lower = name.toLowerCase();
    let score = 100 - Math.abs(size - 8) * 3;
    if (/qwen|llama|mistral|gemma|phi|deepseek|gpt-oss/.test(lower)) score += 20;
    if (/instruct|chat/.test(lower)) score += 10;
    if (/vision|embed/.test(lower)) score -= 15;
    return { name, size, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);

  return scored[0]?.name || "";
}

async function optionalOllamaReview(evidence) {
  try {
    const tagsResponse = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(4000) });
    if (!tagsResponse.ok) return { status: "skipped", reason: `Ollama returned HTTP ${tagsResponse.status}.` };
    const tags = await tagsResponse.json();
    const model = chooseOllamaModel(Array.isArray(tags.models) ? tags.models : []);
    if (!model) return { status: "skipped", reason: "No suitable installed Ollama instruction model of roughly 3B-32B was found." };

    const compactEvidence = evidence.map((item) => ({
      screen: item.label,
      status: item.status,
      method: item.method,
      activeId: item.pageState?.activeId || "",
      activeLabel: item.pageState?.activeLabel || "",
      url: item.pageState?.url || "",
      mainLength: item.pageState?.mainLength || 0,
      console: item.consoleText ? item.consoleText.slice(0, 1200) : "",
      note: item.note || "",
    }));

    const response = await fetch("http://127.0.0.1:11434/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "system",
            content: "You are a read-only PlotPickle usability reviewer. Review only the supplied deterministic browser evidence. Do not invent actions or failures. Return concise Markdown with Overall, WARN findings, and PASS observations. A local AI opinion never overrides deterministic FAIL/PASS results.",
          },
          {
            role: "user",
            content: `Scope: ${scope}\nDeterministic browser evidence:\n${JSON.stringify(compactEvidence, null, 2)}`,
          },
        ],
        options: { temperature: 0.1, num_predict: 700 },
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) return { status: "skipped", reason: `Ollama review returned HTTP ${response.status}.`, model };
    const payload = await response.json();
    const review = String(payload?.message?.content || "").trim();
    if (!review) return { status: "skipped", reason: "Ollama returned an empty review.", model };
    await writeFile(ollamaReviewPath, `${review}\n`, "utf8");
    return { status: "complete", model, review };
  } catch (error) {
    return { status: "skipped", reason: error instanceof Error ? error.message : String(error) };
  }
}

class McpClient {
  constructor(command, commandArgs, options = {}) {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderr = "";
    this.trace = [];
    this.child = spawn(command, commandArgs, {
      cwd: options.cwd || repoRoot,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.onStdout(chunk));
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.child.once("error", (error) => this.rejectAll(error));
    this.child.once("exit", (code) => {
      if (code !== 0 && this.pending.size) this.rejectAll(new Error(`Playwright MCP exited with code ${code}.`));
    });
  }

  onStdout(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.startsWith("{")) continue;
      try {
        const message = JSON.parse(line);
        this.trace.push(message);
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
          else pending.resolve(message.result);
        }
      } catch {}
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  send(message) {
    this.trace.push({ direction: "out", ...message });
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request(method, params = {}, timeoutMs = 120000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params = {}) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  async initialize() {
    const result = await this.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "plotpickle-local-uat", version: "1.0.0" },
    });
    this.notify("notifications/initialized");
    return result;
  }

  async tools() {
    const result = await this.request("tools/list");
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async call(name, toolArgs = {}) {
    const result = await this.request("tools/call", { name, arguments: toolArgs });
    if (result?.isError) throw new Error(resultText(result) || `${name} failed.`);
    return result;
  }

  async close() {
    try { this.child.stdin.end(); } catch {}
    await delay(100);
    if (this.child.exitCode === null) this.child.kill();
  }
}

function toolArguments(tool, values) {
  const properties = tool?.inputSchema?.properties || {};
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && key in properties) result[key] = value;
  }
  return result;
}

async function main() {
  await mkdir(artifactRoot, { recursive: true });
  await mkdir(pluginData, { recursive: true });
  await mkdir(snapshotRoot, { recursive: true });

  const mcpConfig = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const server = mcpConfig?.mcpServers?.playwright;
  if (!server || server.type !== "stdio" || typeof server.command !== "string") throw new Error("PlotPickle local UAT requires the Playwright stdio MCP server from the Agent Plugin.");

  const expand = (value) => String(value)
    .replaceAll("${PLUGIN_ROOT}", pluginRoot)
    .replaceAll("${PLUGIN_DATA}", pluginData);
  const command = process.platform === "win32" && server.command.toLowerCase() === "npx" ? "npx.cmd" : expand(server.command);
  const commandArgs = Array.isArray(server.args) ? server.args.map(expand) : [];
  const commandEnv = Object.fromEntries(Object.entries(server.env || {}).map(([key, value]) => [key, expand(value)]));
  const client = new McpClient(command, commandArgs, { cwd: expand(server.cwd || pluginRoot), env: commandEnv });
  const evidence = [];
  let deterministicError = null;
  let tools = [];

  try {
    await client.initialize();
    tools = await client.tools();
    const toolMap = new Map(tools.map((tool) => [tool.name, tool]));
    const has = (name) => toolMap.has(name);
    for (const required of ["browser_navigate", "browser_snapshot", "browser_take_screenshot"]) {
      if (!has(required)) throw new Error(`Playwright MCP is missing required tool ${required}.`);
    }

    const navigate = async (url) => client.call("browser_navigate", { url });
    const snapshot = async () => resultText(await client.call("browser_snapshot", {}));
    const pageState = async () => {
      if (!has("browser_evaluate")) return {};
      const result = await client.call("browser_evaluate", {
        function: "() => ({ url: location.href, title: document.title, activeId: document.querySelector('[data-workspace-active=\\\"true\\\"]')?.getAttribute('data-workspace-id') || '', activeLabel: document.querySelector('[data-workspace-active=\\\"true\\\"]')?.textContent?.trim() || '', mainLength: (document.querySelector('main')?.innerText || document.body.innerText || '').trim().length })",
      });
      return extractPageState(resultText(result));
    };
    const consoleMessages = async () => {
      if (!has("browser_console_messages")) return "";
      try {
        return resultText(await client.call("browser_console_messages", toolArguments(toolMap.get("browser_console_messages"), { level: "error", all: false })));
      } catch {
        return "";
      }
    };
    const takeScreenshot = async (filename) => {
      const screenshotArgs = toolArguments(toolMap.get("browser_take_screenshot"), { type: "png", filename, fullPage: true });
      return client.call("browser_take_screenshot", screenshotArgs);
    };
    const findRef = async (label, currentSnapshot) => {
      if (has("browser_find")) {
        try {
          const found = resultText(await client.call("browser_find", { text: label }));
          const ref = extractRef(found, label);
          if (ref) return ref;
        } catch {}
      }
      return extractRef(currentSnapshot, label);
    };
    const clickRef = async (label, ref) => {
      if (!has("browser_click") || !ref) return false;
      const clickTool = toolMap.get("browser_click");
      const properties = clickTool?.inputSchema?.properties || {};
      const clickArgs = { element: `${label} navigation control` };
      if ("target" in properties) clickArgs.target = ref;
      else if ("ref" in properties) clickArgs.ref = ref;
      else return false;
      await client.call("browser_click", clickArgs);
      return true;
    };

    await navigate(baseUrl);
    await delay(400);
    const splashSnapshot = await snapshot();
    await writeFile(path.join(snapshotRoot, "00-splash.md"), splashSnapshot, "utf8");
    await takeScreenshot("00-splash.png");

    let enteredByClick = false;
    const enterRef = await findRef("Enter", splashSnapshot);
    if (enterRef) {
      try {
        enteredByClick = await clickRef("Enter", enterRef);
        if (enteredByClick) await delay(500);
      } catch {}
    }
    if (!enteredByClick) {
      await navigate(new URL("/?workspace=dashboard", baseUrl).toString());
      await delay(500);
    }

    let currentSnapshot = await snapshot();
    for (let index = 0; index < journey.length; index += 1) {
      const screen = journey[index];
      let method = index === 0 && enteredByClick ? "visible Enter control" : "visible workspace control";
      let note = "";
      let reached = false;

      if (index > 0 || screen.id !== "dashboard") {
        const ref = await findRef(screen.label, currentSnapshot);
        if (ref) {
          try {
            reached = await clickRef(screen.label, ref);
            if (reached) await delay(500);
          } catch (error) {
            note = `Visible navigation failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      } else {
        reached = true;
      }

      if (!reached && screen.id === "dashboard") reached = true;
      if (!reached) {
        method = "direct recovery navigation";
        const fallbackUrl = screen.path
          ? new URL(screen.path, baseUrl).toString()
          : new URL(`/?workspace=${screen.query}`, baseUrl).toString();
        try {
          await navigate(fallbackUrl);
          await delay(500);
          reached = true;
          note = note || "The visible workspace control was not usable, so the deterministic runner used the documented local route as a recovery path.";
        } catch (error) {
          note = `${note ? `${note} ` : ""}Recovery navigation failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      currentSnapshot = reached ? await snapshot() : "";
      const filename = `${String(index + 1).padStart(2, "0")}-${safeSlug(screen.label)}`;
      if (currentSnapshot) await writeFile(path.join(snapshotRoot, `${filename}.md`), currentSnapshot, "utf8");
      let screenshotOk = false;
      if (reached) {
        try {
          await takeScreenshot(`${filename}.png`);
          screenshotOk = true;
        } catch (error) {
          note = `${note ? `${note} ` : ""}Screenshot failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
      const state = reached ? await pageState() : {};
      const consoleText = reached ? await consoleMessages() : "";
      const routeMatches = stateMatchesScreen(screen, state);
      const substantive = Number(state.mainLength || 0) > 40 || currentSnapshot.length > 200;
      let status = reached && routeMatches && substantive ? "PASS" : "FAIL";
      if (status === "PASS" && (method === "direct recovery navigation" || !screenshotOk || consoleHasErrors(consoleText))) status = "WARN";

      evidence.push({ ...screen, status, method, note, screenshotOk, pageState: state, consoleText });
    }
  } catch (error) {
    deterministicError = error instanceof Error ? error : new Error(String(error));
  } finally {
    try {
      const toolNames = new Set(tools.map((tool) => tool.name));
      if (toolNames.has("browser_close")) await client.call("browser_close", {});
    } catch {}
    await client.close();
    await writeFile(tracePath, client.trace.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
    await writeFile(mcpStderrPath, client.stderr || "", "utf8");
  }

  const ollama = await optionalOllamaReview(evidence);
  const failures = evidence.filter((item) => item.status === "FAIL");
  const warnings = evidence.filter((item) => item.status === "WARN");
  const overall = deterministicError || failures.length ? "FAIL" : warnings.length ? "WARN" : "PASS";

  const lines = [
    "# PlotPickle Local Human Acceptance Test",
    "",
    `Overall: ${overall}`,
    `Scope: ${scope}`,
    `Target: ${baseUrl}`,
    "Engine: local Agent Plugin + Playwright MCP",
    "Cloud AI required: no",
    "Codex required: no",
    "",
    "## Deterministic journey",
    "",
    "| Screen | Result | Navigation | Active workspace / URL | Screenshot |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const item of evidence) {
    const state = item.pageState || {};
    const location = state.activeId ? `${state.activeId} / ${state.url || ""}` : state.url || "unknown";
    lines.push(`| ${item.label} | ${item.status} | ${item.method} | ${String(location).replaceAll("|", "\\|")} | ${item.screenshotOk ? "captured" : "missing"} |`);
  }

  if (deterministicError) {
    lines.push("", "## Blocking runner error", "", deterministicError.message);
  }

  const notes = evidence.filter((item) => item.note || consoleHasErrors(item.consoleText));
  if (notes.length) {
    lines.push("", "## Findings", "");
    for (const item of notes) {
      const hasConsoleError = consoleHasErrors(item.consoleText);
      lines.push(`- ${item.status} ${item.label}: ${item.note || "Browser console reported an error."}`);
      if (hasConsoleError) lines.push(`  Console: ${item.consoleText.replace(/\s+/g, " ").slice(0, 600)}`);
    }
  }

  lines.push("", "## Optional local AI review", "");
  if (ollama.status === "complete") {
    lines.push(`Ollama model: ${ollama.model}`, "", ollama.review);
  } else {
    lines.push(`Skipped: ${ollama.reason || "No local reviewer was available."}`);
  }

  lines.push(
    "",
    "## Safety boundary",
    "",
    "This baseline run uses the local Agent Plugin and Playwright MCP against 127.0.0.1 only. It does not require ChatGPT/Codex quota, does not use API-key billing, does not edit repository files, and does not perform external writes. Ollama review is optional and never changes the deterministic verdict.",
    "",
  );

  await writeFile(reportPath, lines.join("\n"), "utf8");
  process.stdout.write(`${lines.join("\n")}\n`);
  process.exitCode = overall === "FAIL" ? 1 : 0;
}

main().catch(async (error) => {
  await mkdir(artifactRoot, { recursive: true });
  const message = error instanceof Error ? error.stack || error.message : String(error);
  await writeFile(reportPath, `# PlotPickle Local Human Acceptance Test\n\nOverall: FAIL\n\n${message}\n`, "utf8");
  console.error(message);
  process.exitCode = 1;
});
