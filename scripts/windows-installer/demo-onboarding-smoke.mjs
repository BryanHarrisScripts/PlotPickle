#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { establishVerificationSyntheticHuman } from "../full-verification-auth.mjs";

const root = path.resolve(process.argv[2] ?? ".");
const reportDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "windows-demo-onboarding"));
const totalTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_DEMO_SMOKE_TIMEOUT_MS || 6 * 60_000), 6 * 60_000);
const actionTimeoutMs = 20_000;
const routeTimeoutMs = 45_000;
const coldDemoTimeoutMs = 90_000;
const coldProfileTimeoutMs = 120_000;
const deadline = Date.now() + totalTimeoutMs;
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const processes = new Set();

if (process.platform !== "win32") throw new Error("The packaged DEMO onboarding smoke must run on Windows.");
if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function choosePort(preferred, span = 100) {
  for (let port = preferred; port < preferred + span; port += 1) {
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
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(30_000, remainingMs)), redirect: "manual" });
      if (response.status > 0) return response;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function warmDemoHandoffRoute(baseUrl) {
  const response = await fetch(`${baseUrl}/api/demo/handoff`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ action: "make-this-mine" }),
    signal: AbortSignal.timeout(coldDemoTimeoutMs),
  });
  await response.arrayBuffer();
  if (![400, 401, 403].includes(response.status)) {
    throw new Error(`Anonymous DEMO handoff warm-up returned unexpected status ${response.status}.`);
  }
  return response.status;
}

function findBrowserExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error(`Microsoft Edge was not found. Checked: ${candidates.join(", ")}`);
  return executable;
}

function startLoggedProcess(command, args, options, logPath) {
  const stream = createWriteStream(logPath, { flags: "w" });
  const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
  processes.add(child);
  child.stdout.on("data", (chunk) => stream.write(`[stdout] ${chunk}`));
  child.stderr.on("data", (chunk) => stream.write(`[stderr] ${chunk}`));
  child.once("exit", (code, signal) => {
    stream.end(`\n[exit] code=${code ?? "null"} signal=${signal ?? "none"}\n`);
    processes.delete(child);
  });
  child.once("error", (error) => stream.write(`\n[process-error] ${error.stack || error.message}\n`));
  return child;
}

async function terminateProcessTree(child, timeoutMs = 10_000) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(resolve, timeoutMs);
    killer.once("exit", () => { clearTimeout(timer); resolve(); });
    killer.once("error", () => { clearTimeout(timer); resolve(); });
  });
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
      const timer = setTimeout(() => reject(new Error("Timed out connecting to Microsoft Edge debugger.")), 15_000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Microsoft Edge debugger connection failed.")); }, { once: true });
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
  }
  send(method, params = {}, timeoutMs = actionTimeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} exceeded ${timeoutMs} ms.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, method, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    if (typeof listener !== "function") throw new TypeError("CDP listener must be a function.");
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }
  close() { this.socket?.close(); }
}

async function waitForDebugger(port, timeoutMs = 30_000) {
  const stopAt = Date.now() + timeoutMs;
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
  throw new Error(`Microsoft Edge DevTools endpoint did not become available: ${lastError}`);
}

async function createTarget(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Could not create Microsoft Edge target: ${response.status}.`);
  return response.json();
}

async function evaluate(client, expression, timeoutMs = actionTimeoutMs) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  }, timeoutMs);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Browser evaluation failed.");
  return result.result?.value;
}

async function waitFor(client, expression, label, timeoutMs = routeTimeoutMs) {
  const stopAt = Math.min(Date.now() + timeoutMs, deadline);
  let last = null;
  while (Date.now() < stopAt) {
    try {
      last = await evaluate(client, expression);
      if (last) return last;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(150);
  }
  throw new Error(`${label} did not become ready: ${typeof last === "string" ? last : JSON.stringify(last)}`);
}

async function click(client, selector, label) {
  const result = await evaluate(client, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!(element instanceof HTMLElement) || element.hasAttribute("disabled")) return false;
    element.click();
    return true;
  })()`);
  if (!result) throw new Error(`${label} was not available.`);
}

async function enterDemo(client, entrySelector, label) {
  const stopAt = Math.min(Date.now() + 30_000, deadline);
  while (Date.now() < stopAt) {
    const mounted = await evaluate(client, `document.querySelector('[data-demo-runtime="synthetic-demo-runtime"]') !== null`);
    if (mounted) return;
    const available = await evaluate(client, `(() => {
      const element = document.querySelector(${JSON.stringify(entrySelector)});
      return element instanceof HTMLElement && !element.hasAttribute("disabled");
    })()`);
    if (available) await click(client, entrySelector, label);
    await delay(350);
  }
  const body = await evaluate(client, `(document.body?.innerText || '').slice(0, 1600)`).catch(() => "");
  throw new Error(`${label} did not mount the disposable DEMO runtime. Browser: ${String(body)}`);
}

