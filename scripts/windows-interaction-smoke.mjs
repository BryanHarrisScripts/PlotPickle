#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const reportDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "windows-interaction-smoke"));
const totalTimeoutMs = Number(process.env.PLOTPICKLE_SMOKE_TOTAL_TIMEOUT_MS || 8 * 60_000);
const actionTimeoutMs = Number(process.env.PLOTPICKLE_SMOKE_ACTION_TIMEOUT_MS || 15_000);
const maximumStates = Number(process.env.PLOTPICKLE_SMOKE_MAX_STATES || 180);
const maximumActions = Number(process.env.PLOTPICKLE_SMOKE_MAX_ACTIONS || 650);
const maximumDepth = Number(process.env.PLOTPICKLE_SMOKE_MAX_DEPTH || 6);
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

if (process.platform !== "win32") throw new Error("The packaged interaction smoke must run on Windows.");
if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);

const processes = new Set();
let watchdog;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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
  const waitDeadline = Date.now() + timeoutMs;
  let lastError = "No response received.";
  while (Date.now() < waitDeadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4_000), redirect: "manual" });
      if (response.status > 0) return response;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function terminateProcessTree(child, label) {
  if (!child?.pid) return;
  processes.delete(child);
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    const timer = setTimeout(() => resolve(), 10_000);
    killer.once("exit", () => { clearTimeout(timer); resolve(); });
    killer.once("error", () => { clearTimeout(timer); resolve(); });
  });
  const waitDeadline = Date.now() + 5_000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < waitDeadline) await delay(100);
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
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error(`Chrome or Edge was not found. Checked: ${candidates.join(", ")}`);
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
  const routes = new Set(["/", "/?workspace=1"]);
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
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

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
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("Browser debugger connection closed."));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() {
    this.socket?.close();
  }
}

async function waitForDebugger(port) {
  const waitDeadline = Date.now() + 30_000;
  while (Date.now() < waitDeadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return response.json();
    } catch {}
    await delay(250);
  }
  throw new Error("Chrome DevTools Protocol did not become available.");
}

