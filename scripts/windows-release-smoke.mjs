#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const reportDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "windows-release-smoke"));
const totalTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_RELEASE_SMOKE_TIMEOUT_MS || 5 * 60_000), 5 * 60_000);
const deadline = Date.now() + totalTimeoutMs;
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const requiredAssets = [
  "/manifest.webmanifest",
  "/brand/favicon/plotpickle-icon-32.png",
  "/brand/plotpickle-header-horizontal-600.png",
  "/brand/plotpickle-logo-stacked-transparent-800.png",
];
const workspaceLabels = {
  dashboard: "Dashboard",
  learn: "Learn",
  plan: "Plan",
  storyboard: "Storyboard",
  write: "Write",
  pitch: "Pitch",
  build: "Build",
  feedback: "Feedback",
  refine: "Refine",
  reports: "Reports",
  collab: "Collab",
  settings: "Settings",
};
const workspaces = Object.keys(workspaceLabels);
const processes = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (process.platform !== "win32") throw new Error("The deterministic packaged release smoke must run on Windows.");
if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);

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

async function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(resolve, 10_000);
    killer.once("exit", () => { clearTimeout(timer); resolve(); });
    killer.once("error", () => { clearTimeout(timer); resolve(); });
  });
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

async function waitForHttp(url, timeoutMs = 120_000) {
  const stopAt = Date.now() + timeoutMs;
  let lastError = "No response received.";
  while (Date.now() < stopAt) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4_000) });
      if (response.status > 0) return response;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function waitForDebugger(port) {
  const stopAt = Date.now() + 30_000;
  while (Date.now() < stopAt) {
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
  close() { this.socket?.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Browser evaluation failed.");
  return result.result?.value;
}

async function waitFor(client, predicateExpression, timeoutMs = 15_000, label = "Browser condition") {
  const stopAt = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < stopAt) {
    try {
      const value = await evaluate(client, predicateExpression);
      if (value) return value;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(100);
  }
  throw new Error(`${label} did not become true within ${timeoutMs} ms.${lastError ? ` Last browser error: ${lastError}` : ""}`);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await waitFor(client, `document.readyState !== "loading" && Boolean(document.body)`, 15_000, `Page ${url}`);
}

function browserNormalizeFunction() {
  return `const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();`;
}

function hydratedButtonExpression(text) {
  return `(() => { ${browserNormalizeFunction()} const button = [...document.querySelectorAll("button")].find((item) => normalize(item.innerText) === ${JSON.stringify(text)}); return Boolean(button && Object.keys(button).some((key) => key.startsWith("__reactProps$") || key.startsWith("__reactFiber$"))); })()`;
}

async function waitForHydratedButton(client, text, timeoutMs = 20_000) {
  await waitFor(client, hydratedButtonExpression(text), timeoutMs, `Hydrated ${text} button`);
}

function shellReadyExpression(workspace) {
  const label = workspaceLabels[workspace];
  return `(() => { ${browserNormalizeFunction()} const header = document.querySelector(".application-shell-header"); const active = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((item) => normalize(item.innerText) === ${JSON.stringify(label)}); const body = normalize(document.body?.innerText); return Boolean(header && active && !body.includes("See the whole movie before you make it.")); })()`;
}

async function waitForShell(client, workspace, timeoutMs = 25_000) {
  await waitFor(client, shellReadyExpression(workspace), timeoutMs, `${workspace} application shell`);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function inspect(client, events, eventStart, baseOrigin) {
  const page = await evaluate(client, String.raw`(() => {
    const body = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
    return {
      url: location.href,
      title: document.title.trim(),
      description: document.querySelector("meta[name='description']")?.content?.trim() || "",
      body,
      scriptErrors: [...(window.__plotpickleReleaseErrors || [])],
      overlay: /Runtime Error|Unhandled Runtime Error|Failed to execute 'removeChild'|NotFoundError:/i.test(body),
    };
  })()`);
  const failures = [];
  if (!page.title) failures.push("Document title is missing.");
  if (!page.description) failures.push("Meta description is missing.");
  if (!page.body) failures.push("Document body is empty.");
  if (page.overlay) failures.push("A runtime-error overlay is visible.");
  for (const message of page.scriptErrors) failures.push(`Window error: ${message}`);
  for (const event of events.slice(eventStart)) {
    if (event.kind === "response") {
      try {
        if (new URL(event.url).origin === baseOrigin && event.status >= 400) failures.push(`${event.status} ${event.url}`);
      } catch {}
    } else {
      failures.push(event.message);
    }
  }
  return { ...page, body: undefined, failures: unique(failures) };
}

async function runScenario(report, name, callback) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    if (Date.now() >= deadline) throw new Error("The deterministic release smoke reached its total deadline.");
    const detail = await callback();
    report.scenarios.push({ name, passed: true, durationMs: Date.now() - started, startedAt, ...detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.scenarios.push({ name, passed: false, durationMs: Date.now() - started, startedAt, failures: [message] });
    report.failures.push(`${name}: ${message}`);
  }
}

async function writeReports(report) {
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(path.join(reportDirectory, "windows-release-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# PlotPickle deterministic Windows release smoke",
    "",
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Scenarios: ${report.scenarios.filter((item) => item.passed).length}/${report.scenarios.length} passed`,
    `Required assets: ${report.assets.filter((item) => item.passed).length}/${report.assets.length} passed`,
    "",
    "## Scenarios",
    "",
    ...report.scenarios.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}${item.failures?.length ? ` — ${item.failures.join(" ")}` : ""}`),
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((item) => `- ${item}`) : ["- None"]),
  ];
  await writeFile(path.join(reportDirectory, "windows-release-smoke.md"), `${lines.join("\n")}\n`);
}

async function main() {
  await mkdir(reportDirectory, { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-release-smoke-"));
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
    generatedAt: new Date().toISOString(),
    root,
    baseUrl,
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    browserExecutable,
    timeoutMs: totalTimeoutMs,
    scenarios: [],
    assets: [],
    failures: [],
    passed: false,
  };

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
  }, path.join(reportDirectory, "server.log"));

  let browser;
  let client;
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
      "--disable-extensions",
      "--disable-sync",
      "--disable-notifications",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-features=TranslateUI,OptimizationHints,MediaRouter",
      "--window-size=1440,1000",
      "about:blank",
    ], { cwd: root, windowsHide: true, env: { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot } }, path.join(reportDirectory, "browser.log"));
    await waitForDebugger(debugPort);
    const target = await createTarget(debugPort, `${baseUrl}/`);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([client.send("Page.enable"), client.send("Runtime.enable"), client.send("Network.enable")]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: String.raw`(() => {
      window.confirm = () => false;
      window.prompt = () => null;
      window.open = () => ({ opener: null, location: { replace() {} }, close() {}, closed: false });
      window.__plotpickleReleaseErrors = [];
      addEventListener("error", (event) => window.__plotpickleReleaseErrors.push(String(event.error?.stack || event.message || "window error")));
      addEventListener("unhandledrejection", (event) => window.__plotpickleReleaseErrors.push(String(event.reason?.stack || event.reason || "unhandled rejection")));
      addEventListener("click", (event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
        if (!anchor) return;
        try {
          if (new URL(anchor.href, location.href).origin !== location.origin) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        } catch {}
      }, true);
    })();` });

    const events = [];
    client.on("Runtime.exceptionThrown", (entry) => events.push({ kind: "exception", message: entry.exceptionDetails?.exception?.description || entry.exceptionDetails?.text || "Runtime exception" }));
    client.on("Runtime.consoleAPICalled", (entry) => {
      if (entry.type === "error" || entry.type === "assert") events.push({ kind: "console", message: entry.args?.map((arg) => arg.value ?? arg.description ?? "").join(" ") || "Console error" });
    });
    client.on("Network.responseReceived", ({ response: item }) => {
      if (Number(item.status) >= 400) events.push({ kind: "response", status: Number(item.status), url: item.url });
    });
    client.on("Network.loadingFailed", (entry) => {
      if (entry.errorText !== "net::ERR_ABORTED") events.push({ kind: "loading", message: entry.errorText || "Network loading failed" });
    });

    for (const asset of requiredAssets) {
      try {
        const assetResponse = await fetch(new URL(asset, baseUrl), { signal: AbortSignal.timeout(5_000) });
        const bytes = (await assetResponse.arrayBuffer()).byteLength;
        const passed = assetResponse.ok && bytes > 0;
        report.assets.push({ path: asset, status: assetResponse.status, bytes, passed });
        if (!passed) report.failures.push(`Required asset failed: ${asset}`);
      } catch (error) {
        report.assets.push({ path: asset, status: null, bytes: 0, passed: false, error: error instanceof Error ? error.message : String(error) });
        report.failures.push(`Required asset failed: ${asset}`);
      }
    }

    await runScenario(report, "Splash enters the application", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/`);
      await waitForHydratedButton(client, "Enter PlotPickle");
      const clicked = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const button = [...document.querySelectorAll("button")].find((item) => normalize(item.innerText) === "Enter PlotPickle");
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error("The Enter PlotPickle button was not found.");
      await waitForShell(client, "dashboard");
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url };
    });

    for (const workspace of workspaces) {
      await runScenario(report, `Named workspace: ${workspace}`, async () => {
        const eventStart = events.length;
        await navigate(client, `${baseUrl}/?workspace=${workspace}`);
        await waitForShell(client, workspace);
        const page = await inspect(client, events, eventStart, baseOrigin);
        if (page.failures.length) throw new Error(page.failures.join(" "));
        const state = await evaluate(client, `(() => { ${browserNormalizeFunction()} return { search: location.search, splash: normalize(document.body?.innerText).includes("See the whole movie before you make it."), active: [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((item) => normalize(item.innerText)), headings: [...document.querySelectorAll("main h1, main h2")].map((item) => normalize(item.innerText)).filter(Boolean) }; })()`);
        if (state.search !== `?workspace=${workspace}`) throw new Error(`Workspace URL did not remain on ${workspace}.`);
        if (state.splash) throw new Error(`Workspace ${workspace} remained on the Splash page.`);
        if (!state.active.includes(workspaceLabels[workspace])) throw new Error(`Workspace ${workspace} was not selected in the application shell.`);
        if (!state.headings.length) throw new Error(`Workspace ${workspace} has no visible heading.`);
        return { finalUrl: page.url, active: state.active, headings: state.headings.slice(0, 5) };
      });
    }

    await runScenario(report, "Settings → Repository & Collab status transition", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=settings`);
      await waitForShell(client, "settings");
      await waitFor(client, `document.body.innerText.includes("Configure PlotPickle by system.")`, 20_000, "Settings panel");
      const opened = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const button = [...document.querySelectorAll("button")].find((item) => normalize(item.querySelector("b")?.innerText) === "Repos");
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!opened) throw new Error("Repos was not found in Settings.");
      await waitFor(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        return [...document.querySelectorAll("button")].some((item) => normalize(item.querySelector("b")?.innerText) === "GitHub Story Repository");
      })()`, 10_000, "GitHub Story Repository item");
      const clicked = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const button = [...document.querySelectorAll("button")].find((item) => normalize(item.querySelector("b")?.innerText) === "GitHub Story Repository");
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error("GitHub Story Repository was not found in Settings.");
      await waitFor(client, `document.body.innerText.includes("Keep story history and proposals under project-owner control.")`, 15_000, "Repository & Collab panel");
      await waitFor(client, `["The PlotPickle GitHub App is not configured in this build.", "Connect GitHub", "Signed in as"].some((text) => document.body.innerText.includes(text))`, 20_000, "GitHub status transition");
      const expanded = await evaluate(client, String.raw`(() => {
        const summary = [...document.querySelectorAll("details > summary")].find((item) => item.getBoundingClientRect().width > 0 && item.getBoundingClientRect().height > 0);
        if (!summary) return { present: false, open: false };
        summary.click();
        return { present: true, open: Boolean(summary.parentElement?.open) };
      })()`);
      if (expanded.present && !expanded.open) throw new Error("The Repository & Collab expandable section did not open.");
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      const state = await evaluate(client, String.raw`(() => {
        const body = document.body.innerText;
        return {
          finalState: ["The PlotPickle GitHub App is not configured in this build.", "Connect GitHub", "Signed in as"].find((text) => body.includes(text)) || "",
          removeChild: /Failed to execute 'removeChild'|NotFoundError:/i.test(body),
        };
      })()`);
      if (!state.finalState) throw new Error("The GitHub status panel did not reach a recognized final state.");
      if (state.removeChild) throw new Error("The removeChild runtime error was reproduced.");
      return { finalState: state.finalState, expandablePresent: expanded.present };
    });

    await runScenario(report, "Settings preference saves and survives reload", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=settings`);
      await waitForShell(client, "settings");
      await waitFor(client, `document.body.innerText.includes("Configure PlotPickle by system.")`, 20_000, "Settings panel");
      await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const general = [...document.querySelectorAll("button")].find((item) => normalize(item.querySelector("b")?.innerText) === "General");
        general?.click();
        return Boolean(general);
      })()`);
      await waitFor(client, `(() => { const labels = [...document.querySelectorAll("label")]; return labels.some((label) => label.innerText.includes("Language") && label.querySelector("input")) && labels.some((label) => label.innerText.includes("Startup workspace") && label.querySelector("select")); })()`, 15_000, "General Settings controls");
      const changed = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const labels = [...document.querySelectorAll("label")];
        const language = labels.find((label) => normalize(label.querySelector("span")?.innerText) === "Language")?.querySelector("input");
        const startup = labels.find((label) => normalize(label.querySelector("span")?.innerText) === "Startup workspace")?.querySelector("select");
        if (!language || !startup) return false;
        const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        const selectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
        if (!inputSetter || !selectSetter) return false;
        inputSetter.call(language, "English (Smoke)");
        language.dispatchEvent(new Event("input", { bubbles: true }));
        language.dispatchEvent(new Event("change", { bubbles: true }));
        selectSetter.call(startup, "simple-start");
        startup.dispatchEvent(new Event("input", { bubbles: true }));
        startup.dispatchEvent(new Event("change", { bubbles: true }));
        const save = [...document.querySelectorAll("button")].find((button) => normalize(button.innerText) === "Save preferences");
        if (!save) return false;
        save.click();
        return true;
      })()`);
      if (!changed) throw new Error("General Settings controls or Save preferences were not found.");
      await waitFor(client, `document.body.innerText.includes("Preferences saved on this device")`, 15_000, "Settings save confirmation");
      await client.send("Page.reload", { ignoreCache: true });
      await waitFor(client, `document.readyState !== "loading" && Boolean(document.body)`, 15_000, "Settings reload");
      await waitForShell(client, "settings");
      await waitFor(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const labels = [...document.querySelectorAll("label")];
        const language = labels.find((label) => normalize(label.querySelector("span")?.innerText) === "Language")?.querySelector("input");
        const startup = labels.find((label) => normalize(label.querySelector("span")?.innerText) === "Startup workspace")?.querySelector("select");
        return language?.value === "English (Smoke)" && startup?.value === "simple-start";
      })()`, 20_000, "Saved Settings values");
      const persisted = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const labels = [...document.querySelectorAll("label")];
        const language = labels.find((label) => normalize(label.querySelector("span")?.innerText) === "Language")?.querySelector("input");
        const startup = labels.find((label) => normalize(label.querySelector("span")?.innerText) === "Startup workspace")?.querySelector("select");
        return { language: language?.value || "", startup: startup?.value || "" };
      })()`);
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return persisted;
    });

    await runScenario(report, "Diagnostics tab and evidence expander", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/diagnostics`);
      await waitForHydratedButton(client, "Opening & Act I");
      const clicked = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const button = [...document.querySelectorAll("button")].find((item) => normalize(item.innerText) === "Opening & Act I");
        if (!button) return false;
        button.click();
        return true;
      })()`);
      if (!clicked) throw new Error("The Opening & Act I diagnostics tab was not found.");
      await waitFor(client, `document.body.innerText.includes("Twelve functions across Blocks 1–6")`, 15_000, "Opening & Act I diagnostics");
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url };
    });

    await runScenario(report, "Browser back and forward preserve named workspaces", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=dashboard`);
      await waitForShell(client, "dashboard");
      await navigate(client, `${baseUrl}/?workspace=settings`);
      await waitForShell(client, "settings");
      await evaluate(client, `history.back(); true`);
      await waitFor(client, `location.search === "?workspace=dashboard"`, 15_000, "Browser back URL");
      await waitForShell(client, "dashboard");
      await evaluate(client, `history.forward(); true`);
      await waitFor(client, `location.search === "?workspace=settings"`, 15_000, "Browser forward URL");
      await waitForShell(client, "settings");
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url };
    });

    report.passed = report.failures.length === 0 && report.assets.every((item) => item.passed) && report.scenarios.every((item) => item.passed);
  } catch (error) {
    report.failures.push(error instanceof Error ? error.message : String(error));
    report.passed = false;
  } finally {
    client?.close();
    await terminateProcessTree(browser);
    await terminateProcessTree(server);
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
    await writeReports(report);
  }

  if (!report.passed) throw new Error(`Deterministic Windows release smoke failed. Review ${reportDirectory}.`);
  console.log(`Deterministic Windows release smoke passed: ${reportDirectory}`);
}

const watchdog = setTimeout(() => {
  console.error(`Deterministic Windows release smoke exceeded ${totalTimeoutMs} ms.`);
  for (const child of processes) {
    try { spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); } catch {}
  }
  process.exit(124);
}, totalTimeoutMs + 10_000);
watchdog.unref();

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
