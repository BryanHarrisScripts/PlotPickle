#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const AXE_PLAYWRIGHT_VERSION = "4.13.0";
export const PLAYWRIGHT_TEST_VERSION = "1.62.1";
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRoutes = path.join(repoRoot, "config", "ui-axe-routes.json");

function option(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : fallback;
}

export function validateLocalServer(value) {
  const server = new URL(value);
  if (server.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(server.hostname)) {
    throw new Error("UI axe audit accepts only a local PlotPickle server address.");
  }
  return server;
}

export function blockingAxeViolations(result) {
  return (result?.violations || []).filter((violation) => violation.impact !== "minor");
}

function formatViolation(route, violation) {
  const nodes = violation.nodes
    .slice(0, 5)
    .map((node) => `    - ${node.target.join(" ")} :: ${node.failureSummary || "failed axe rule"}`)
    .join("\n");
  return [
    `${route.label} (${route.path}) — ${violation.id} [${violation.impact || "unknown"}]`,
    `  ${violation.help}`,
    `  ${violation.helpUrl}`,
    nodes
  ].filter(Boolean).join("\n");
}

async function waitForServer(server, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(server, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`PlotPickle did not become available at ${server.origin} within ${timeoutMs / 1000} seconds.`);
}

async function loadTooling(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned CI-only axe/playwright install.");
  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  const { chromium } = toolRequire("@playwright/test");
  const axeModule = toolRequire("@axe-core/playwright");
  const AxeBuilder = axeModule.default || axeModule;
  return { chromium, AxeBuilder };
}

export async function runUiAxeAudit({ serverUrl, toolRoot, routesPath = defaultRoutes } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  const registry = JSON.parse(await readFile(routesPath, "utf8"));
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.routes) || registry.routes.length === 0) {
    throw new Error("UI axe route registry must provide schemaVersion 1 and at least one route.");
  }

  await waitForServer(server);
  const { chromium, AxeBuilder } = await loadTooling(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    for (const route of registry.routes) {
      const url = new URL(route.path, server).toString();
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || response.status() >= 500) {
        failures.push(`${route.label} (${route.path}) failed to render: HTTP ${response?.status() ?? "no response"}`);
        continue;
      }
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      for (const violation of blockingAxeViolations(result)) failures.push(formatViolation(route, violation));
    }

    await context.close();
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`UI axe audit found ${failures.length} blocking accessibility finding(s):\n\n${failures.join("\n\n")}`);
    throw new Error(`UI axe audit failed with ${failures.length} blocking accessibility finding(s).`);
  }

  console.log(`UI axe audit passed ${registry.routes.length} representative route(s) against WCAG 2.2 AA structural rules.`);
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  runUiAxeAudit({
    serverUrl: option("--server", "http://127.0.0.1:4173"),
    toolRoot: option("--tool-root"),
    routesPath: option("--routes", defaultRoutes)
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
