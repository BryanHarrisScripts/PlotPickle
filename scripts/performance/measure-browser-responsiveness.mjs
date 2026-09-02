import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { performance } from "node:perf_hooks";

export const browserRoutes = Object.freeze([
  { label: "dashboard", path: "/?workspace=dashboard" },
  { label: "library", path: "/library" },
  { label: "learn", path: "/?workspace=learn" },
  { label: "plan", path: "/?workspace=plan" },
  { label: "build", path: "/?workspace=build" },
  { label: "story-decisions", path: "/story-decisions" },
  { label: "story-workbench", path: "/story-workbench" },
]);

export const idleWindowMs = 5_000;
const idleSettleMs = 1_000;
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
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  const detail = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`#1411 browser debugger did not become ready.${detail}`);
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
    this.eventHandlers = new Map();
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
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result ?? {});
        return;
      }
      const handlers = this.eventHandlers.get(message.method);
      if (!handlers) return;
      for (const handler of handlers) handler(message.params ?? {});
    });
    this.socket.addEventListener("close", () => {
      for (const pending of this.pending.values()) pending.reject(new Error("#1411 browser debugger connection closed."));
      this.pending.clear();
      this.eventHandlers.clear();
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(payload);
    });
  }

  on(method, handler) {
    const handlers = this.eventHandlers.get(method) ?? new Set();
    handlers.add(handler);
    this.eventHandlers.set(method, handlers);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) this.eventHandlers.delete(method);
    };
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

const readinessExpression = `(() => {
  const body = document.body?.innerText || "";
  const routeKey = location.pathname + location.search;
  const shellWorkspace = document.querySelector('[data-active-workspace]')?.getAttribute('data-active-workspace') || '';
  let routeReady = false;
  if (routeKey === "/?workspace=dashboard") routeReady = shellWorkspace === "dashboard" && !body.includes("See the whole movie before you make it.");
  else if (routeKey === "/library") routeReady = shellWorkspace === "library" && Boolean(document.querySelector('[data-library-workspace="v1"]')) && body.includes("Featured Examples") && body.includes("Afterglow");
  else if (routeKey === "/?workspace=learn") routeReady = shellWorkspace === "learn" && Boolean(document.querySelector('[aria-label="PlotPickle curriculum"]'));
  else if (routeKey === "/?workspace=plan") routeReady = shellWorkspace === "plan";
  else if (routeKey === "/?workspace=build") routeReady = shellWorkspace === "build";
  else if (routeKey === "/story-decisions") routeReady = body.includes("Story Decisions");
  else if (routeKey === "/story-workbench") routeReady = body.includes("Story Workbench");
  const controls = document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])').length;
  const navigation = performance.getEntriesByType('navigation')[0];
  const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0];
  return {
    ready: document.readyState === 'complete' && body.trim().length > 40 && controls > 0 && routeReady,
    documentReadyState: document.readyState,
    bodyCharacters: body.length,
    interactiveControlCount: controls,
    domInteractiveMs: navigation?.domInteractive ?? null,
    domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
    loadEventMs: navigation?.loadEventEnd ?? null,
    firstContentfulPaintMs: firstContentfulPaint?.startTime ?? null,
  };
})()`;

