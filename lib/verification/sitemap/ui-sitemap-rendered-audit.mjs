#!/usr/bin/env node

import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateLocalServer, waitForUiServer } from "../ui-axe-audit.mjs";

export const SITEMAP_RENDERED_ROUTES = Object.freeze([
  { id: "home-library", path: "/library", area: "home", destination: "library" },
  { id: "create-curriculum", path: "/core-curriculum", area: "create", destination: "core-curriculum" },
  { id: "produce-storyboard", path: "/storyboard", area: "produce", destination: "storyboard" },
  { id: "review-refine", path: "/diagnostics", area: "review", destination: "refine" },
  { id: "connect-collab", path: "/?workspace=collab", area: "connect", destination: "collab" },
  { id: "settings-ai-routing", path: "/ai-routing", area: "settings", destination: "ai-routing" },
]);

async function loadChromium(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned CI-only Playwright install.");
  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  return toolRequire("@playwright/test").chromium;
}

function contextOptions(storageStatePath) {
  return {
    viewport: { width: 960, height: 900 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  };
}

async function inspectRoute(browser, server, route, storageStatePath) {
  const context = await browser.newContext(contextOptions(storageStatePath));
  const page = await context.newPage();
  try {
    const response = await page.goto(new URL(route.path, server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`${route.id} failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("[data-current-navigation-area]", { timeout: 15_000 });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await page.waitForTimeout(200);
    return await page.evaluate(() => {
      const visible = (node) => {
        if (!node) return false;
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
      };
      const shell = document.querySelector("[data-current-navigation-area]");
      const destinations = [...document.querySelectorAll("[data-workspace-navigation='true'] [data-workspace-nav-id]")];
      const destinationIds = destinations.map((node) => node.getAttribute("data-workspace-nav-id") || "").filter(Boolean);
      const visiblePanels = [...document.querySelectorAll("[data-navigation-area-panel]")]
        .filter(visible)
        .map((node) => node.getAttribute("data-navigation-area-panel") || "")
        .filter(Boolean);
      return {
        area: shell?.getAttribute("data-current-navigation-area") || "",
        destination: shell?.getAttribute("data-current-destination") || "",
        context: shell?.getAttribute("data-current-context") || "",
        areaCount: document.querySelectorAll("[data-workspace-areas='true'] [data-navigation-area-id]").length,
        canonicalCount: Number(document.querySelector("[data-navigation-canonical-count]")?.getAttribute("data-navigation-canonical-count") || 0),
        reachableCount: new Set(destinationIds).size,
        visiblePanels,
        projectContext: visible(document.querySelector("[data-shell-project-context='true']")),
        horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      };
    });
  } finally {
    await context.close();
  }
}

export async function runUiSitemapRenderedAudit({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const chromium = await loadChromium(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const failures = [];

  try {
    for (const route of SITEMAP_RENDERED_ROUTES) {
      const snapshot = await inspectRoute(browser, server, route, storageStatePath);
      console.log(`UI sitemap ${route.id}: ${snapshot.area} / ${snapshot.destination}`);
      if (snapshot.area !== route.area) failures.push(`${route.id} reported area ${snapshot.area || "missing"}; expected ${route.area}.`);
      if (snapshot.destination !== route.destination) failures.push(`${route.id} reported destination ${snapshot.destination || "missing"}; expected ${route.destination}.`);
      if (!snapshot.areaCount || snapshot.areaCount > 6) failures.push(`${route.id} exposed ${snapshot.areaCount} top-level areas; expected 1–6.`);
      if (!snapshot.canonicalCount || snapshot.reachableCount !== snapshot.canonicalCount) failures.push(`${route.id} reaches ${snapshot.reachableCount} of ${snapshot.canonicalCount || "an undeclared number of"} canonical destinations.`);
      if (snapshot.visiblePanels.length !== 1 || snapshot.visiblePanels[0] !== route.area) failures.push(`${route.id} disclosed ${snapshot.visiblePanels.join(", ") || "no"} destination panels; expected only ${route.area}.`);
      if (!snapshot.projectContext) failures.push(`${route.id} did not expose persistent project/status context.`);
      if (snapshot.horizontalOverflow > 1) failures.push(`${route.id} overflowed horizontally by ${snapshot.horizontalOverflow}px at the 200% stress setting.`);
      if (route.destination === "collab" && snapshot.context !== "collab") failures.push("Collab did not expose its contextual child identity.");
    }
  } finally {
    await browser.close();
  }

  if (failures.length) throw new Error(`UI sitemap rendered audit failed:\n- ${failures.join("\n- ")}`);
  console.log("UI sitemap rendered audit passed representative Home, Create, Produce, Review, Connect / Play and Settings routes at 200% stress.");
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const serverIndex = process.argv.indexOf("--server");
  const toolRootIndex = process.argv.indexOf("--tool-root");
  const storageStateIndex = process.argv.indexOf("--storage-state");
  runUiSitemapRenderedAudit({
    serverUrl: serverIndex >= 0 ? process.argv[serverIndex + 1] : "http://127.0.0.1:4173",
    toolRoot: toolRootIndex >= 0 ? process.argv[toolRootIndex + 1] : "",
    storageStatePath: storageStateIndex >= 0 ? process.argv[storageStateIndex + 1] : "",
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
