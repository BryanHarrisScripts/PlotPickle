#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const logFile = path.join(root, "windows-community-edge-smoke.log");
const timeoutMs = 120_000;
const stableCommunityMs = 5_000;

if (process.platform !== "win32") throw new Error("The managed Edge Community smoke must run on Windows.");
if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findEdgeExecutable() {
  const candidates = [
    process.env.EDGE_PATH,
    path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error(`Microsoft Edge was not found. Checked: ${candidates.join(", ")}`);
  return executable;
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

async function waitForHttp(url) {
  const stopAt = Date.now() + timeoutMs;
  let lastError = "No response received.";
  while (Date.now() < stopAt) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
      if (response.ok) return;
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError}`);
}

async function waitForEdgeTarget(debugPort, expectedUrl) {
  const stopAt = Date.now() + 30_000;
  let lastTargets = [];
  while (Date.now() < stopAt) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) {
        lastTargets = await response.json();
        const target = lastTargets.find((candidate) => candidate.type === "page" && String(candidate.url || "").startsWith(expectedUrl));
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Managed Edge target did not become debuggable. Targets: ${JSON.stringify(lastTargets).slice(0, 1200)}`);
}

function terminateTree(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
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
      const timer = setTimeout(() => reject(new Error("Timed out connecting to managed Edge debugger.")), 15_000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Managed Edge debugger connection failed.")); }, { once: true });
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
      for (const pending of this.pending.values()) pending.reject(new Error("Managed Edge debugger connection closed."));
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

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Managed Edge evaluation failed.");
  }
  return result.result?.value;
}

async function waitForCommunity(client, crashState) {
  const stopAt = Date.now() + 20_000;
  let lastState = null;
  while (Date.now() < stopAt) {
    if (crashState.crashed) throw new Error(`Managed Edge renderer crashed: ${crashState.detail}`);
    try {
      lastState = await evaluate(client, `(() => ({
        url: location.href,
        active: document.querySelector('[data-active-workspace="community"]') !== null,
        community: document.querySelector('[data-community-native-buzz="true"]') !== null,
        body: (document.body?.innerText || '').slice(0, 500)
      }))()`);
      if (lastState?.active && lastState?.community && String(lastState.url).includes("workspace=community")) return lastState;
    } catch (error) {
      if (crashState.crashed) throw new Error(`Managed Edge renderer crashed: ${crashState.detail}`);
      throw error;
    }
    await delay(250);
  }
  throw new Error(`Community did not mount in managed Edge. Last state: ${JSON.stringify(lastState)}`);
}

const edgeExecutable = findEdgeExecutable();
const serverPort = await choosePort(4174);
const debugPort = await choosePort(9229);
const baseUrl = `http://127.0.0.1:${serverPort}`;
const dashboardUrl = `${baseUrl}/?workspace=dashboard`;
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-community-edge-"));
const browserProfile = path.join(temporaryRoot, "browser-profile");
let server;
let edge;
let client;
let output = "";

function record(label, chunk) {
  const text = String(chunk);
  output += `[${label}] ${text}`;
  process.stdout.write(text);
}

try {
  server = spawn(process.execPath, [viteEntry, "--host", "127.0.0.1", "--port", String(serverPort), "--strictPort"], {
    cwd: root,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0", NODE_ENV: "development", WRANGLER_WRITE_LOGS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => record("vite", chunk));
  server.stderr.on("data", (chunk) => record("vite-error", chunk));
  await waitForHttp(`${baseUrl}/`);

  edge = spawn(edgeExecutable, [
    `--app=${dashboardUrl}`,
    `--user-data-dir=${browserProfile}`,
    `--remote-debugging-port=${debugPort}`,
    "--remote-debugging-address=127.0.0.1",
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
  ], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  edge.stdout.on("data", (chunk) => record("edge", chunk));
  edge.stderr.on("data", (chunk) => record("edge-error", chunk));

  const target = await waitForEdgeTarget(debugPort, baseUrl);
  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  const crashState = { crashed: false, detail: "" };
  client.on("Inspector.targetCrashed", (params) => {
    crashState.crashed = true;
    crashState.detail = JSON.stringify(params);
  });
  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Inspector.enable"),
  ]);

  const initialState = await evaluate(client, `(() => ({
    url: location.href,
    timeOrigin: performance.timeOrigin,
    dashboard: document.querySelector('[data-active-workspace="dashboard"]') !== null
  }))()`);
  if (!initialState?.dashboard) throw new Error(`Dashboard did not mount before Community navigation: ${JSON.stringify(initialState)}`);

  const clicked = await evaluate(client, `(() => {
    const button = document.querySelector('[data-workspace-nav-id="community"] button');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) throw new Error("Community navigation control was not available in managed Edge.");

  const communityState = await waitForCommunity(client, crashState);
  const afterTransition = await evaluate(client, `(() => ({ timeOrigin: performance.timeOrigin, body: (document.body?.innerText || '').slice(0, 1000) }))()`);
  if (afterTransition.timeOrigin !== initialState.timeOrigin) {
    throw new Error("Community navigation performed a full document reload instead of an in-document workspace transition.");
  }
  if (/STATUS_ACCESS_VIOLATION|Can't open this page/i.test(afterTransition.body || "")) {
    throw new Error("Managed Edge rendered a browser crash page while opening Community.");
  }

  await delay(stableCommunityMs);
  if (crashState.crashed) throw new Error(`Managed Edge renderer crashed after Community mounted: ${crashState.detail}`);
  const stableState = await evaluate(client, `(() => ({
    active: document.querySelector('[data-active-workspace="community"]') !== null,
    community: document.querySelector('[data-community-native-buzz="true"]') !== null,
    body: (document.body?.innerText || '').slice(0, 1000)
  }))()`);
  if (!stableState?.active || !stableState?.community) throw new Error(`Community did not remain mounted: ${JSON.stringify(stableState)}`);
  if (/STATUS_ACCESS_VIOLATION|Can't open this page/i.test(stableState.body || "")) {
    throw new Error("Managed Edge became a browser crash page after Community mounted.");
  }

  writeFileSync(logFile, [
    "PlotPickle managed Edge Community smoke: PASS",
    `Edge: ${edgeExecutable}`,
    `Node: ${process.version}`,
    `Dashboard URL: ${dashboardUrl}`,
    `Community URL: ${communityState.url}`,
    `Document time origin preserved: ${initialState.timeOrigin}`,
    "",
    output,
  ].join("\n"), "utf8");
  console.log("Managed Edge Community navigation PASS: in-document transition remained stable without renderer crash.");
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  writeFileSync(logFile, [
    "PlotPickle managed Edge Community smoke: FAIL",
    `Edge: ${edgeExecutable}`,
    `Node: ${process.version}`,
    `Failure: ${message}`,
    "",
    output,
  ].join("\n"), "utf8");
  console.error(message);
  console.error(`Diagnostic log: ${logFile}`);
  process.exitCode = 1;
} finally {
  client?.close();
  terminateTree(edge);
  terminateTree(server);
  await rm(temporaryRoot, { recursive: true, force: true });
}