const ensureBenchmarkProfileExpression = `(async () => {
  const benchmarkName = "PlotPickle Performance Benchmark";
  const benchmarkPassphrase = "PlotPickle issue 1411 disposable performance benchmark";
  const readStatus = async () => {
    const response = await fetch('/api/auth/profile', { credentials: 'same-origin', cache: 'no-store' });
    const body = await response.json();
    return { ok: response.ok, status: response.status, body };
  };
  const mutate = async (action, payload) => {
    const response = await fetch('/api/auth/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
    const body = await response.json();
    return { ok: response.ok, status: response.status, body };
  };

  const current = await readStatus();
  if (!current.ok) return { ready: false, stage: 'status', status: current.status, message: current.body?.message || '' };
  if (current.body?.authenticated) return { ready: true, action: 'reused-authenticated-session', profileId: current.body.profile?.profileId || '' };

  let profile = Array.isArray(current.body?.profiles)
    ? current.body.profiles.find((item) => item?.displayName === benchmarkName)
    : null;
  let action = 'unlocked-existing-benchmark-profile';
  if (current.body?.configured !== true) {
    const created = await mutate('create-first-profile', { displayName: benchmarkName, password: benchmarkPassphrase });
    if (!created.ok || !created.body?.profile?.profileId) {
      return { ready: false, stage: 'create-first-profile', status: created.status, message: created.body?.message || '' };
    }
    profile = created.body.profile;
    action = 'created-and-unlocked-benchmark-profile';
  } else if (!profile?.profileId) {
    return {
      ready: false,
      stage: 'safety-boundary',
      status: 409,
      message: 'Configured PlotPickle Node has no disposable Performance Benchmark profile; refusing to touch existing Human profiles.',
    };
  }

  const login = await mutate('login', { locator: profile.profileId, password: benchmarkPassphrase });
  if (!login.ok) return { ready: false, stage: 'login', status: login.status, message: login.body?.message || '' };
  const verified = await readStatus();
  return {
    ready: Boolean(verified.ok && verified.body?.authenticated && verified.body?.profile?.profileId === profile.profileId),
    action,
    profileId: profile.profileId,
    accessMode: verified.body?.accessMode || '',
  };
})()`;

const loadAfterglowExpression = `(() => {
  const button = [...document.querySelectorAll('button')].find((item) => {
    if ((item.textContent || '').trim() !== 'Load & Explore') return false;
    return (item.closest('article')?.textContent || '').includes('Afterglow');
  });
  if (!button) return false;
  const hydrated = Object.keys(button).some((key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'));
  if (!hydrated) return false;
  button.click();
  return true;
})()`;

const confirmAfterglowExpression = `(() => {
  const dialog = document.querySelector('[role="dialog"][aria-labelledby="library-load-title"]');
  const button = dialog ? [...dialog.querySelectorAll('button')].find((item) => (item.textContent || '').trim() === 'Save & Switch') : null;
  if (!button) return false;
  const hydrated = Object.keys(button).some((key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'));
  if (!hydrated) return false;
  button.click();
  return true;
})()`;

const afterglowDashboardReadyExpression = `location.pathname === "/" && location.search === "?workspace=dashboard" && document.querySelector('[data-active-workspace]')?.getAttribute('data-active-workspace') === "dashboard"`;
const browserSetupStateExpression = `(() => ({ location: location.pathname + location.search, workspace: document.querySelector('[data-active-workspace]')?.getAttribute('data-active-workspace') || '', body: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 700) }))()`;
const beginIdleMutationCountExpression = `(() => {
  globalThis.__plotpickleIdleMutationObserver?.disconnect?.();
  globalThis.__plotpickleIdleMutationCount = 0;
  const observer = new MutationObserver((records) => { globalThis.__plotpickleIdleMutationCount += records.length; });
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  globalThis.__plotpickleIdleMutationObserver = observer;
  return true;
})()`;
const finishIdleMutationCountExpression = `(() => {
  const count = Number(globalThis.__plotpickleIdleMutationCount || 0);
  globalThis.__plotpickleIdleMutationObserver?.disconnect?.();
  delete globalThis.__plotpickleIdleMutationObserver;
  delete globalThis.__plotpickleIdleMutationCount;
  return count;
})()`;

async function waitForBrowserValue(client, expression, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const value = await evaluate(client, expression);
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  let state = null;
  try {
    state = await evaluate(client, browserSetupStateExpression);
  } catch (error) {
    lastError ??= error;
  }
  const errorDetail = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  const stateDetail = state ? ` Last browser state: ${JSON.stringify(state)}` : "";
  throw new Error(`#1411 browser setup ${label} did not become ready within ${timeoutMs} ms.${errorDetail}${stateDetail}`);
}

