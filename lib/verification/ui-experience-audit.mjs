#!/usr/bin/env node

import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateLocalServer, waitForUiServer } from "./ui-axe-audit.mjs";

export const UI_CLS_REFERENCE_CEILING = 0.1;
export const UI_ZOOM_TEXT_SCALE = "200%";
export const UI_CLS_PROBES = Object.freeze(["transition", "notification", "consequence"]);

async function loadChromium(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned CI-only Playwright install.");
  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  return toolRequire("@playwright/test").chromium;
}

async function measureUnexpectedCls(browser, fixtureServer, probe) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__plotpickleCls = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__plotpickleCls += entry.value;
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  });
  try {
    const response = await page.goto(new URL(`/?probe=${encodeURIComponent(probe)}`, fixtureServer).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`UI experience fixture ${probe} probe failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("[data-ui-experience-gallery='true']", { timeout: 10_000 });
    await page.waitForTimeout(900);
    return Number(await page.evaluate(() => window.__plotpickleCls || 0));
  } finally {
    await context.close();
  }
}

async function inspectZoomAndLongContent(browser, fixtureServer) {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 } });
  const page = await context.newPage();
  try {
    const response = await page.goto(fixtureServer.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`UI experience fixture zoom probe failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("[data-ui-experience-gallery='true']", { timeout: 10_000 });
    await page.evaluate((scale) => { document.documentElement.style.fontSize = scale; }, UI_ZOOM_TEXT_SCALE);
    await page.waitForTimeout(200);
    return page.evaluate(() => {
      const root = document.documentElement;
      const action = document.querySelector("[data-pp-primary-probe='true']");
      const rect = action?.getBoundingClientRect();
      return {
        overflow: Math.max(0, root.scrollWidth - root.clientWidth),
        primaryWidth: rect?.width ?? 0,
        primaryHeight: rect?.height ?? 0,
      };
    });
  } finally {
    await context.close();
  }
}

async function inspectReducedMotion(browser, fixtureServer) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    const response = await page.goto(fixtureServer.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`UI experience fixture reduced-motion probe failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("[data-pp-work-status='resolving']", { timeout: 10_000 });
    return page.evaluate(() => Array.from(document.querySelectorAll("[data-pp-work-status='resolving'] *"))
      .map((element) => getComputedStyle(element).animationDuration)
      .filter((duration) => duration && duration !== "0s" && duration !== "0ms"));
  } finally {
    await context.close();
  }
}

async function inspectStoryZeroRoute(browser, appServer) {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 } });
  const page = await context.newPage();
  try {
    const response = await page.goto(new URL("/story", appServer).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`STORY zero-state route failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("[data-story-zero-state]", { timeout: 10_000 });
    await page.evaluate((scale) => { document.documentElement.style.fontSize = scale; }, UI_ZOOM_TEXT_SCALE);
    await page.waitForTimeout(200);
    return page.evaluate(() => ({
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      state: document.querySelector("[data-story-zero-state]")?.getAttribute("data-story-zero-state") || "missing",
      primaryActions: document.querySelectorAll("[data-story-zero-state] [data-pp-action='primary']").length,
    }));
  } finally {
    await context.close();
  }
}

export async function runUiExperienceAudit({ serverUrl, fixtureServerUrl, toolRoot } = {}) {
  const appServer = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  const fixtureServer = validateLocalServer(fixtureServerUrl || "http://127.0.0.1:4174");
  await Promise.all([waitForUiServer(appServer), waitForUiServer(fixtureServer)]);
  const chromium = await loadChromium(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  try {
    for (const probe of UI_CLS_PROBES) {
      const cls = await measureUnexpectedCls(browser, fixtureServer, probe);
      console.log(`UI CLS ${probe}: ${cls.toFixed(4)}`);
      if (cls > UI_CLS_REFERENCE_CEILING) failures.push(`${probe} CLS ${cls.toFixed(4)} exceeded ${UI_CLS_REFERENCE_CEILING}.`);
    }

    const zoom = await inspectZoomAndLongContent(browser, fixtureServer);
    if (zoom.overflow > 1) failures.push(`UI fixture overflowed horizontally by ${zoom.overflow}px at the 200% stress setting.`);
    if (zoom.primaryWidth < 44 || zoom.primaryHeight < 44) failures.push(`Primary action shrank below 44px at 200% stress (${zoom.primaryWidth}x${zoom.primaryHeight}).`);

    const reducedMotionDurations = await inspectReducedMotion(browser, fixtureServer);
    if (reducedMotionDurations.length) failures.push(`Reduced-motion probe still exposed active animation durations: ${reducedMotionDurations.join(", ")}.`);

    const story = await inspectStoryZeroRoute(browser, appServer);
    if (story.overflow > 1) failures.push(`STORY zero state overflowed horizontally by ${story.overflow}px at the 200% stress setting.`);
    if (story.state === "missing") failures.push("STORY zero-state route did not expose its state contract.");
    if (story.primaryActions !== 1) failures.push(`STORY zero state exposed ${story.primaryActions} primary actions; expected exactly one.`);
  } finally {
    await browser.close();
  }

  if (failures.length) throw new Error(`UI experience audit failed:\n- ${failures.join("\n- ")}`);
  console.log("UI experience audit passed CLS, 200% stress, long-content, reduced-motion and STORY zero-state checks.");
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const serverIndex = process.argv.indexOf("--server");
  const fixtureServerIndex = process.argv.indexOf("--fixture-server");
  const toolRootIndex = process.argv.indexOf("--tool-root");
  runUiExperienceAudit({
    serverUrl: serverIndex >= 0 ? process.argv[serverIndex + 1] : "http://127.0.0.1:4173",
    fixtureServerUrl: fixtureServerIndex >= 0 ? process.argv[fixtureServerIndex + 1] : "http://127.0.0.1:4174",
    toolRoot: toolRootIndex >= 0 ? process.argv[toolRootIndex + 1] : "",
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
