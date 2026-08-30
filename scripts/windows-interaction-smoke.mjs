#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { establishVerificationSyntheticHuman } from "./full-verification-auth.mjs";

const root = path.resolve(process.argv[2] ?? ".");
const reportDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "windows-interaction-smoke"));
const requestedTotalTimeoutMs = Number(process.env.PLOTPICKLE_SMOKE_TOTAL_TIMEOUT_MS || 6 * 60_000);
const totalTimeoutMs = Math.min(requestedTotalTimeoutMs, 6 * 60_000);
const actionTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_SMOKE_ACTION_TIMEOUT_MS || 8_000), 8_000);
const routeTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_SMOKE_ROUTE_TIMEOUT_MS || 30_000), 30_000);
const maximumRoutes = Math.min(Number(process.env.PLOTPICKLE_SMOKE_MAX_ROUTES || (process.env.CI === "true" ? 1 : 60)), 60);
const maximumStates = Math.min(Number(process.env.PLOTPICKLE_SMOKE_MAX_STATES || (process.env.CI === "true" ? 1 : 60)), 60);
const maximumActions = Math.min(Number(process.env.PLOTPICKLE_SMOKE_MAX_ACTIONS || (process.env.CI === "true" ? 3 : 240)), 240);
const maximumDepth = Math.min(Number(process.env.PLOTPICKLE_SMOKE_MAX_DEPTH || (process.env.CI === "true" ? 0 : 3)), 3);
const communityEdgeMode = process.env.PLOTPICKLE_SMOKE_COMMUNITY_EDGE === "1";
const communityStableMs = 5_000;
const deadline = Date.now() + totalTimeoutMs;
const appDirectory = path.join(root, "app");
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const pageFile = /^page\.(?:[cm]?[jt]sx?)$/;
const requiredAssets = [
  "/manifest.webmanifest",
  "/brand/favicon/plotpickle-icon-32.png",
  "/brand/plotpickle-header-horizontal-600.png",
  "/brand/plotpickle-logo-stacked-transparent-800.png",
];
const externalOrCostlyAction = /\b(connect|sign[ -]?in|log[ -]?in|authorize|install|update|repair|publish|merge|approve|reject|invite|send|upload|import|export|download|open folder|open github|create repository|create story project|generate|render|run ai|buy|subscribe)\b/i;
const directMutationAction = /\b(delete|erase|wipe|remove|disconnect|revoke|reset|trash|destroy)\b/i;
const selector = "button, a[href], [role='button'], [role='tab'], summary, input[type='checkbox'], input[type='radio'], select";
const processes = new Set();
let watchdog;
let emergencyReport;

if (process.platform !== "win32") throw new Error("The packaged interaction smoke must run on Windows.");
if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const stateExpression = String.raw`(() => {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  };
  return {
    url: location.href,
    headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).slice(0, 8).map((element) => normalize(element.innerText)),
    selected: [...document.querySelectorAll("[aria-selected='true'],[aria-current],details[open]>summary")].filter(visible).slice(0, 12).map((element) => normalize(element.innerText || element.getAttribute("aria-label"))),
  };
})()`;

function stateKey(state) {
  return JSON.stringify({ url: state?.url || "", headings: state?.headings || [], selected: state?.selected || [] });
}