async function ensureBenchmarkProfile(client, baseUrl) {
  if (!process.env.PLOTPICKLE_HOME) {
    throw new Error("#1411 browser evidence requires an explicit isolated PLOTPICKLE_HOME before it may create a disposable benchmark profile.");
  }
  await client.send("Page.navigate", { url: new URL("/library", baseUrl).toString() });
  await waitForBrowserValue(client, `document.readyState === "complete" && Boolean(document.body)`, "local profile boundary");
  const result = await evaluate(client, ensureBenchmarkProfileExpression);
  if (!result?.ready) throw new Error(`#1411 disposable benchmark profile setup failed: ${JSON.stringify(result)}`);
  await client.send("Page.navigate", { url: new URL("/library", baseUrl).toString() });
  await waitForBrowserValue(client, readinessExpression, "authenticated rendered Library");
  return result;
}

async function bootstrapAfterglowWorkingCopy(client, baseUrl) {
  await client.send("Page.navigate", { url: new URL("/library", baseUrl).toString() });
  await waitForBrowserValue(client, readinessExpression, "rendered Library with Featured Examples and Afterglow");
  await waitForBrowserValue(client, loadAfterglowExpression, "hydrated Afterglow Load & Explore action");
  await waitForBrowserValue(client, confirmAfterglowExpression, "hydrated Afterglow Save & Switch confirmation");
  await waitForBrowserValue(client, afterglowDashboardReadyExpression, "Afterglow Dashboard");
  await client.send("Page.navigate", { url: "about:blank" });
  await waitForBrowserValue(client, `document.readyState === "complete"`, "blank benchmark target");
}

