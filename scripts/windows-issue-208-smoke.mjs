#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const reportDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "windows-issue-208-smoke"));
const totalTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_ISSUE_208_SMOKE_TIMEOUT_MS || 3 * 60_000), 3 * 60_000);
const deadline = Date.now() + totalTimeoutMs;
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const processes = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (process.platform !== "win32") throw new Error("The Issue #208 packaged smoke must run on Windows.");
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

const normalizeFunction = `const normalize = (value) => String(value || "").replace(/\\s+/g, " ").trim();`;

async function waitForShell(client, label, timeoutMs = 25_000) {
  await waitFor(client, `(() => { ${normalizeFunction} const active = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((item) => normalize(item.innerText) === ${JSON.stringify(label)}); return Boolean(document.querySelector(".application-shell-header") && active); })()`, timeoutMs, `${label} application shell`);
}

async function clickButton(client, text) {
  return evaluate(client, `(() => { ${normalizeFunction} const button = [...document.querySelectorAll("button")].find((item) => normalize(item.innerText) === ${JSON.stringify(text)}); if (!button) return false; button.click(); return true; })()`);
}

async function inspect(client, events, eventStart, baseOrigin) {
  const page = await evaluate(client, String.raw`(() => {
    const body = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
    return {
      url: location.href,
      title: document.title.trim(),
      description: document.querySelector("meta[name='description']")?.content?.trim() || "",
      body,
      scriptErrors: [...(window.__plotpickleIssue208Errors || [])],
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
  return { ...page, failures: [...new Set(failures.filter(Boolean))] };
}

async function runScenario(report, name, callback) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    if (Date.now() >= deadline) throw new Error("The Issue #208 smoke reached its total deadline.");
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
  await writeFile(path.join(reportDirectory, "windows-issue-208-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# PlotPickle Issue #208 Windows smoke",
    "",
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Scenarios: ${report.scenarios.filter((item) => item.passed).length}/${report.scenarios.length} passed`,
    `Intercepted paid image calls: ${report.paidImageCalls}`,
    "",
    "## Scenarios",
    "",
    ...report.scenarios.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}${item.failures?.length ? ` — ${item.failures.join(" ")}` : ""}`),
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((item) => `- ${item}`) : ["- None"]),
  ];
  await writeFile(path.join(reportDirectory, "windows-issue-208-smoke.md"), `${lines.join("\n")}\n`);
}

async function main() {
  await mkdir(reportDirectory, { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-issue-208-smoke-"));
  const home = path.join(temporaryRoot, "home");
  const browserProfile = path.join(temporaryRoot, "browser");
  await mkdir(home, { recursive: true });
  await mkdir(browserProfile, { recursive: true });
  const serverPort = await choosePort(4273);
  const debugPort = await choosePort(9322);
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
    failures: [],
    paidImageCalls: 0,
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
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
      client.send("Fetch.enable", { patterns: [
        { urlPattern: "*/api/local-connections*", requestStage: "Request" },
        { urlPattern: "*/api/local-ai/generate/image*", requestStage: "Request" },
      ] }),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: String.raw`(() => {
      window.confirm = () => false;
      window.prompt = () => null;
      window.open = () => ({ opener: null, location: { replace() {} }, close() {}, closed: false });
      window.__plotpickleIssue208Errors = [];
      addEventListener("error", (event) => window.__plotpickleIssue208Errors.push(String(event.error?.stack || event.message || "window error")));
      addEventListener("unhandledrejection", (event) => window.__plotpickleIssue208Errors.push(String(event.reason?.stack || event.reason || "unhandled rejection")));
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
    client.on("Fetch.requestPaused", (entry) => {
      void (async () => {
        const url = entry.request?.url || "";
        if (url.includes("/api/local-connections")) {
          const payload = JSON.stringify({
            checkedAt: new Date().toISOString(),
            ai: { state: "connected", identity: "Issue 208 smoke image provider", detail: "Synthetic packaged-smoke provider; no external request is permitted." },
            storage: { state: "connected", identity: "Isolated smoke storage", detail: "The temporary smoke project is saved locally." },
            github: { state: "disconnected", identity: "", detail: "No live repository is used by this smoke." },
          });
          await client.send("Fetch.fulfillRequest", {
            requestId: entry.requestId,
            responseCode: 200,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(payload).toString("base64"),
          });
          return;
        }
        if (url.includes("/api/local-ai/generate/image")) {
          report.paidImageCalls += 1;
          const payload = JSON.stringify({ message: "Paid image calls are blocked by the Issue #208 smoke." });
          await client.send("Fetch.fulfillRequest", {
            requestId: entry.requestId,
            responseCode: 409,
            responseHeaders: [{ name: "Content-Type", value: "application/json" }],
            body: Buffer.from(payload).toString("base64"),
          });
          return;
        }
        await client.send("Fetch.continueRequest", { requestId: entry.requestId });
      })().catch((error) => events.push({ kind: "interception", message: error instanceof Error ? error.message : String(error) }));
    });

    await runScenario(report, "Dashboard identifies a new local project without Afterglow fragments", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=dashboard`);
      await waitForShell(client, "Dashboard");
      await waitFor(client, `document.body.innerText.includes("Current project source")`, 20_000, "Current Project Source panel");
      const state = await evaluate(client, String.raw`(() => {
        const body = String(document.body?.innerText || "");
        return {
          hasLoadedStory: body.includes("Loaded story"),
          hasLocalStorage: body.includes("Local storage"),
          hasRepository: body.includes("GitHub repository"),
          hasApprovedStory: body.includes("Approved story"),
          hasLocalLabel: body.includes("Local project on this device"),
          hasAfterglow: /Afterglow/i.test(body),
          refreshLabels: [...document.querySelectorAll("button[aria-label]")].map((item) => item.getAttribute("aria-label")).filter(Boolean),
        };
      })()`);
      if (!state.hasLoadedStory || !state.hasLocalStorage || !state.hasRepository || !state.hasApprovedStory || !state.hasLocalLabel) throw new Error("The Dashboard project-source fields are incomplete.");
      if (state.hasAfterglow) throw new Error("A new local project exposed Afterglow-specific UI fragments.");
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url, refreshLabels: state.refreshLabels };
    });

    await runScenario(report, "Learn tabs switch without a nested tab scrollbar", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=learn`);
      await waitFor(client, `Boolean(document.querySelector(".application-shell-header"))`, 25_000, "Learn application shell header");
      const selectedLearn = await evaluate(client, `(() => { ${normalizeFunction} const tab = [...document.querySelectorAll('[role="tab"]')].find((item) => normalize(item.innerText) === "Learn"); if (!tab) return false; if (tab.getAttribute("aria-selected") !== "true") tab.click(); return true; })()`);
      if (!selectedLearn) throw new Error("Learn workspace tab was not found in the application shell.");
      await waitForShell(client, "Learn", 40_000);
      await waitFor(client, `Boolean(document.querySelector(".learn-section-tabs"))`, 20_000, "Learn tabs");
      const overflow = await evaluate(client, String.raw`(() => {
        const tabs = document.querySelector(".learn-section-tabs");
        const style = getComputedStyle(tabs);
        return { overflowX: style.overflowX, overflowY: style.overflowY, scrollHeight: tabs.scrollHeight, clientHeight: tabs.clientHeight };
      })()`);
      if (overflow.overflowY === "scroll" || overflow.scrollHeight > overflow.clientHeight + 1) throw new Error(`Learn tabs still create a vertical scrollbar: ${JSON.stringify(overflow)}`);
      const labels = ["Introduction", "Complete Learning Library", "Terminology", "Screenplay Study"];
      for (const label of labels) {
        if (!await clickButton(client, label)) throw new Error(`Learn tab not found: ${label}`);
        await waitFor(client, `(() => { ${normalizeFunction} return [...document.querySelectorAll(".learn-section-tabs button")].some((item) => normalize(item.innerText) === ${JSON.stringify(label)} && item.getAttribute("aria-current") === "page"); })()`, 10_000, `${label} active Learn tab`);
      }
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url, overflow };
    });

    await runScenario(report, "Collab Approvals explains GitHub and routes setup to Settings", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=collab`);
      await waitForShell(client, "Collab");
      if (!await clickButton(client, "Approvals")) throw new Error("Approvals tab was not found.");
      await waitFor(client, `document.body.innerText.includes("Powered by GitHub") && document.body.innerText.includes("It is not the GitHub connection screen")`, 15_000, "GitHub provider explanation");
      const settingsButton = await evaluate(client, `(() => { const button = document.querySelector('button[aria-label="View GitHub connection settings"]'); if (!button) return false; button.click(); return true; })()`);
      if (!settingsButton) throw new Error("View GitHub connection settings was not found.");
      await waitForShell(client, "Settings");
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url };
    });

    await runScenario(report, "Graphic Novel entire-cast regeneration cancels before paid calls", async () => {
      const eventStart = events.length;
      await navigate(client, `${baseUrl}/?workspace=dashboard`);
      await waitForShell(client, "Dashboard");
      if (!await clickButton(client, "Load Example")) throw new Error("Load Example was not found.");
      await waitFor(client, `/Afterglow/i.test(document.body.innerText)`, 20_000, "Bundled example load");
      if (!await clickButton(client, "Pitch")) throw new Error("Pitch navigation was not found.");
      await waitForShell(client, "Pitch");
      await waitFor(client, `document.body.innerText.includes("Regenerate Entire Cast")`, 20_000, "Entire cast controls");
      const state = await evaluate(client, String.raw`(() => {
        const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim();
        const body = String(document.body?.innerText || "");
        const label = [...document.querySelectorAll("label")].find((item) => normalize(item.innerText).includes("paid image API calls") && normalize(item.innerText).includes("No replacement becomes approved automatically"));
        const checkbox = label?.querySelector('input[type="checkbox"]');
        if (!checkbox) return { ready: false, reason: "acknowledgement checkbox missing" };
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set;
        if (!setter) return { ready: false, reason: "checkbox setter missing" };
        setter.call(checkbox, true);
        checkbox.dispatchEvent(new Event("input", { bubbles: true }));
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        return { ready: true, comicBook: /Comic Book|comic-book/i.test(body) };
      })()`);
      if (!state.ready) throw new Error(state.reason || "Cast acknowledgement could not be selected.");
      if (state.comicBook) throw new Error("Comic Book wording remains in the active Graphic Novel workspace.");
      await waitFor(client, `(() => { ${normalizeFunction} const button = [...document.querySelectorAll("button")].find((item) => normalize(item.innerText) === "Regenerate Entire Cast"); return Boolean(button && !button.disabled); })()`, 15_000, "Enabled Regenerate Entire Cast button");
      if (!await clickButton(client, "Regenerate Entire Cast")) throw new Error("Regenerate Entire Cast was not found.");
      await waitFor(client, `document.body.innerText.includes("Entire-cast regeneration was cancelled. No provider calls were made.")`, 15_000, "Cancelled cast regeneration message");
      if (report.paidImageCalls !== 0) throw new Error(`${report.paidImageCalls} image request(s) escaped the cancelled action.`);
      const page = await inspect(client, events, eventStart, baseOrigin);
      if (page.failures.length) throw new Error(page.failures.join(" "));
      return { finalUrl: page.url, paidImageCalls: report.paidImageCalls };
    });

    report.passed = report.failures.length === 0 && report.scenarios.every((item) => item.passed) && report.paidImageCalls === 0;
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

  if (!report.passed) throw new Error(`Issue #208 Windows smoke failed. Review ${reportDirectory}.`);
  console.log(`Issue #208 Windows smoke passed: ${reportDirectory}`);
}

const watchdog = setTimeout(() => {
  console.error(`Issue #208 Windows smoke exceeded ${totalTimeoutMs} ms.`);
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
