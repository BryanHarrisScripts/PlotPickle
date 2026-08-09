#!/usr/bin/env node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { auditContinuitySnapshot, continuityReport } from "../lib/ui-continuity-audit.mjs";
import { delay, extractPageState, McpClient, resultText } from "./creative-uat/mcp-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
};

const server = new URL(argument("--server", "http://127.0.0.1:4173"));
if (server.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(server.hostname)) {
  throw new Error("UI Continuity Agent accepts only a local PlotPickle server address.");
}

const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const reportPath = path.resolve(argument("--report", path.join(localRoot, "PlotPickle", "reports", "ui-continuity-report.md")));
const registryPath = path.join(repoRoot, "config", "ui-continuity-agent-registry.json");
const pluginRoot = path.join(repoRoot, "tools", "agent-plugins", "plotpickle-workflow-tester");

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(server, { signal: AbortSignal.timeout(2_000) });
      if (response.ok || response.status < 500) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`PlotPickle did not become available at ${server.origin} within ${timeoutMs / 1000} seconds.`);
}

function expandPluginValue(value, pluginData) {
  return String(value).replaceAll("${PLUGIN_ROOT}", pluginRoot).replaceAll("${PLUGIN_DATA}", pluginData);
}

async function renderedSnapshot(client) {
  const result = await client.call("browser_evaluate", { function: `() => {
    const visible = (node) => {
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.display !== 'none' && style.visibility !== 'hidden' && node.getClientRects().length > 0;
    };
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } : null;
    };
    const shell = document.querySelector('[data-ui-continuity-shell="v1"]');
    const shellStyle = shell ? getComputedStyle(shell) : null;
    const anchor = document.querySelector('[data-ui-continuity-anchor="agent-settings"]');
    const active = document.querySelector('[data-workspace-active="true"]');
    const returnControls = [...document.querySelectorAll('button, a')]
      .filter(visible)
      .map((node) => (node.getAttribute('aria-label') || node.textContent || '').replace(/\\s+/g, ' ').trim())
      .filter((label) => /(?:back|return) to /i.test(label));
    const navigation = [...document.querySelectorAll('.application-shell-header [data-workspace-id]')]
      .filter(visible)
      .map((node) => (node.textContent || '').replace(/\\s+/g, ' ').trim());
    const anchorBox = rect(anchor);
    return {
      rendered: Boolean(document.querySelector('main, [role="main"], .workspace')) && Boolean((document.body.innerText || '').trim()),
      url: location.href,
      theme: document.documentElement.dataset.plotpickleTheme || '',
      activeWorkspace: active?.getAttribute('data-workspace-id') || '',
      navigation,
      projectStrip: visible(document.querySelector('.project-strip, [class*="projectStrip"]')),
      statusSignals: [...document.querySelectorAll('[role="status"], progress, .status-dot, [aria-live]')].filter(visible).length,
      returnControls,
      anchor: {
        visible: visible(anchor),
        name: anchor ? (anchor.getAttribute('aria-label') || '').trim() : '',
        x: anchorBox?.x ?? 9999,
        y: anchorBox?.y ?? 9999
      },
      shell: shell ? {
        contract: shell.getAttribute('data-ui-continuity-shell') || '',
        designSystem: shell.getAttribute('data-ui-continuity-theme') || '',
        height: rect(shell)?.height || 0,
        background: shellStyle?.backgroundColor || '',
        borderBottom: shellStyle?.borderBottomColor || '',
        fontFamily: shellStyle?.fontFamily || ''
      } : null
    };
  }` });
  return extractPageState(resultText(result));
}

async function inspectScreen(client, screen) {
  await client.call("browser_navigate", { url: new URL(screen.path, server).toString() });
  let snapshot = {};
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await delay(attempt === 0 ? 900 : 250);
    snapshot = await renderedSnapshot(client);
    if (snapshot.rendered && snapshot.anchor?.visible && (screen.kind === "standalone" || snapshot.activeWorkspace === screen.activeWorkspace)) break;
  }
  return snapshot;
}

async function main() {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  if (registry.mode !== "read-only" || registry.autoFix !== false || registry.fixApprovalRequired !== true) {
    throw new Error("UI Continuity Agent registry must preserve the read-only, approval-required boundary.");
  }
  await mkdir(path.dirname(reportPath), { recursive: true });
  await waitForServer();

  const pluginData = await mkdtemp(path.join(os.tmpdir(), "plotpickle-ui-continuity-"));
  const config = JSON.parse(await readFile(path.join(pluginRoot, "mcp.json"), "utf8"));
  const playwright = config?.mcpServers?.playwright;
  if (!playwright || playwright.type !== "stdio") throw new Error("UI Continuity Agent requires the local Playwright agent runtime.");
  const client = new McpClient(
    expandPluginValue(playwright.command, pluginData),
    (playwright.args || []).map((value) => expandPluginValue(value, pluginData)),
    {
      cwd: expandPluginValue(playwright.cwd || pluginRoot, pluginData),
      env: Object.fromEntries(Object.entries(playwright.env || {}).map(([key, value]) => [key, expandPluginValue(value, pluginData)])),
    },
  );

  const results = [];
  let baseline = null;
  try {
    await client.initialize();
    const tools = await client.tools();
    for (const required of ["browser_navigate", "browser_evaluate"]) {
      if (!tools.some((tool) => tool.name === required)) throw new Error(`Playwright agent runtime is missing ${required}.`);
    }
    for (const screen of registry.screens) {
      const snapshot = await inspectScreen(client, screen);
      if (screen.id === "dashboard" && snapshot.shell) baseline = snapshot.shell;
      results.push(auditContinuitySnapshot(screen, snapshot, baseline));
    }
  } finally {
    await client.close();
    await rm(pluginData, { recursive: true, force: true });
  }

  const report = continuityReport({ generatedAt: new Date().toISOString(), server: server.origin, results });
  await writeFile(reportPath, report, "utf8");
  const findings = results.reduce((count, result) => count + result.findings.length, 0);
  process.stdout.write(`UI Continuity Agent inspected ${results.length} screens and recorded ${findings} finding${findings === 1 ? "" : "s"}. Report: ${reportPath}\n`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, continuityReport({ generatedAt: new Date().toISOString(), server: server.origin, results: [], runtimeError: message }), "utf8");
  } catch {}
  console.error(message);
  process.exitCode = 1;
});