async function measureRoute(client, baseUrl, route) {
  const started = performance.now();
  await client.send("Page.navigate", { url: new URL(route.path, baseUrl).toString() });
  const deadline = Date.now() + 30_000;
  let state = null;
  let lastProbeError = null;
  while (Date.now() < deadline) {
    try {
      state = await evaluate(client, readinessExpression);
      if (state?.ready) {
        await evaluate(client, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
        return { label: route.label, path: route.path, usefulInteractiveMs: Number((performance.now() - started).toFixed(2)), ...state };
      }
    } catch (error) {
      lastProbeError = error;
    }
    await delay(100);
  }
  const detail = lastProbeError instanceof Error ? ` Last probe error: ${lastProbeError.message}` : "";
  throw new Error(`#1411 browser route ${route.label} did not become useful and interactive within 30000 ms. Last state: ${JSON.stringify(state)}.${detail}`);
}

async function measureIdleCost(client, baseUrl) {
  await client.send("Page.navigate", { url: new URL("/?workspace=dashboard", baseUrl).toString() });
  await waitForBrowserValue(client, readinessExpression, "idle Dashboard");
  await evaluate(client, "new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
  await delay(idleSettleMs);

  const requests = [];
  const removeNetworkListener = client.on("Network.requestWillBeSent", (params) => {
    const requestUrl = params.request?.url;
    if (!requestUrl || requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) return;
    requests.push({ url: requestUrl, method: params.request?.method ?? null, type: params.type ?? null });
  });

  await Promise.all([client.send("Network.enable"), client.send("Performance.enable")]);
  await evaluate(client, beginIdleMutationCountExpression);
  const before = await client.send("Performance.getMetrics");
  const started = performance.now();
  await delay(idleWindowMs);
  const after = await client.send("Performance.getMetrics");
  const observedWindowMs = Number((performance.now() - started).toFixed(2));
  const domMutationCount = await evaluate(client, finishIdleMutationCountExpression);
  removeNetworkListener();
  await client.send("Network.disable");

  const origin = new URL(baseUrl).origin;
  const sameOriginPaths = new Map();
  const externalOrigins = new Map();
  let sameOriginRequestCount = 0;
  let apiRequestCount = 0;
  let externalRequestCount = 0;
  for (const request of requests) {
    const requestUrl = new URL(request.url);
    if (requestUrl.origin === origin) {
      sameOriginRequestCount += 1;
      const pathKey = `${request.method ?? "GET"} ${requestUrl.pathname}`;
      sameOriginPaths.set(pathKey, (sameOriginPaths.get(pathKey) ?? 0) + 1);
      if (requestUrl.pathname.startsWith("/api/")) apiRequestCount += 1;
    } else {
      externalRequestCount += 1;
      externalOrigins.set(requestUrl.origin, (externalOrigins.get(requestUrl.origin) ?? 0) + 1);
    }
  }

  const beforeTaskDuration = (before.metrics ?? []).find((metric) => metric.name === "TaskDuration")?.value ?? null;
  const afterTaskDuration = (after.metrics ?? []).find((metric) => metric.name === "TaskDuration")?.value ?? null;
  const rendererTaskDurationMs = Number.isFinite(beforeTaskDuration) && Number.isFinite(afterTaskDuration)
    ? Number(Math.max(0, (afterTaskDuration - beforeTaskDuration) * 1000).toFixed(2))
    : null;

  return {
    reliability: "headless-browser-cdp-idle-window",
    windowMs: idleWindowMs,
    observedWindowMs,
    settleBeforeWindowMs: idleSettleMs,
    sameOriginRequestCount,
    apiRequestCount,
    externalRequestCount,
    sameOriginPaths: Object.fromEntries([...sameOriginPaths.entries()].sort(([left], [right]) => left.localeCompare(right))),
    externalOrigins: Object.fromEntries([...externalOrigins.entries()].sort(([left], [right]) => left.localeCompare(right))),
    domMutationCount,
    domMutationReliability: "DOM mutation proxy only; zero mutations do not prove zero React renders.",
    rendererTaskDurationMs,
    rendererTaskDurationReliability: "Chrome renderer TaskDuration delta; not whole-system CPU usage.",
    modelOrAgentWakeups: {
      value: null,
      reliability: "not-observable-from-browser-cdp",
      note: "This browser probe reports network and DOM/renderer activity only; hidden local model or Agent process wakeups require a separate process-level observer.",
    },
    activityObserved: sameOriginRequestCount > 0 || externalRequestCount > 0 || domMutationCount > 0,
  };
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
    const profileSetup = await ensureBenchmarkProfile(client, baseUrl);
    await bootstrapAfterglowWorkingCopy(client, baseUrl);
    const firstAccess = [];
    const repeatedAccess = [];
    let firstUsefulWorkspaceAtEpochMs = null;
    for (const route of browserRoutes) {
      firstAccess.push(await measureRoute(client, baseUrl, route));
      if (firstUsefulWorkspaceAtEpochMs == null) firstUsefulWorkspaceAtEpochMs = Date.now();
    }
    for (const route of browserRoutes) repeatedAccess.push(await measureRoute(client, baseUrl, route));
    const idle = await measureIdleCost(client, baseUrl);
    return {
      reliability: "headless-browser-cdp-useful-interactive-contract",
      browser: path.basename(executable),
      managedLauncherBrowser: false,
      profileSetup: {
        authority: "desktop-loopback-auth-api",
        disposableBenchmarkProfile: true,
        existingHumanProfileBypassAllowed: false,
        action: profileSetup.action,
        accessMode: profileSetup.accessMode,
      },
      fixtureSetup: {
        sourceCatalogId: "afterglow-v9",
        method: "normal-library-load-and-confirm",
        includedInRouteTiming: false,
      },
      firstAccessBasis: "first measured navigation after authenticated canonical fixture setup",
      viewport: { width: 1440, height: 1000 },
      firstUsefulWorkspaceAtEpochMs,
      firstAccess,
      repeatedAccess,
      idle,
    };
  } finally {
    client?.close();
    await stopBrowser(child);
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}
