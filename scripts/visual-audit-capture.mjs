#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = path.resolve(process.argv[2] ?? ".");
const outputDirectory = path.resolve(process.argv[3] ?? path.join(root, "reports", "visual-audit"));
const configPath = path.join(root, "config", "visual-audit-captures.json");
const registryPath = path.join(root, "config", "ui-ux-screen-registry.json");
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const totalTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_VISUAL_AUDIT_TIMEOUT_MS || 15 * 60_000), 20 * 60_000);
const pageTimeoutMs = Math.min(Number(process.env.PLOTPICKLE_VISUAL_PAGE_TIMEOUT_MS || 45_000), 60_000);
const maximumPageHeight = Math.min(Number(process.env.PLOTPICKLE_VISUAL_MAX_HEIGHT || 20_000), 30_000);
const deadline = Date.now() + totalTimeoutMs;
const processes = new Set();

const captureConfig = JSON.parse(await readFile(configPath, "utf8"));
const screenRegistry = JSON.parse(await readFile(registryPath, "utf8"));
const viewports = captureConfig.viewports ?? {};
const captures = captureConfig.captures ?? [];
const registryScreens = screenRegistry.screens ?? [];

if (!existsSync(viteEntry)) throw new Error(`Vite entry is missing: ${viteEntry}`);
if (!captures.length) throw new Error("Visual capture registry is empty.");

const configuredIds = new Set(captures.map((capture) => capture.screenId));
const missingScreenIds = registryScreens.map((screen) => screen.id).filter((id) => !configuredIds.has(id));
if (missingScreenIds.length) {
  throw new Error(`Visual capture registry does not cover: ${missingScreenIds.join(", ")}`);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const safeName = (value) => String(value ?? "capture")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "capture";

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

async function terminateProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  processes.delete(child);
  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      const timer = setTimeout(resolve, 10_000);
      killer.once("exit", () => { clearTimeout(timer); resolve(); });
      killer.once("error", () => { clearTimeout(timer); resolve(); });
    });
    return;
  }
  child.kill("SIGTERM");
  await delay(1_000);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    process.platform === "win32" ? path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe") : null,
    process.platform === "win32" ? path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe") : null,
    process.platform === "win32" ? path.join(process.env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe") : null,
    process.platform === "win32" ? path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe") : null,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : null,
    process.platform === "darwin" ? "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" : null,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean);
  const executable = candidates.find((candidate) => existsSync(candidate));
  if (!executable) throw new Error(`Chrome or Edge was not found. Checked: ${candidates.join(", ")}`);
  return executable;
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
      const timer = setTimeout(() => reject(new Error("Timed out connecting to the browser debugger.")), 15_000);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Browser debugger connection failed.")); }, { once: true });
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

  close() {
    this.socket?.close();
  }
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

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Browser evaluation failed.");
  }
  return response.result?.value;
}