async function waitForInitialWorld(client) {
  const result = await waitFor(client, `(() => {
    if (document.querySelector('[data-demo-turns="0"]') !== null && document.querySelector('[data-demo-decision]') !== null) {
      return { ready: true, error: '' };
    }
    const runtime = document.querySelector('[data-demo-runtime="synthetic-demo-runtime"]');
    if (!runtime) return null;
    const alert = runtime.querySelector('[role="alert"]')?.textContent?.trim() || '';
    const headings = [...runtime.querySelectorAll('h2')].map((item) => item.textContent?.trim() || '');
    const failedHeading = headings.find((text) => /could not start/i.test(text)) || '';
    if (alert || failedHeading) return { ready: false, error: alert || failedHeading };
    return null;
  })()`, "Initial DEMO world", coldDemoTimeoutMs);
  if (!result?.ready) throw new Error(`Initial DEMO world failed: ${result?.error || "unknown packaged DEMO error"}`);
}

async function browserState(client) {
  return evaluate(client, `(() => ({
    url: location.href,
    demoEntry: document.querySelector('[data-demo-onboarding]')?.getAttribute('data-demo-onboarding') || '',
    demoRuntime: document.querySelector('[data-demo-runtime]')?.getAttribute('data-demo-runtime') || '',
    demoTurns: document.querySelector('[data-demo-turns]')?.getAttribute('data-demo-turns') || '',
    demoStatus: document.querySelector('[data-demo-story-status]')?.getAttribute('data-demo-story-status') || '',
    handoff: document.querySelector('[data-demo-handoff]')?.getAttribute('data-demo-handoff') || '',
    alerts: [...document.querySelectorAll('[role="alert"]')].map((item) => item.textContent?.trim() || '').filter(Boolean),
    body: (document.body?.innerText || '').slice(0, 2000),
  }))()`);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url }, routeTimeoutMs);
  await waitFor(client, `document.readyState !== "loading" && Boolean(document.body)`, `Navigation to ${url}`);
}

async function installSessionCookie(client, baseUrl, cookieHeader) {
  const separator = cookieHeader.indexOf("=");
  if (separator <= 0) throw new Error("Synthetic Human authentication returned an invalid session cookie.");
  const result = await client.send("Network.setCookie", {
    name: cookieHeader.slice(0, separator),
    value: cookieHeader.slice(separator + 1),
    url: baseUrl,
    httpOnly: true,
    sameSite: "Strict",
  });
  if (result.success === false) throw new Error("Could not install the synthetic Human session cookie in Microsoft Edge.");
}

async function deleteSessionCookie(client, baseUrl) {
  await client.send("Network.deleteCookies", { name: "ppsid", url: baseUrl });
}

async function playFiveScenes(client, report, labelPrefix) {
  for (let turn = 0; turn < 5; turn += 1) {
    await waitFor(
      client,
      `document.querySelector('[data-demo-turns="${turn}"]') !== null && document.querySelector('[data-demo-decision]') !== null`,
      `${labelPrefix} scene ${turn + 1}`,
    );
    const decisionId = await evaluate(client, `document.querySelector('[data-demo-decision]')?.getAttribute('data-demo-decision') || ''`);
    await click(client, `[data-demo-decision="${decisionId}"]`, `${labelPrefix} decision ${turn + 1}`);
    await waitFor(client, `document.querySelector('[data-demo-turns="${turn + 1}"]') !== null`, `${labelPrefix} turn ${turn + 1} consequence`);
    report.steps.push({ name: `${labelPrefix} scene ${turn + 1}`, passed: true, decisionId });
  }
  await waitFor(client, `document.querySelector('[data-demo-story-status="completed"]') !== null`, `${labelPrefix} completion`);
}

async function browserPrivateProject(client) {
  return evaluate(client, `(async () => {
    const response = await fetch('/api/auth/profile-private', { credentials: 'same-origin', cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    return { status: response.status, body };
  })()`);
}

async function writeReports(report) {
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(path.join(reportDirectory, "demo-onboarding-smoke.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportDirectory, "demo-onboarding-smoke.md"), [
    "# PlotPickle packaged DEMO onboarding UAT",
    "",
    `Result: ${report.passed ? "PASS" : "FAIL"}`,
    `Steps passed: ${report.steps.filter((step) => step.passed).length}/${report.steps.length}`,
    `Cold DEMO start: ${Number.isFinite(report.coldDemoStartMs) ? `${report.coldDemoStartMs} ms` : "not proven"}`,
    `Human project: ${report.projectTitle || "not created"}`,
    `Existing-profile isolation: ${report.existingProfileIsolation ? "PASS" : "NOT PROVEN"}`,
    "",
    "## Failures",
    "",
    ...(report.failures.length ? report.failures.map((failure) => `- ${failure}`) : ["- None"]),
  ].join("\n") + "\n");
}