async function createTarget(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Could not create browser target: ${response.status} ${response.statusText}`);
  return response.json();
}

const guardScript = String.raw`
(() => {
  const originalOpen = window.open;
  Object.defineProperty(window, "open", {
    configurable: true,
    value: () => ({ opener: null, location: { replace() {} }, close() {}, closed: false }),
  });
  window.confirm = () => false;
  window.prompt = () => null;
  window.__plotpickleSmokeErrors = [];
  addEventListener("error", (event) => window.__plotpickleSmokeErrors.push(String(event.error?.stack || event.message || "window error")));
  addEventListener("unhandledrejection", (event) => window.__plotpickleSmokeErrors.push(String(event.reason?.stack || event.reason || "unhandled rejection")));
  addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    try {
      const target = new URL(anchor.href, location.href);
      if (target.origin !== location.origin) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    } catch {}
  }, true);
  window.__plotpickleOriginalOpen = originalOpen;
})();
`;

const candidateScript = String.raw`
(() => {
  const selector = "button, a[href], [role='button'], [role='tab'], summary, input[type='checkbox'], input[type='radio'], select";
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
  const visible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  };
  const elements = [...document.querySelectorAll(selector)].filter((element) => visible(element));
  const counts = new Map();
  return elements.map((element) => {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role") || "";
    const type = element.getAttribute("type") || "";
    const text = normalize(element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText || element.value || element.name || tag).slice(0, 180);
    const href = tag === "a" ? element.href : "";
    const base = [tag, role, type, text, href].join("|");
    const occurrence = counts.get(base) || 0;
    counts.set(base, occurrence + 1);
    return {
      base,
      occurrence,
      tag,
      role,
      type,
      text,
      href,
      disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
      checked: "checked" in element ? Boolean(element.checked) : null,
      selected: tag === "select" ? element.value : null,
    };
  });
})()
`;

function performScript(action) {
  return `(() => {
    const selector = "button, a[href], [role='button'], [role='tab'], summary, input[type='checkbox'], input[type='radio'], select";
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const matches = [...document.querySelectorAll(selector)].filter((element) => {
      if (!visible(element)) return false;
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role") || "";
      const type = element.getAttribute("type") || "";
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
  if (action.href) {
    try {
      if (new URL(action.href).origin !== baseOrigin) return "external-link";
    } catch {
      return "invalid-link";
    }
  }
  if (externalOrCostlyAction.test(action.text)) return "external-or-costly";
  if (directMutationAction.test(action.text)) return "direct-mutation";
  return "safe";
}

function stateExpression() {
  return String.raw`(() => {
    const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const headings = [...document.querySelectorAll("h1,h2,h3")].filter((element) => {
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }).slice(0, 8).map((element) => normalize(element.innerText));
    const selected = [...document.querySelectorAll("[aria-selected='true'], [aria-current], details[open] > summary")].slice(0, 12).map((element) => normalize(element.innerText || element.getAttribute("aria-label")));
    return { url: location.href, title: document.title, headings, selected, bodySample: normalize(document.body?.innerText).slice(0, 500) };
  })()`;
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  return result.result?.value;
}

async function waitForReady(client, expectedOrigin, timeoutMs = actionTimeoutMs) {
  const waitDeadline = Date.now() + timeoutMs;
  let lastState;
  while (Date.now() < waitDeadline) {
    try {
      lastState = await evaluate(client, `({ readyState: document.readyState, url: location.href, body: Boolean(document.body) })`);
      if (lastState?.body && lastState.readyState !== "loading" && new URL(lastState.url).origin === expectedOrigin) {
        await delay(350);
        return lastState;
      }
    } catch {}
    await delay(100);
  }
  throw new Error(`Browser did not become ready within ${timeoutMs} ms. Last state: ${JSON.stringify(lastState)}`);
}

function errorText(event) {
  if (event.kind === "exception") return event.details?.exception?.description || event.details?.text || "Runtime exception";
  if (event.kind === "console") return event.args?.map((arg) => arg.value ?? arg.description ?? "").join(" ") || "Console error";
  if (event.kind === "log") return event.entry?.text || "Browser log error";
  if (event.kind === "response") return `${event.status} ${event.url}`;
  if (event.kind === "loading") return `${event.errorText || "Network loading failed"} ${event.url || ""}`;
  return JSON.stringify(event);
}

async function inspectPage(client, eventLog, eventStart, expectedOrigin) {
  const page = await evaluate(client, String.raw`(() => {
    const title = document.title.trim();
    const description = document.querySelector("meta[name='description']")?.content?.trim() || "";
    const body = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const overlay = /Runtime Error|Failed to execute 'removeChild'|NotFoundError:|Unhandled Runtime Error/i.test(body);
    const scriptErrors = Array.isArray(window.__plotpickleSmokeErrors) ? [...window.__plotpickleSmokeErrors] : [];
    return { title, description, bodyLength: body.length, overlay, scriptErrors, url: location.href };
  })()`);
  const events = eventLog.slice(eventStart).filter((event) => {
    if (event.kind === "response") {
      try { return new URL(event.url).origin === expectedOrigin && event.status >= 400; } catch { return true; }
    }
    if (event.kind === "loading") {
      try { return !event.url || new URL(event.url).origin === expectedOrigin; } catch { return true; }
    }
    return true;
  });
  const failures = [];
  if (!page.title) failures.push("Document title is missing.");
  if (!page.description) failures.push("Meta description is missing.");
  if (!page.bodyLength) failures.push("Document body is empty.");
  if (page.overlay) failures.push("A runtime-error overlay is visible.");
  for (const message of page.scriptErrors) failures.push(`Window error: ${message}`);
  for (const event of events) failures.push(errorText(event));
  return { ...page, failures: [...new Set(failures)] };
}

async function navigate(client, url, expectedOrigin) {
  await client.send("Page.navigate", { url });
  await waitForReady(client, expectedOrigin);
}

async function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs} ms.`)), timeoutMs)),
  ]);
}

function actionLabel(action) {
  return normalizeText(action.text || action.href || `${action.tag} ${action.role}`) || action.base;
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
  const serverLog = path.join(reportDirectory, "server.log");
  const browserLog = path.join(reportDirectory, "browser.log");
  const server = startLoggedProcess(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(serverPort), "--strictPort"], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NODE_ENV: "development",
      PLOTPICKLE_HOME: home,
      PLOTPICKLE_GITHUB_APP_CONFIG: path.join(root, "config", "github-app.json"),
      PLOTPICKLE_GOOGLE_OAUTH_CONFIG: path.join(root, "config", "google-oauth.json"),
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_LOG_PATH: path.join(temporaryRoot, "wrangler-logs"),
      MINIFLARE_REGISTRY_PATH: path.join(temporaryRoot, "wrangler-registry"),
    },
  }, serverLog);

  let browser;
  let client;
  const report = {
    generatedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    root,
    baseUrl,
    browserExecutable,
    limits: { totalTimeoutMs, actionTimeoutMs, maximumStates, maximumActions, maximumDepth },
    routes: [],
    dynamicRoutes: [],
    assets: [],
    actions: [],
    skippedActions: [],
    statesVisited: 0,
    passed: false,
    failures: [],
  };

  let fatalError;
  try {
    const response = await waitForHttp(baseUrl);
    if (!response.ok) throw new Error(`Packaged server returned ${response.status} ${response.statusText}.`);

    browser = startLoggedProcess(browserExecutable, [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${browserProfile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=TranslateUI",
      "--window-size=1440,1000",
      "about:blank",
    ], { cwd: root, windowsHide: true, env: { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot } }, browserLog);

    await waitForDebugger(debugPort);
    const target = await createTarget(debugPort, `${baseUrl}/?workspace=1`);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Log.enable"),
      client.send("Network.enable"),
      client.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => ({})),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: guardScript });

    const events = [];
    const requestUrls = new Map();
    client.on("Runtime.exceptionThrown", (details) => events.push({ kind: "exception", details, at: new Date().toISOString() }));
    client.on("Runtime.consoleAPICalled", (entry) => {
      if (entry.type === "error" || entry.type === "assert") events.push({ kind: "console", ...entry, at: new Date().toISOString() });
    });
    client.on("Log.entryAdded", ({ entry }) => {
      if (entry.level === "error") events.push({ kind: "log", entry, at: new Date().toISOString() });
    });
    client.on("Network.requestWillBeSent", ({ requestId, request }) => requestUrls.set(requestId, request.url));
    client.on("Network.responseReceived", ({ response: networkResponse }) => {
      if (Number(networkResponse.status) >= 400) events.push({ kind: "response", status: Number(networkResponse.status), url: networkResponse.url, at: new Date().toISOString() });
    });
    client.on("Network.loadingFailed", (entry) => {
      if (entry.errorText === "net::ERR_ABORTED") return;
      events.push({ kind: "loading", ...entry, url: requestUrls.get(entry.requestId) || "", at: new Date().toISOString() });
    });

    const inventory = await discoverRoutes();
    report.dynamicRoutes = inventory.dynamicRoutes;
    for (const route of inventory.routes) {
      const eventStart = events.length;
      const targetUrl = new URL(route, `${baseUrl}/`).href;
      try {
        await withTimeout(navigate(client, targetUrl, baseOrigin), actionTimeoutMs, `Route ${route}`);
        const inspection = await inspectPage(client, events, eventStart, baseOrigin);
        report.routes.push({ route, passed: inspection.failures.length === 0, ...inspection });
      } catch (error) {
        report.routes.push({ route, passed: false, failures: [error instanceof Error ? error.message : String(error)] });
      }
    }

    for (const asset of requiredAssets) {
      try {
        const assetResponse = await fetch(new URL(asset, baseUrl), { signal: AbortSignal.timeout(5_000) });
        const bytes = (await assetResponse.arrayBuffer()).byteLength;
        report.assets.push({ path: asset, status: assetResponse.status, contentType: assetResponse.headers.get("content-type") || "", bytes, passed: assetResponse.ok && bytes > 0 });
      } catch (error) {
        report.assets.push({ path: asset, status: null, bytes: 0, passed: false, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const workspaceUrl = `${baseUrl}/?workspace=1`;
    const queue = [{ path: [], depth: 0 }];
    const visitedStates = new Set();
    const testedActions = new Set();

    async function replay(actionPath) {
      await navigate(client, workspaceUrl, baseOrigin);
      for (const action of actionPath) {
        const result = await evaluate(client, performScript(action));
        if (!result?.ok) throw new Error(`Could not replay ${actionLabel(action)}: ${result?.reason || "unknown"}`);
        await waitForReady(client, baseOrigin);
      }
    }

    while (queue.length && visitedStates.size < maximumStates && report.actions.length < maximumActions) {
      if (Date.now() >= deadline) throw new Error("The total smoke-test deadline was reached.");
      const state = queue.shift();
      try {
        await withTimeout(replay(state.path), actionTimeoutMs * Math.max(1, state.path.length + 1), "Replay interaction path");
      } catch (error) {
        report.failures.push(`State replay failed: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
      const stateValue = await evaluate(client, stateExpression());
      const stateKey = JSON.stringify({ url: stateValue.url, headings: stateValue.headings, selected: stateValue.selected });
      if (visitedStates.has(stateKey)) continue;
      visitedStates.add(stateKey);
      report.statesVisited = visitedStates.size;
      const candidates = await evaluate(client, candidateScript);

      for (const candidate of candidates) {
        if (report.actions.length >= maximumActions) break;
        const classification = classifyAction(candidate, baseOrigin);
        const candidateKey = `${stateKey}|${candidate.base}|${candidate.occurrence}`;
        if (testedActions.has(candidateKey)) continue;
        testedActions.add(candidateKey);
        if (classification !== "safe") {
          report.skippedActions.push({ state: stateValue, action: candidate, reason: classification });
          continue;
        }

        const eventStart = events.length;
        const startedAt = Date.now();
        try {
          await withTimeout(replay(state.path), actionTimeoutMs * Math.max(1, state.path.length + 1), `Prepare ${actionLabel(candidate)}`);
          const result = await withTimeout(evaluate(client, performScript(candidate)), actionTimeoutMs, `Activate ${actionLabel(candidate)}`);
          if (!result?.ok) throw new Error(result?.reason || "The control did not activate.");
          await waitForReady(client, baseOrigin);
          const inspection = await inspectPage(client, events, eventStart, baseOrigin);
          const nextState = await evaluate(client, stateExpression());
          const passed = inspection.failures.length === 0;
          report.actions.push({
            state: stateValue,
            action: candidate,
            result,
            nextState,
            passed,
            failures: inspection.failures,
            durationMs: Date.now() - startedAt,
          });
          if (!passed) continue;
          const changed = JSON.stringify({ url: nextState.url, headings: nextState.headings, selected: nextState.selected }) !== stateKey;
          if (changed && state.depth < maximumDepth) queue.push({ path: [...state.path, candidate], depth: state.depth + 1 });
        } catch (error) {
          report.actions.push({
            state: stateValue,
            action: candidate,
            passed: false,
            failures: [error instanceof Error ? error.message : String(error)],
            durationMs: Date.now() - startedAt,
          });
        }
      }
    }

    const failedRoutes = report.routes.filter((item) => !item.passed);
    const failedAssets = report.assets.filter((item) => !item.passed);
    const failedActions = report.actions.filter((item) => !item.passed);
    if (visitedStates.size >= maximumStates) report.failures.push(`State limit reached (${maximumStates}); the interaction inventory may be incomplete.`);
    if (report.actions.length >= maximumActions) report.failures.push(`Action limit reached (${maximumActions}); the interaction inventory may be incomplete.`);
    if (failedRoutes.length) report.failures.push(`${failedRoutes.length} route smoke check(s) failed.`);
    if (failedAssets.length) report.failures.push(`${failedAssets.length} required asset check(s) failed.`);
    if (failedActions.length) report.failures.push(`${failedActions.length} safe interaction(s) failed.`);
    report.passed = report.failures.length === 0;
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

  await writeFile(path.join(reportDirectory, "windows-interaction-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  const markdown = [
    "# PlotPickle Windows packaged interaction smoke",
    "",
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Generated: ${report.generatedAt}`,
    `Routes: ${report.routes.filter((item) => item.passed).length}/${report.routes.length} passed`,
    `Required assets: ${report.assets.filter((item) => item.passed).length}/${report.assets.length} passed`,
    `Safe actions: ${report.actions.filter((item) => item.passed).length}/${report.actions.length} passed`,
    `UI states visited: ${report.statesVisited}`,
    `Skipped external, costly, disabled or direct-mutation controls: ${report.skippedActions.length}`,
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Interaction policy",
    "",
    "Every discoverable visible same-origin and non-destructive control is exercised in an isolated browser profile and temporary PlotPickle data home. External authentication, publishing, repository mutation, paid generation, downloads, system-folder actions and direct destructive controls are inventoried but not executed.",
  ].join("\n");
  await writeFile(path.join(reportDirectory, "windows-interaction-smoke.md"), `${markdown}\n`);

  if (!report.passed) {
    if (fatalError) console.error(fatalError.stack || fatalError.message || String(fatalError));
    throw new Error(`Windows packaged interaction smoke failed. Review ${reportDirectory}.`);
  }
  console.log(`Windows packaged interaction smoke passed: ${reportDirectory}`);
}

watchdog = setTimeout(() => {
  console.error(`Windows interaction smoke exceeded its total timeout of ${totalTimeoutMs} ms.`);
  for (const child of processes) {
    try { spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {}
  }
  process.exit(124);
}, totalTimeoutMs + 30_000);
watchdog.unref();

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