async function choosePort(preferred) {
  for (let port = preferred; port < preferred + 100; port += 1) {
    const available = await new Promise((resolve) => {
      const server = createServer();
      server.once("error", () => resolve(false));
      server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No free port was found near ${preferred}.`);
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const stopAt = Date.now() + timeoutMs;
  let lastError = "No response received.";
  while (Date.now() < stopAt) {
    try {
      const remainingMs = Math.max(1_000, stopAt - Date.now());
      const response = await fetch(url, { signal: AbortSignal.timeout(remainingMs), redirect: "manual" });
      if (response.status > 0) return response;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function inspectHttpRoute(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(routeTimeoutMs),
    redirect: "manual",
  });
  const source = await response.text();
  const title = normalizeText(source.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const descriptionTag = source.match(/<meta\b[^>]*name=["']description["'][^>]*>/i)?.[0] ?? "";
  const description = normalizeText(descriptionTag.match(/content=["']([^"']*)["']/i)?.[1]);
  const body = normalizeText(source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]);
  const failures = [];
  if (!response.ok) failures.push(`${response.status} ${response.statusText}`);
  if (!title) failures.push("Document title is missing.");
  if (!description) failures.push("Meta description is missing.");
  if (!body) failures.push("Document body is empty.");
  if (!/data-plotpickle-startup=/i.test(source)) failures.push("Startup contract is missing from the server-rendered document.");
  if (/Runtime Error|Failed to execute 'removeChild'|NotFoundError:|Unhandled Runtime Error/i.test(source)) {
    failures.push("A runtime-error overlay is present in the server response.");
  }
  return {
    status: response.status,
    url: response.url || url,
    title,
    description,
    bodyLength: body.length,
    failures: [...new Set(failures)],
  };
}

async function terminateProcessTree(child, label) {
  if (!child?.pid) return;
  processes.delete(child);
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(resolve, 10_000);
    killer.once("exit", () => { clearTimeout(timer); resolve(); });
    killer.once("error", () => { clearTimeout(timer); resolve(); });
  });
  const stopAt = Date.now() + 5_000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < stopAt) await delay(100);
  if (child.exitCode === null && child.signalCode === null) console.warn(`${label} process tree did not report an exit after taskkill.`);
}

function startLoggedProcess(command, args, options, logPath) {
  const stream = createWriteStream(logPath, { flags: "w" });
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  processes.add(child);
  child.stdout.on("data", (chunk) => { stream.write(`[stdout] ${chunk}`); process.stdout.write(chunk); });
  child.stderr.on("data", (chunk) => { stream.write(`[stderr] ${chunk}`); process.stderr.write(chunk); });
  child.once("exit", (code, signal) => {
    stream.end(`\n[exit] code=${code ?? "null"} signal=${signal ?? "none"}\n`);
    processes.delete(child);
  });
  child.once("error", (error) => stream.write(`\n[process-error] ${error.stack || error.message}\n`));
  return child;
}

function findBrowserExecutable() {
  const edgeCandidates = [
    process.env.EDGE_PATH,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  const defaultCandidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  const candidates = communityEdgeMode ? edgeCandidates : defaultCandidates;
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error(`${communityEdgeMode ? "Microsoft Edge" : "Chrome or Edge"} was not found. Checked: ${candidates.join(", ")}`);
  return executable;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (pageFile.test(entry.name)) files.push(fullPath);
  }
  return files;
}

async function discoverRoutes() {
  const pages = await walk(appDirectory);
  const routes = new Set(["/", "/?workspace=dashboard", "/?workspace=settings", "/?workspace=community"]);
  const dynamicRoutes = [];
  for (const page of pages) {
    const directory = path.relative(appDirectory, path.dirname(page));
    const segments = directory ? directory.split(path.sep).filter((segment) => !segment.startsWith("(")) : [];
    const route = `/${segments.join("/")}`.replace(/\/$/, "") || "/";
    if (segments.some((segment) => segment.includes("[") || segment.includes("]"))) dynamicRoutes.push(route);
    else routes.add(route);
  }
  return { routes: [...routes].sort(), dynamicRoutes: [...new Set(dynamicRoutes)].sort() };
}

class CdpClient {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); this.listeners = new Map(); }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to the browser debugger.")), 15_000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Browser debugger connection failed.")); }, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error("Browser debugger connection closed."));
      }
      this.pending.clear();
    });
  }
  send(method, params = {}, timeoutMs = actionTimeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} exceeded ${timeoutMs} ms.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, method, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }
  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
  close() { this.socket?.close(); }
}

async function waitForDebugger(port) {
  const stopAt = Date.now() + 30_000;
  let lastError = "Debugger endpoint did not respond.";
  while (Date.now() < stopAt) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return response.json();
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`Chrome DevTools Protocol did not become available: ${lastError}`);
}

async function createTarget(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: "PUT", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Could not create browser target: ${response.status} ${response.statusText}`);
  return response.json();
}

const guardScript = String.raw`(() => {
  window.confirm = () => false;
  window.prompt = () => null;
  window.open = () => ({ opener: null, location: { replace() {} }, close() {}, closed: false });
  window.__plotpickleSmokeErrors = [];
  addEventListener("error", (event) => window.__plotpickleSmokeErrors.push(String(event.error?.stack || event.message || "window error")));
  addEventListener("unhandledrejection", (event) => window.__plotpickleSmokeErrors.push(String(event.reason?.stack || event.reason || "unhandled rejection")));
  addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    try { if (new URL(anchor.href, location.href).origin !== location.origin) { event.preventDefault(); event.stopImmediatePropagation(); } } catch {}
  }, true);
})();`;

const candidateScript = String.raw`(() => {
  const selector = "button, a[href], [role='button'], [role='tab'], summary, input[type='checkbox'], input[type='radio'], select";
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visible = (element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0; };
  const counts = new Map();
  return [...document.querySelectorAll(selector)].filter(visible).map((element) => {
    const tag = element.tagName.toLowerCase(); const role = element.getAttribute("role") || ""; const type = element.getAttribute("type") || "";
    const text = normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText || element.value || element.name || tag).slice(0, 180);
    const href = tag === "a" ? element.href : ""; const base = [tag, role, type, text, href].join("|"); const occurrence = counts.get(base) || 0; counts.set(base, occurrence + 1);
    return { base, occurrence, tag, role, type, text, href, disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true") };
  });
})()`;

function performScript(action) {
  return `(() => {
    const selector = ${JSON.stringify(selector)};
    const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const visible = (element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0; };
    const matches = [...document.querySelectorAll(selector)].filter((element) => {
      if (!visible(element)) return false;
      const tag = element.tagName.toLowerCase(); const role = element.getAttribute("role") || ""; const type = element.getAttribute("type") || "";
      const text = normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText || element.value || element.name || tag).slice(0, 180);
      const href = tag === "a" ? element.href : "";
      return [tag, role, type, text, href].join("|") === ${JSON.stringify(action.base)};
    });
    const element = matches[${Number(action.occurrence)}];
    if (!element) return { ok: false, reason: "control-not-found" };
    if (element.disabled || element.getAttribute("aria-disabled") === "true") return { ok: false, reason: "control-disabled" };
    element.scrollIntoView({ block: "center", inline: "center" });
    if (element.tagName === "SELECT") {
      const options = [...element.options].filter((option) => !option.disabled);
      const current = Math.max(0, options.findIndex((option) => option.value === element.value));
      const next = options[(current + 1) % Math.max(1, options.length)];
      if (!next) return { ok: false, reason: "select-has-no-option" };
      element.value = next.value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, action: "change", value: next.value };
    }
    element.click();
    return { ok: true, action: "click", url: location.href };
  })()`;
}

function classifyAction(action, baseOrigin) {
  if (action.disabled) return "disabled";
  if (action.href) { try { if (new URL(action.href).origin !== baseOrigin) return "external-link"; } catch { return "invalid-link"; } }
  if (externalOrCostlyAction.test(action.text)) return "external-or-costly";
  if (directMutationAction.test(action.text)) return "direct-mutation";
  return "safe";
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  return result.result?.value;
}

async function waitForReady(client, expectedOrigin, timeoutMs = actionTimeoutMs) {
  const stopAt = Date.now() + timeoutMs;
  let lastError = "Page did not expose a ready document.";
  while (Date.now() < stopAt) {
    try {
      const state = await evaluate(client, `({ readyState: document.readyState, url: location.href, body: Boolean(document.body) })`);
      if (state?.body && state.readyState !== "loading" && new URL(state.url).origin === expectedOrigin) { await delay(100); return state; }
      lastError = `Unexpected state: ${JSON.stringify(state)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(75);
  }
  throw new Error(`Browser did not become ready within ${timeoutMs} ms: ${lastError}`);
}

async function navigate(client, url, expectedOrigin) { await client.send("Page.navigate", { url }, routeTimeoutMs); await waitForReady(client, expectedOrigin, routeTimeoutMs); }
async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms} ms.`)), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function inspectPage(client, events, eventStart, expectedOrigin) {
  const page = await evaluate(client, String.raw`(() => {
    const body = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
    return { title: document.title.trim(), description: document.querySelector("meta[name='description']")?.content?.trim() || "", bodyLength: body.length, body, overlay: /Runtime Error|Failed to execute 'removeChild'|NotFoundError:|Unhandled Runtime Error/i.test(body), scriptErrors: [...(window.__plotpickleSmokeErrors || [])], url: location.href };
  })()`);
  const failures = [];
  if (!page.title) failures.push("Document title is missing.");
  if (!page.description) failures.push("Meta description is missing.");
  if (!page.bodyLength) failures.push("Document body is empty.");
  if (page.overlay) failures.push("A runtime-error overlay is visible.");
  for (const message of page.scriptErrors) failures.push(`Window error: ${message}`);
  for (const event of events.slice(eventStart)) {
    if (event.kind === "response") {
      if (URL.canParse(event.url) && new URL(event.url).origin === expectedOrigin && event.status >= 400) failures.push(`${event.status} ${event.url}`);
    } else failures.push(event.message);
  }
  return { ...page, failures: [...new Set(failures)] };
}

async function runCommunityEdgeScenario(client, events, baseUrl, baseOrigin) {
  const eventStart = events.length;
  await navigate(client, `${baseUrl}/?workspace=dashboard`, baseOrigin);
  const waitUntil = Date.now() + 15_000;
  let initialState = null;
  while (Date.now() < waitUntil) {
    initialState = await evaluate(client, `(() => ({
      url: location.href,
      timeOrigin: performance.timeOrigin,
      dashboard: document.querySelector('[data-active-workspace="dashboard"]') !== null
    }))()`);
    if (initialState?.dashboard) break;
    await delay(200);
  }
  const failures = [];
  if (!initialState?.dashboard) {
    failures.push(`Dashboard did not mount before Community navigation: ${JSON.stringify(initialState)}`);
    return { passed: false, failures };
  }

  const clicked = await evaluate(client, `(() => {
    const button = document.querySelector('[data-workspace-nav-id="community"] button');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) {
    failures.push("Community navigation control was not available in Microsoft Edge.");
    return { passed: false, failures };
  }

  const communityDeadline = Date.now() + 20_000;
  let communityState = null;
  while (Date.now() < communityDeadline) {
    communityState = await evaluate(client, `(() => ({
      url: location.href,
      timeOrigin: performance.timeOrigin,
      active: document.querySelector('[data-active-workspace="community"]') !== null,
      community: document.querySelector('[data-community-native-buzz="true"]') !== null,
      body: (document.body?.innerText || '').slice(0, 1200)
    }))()`);
    if (communityState?.active && communityState?.community && String(communityState.url).includes("workspace=community")) break;
    await delay(200);
  }
  if (!communityState?.active || !communityState?.community) failures.push(`Community did not mount after navigation: ${JSON.stringify(communityState)}`);
  if (communityState?.timeOrigin !== initialState.timeOrigin) failures.push("Community navigation performed a full document reload instead of an in-document workspace transition.");
  if (/STATUS_ACCESS_VIOLATION|Can't open this page/i.test(communityState?.body || "")) failures.push("Microsoft Edge rendered a browser crash page while opening Community.");

  await delay(communityStableMs);
  const stableState = await evaluate(client, `(() => ({
    active: document.querySelector('[data-active-workspace="community"]') !== null,
    community: document.querySelector('[data-community-native-buzz="true"]') !== null,
    body: (document.body?.innerText || '').slice(0, 1200)
  }))()`);
  if (!stableState?.active || !stableState?.community) failures.push(`Community did not remain mounted for ${communityStableMs} ms.`);
  if (/STATUS_ACCESS_VIOLATION|Can't open this page/i.test(stableState?.body || "")) failures.push("Microsoft Edge became a browser crash page after Community mounted.");
  for (const event of events.slice(eventStart)) {
    if (event.kind === "renderer-crash" || event.kind === "exception") failures.push(event.message);
  }
  return { passed: failures.length === 0, url: communityState?.url || "", documentTimeOrigin: initialState.timeOrigin, failures: [...new Set(failures)] };
}

async function writeReports(report) {
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(path.join(reportDirectory, "windows-interaction-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportDirectory, "windows-interaction-smoke.md"), [
    "# PlotPickle Windows packaged interaction smoke",
    "",
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Routes: ${report.routes.filter((item) => item.passed).length}/${report.routes.length} passed`,
    `Required assets: ${report.assets.filter((item) => item.passed).length}/${report.assets.length} passed`,
    `Safe actions: ${report.actions.filter((item) => item.passed).length}/${report.actions.length} passed`,
    `UI states visited: ${report.statesVisited}`,
    `Repository & Collab: ${report.scenarios.repositoryAndCollab ? (report.scenarios.repositoryAndCollab.passed ? "PASS" : "FAIL") : "NOT RUN"}`,
    `Community Edge: ${report.scenarios.communityEdge ? (report.scenarios.communityEdge.passed ? "PASS" : "FAIL") : "NOT RUN"}`,
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((item) => `- ${item}`) : ["- None"]),
  ].join("\n") + "\n");
}

async function main() {
  await mkdir(reportDirectory, { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-smoke-"));
  const home = path.join(temporaryRoot, "home");
  const browserProfile = path.join(temporaryRoot, "browser");
  await mkdir(home, { recursive: true });
  await mkdir(browserProfile, { recursive: true });

  const serverPort = await choosePort(4173);
  const debugPort = await choosePort(9222);
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  const baseOrigin = new URL(baseUrl).origin;
  const browserExecutable = findBrowserExecutable();
  const report = {
    generatedAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, node: process.version,
    root, baseUrl, browserExecutable, communityEdgeMode,
    limits: { requestedTotalTimeoutMs, totalTimeoutMs, actionTimeoutMs, routeTimeoutMs, maximumRoutes, maximumStates, maximumActions, maximumDepth },
    routes: [], dynamicRoutes: [], assets: [], actions: [], skippedActions: [], scenarios: {}, statesVisited: 0,
    passed: false, failures: [], progress: "starting",
  };
  emergencyReport = report;

  const server = startLoggedProcess(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(serverPort), "--strictPort"], {
    cwd: root, windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0", NODE_ENV: "development", PLOTPICKLE_INSTALLED: "1", PLOTPICKLE_HOME: home, PLOTPICKLE_GITHUB_APP_CONFIG: path.join(root, "config", "github-app.json"), PLOTPICKLE_GOOGLE_OAUTH_CONFIG: path.join(root, "config", "google-oauth.json"), WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG_PATH: path.join(temporaryRoot, "wrangler-logs"), MINIFLARE_REGISTRY_PATH: path.join(temporaryRoot, "wrangler-registry") },
  }, path.join(reportDirectory, "server.log"));

  let browser; let client; let fatalError;
  try {
    const response = await waitForHttp(baseUrl);
    if (!response.ok) throw new Error(`Packaged server returned ${response.status} ${response.statusText}.`);
    const verificationAuth = communityEdgeMode ? await establishVerificationSyntheticHuman({ baseUrl, home }) : null;
    const browserArgs = [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${browserProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=TranslateUI",
      "--window-size=1440,1000",
      ...(communityEdgeMode ? [`--app=${baseUrl}/?workspace=dashboard`] : ["--disable-gpu", "about:blank"]),
    ];
    browser = startLoggedProcess(browserExecutable, browserArgs, { cwd: root, windowsHide: true, env: { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot } }, path.join(reportDirectory, "browser.log"));
    await waitForDebugger(debugPort);
    const target = await createTarget(debugPort, `${baseUrl}/?workspace=dashboard`);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Log.enable"),
      client.send("Network.enable"),
      client.send("Inspector.enable"),
      client.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => ({})),
    ]);
    if (verificationAuth) {
      const cookieHeader = verificationAuth.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE;
      const separator = cookieHeader.indexOf("=");
      if (separator <= 0) throw new Error("Synthetic Human authentication returned an invalid session cookie.");
      const cookieResult = await client.send("Network.setCookie", {
        name: cookieHeader.slice(0, separator),
        value: cookieHeader.slice(separator + 1),
        url: baseUrl,
        httpOnly: true,
        sameSite: "Strict",
      });
      if (cookieResult.success === false) throw new Error("Could not install the synthetic Human session cookie in Microsoft Edge.");
    }
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: guardScript });

    const events = [];
    client.on("Inspector.targetCrashed", (entry) => events.push({ kind: "renderer-crash", message: `Browser renderer crashed: ${JSON.stringify(entry)}` }));
    client.on("Runtime.exceptionThrown", (entry) => events.push({ kind: "exception", message: entry.exceptionDetails?.exception?.description || entry.exceptionDetails?.text || "Runtime exception" }));
    client.on("Runtime.consoleAPICalled", (entry) => { if (entry.type === "error" || entry.type === "assert") events.push({ kind: "console", message: entry.args?.map((arg) => arg.value ?? arg.description ?? "").join(" ") || "Console error" }); });
    client.on("Log.entryAdded", ({ entry }) => { if (entry.level === "error") events.push({ kind: "log", message: entry.text || "Browser log error" }); });
    client.on("Network.responseReceived", ({ response: item }) => { if (Number(item.status) >= 400) events.push({ kind: "response", status: Number(item.status), url: item.url }); });
    client.on("Network.loadingFailed", (entry) => { if (entry.errorText !== "net::ERR_ABORTED") events.push({ kind: "loading", message: `${entry.errorText || "Network loading failed"}` }); });

    if (communityEdgeMode) {
      report.progress = "community-edge";
      report.scenarios.communityEdge = await runCommunityEdgeScenario(client, events, baseUrl, baseOrigin);
      report.statesVisited = report.scenarios.communityEdge.passed ? 2 : 1;
      if (!report.scenarios.communityEdge.passed) report.failures.push("Dashboard → Community managed Edge scenario failed.");
      report.progress = "complete";
      report.passed = report.failures.length === 0;
    } else {
      report.progress = "routes";
      const inventory = await discoverRoutes();
      report.dynamicRoutes = inventory.dynamicRoutes;
      report.routeInventoryCount = inventory.routes.length;
      for (const route of inventory.routes.slice(0, maximumRoutes)) {
        if (Date.now() >= deadline) throw new Error("The total smoke-test deadline was reached during route checks.");
        try {
          const inspection = await inspectHttpRoute(new URL(route, `${baseUrl}/`).href);
          report.routes.push({ route, passed: inspection.failures.length === 0, ...inspection });
        } catch (error) { report.routes.push({ route, passed: false, failures: [error instanceof Error ? error.message : String(error)] }); }
      }

      report.progress = "assets";
      for (const asset of requiredAssets) {
        try { const assetResponse = await fetch(new URL(asset, baseUrl), { signal: AbortSignal.timeout(5_000) }); const bytes = (await assetResponse.arrayBuffer()).byteLength; report.assets.push({ path: asset, status: assetResponse.status, bytes, passed: assetResponse.ok && bytes > 0 }); }
        catch (error) { report.assets.push({ path: asset, status: null, bytes: 0, passed: false, error: error instanceof Error ? error.message : String(error) }); }
      }

      report.progress = "interaction-crawl";
      const workspaceUrl = `${baseUrl}/?workspace=dashboard`;
      const queue = [{ path: [], depth: 0 }];
      const queuedStateKeys = new Set();
      const visitedStates = new Set();
      const testedActions = new Set();
      async function replay(actionPath) {
        await navigate(client, workspaceUrl, baseOrigin);
        for (const action of actionPath) {
          const result = await evaluate(client, performScript(action));
          if (!result?.ok) throw new Error(`Could not replay ${normalizeText(action.text)}: ${result?.reason || "unknown"}`);
          await waitForReady(client, baseOrigin);
        }
      }

      while (queue.length && visitedStates.size < maximumStates && report.actions.length < maximumActions) {
        if (Date.now() >= deadline) { report.failures.push("The total smoke-test deadline was reached before the interaction queue completed."); break; }
        const state = queue.shift();
        try { await withTimeout(replay(state.path), routeTimeoutMs + actionTimeoutMs * state.path.length, "Replay interaction path"); }
        catch (error) { report.failures.push(`State replay failed: ${error instanceof Error ? error.message : String(error)}`); continue; }
        const stateValue = await evaluate(client, stateExpression);
        const currentKey = stateKey(stateValue);
        if (visitedStates.has(currentKey)) continue;
        visitedStates.add(currentKey);
        report.statesVisited = visitedStates.size;
        const candidates = await evaluate(client, candidateScript);

        for (const candidate of candidates) {
          if (Date.now() >= deadline || report.actions.length >= maximumActions) break;
          const candidateKey = `${currentKey}|${candidate.base}|${candidate.occurrence}`;
          if (testedActions.has(candidateKey)) continue;
          testedActions.add(candidateKey);
          const classification = classifyAction(candidate, baseOrigin);
          if (classification !== "safe") { report.skippedActions.push({ state: stateValue, action: candidate, reason: classification }); continue; }
          const eventStart = events.length;
          try {
            await withTimeout(replay(state.path), routeTimeoutMs + actionTimeoutMs * state.path.length, `Prepare ${normalizeText(candidate.text)}`);
            const result = await withTimeout(evaluate(client, performScript(candidate)), actionTimeoutMs, `Activate ${normalizeText(candidate.text)}`);
            if (!result?.ok) throw new Error(result?.reason || "The control did not activate.");
            await waitForReady(client, baseOrigin);
            const inspection = await inspectPage(client, events, eventStart, baseOrigin);
            const nextState = await evaluate(client, stateExpression);
            const nextKey = stateKey(nextState);
            const passed = inspection.failures.length === 0;
            report.actions.push({ state: stateValue, action: candidate, result, nextState, passed, failures: inspection.failures });
            if (passed && nextKey !== currentKey && !visitedStates.has(nextKey) && !queuedStateKeys.has(nextKey) && state.depth < maximumDepth) {
              queuedStateKeys.add(nextKey);
              queue.push({ path: [...state.path, candidate], depth: state.depth + 1 });
            }
          } catch (error) {
            report.actions.push({ state: stateValue, action: candidate, passed: false, failures: [error instanceof Error ? error.message : String(error)] });
          }
        }
      }

      const failedRoutes = report.routes.filter((item) => !item.passed);
      const failedAssets = report.assets.filter((item) => !item.passed);
      const failedActions = report.actions.filter((item) => !item.passed);
      if (process.env.CI !== "true" && visitedStates.size >= maximumStates) report.failures.push(`State limit reached (${maximumStates}); the interaction inventory may be incomplete.`);
      if (process.env.CI !== "true" && report.actions.length >= maximumActions) report.failures.push(`Action limit reached (${maximumActions}); the interaction inventory may be incomplete.`);
      if (failedRoutes.length) report.failures.push(`${failedRoutes.length} route smoke check(s) failed.`);
      if (failedAssets.length) report.failures.push(`${failedAssets.length} required asset check(s) failed.`);
      if (failedActions.length) report.failures.push(`${failedActions.length} safe interaction(s) failed.`);
      report.progress = "complete";
      report.passed = report.failures.length === 0;
    }
  } catch (error) {
    fatalError = error;
    report.failures.push(error instanceof Error ? error.message : String(error));
    report.passed = false;
  } finally {
    client?.close();
    await terminateProcessTree(browser, "Browser");
    await terminateProcessTree(server, "Server");
    clearTimeout(watchdog);
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
  }

  await writeReports(report);
  if (!report.passed) {
    if (fatalError) console.error(fatalError.stack || fatalError.message || String(fatalError));
    throw new Error(`Windows packaged interaction smoke failed. Review ${reportDirectory}.`);
  }
  console.log(`Windows packaged interaction smoke passed: ${reportDirectory}`);
}

watchdog = setTimeout(() => {
  console.error(`Windows interaction smoke exceeded its total timeout of ${totalTimeoutMs} ms.`);
  try {
    const report = emergencyReport || { passed: false, failures: [], progress: "unknown" };
    report.passed = false;
    report.failures = [...new Set([...(report.failures || []), `Watchdog timeout after ${totalTimeoutMs} ms during ${report.progress || "unknown"}.`])];
    writeFileSync(path.join(reportDirectory, "windows-interaction-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(path.join(reportDirectory, "windows-interaction-smoke.md"), `# PlotPickle Windows packaged interaction smoke\n\nResult: FAIL\n\n## Failures\n\n- Watchdog timeout after ${totalTimeoutMs} ms during ${report.progress || "unknown"}.\n`);
  } catch (error) {
    console.error(`Could not write emergency smoke evidence: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const child of processes) {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    killer.once("error", () => undefined);
  }
  process.exit(124);
}, totalTimeoutMs + 10_000);
watchdog.unref();

main().catch((error) => { console.error(error.stack || error.message || String(error)); process.exitCode = 1; });