async function waitForDocument(client) {
  const stopAt = Date.now() + pageTimeoutMs;
  let lastState = null;
  while (Date.now() < stopAt) {
    try {
      lastState = await evaluate(client, String.raw`(() => {
        const body = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
        return {
          readyState: document.readyState,
          bodyLength: body.length,
          preparing: /Preparing Settings|Loading PlotPickle/i.test(body),
        };
      })()`);
      if (lastState?.readyState === "complete" && lastState.bodyLength > 0 && !lastState.preparing) {
        await delay(900);
        return;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for the rendered page: ${JSON.stringify(lastState)}`);
}

async function waitForExpectedText(client, expectedText) {
  if (!expectedText) return;
  const stopAt = Date.now() + pageTimeoutMs;
  const expected = String(expectedText).toLowerCase();
  let lastState = null;
  while (Date.now() < stopAt) {
    try {
      lastState = await evaluate(client, `(() => {
        const body = String(document.body?.innerText || "").replace(/\\s+/g, " ").trim().toLowerCase();
        return { found: body.includes(${JSON.stringify(expected)}), sample: body.slice(0, 500) };
      })()`);
      if (lastState?.found) {
        await delay(300);
        return;
      }
    } catch {}
    await delay(250);
  }
  throw new Error(`Timed out waiting for screen identity ${JSON.stringify(expectedText)}: ${JSON.stringify(lastState)}`);
}

async function navigate(client, url) {
  const result = await client.send("Page.navigate", { url });
  if (result.errorText) throw new Error(`Navigation failed for ${url}: ${result.errorText}`);
  await waitForDocument(client);
}

async function setViewport(client, viewport) {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: Number(viewport.width),
    height: Number(viewport.height),
    deviceScaleFactor: 1,
    mobile: Boolean(viewport.mobile),
    screenWidth: Number(viewport.width),
    screenHeight: Number(viewport.height),
  });
  await delay(300);
}

const stabilizationScript = String.raw`(() => {
  window.confirm = () => false;
  window.prompt = () => null;
  window.open = () => ({ opener: null, location: { replace() {} }, close() {}, closed: false });
  const install = () => {
    if (!document.documentElement) return;
    document.documentElement.dataset.visualAudit = "true";
    let style = document.getElementById("plotpickle-visual-audit-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "plotpickle-visual-audit-style";
      style.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important} input[type=password],[data-secret],[data-credential]{color:transparent!important;text-shadow:none!important}";
      document.documentElement.append(style);
    }
  };
  install();
  addEventListener("DOMContentLoaded", install, { once: true });
})();`;

const redactScript = String.raw`(() => {
  const secretHint = /(password|private[ -]?key|api[ -]?key|access[ -]?token|refresh[ -]?token|client[ -]?secret|credential)/i;
  for (const element of document.querySelectorAll("input,textarea,[contenteditable='true']")) {
    const hint = [element.id, element.getAttribute("name"), element.getAttribute("aria-label"), element.getAttribute("autocomplete")].filter(Boolean).join(" ");
    if (element.getAttribute("type") === "password" || secretHint.test(hint)) {
      if ("value" in element) element.value = "";
      element.textContent = "";
      element.setAttribute("data-visual-audit-redact", "true");
    }
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const replacements = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue || "";
    const redacted = value
      .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "[local-user]")
      .replace(/\/home\/[^/\s]+/g, "/home/[user]")
      .replace(/\/Users\/[^/\s]+/g, "/Users/[user]");
    if (redacted !== value) replacements.push([node, redacted]);
  }
  for (const [node, value] of replacements) node.nodeValue = value;
  const body = String(document.body?.innerText || "");
  return {
    leakedSecret: /(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/.test(body),
  };
})()`;

async function pageSummary(client, viewport) {
  return evaluate(client, `(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const headings = [...document.querySelectorAll("h1,h2,h3")].filter(visible).slice(0, 12).map((element) => String(element.innerText || "").replace(/\\s+/g, " ").trim());
    return {
      url: location.href,
      title: document.title,
      headings,
      bodyLength: String(document.body?.innerText || "").trim().length,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      clientWidth: document.documentElement.clientWidth,
      horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) > ${Number(viewport.width)} + 1,
    };
  })()`);
}

async function captureScreenshot(client, viewport, filePath) {
  const metrics = await client.send("Page.getLayoutMetrics");
  const contentSize = metrics.cssContentSize ?? metrics.contentSize ?? { width: viewport.width, height: viewport.height };
  const width = Math.min(Math.max(Math.ceil(contentSize.width || 0), Number(viewport.width)), 2_400);
  const height = Math.min(Math.max(Math.ceil(contentSize.height || 0), Number(viewport.height)), maximumPageHeight);
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  await writeFile(filePath, Buffer.from(result.data, "base64"));
  return { width, height, originalContentHeight: Math.ceil(contentSize.height || 0), truncated: Number(contentSize.height || 0) > maximumPageHeight };
}

async function writeIndex(manifest) {
  const cards = manifest.items.map((item) => `
    <article>
      <header><strong>${htmlEscape(item.label)}</strong><span>${htmlEscape(item.screenId)} · ${htmlEscape(item.viewport)}</span></header>
      <a href="${htmlEscape(item.filename)}"><img src="${htmlEscape(item.filename)}" alt="${htmlEscape(item.label)} at ${htmlEscape(item.viewport)} viewport"></a>
      <p>${htmlEscape(item.headings.join(" · ") || item.title || item.url)}</p>
      ${item.horizontalOverflow ? "<p class=\"warning\">Horizontal overflow detected.</p>" : ""}
    </article>`).join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PlotPickle visual audit</title>
<style>body{font:14px/1.45 system-ui;margin:0;background:#111;color:#eee}header.top{padding:24px;position:sticky;top:0;background:#111;border-bottom:1px solid #444;z-index:2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;padding:18px}article{background:#1d1d1d;border:1px solid #3a3a3a;border-radius:12px;overflow:hidden}article header{display:flex;justify-content:space-between;gap:12px;padding:12px}article header span{color:#aaa}img{display:block;width:100%;height:320px;object-fit:contain;object-position:top;background:#fff}p{padding:0 12px 12px;margin:8px 0;color:#bbb}.warning{color:#ffca63}</style></head>
<body><header class="top"><h1>PlotPickle visual audit</h1><p>${manifest.items.length} screenshots · ${manifest.coveredScreens}/${manifest.registryScreens} registry screens · generated ${htmlEscape(manifest.generatedAt)}</p></header><main class="grid">${cards}</main></body></html>`;
  await writeFile(path.join(outputDirectory, "index.html"), html);
  const markdown = [
    "# PlotPickle visual audit",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Registry coverage: ${manifest.coveredScreens}/${manifest.registryScreens}`,
    `Screenshots: ${manifest.items.length}`,
    "",
    "## Review order",
    "",
    ...manifest.items.map((item) => `- [${item.label} · ${item.viewport}](${item.filename})${item.horizontalOverflow ? " — horizontal overflow detected" : ""}`),
    "",
  ].join("\n");
  await writeFile(path.join(outputDirectory, "README.md"), markdown);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-visual-audit-"));
  const home = path.join(temporaryRoot, "home");
  const browserProfile = path.join(temporaryRoot, "browser");
  await mkdir(home, { recursive: true });
  await mkdir(browserProfile, { recursive: true });

  const serverPort = await choosePort(4173);
  const debugPort = await choosePort(9222);
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  const browserExecutable = findBrowserExecutable();
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
  }, path.join(outputDirectory, "server.log"));

  let browser;
  let client;
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    root,
    baseUrl,
    browserExecutable,
    registryScreens: registryScreens.length,
    coveredScreens: configuredIds.size,
    viewports,
    items: [],
    failures: [],
  };

  try {
    const response = await waitForHttp(baseUrl);
    if (!response.ok) throw new Error(`Visual-audit server returned ${response.status} ${response.statusText}.`);
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
      "--hide-scrollbars",
      "about:blank",
    ], { cwd: root, windowsHide: true, env: { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot } }, path.join(outputDirectory, "browser.log"));
    await waitForDebugger(debugPort);
    const target = await createTarget(debugPort, "about:blank");
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.connect();
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable"),
      client.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 255, g: 255, b: 255, a: 1 } }),
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: stabilizationScript });

    const viewportEntries = Object.entries(viewports);
    const firstViewport = viewportEntries[0]?.[1];
    if (!firstViewport) throw new Error("No visual-audit viewports are configured.");
    await setViewport(client, firstViewport);
    await navigate(client, baseUrl);

    for (const capture of captures) {
      if (Date.now() >= deadline) throw new Error("Visual-audit deadline reached before all screens were captured.");
      try {
        await evaluate(client, `sessionStorage.removeItem(${JSON.stringify(captureConfig.settingsSessionKey)});`);
        if (capture.settingsTarget) {
          await evaluate(client, `sessionStorage.setItem(${JSON.stringify(captureConfig.settingsSessionKey)}, ${JSON.stringify(capture.settingsTarget)});`);
        }
        const url = new URL(capture.route, `${baseUrl}/`).href;
        await navigate(client, url);
        await waitForExpectedText(client, capture.expectedText);
        const redaction = await evaluate(client, redactScript);
        if (redaction?.leakedSecret) throw new Error("A credential-like value remained visible after redaction.");

        const requestedViewports = capture.viewports?.length ? capture.viewports : Object.keys(viewports);
        for (const viewportName of requestedViewports) {
          const viewport = viewports[viewportName];
          if (!viewport) throw new Error(`Unknown viewport ${viewportName}.`);
          await setViewport(client, viewport);
          const summary = await pageSummary(client, viewport);
          const suffix = capture.variant ? `--${safeName(capture.variant)}` : capture.settingsTarget ? `--${safeName(capture.settingsTarget)}` : "";
          const filename = `${safeName(capture.screenId)}${suffix}--${safeName(viewportName)}.png`;
          const dimensions = await captureScreenshot(client, viewport, path.join(outputDirectory, filename));
          manifest.items.push({
            screenId: capture.screenId,
            label: capture.label,
            variant: capture.variant ?? capture.settingsTarget ?? null,
            viewport: viewportName,
            filename,
            ...summary,
            ...dimensions,
          });
        }
      } catch (error) {
        manifest.failures.push({ screenId: capture.screenId, label: capture.label, error: error instanceof Error ? error.message : String(error) });
      }
    }
  } finally {
    client?.close();
    await terminateProcess(browser);
    await terminateProcess(server);
    await rm(temporaryRoot, { recursive: true, force: true }).catch(() => {});
  }

  const capturedScreenIds = new Set(manifest.items.map((item) => item.screenId));
  for (const screen of registryScreens) {
    if (!capturedScreenIds.has(screen.id)) manifest.failures.push({ screenId: screen.id, label: screen.label, error: "No screenshot was produced." });
  }
  await writeFile(path.join(outputDirectory, "visual-audit-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeIndex(manifest);
  if (manifest.failures.length) {
    throw new Error(`Visual audit captured ${manifest.items.length} screenshots with ${manifest.failures.length} failure(s). Review ${outputDirectory}.`);
  }
  console.log(`Visual audit captured ${manifest.items.length} screenshots in ${outputDirectory}.`);
}

main().catch(async (error) => {
  console.error(error.stack || error.message || String(error));
  for (const child of [...processes]) await terminateProcess(child).catch(() => {});
  process.exitCode = 1;
});
