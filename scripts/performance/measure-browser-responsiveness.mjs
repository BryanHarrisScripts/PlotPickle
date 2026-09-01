import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

export const browserRoutes = Object.freeze([
  { label: "dashboard", path: "/?workspace=dashboard", selector: '[aria-label="PlotPickle Studio Dashboard"]' },
  { label: "library", path: "/library", selector: '[data-library-workspace="v1"]' },
  { label: "learn", path: "/?workspace=learn", selector: '[aria-label="PlotPickle curriculum"]' },
  { label: "plan", path: "/?workspace=plan", activeTab: "Plan" },
  { label: "build", path: "/?workspace=build", activeTab: "Build" },
  { label: "story-decisions", path: "/story-decisions", text: "Story Decisions" },
  { label: "story-workbench", path: "/story-workbench", text: "Story Workbench" },
]);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function choosePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

export function findPerformanceBrowser(environment = process.env, fileExists = existsSync) {
  const candidates = [
    environment.CHROME_PATH,
    environment.EDGE_PATH,
    path.join(environment.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(environment["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(environment.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(environment["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(environment.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => fileExists(candidate));
  if (!executable) throw new Error(`Chrome or Edge was not found for #1411 browser evidence. Checked: ${candidates.join(", ")}`);
  return executable;
}

async function waitForDebugger(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error("#1411 browser debugger did not become ready.");
}

async function createTarget(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`#1411 browser target creation returned HTTP ${response.status}.`);
  return response.json();
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("#1411 browser debugger connection timed out.")), 15_000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("#1411 browser debugger connection failed.")); }, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result ?? {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("#1411 browser debugger connection closed."));
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

  close() {
    this.socket?.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "#1411 browser evaluation failed.");
  return result.result?.value;
}

function readinessExpression(route) {
  return `(() => {
    const body = document.body?.innerText || "";
    const selectorReady = ${route.selector ? `Boolean(document.querySelector(${JSON.stringify(route.selector)}))` : "true"};
    const activeTabReady = ${route.activeTab ? `[...document.querySelectorAll('[role="tab"][aria-selected="true"]')].some((item) => item.textContent?.trim() === ${JSON.stringify(route.activeTab)})` : "true"};
    const textReady = ${route.text ? `body.includes(${JSON.stringify(route.text)})` : "true"};
    const controls = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])').length;
    const navigation = performance.getEntriesByType('navigation')[0];
    const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      ready: document.readyState === 'complete' && body.trim().length > 40 && controls > 0 && selectorReady && activeTabReady && textReady,
      documentReadyState: document.readyState,
      bodyCharacters: body.length,
      interactiveControlCount: controls,
      domInteractiveMs: navigation?.domInteractive ?? null,
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigation?.loadEventEnd ?? null,
      firstContentfulPaintMs: firstContentfulPaint?.startTime ?? null,
    };
  })()`;
}

async function measureRoute(client, baseUrl, route) {
  const started = performance.now();
  await client.send("Page.navigate", { url: new URL(route.path, baseUrl).toString() });
  const deadline = Date.now() + 30_000;
  let state = null;
  while (Date.now() < deadline) {
    try {
      state = await evaluate(client, readinessExpression(route));
      if (state?.ready) {
        await evaluate(client, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
        return { label: route.label, path: route.path, usefulInteractiveMs: Number((performance.now() - started).toFixed(2)), ...state };
      }
    } catch {}
    await delay(100);
  }
  throw new Error(`#1411 browser route ${route.label} did not become useful and interactive within 30000 ms. Last state: ${JSON.stringify(state)}`);
}

async function stopBrowser(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("error", resolve);
      killer.once("exit", resolve);
    });
    return;
  }
  child.kill("SIGTERM");
}

export async function measureBrowserResponsiveness({ baseUrl }) {
  if (process.platform !== "win32") throw new Error("#1411 authoritative browser responsiveness evidence must run on Windows.");
  const executable = findPerformanceBrowser();
  const debugPort = await choosePort();
  const profile = await mkdtemp(path.join(os.tmpdir(), "plotpickle-performance-browser-"));
  const child = spawn(executable, [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`,
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
  ], { stdio: "ignore", windowsHide: true });
  let client;
  try {
    await waitForDebugger(debugPort);
    const target = await createTarget(debugPort);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([client.send("Page.enable"), client.send("Runtime.enable")]);
    const firstAccess = [];
    const repeatedAccess = [];
    let firstUsefulWorkspaceAtEpochMs = null;
    for (const route of browserRoutes) {
      firstAccess.push(await measureRoute(client, baseUrl, route));
      if (firstUsefulWorkspaceAtEpochMs == null) firstUsefulWorkspaceAtEpochMs = Date.now();
    }
    for (const route of browserRoutes) repeatedAccess.push(await measureRoute(client, baseUrl, route));
    return {
      reliability: "headless-browser-cdp-useful-interactive-contract",
      browser: path.basename(executable),
      managedLauncherBrowser: false,
      viewport: { width: 1440, height: 1000 },
      firstUsefulWorkspaceAtEpochMs,
      firstAccess,
      repeatedAccess,
    };
  } finally {
    client?.close();
    await stopBrowser(child);
    await rm(profile, { recursive: true, force: true });
  }
}