async function main() {
  await mkdir(reportDirectory, { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-demo-smoke-"));
  const home = path.join(temporaryRoot, "home");
  const browserProfile = path.join(temporaryRoot, "browser");
  await mkdir(home, { recursive: true });
  await mkdir(browserProfile, { recursive: true });

  const serverPort = await choosePort(4273);
  const debugPort = await choosePort(9322);
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  const browserExecutable = findBrowserExecutable();
  const report = {
    generatedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    root,
    passed: false,
    steps: [],
    failures: [],
    projectTitle: null,
    existingProfileIsolation: false,
    coldDemoStartMs: null,
    browserState: null,
  };

  const server = startLoggedProcess(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(serverPort), "--strictPort"], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NODE_ENV: "development",
      PLOTPICKLE_INSTALLED: "1",
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
    const handoffWarmStatus = await warmDemoHandoffRoute(baseUrl);
    report.steps.push({ name: "DEMO handoff route warms without anonymous authority", passed: true, status: handoffWarmStatus });

    browser = startLoggedProcess(browserExecutable, [
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
      "about:blank",
    ], { cwd: root, windowsHide: true, env: { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot } }, path.join(reportDirectory, "browser.log"));

    await waitForDebugger(debugPort);
    const target = await createTarget(debugPort, baseUrl);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
      client.send("Log.enable"),
      client.send("Inspector.enable"),
    ]);

    const fatalBrowserEvents = [];
    client.on("Inspector.targetCrashed", (event) => fatalBrowserEvents.push(`Renderer crashed: ${JSON.stringify(event)}`));
    client.on("Runtime.exceptionThrown", (event) => fatalBrowserEvents.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text || "Runtime exception"));

    await navigate(client, baseUrl);
    await waitFor(client, `document.querySelector('[data-demo-onboarding="fresh-desktop"]') !== null`, "Fresh desktop DEMO entry");
    report.steps.push({ name: "fresh installer offers DEMO", passed: true });

    const coldDemoStartedAt = Date.now();
    await enterDemo(client, '[data-demo-entry-action="demo"]', "Fresh DEMO entry");
    await waitForInitialWorld(client);
    report.coldDemoStartMs = Date.now() - coldDemoStartedAt;
    report.steps.push({ name: "fresh installer enters disposable DEMO", passed: true });

    const firstDecision = await evaluate(client, `document.querySelector('[data-demo-decision]')?.getAttribute('data-demo-decision') || ''`);
    await click(client, `[data-demo-decision="${firstDecision}"]`, "First DEMO decision");
    await waitFor(client, `document.querySelector('[data-demo-turns="1"]') !== null`, "First DEMO consequence");
    await click(client, '[data-demo-action="reset"]', "Reset DEMO");
    await waitFor(client, `document.querySelector('[data-demo-turns="0"]') !== null && document.querySelector('[data-demo-story-status="playing"]') !== null`, "Reset DEMO clean state");
    report.steps.push({ name: "DEMO reset returns to known clean state", passed: true });

    await click(client, '[data-demo-action="exit"]', "Exit DEMO");
    await waitFor(client, `document.querySelector('[data-demo-onboarding="fresh-desktop"]') !== null`, "Fresh entry after DEMO exit");
    report.steps.push({ name: "DEMO exit retains no required profile", passed: true });

    await enterDemo(client, '[data-demo-entry-action="demo"]', "Second DEMO entry");
    await waitFor(client, `document.querySelector('[data-demo-turns="0"]') !== null`, "Second DEMO clean world");
    await playFiveScenes(client, report, "Make This Mine");
    await waitFor(client, `document.querySelector('[data-sage-show-me="read-only"]') !== null`, "Sage Show Me after completion");
    report.steps.push({ name: "completed DEMO retains read-only Sage explanation", passed: true });

    await click(client, '[data-demo-action="make-this-mine"]', "Make This Mine");
    await waitFor(client, `document.querySelector('[data-demo-handoff="pending"]') !== null`, "Make This Mine pending Human boundary");
    await waitFor(
      client,
      `document.querySelector('[data-profile-access-boundary="locked"]') !== null`,
      "Existing Human profile boundary after Make This Mine",
      coldProfileTimeoutMs,
    );
    report.steps.push({ name: "Make This Mine crosses to existing Human profile boundary", passed: true });

    const verificationHuman = await establishVerificationSyntheticHuman({ baseUrl, home });
    await installSessionCookie(client, baseUrl, verificationHuman.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE);
    await waitFor(
      client,
      `location.search.includes('workspace=dashboard') && document.querySelector('[data-active-workspace="dashboard"]') !== null`,
      "Dashboard after authenticated Make This Mine",
      coldProfileTimeoutMs,
    );

    const imported = await browserPrivateProject(client);
    if (imported.status !== 200 || !imported.body?.project) throw new Error(`Imported Human project was unavailable: ${JSON.stringify(imported)}`);
    const importedProject = imported.body.project;
    const serializedImported = JSON.stringify(importedProject);
    if (importedProject.title !== "The Lantern at the Fork — My Story") throw new Error(`Unexpected imported project title: ${String(importedProject.title)}`);
    if (!String(importedProject.foundations?.brief?.content || "").includes("Choices carried forward as creative prompts")) throw new Error("Imported Human project did not contain the approved starter brief.");
    if (serializedImported.includes("demo:")) throw new Error("Imported Human project retained a synthetic DEMO reference.");
    report.projectTitle = importedProject.title;
    report.steps.push({ name: "Make This Mine creates fresh Human-owned PPF project", passed: true });

    const privateSnapshot = JSON.stringify({
      title: importedProject.title,
      brief: importedProject.foundations?.brief?.content || "",
    });

    await deleteSessionCookie(client, baseUrl);
    await navigate(client, baseUrl);
    await waitFor(client, `document.querySelector('[data-profile-access-boundary="locked"]') !== null && document.querySelector('[data-demo-entry-action="demo-returning"]') !== null`, "Locked returning profile with DEMO shortcut");
    await enterDemo(client, '[data-demo-entry-action="demo-returning"]', "Returning-profile DEMO shortcut");
    await waitFor(client, `document.querySelector('[data-demo-turns="0"]') !== null`, "Returning-profile DEMO world");
    const anonymousPrivate = await browserPrivateProject(client);
    if (anonymousPrivate.status === 200) throw new Error("Locked-profile DEMO unexpectedly read Human-private project state.");
    report.steps.push({ name: "returning locked DEMO cannot read Human-private project", passed: true });

    await waitFor(client, `document.querySelector('[data-demo-decision]') !== null`, "Returning DEMO first decision");
    const returningDecision = await evaluate(client, `document.querySelector('[data-demo-decision]')?.getAttribute('data-demo-decision') || ''`);
    await click(client, `[data-demo-decision="${returningDecision}"]`, "Returning DEMO decision");
    await waitFor(client, `document.querySelector('[data-demo-turns="1"]') !== null`, "Returning DEMO consequence");
    await click(client, '[data-demo-action="exit"]', "Exit returning DEMO");
    await waitFor(client, `document.querySelector('[data-profile-access-boundary="locked"]') !== null`, "Locked profile after returning DEMO exit");

    await installSessionCookie(client, baseUrl, verificationHuman.environment.PLOTPICKLE_VERIFICATION_AUTH_COOKIE);
    await navigate(client, `${baseUrl}/?workspace=dashboard`);
    await waitFor(client, `document.querySelector('[data-active-workspace="dashboard"]') !== null`, "Authenticated dashboard after returning DEMO");
    const afterDemo = await browserPrivateProject(client);
    if (afterDemo.status !== 200 || !afterDemo.body?.project) throw new Error("Human project was unavailable after returning-profile DEMO.");
    const afterSnapshot = JSON.stringify({
      title: afterDemo.body.project.title,
      brief: afterDemo.body.project.foundations?.brief?.content || "",
    });
    if (afterSnapshot !== privateSnapshot) throw new Error("Returning-profile DEMO changed Human-private starter project data.");
    report.existingProfileIsolation = true;
    report.steps.push({ name: "existing Human project is unchanged after DEMO", passed: true });

    if (fatalBrowserEvents.length) throw new Error(`Browser runtime failures: ${fatalBrowserEvents.join("; ")}`);
    report.passed = true;
  } catch (error) {
    report.failures.push(error instanceof Error ? error.stack || error.message : String(error));
    if (client) {
      try {
        report.browserState = await browserState(client);
      } catch (diagnosticError) {
        report.browserState = { diagnosticError: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError) };
      }
    }
  } finally {
    client?.close();
    await terminateProcessTree(browser);
    await terminateProcessTree(server);
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  await writeReports(report);
  if (!report.passed) throw new Error(`Packaged DEMO onboarding UAT failed. Review ${reportDirectory}.`);
  console.log(`Packaged DEMO onboarding UAT passed: ${reportDirectory}`);
}

await main();
