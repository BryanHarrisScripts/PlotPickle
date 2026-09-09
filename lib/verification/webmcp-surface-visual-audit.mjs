#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateLocalServer, waitForUiServer } from "./ui-axe-audit.mjs";

export const WEBMCP_TOOL_NAMES = Object.freeze([
  "get_current_surface",
  "list_available_surfaces",
  "open_surface",
  "go_back",
  "inspect_surface_visual_contract",
]);
export const DASHBOARD_CANONICAL_SELECTOR = "[data-skin-reference='dashboard-canonical']";
export const DASHBOARD_SCREENSHOT_PATH = ".artifacts/visual-readiness/dashboard-canonical.png";
export const WEBMCP_ALLOWED_TARGETS = Object.freeze(["dashboard", "community", "profile", "local-ai", "node"]);
export const WEBMCP_FORBIDDEN_CAPABILITIES = Object.freeze([
  "ppf-write",
  "canon-mutation",
  "buzz-publication",
  "credential-read",
  "provider-invocation",
]);

async function loadChromium(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned CI-only verification install.");
  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  return toolRequire("@playwright/test").chromium;
}

function mcpPolyfillPath(toolRoot) {
  return path.join(path.resolve(toolRoot), "node_modules", "@mcp-b", "webmcp-polyfill", "dist", "index.iife.js");
}

function contextOptions(storageStatePath) {
  return storageStatePath ? { storageState: storageStatePath } : {};
}

async function installTestWebMcp(page, toolRoot) {
  await page.addScriptTag({ path: mcpPolyfillPath(toolRoot) });
  await page.evaluate(async ({ names, allowedTargets }) => {
    const context = document.modelContext;
    if (!context?.registerTool || !context?.getTools) {
      throw new Error("WebMCP document.modelContext was not installed by the CI-only compatibility layer.");
    }

    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };

    const currentSurface = () => {
      if (visible(document.querySelector("section[aria-label='Local AI setup']"))) return "LOCAL_AI";
      if (visible(document.querySelector("section[aria-label='Node information']"))) return "NODE";
      if (visible(document.querySelector("section[aria-label='Profile menu']"))) return "PROFILE";
      if (visible(document.querySelector("section[aria-label='PlotPickle Community']"))) return "COMMUNITY";
      return document.querySelector("[data-experience-surface]")?.getAttribute("data-experience-surface") || "UNKNOWN";
    };

    const clickButtonByText = (text) => {
      const button = [...document.querySelectorAll("button")].find((node) => visible(node) && node.textContent?.trim().includes(text));
      if (!button) throw new Error(`Visible button containing ${text} was not found.`);
      button.click();
    };

    const returnToDashboard = () => {
      const dashboardButton = [...document.querySelectorAll("button.pp-skin-v1-return")]
        .find((node) => visible(node) && node.textContent?.includes("Dashboard"));
      if (dashboardButton) dashboardButton.click();
    };

    const openTarget = (target) => {
      const normalized = String(target || "").toLowerCase();
      if (!allowedTargets.includes(normalized)) throw new Error(`Unsupported WebMCP surface target: ${normalized || "empty"}`);
      if (normalized === "dashboard") {
        returnToDashboard();
        return;
      }
      if (normalized === "community") {
        returnToDashboard();
        document.querySelector("[data-dashboard-menu-item='community']")?.click();
        return;
      }
      if (normalized === "profile") {
        returnToDashboard();
        document.querySelector("[data-dashboard-menu-item='profile']")?.click();
        return;
      }
      if (currentSurface() !== "PROFILE") {
        throw new Error(`${normalized} can only be opened from the visible Profile menu.`);
      }
      clickButtonByText(normalized === "local-ai" ? "LOCAL AI" : "NODE");
    };

    const resolveColorToken = (token) => {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      probe.style.display = "none";
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };

    const inspect = () => {
      const html = getComputedStyle(document.documentElement);
      const home = document.querySelector("main.pp-skin-v1-home") || document.body;
      const surface = currentSurface();
      const scope = surface === "LOCAL_AI"
        ? document.querySelector("section[aria-label='Local AI setup']")
        : surface === "NODE"
          ? document.querySelector("section[aria-label='Node information']")
          : surface === "PROFILE"
            ? document.querySelector("section[aria-label='Profile menu']")
            : surface === "COMMUNITY"
              ? document.querySelector("section[aria-label='PlotPickle Community']")
              : document.querySelector("section[aria-label='PlotPickle Dashboard']");
      const control = scope?.querySelector("button:not(:disabled), a[href], input, select") || null;
      const homeStyle = getComputedStyle(home);
      const scopeStyle = scope ? getComputedStyle(scope) : null;
      const controlStyle = control ? getComputedStyle(control) : null;
      const tokenNames = [
        "--pp-skin-canvas", "--pp-skin-surface-0", "--pp-skin-surface-1", "--pp-skin-surface-2",
        "--pp-skin-ink", "--pp-skin-ink-soft", "--pp-skin-ink-muted", "--pp-skin-line-strong",
        "--pp-skin-accent-deep", "--pp-skin-accent", "--pp-skin-accent-bright", "--pp-skin-focus",
        "--pp-skin-selected-bg", "--pp-skin-selected-ink", "--pp-skin-disabled", "--pp-skin-radius",
        "--pp-skin-font-ui", "--pp-skin-font-brand", "--pp-skin-control-height", "--pp-skin-shell-max",
        "--pp-skin-menu-max", "--pp-skin-media-filter",
      ];
      return {
        surface,
        tokens: Object.fromEntries(tokenNames.map((name) => [name, html.getPropertyValue(name).trim()])),
        resolved: Object.fromEntries([
          "--pp-skin-canvas", "--pp-skin-ink", "--pp-skin-selected-bg", "--pp-skin-selected-ink",
          "--pp-skin-accent", "--pp-skin-accent-bright", "--pp-skin-ink-muted",
        ].map((name) => [name, resolveColorToken(name)])),
        home: { backgroundColor: homeStyle.backgroundColor, color: homeStyle.color, fontFamily: homeStyle.fontFamily },
        scope: scopeStyle ? { backgroundColor: scopeStyle.backgroundColor, color: scopeStyle.color, fontFamily: scopeStyle.fontFamily, borderRadius: scopeStyle.borderRadius } : null,
        control: controlStyle ? { backgroundColor: controlStyle.backgroundColor, color: controlStyle.color, fontFamily: controlStyle.fontFamily, borderRadius: controlStyle.borderRadius, minHeight: controlStyle.minHeight } : null,
      };
    };

    const registrations = [
      {
        name: names[0],
        description: "Return the currently rendered PlotPickle test surface.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => ({ surface: currentSurface() }),
      },
      {
        name: names[1],
        description: "List Dashboard surface choices and the bounded WebMCP UAT targets.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => ({
          dashboard: [...document.querySelectorAll("[data-dashboard-menu-item]")].map((node) => ({
            id: node.getAttribute("data-dashboard-menu-item"),
            shortcut: node.getAttribute("data-dashboard-shortcut"),
            connected: node.getAttribute("data-dashboard-connected") === "true",
          })),
          testTargets: allowedTargets,
        }),
      },
      {
        name: names[2],
        description: "Navigate through visible Skin V1 controls to a bounded test surface.",
        inputSchema: { type: "object", properties: { surface: { type: "string", enum: allowedTargets } }, required: ["surface"], additionalProperties: false },
        execute: async ({ surface } = {}) => {
          openTarget(surface);
          return { requested: String(surface || "") };
        },
      },
      {
        name: names[3],
        description: "Use the visible Skin V1 return control to go back one test surface.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          const back = [...document.querySelectorAll("button.pp-skin-v1-return")].find(visible);
          if (!back) return { moved: false, surface: currentSurface() };
          back.click();
          return { moved: true };
        },
      },
      {
        name: names[4],
        description: "Read the rendered Skin V1 design contract for the current surface without mutating application state.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => inspect(),
      },
    ];

    for (const registration of registrations) await context.registerTool(registration);
  }, { names: WEBMCP_TOOL_NAMES, allowedTargets: WEBMCP_ALLOWED_TARGETS });
}

async function executeTool(page, name, input = {}) {
  return page.evaluate(async ({ name, input }) => {
    const context = document.modelContext;
    const tools = await context.getTools();
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`WebMCP tool ${name} was not discoverable.`);
    if (typeof context.executeTool !== "function") throw new Error("WebMCP executeTool extension is unavailable in the verification browser.");
    const result = await context.executeTool(tool, JSON.stringify(input));
    if (typeof result !== "string") return result;
    try { return JSON.parse(result); } catch { return { text: result }; }
  }, { name, input });
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function checkSurfaceContract(contract, baselineTokens, failures) {
  assert(contract?.tokens?.["--pp-skin-font-ui"] === baselineTokens["--pp-skin-font-ui"], `${contract?.surface || "Unknown"} changed the Skin V1 UI font token.`, failures);
  assert(contract?.tokens?.["--pp-skin-radius"] === baselineTokens["--pp-skin-radius"], `${contract?.surface || "Unknown"} changed the Skin V1 radius token.`, failures);
  assert(contract?.tokens?.["--pp-skin-accent"] === baselineTokens["--pp-skin-accent"], `${contract?.surface || "Unknown"} changed the Skin V1 accent token.`, failures);
  assert(contract?.tokens?.["--pp-skin-canvas"] === baselineTokens["--pp-skin-canvas"], `${contract?.surface || "Unknown"} changed the Skin V1 canvas token.`, failures);
  assert(contract?.scope?.fontFamily === contract?.home?.fontFamily || contract?.scope?.fontFamily?.includes("Courier"), `${contract?.surface || "Unknown"} does not inherit the Skin V1 UI typography.`, failures);
  assert(contract?.scope?.borderRadius === "0px", `${contract?.surface || "Unknown"} surface radius drifted from square Skin V1 geometry (${contract?.scope?.borderRadius || "missing"}).`, failures);
}

async function inspectDashboard(page, failures) {
  await page.waitForSelector(DASHBOARD_CANONICAL_SELECTOR, { timeout: 15_000 });
  await page.waitForSelector("[data-skin-reference-state='selected']", { timeout: 10_000 });
  const evidencePath = path.resolve(DASHBOARD_SCREENSHOT_PATH);
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await page.locator(DASHBOARD_CANONICAL_SELECTOR).screenshot({ path: evidencePath, animations: "disabled" });

  const result = await page.evaluate(() => {
    const canonical = document.querySelector("[data-skin-reference='dashboard-canonical']");
    const panel = document.querySelector("[data-skin-reference-panel='standard']");
    const selected = document.querySelector("[data-skin-reference-state='selected']");
    const unselected = document.querySelector("[data-skin-reference-state='unselected']");
    const brand = document.querySelector("[data-skin-reference-type='brand']");
    const meta = document.querySelector("[data-skin-reference-type='meta']");
    const muted = document.querySelector("[data-skin-reference-type='muted']");
    const media = document.querySelector("[data-skin-reference-media='primary']");
    const status = document.querySelector("[data-skin-reference-state='status']");
    const style = (node) => node ? getComputedStyle(node) : null;
    const selectedStyle = style(selected);
    const unselectedStyle = style(unselected);
    const canonicalStyle = style(canonical);
    const panelStyle = style(panel);
    const brandStyle = style(brand);
    const metaStyle = style(meta);
    const mutedStyle = style(muted);
    const mediaStyle = style(media);
    const statusStyle = style(status);
    const html = getComputedStyle(document.documentElement);
    return {
      imageReady: media instanceof HTMLImageElement && media.complete && media.naturalWidth > 0,
      canonical: canonicalStyle && { backgroundColor: canonicalStyle.backgroundColor, color: canonicalStyle.color, fontFamily: canonicalStyle.fontFamily },
      panel: panelStyle && { borderRadius: panelStyle.borderRadius, borderColor: panelStyle.borderTopColor, backgroundImage: panelStyle.backgroundImage },
      selected: selectedStyle && { backgroundColor: selectedStyle.backgroundColor, color: selectedStyle.color, outlineColor: selectedStyle.outlineColor },
      unselected: unselectedStyle && { backgroundColor: unselectedStyle.backgroundColor, color: unselectedStyle.color },
      brand: brandStyle && { fontFamily: brandStyle.fontFamily, fontSize: brandStyle.fontSize },
      meta: metaStyle && { color: metaStyle.color, fontFamily: metaStyle.fontFamily },
      muted: mutedStyle && { color: mutedStyle.color },
      media: mediaStyle && { filter: mediaStyle.filter },
      status: statusStyle && { backgroundColor: statusStyle.backgroundColor, borderColor: statusStyle.borderTopColor },
      tokens: Object.fromEntries([
        "--pp-skin-canvas", "--pp-skin-ink", "--pp-skin-ink-muted", "--pp-skin-accent",
        "--pp-skin-accent-bright", "--pp-skin-selected-bg", "--pp-skin-selected-ink", "--pp-skin-radius",
        "--pp-skin-font-ui", "--pp-skin-font-brand", "--pp-skin-media-filter",
      ].map((name) => [name, html.getPropertyValue(name).trim()])),
    };
  });

  assert(result.imageReady, "Dashboard canonical screenshot did not contain a loaded primary SVG/media asset.", failures);
  assert(result.panel?.borderRadius === "0px", `Dashboard panel is not square (${result.panel?.borderRadius || "missing"}).`, failures);
  assert(Boolean(result.panel?.backgroundImage && result.panel.backgroundImage !== "none"), "Dashboard canonical panel lost its stepped Skin V1 shading.", failures);
  assert(Boolean(result.selected && result.unselected && result.selected.backgroundColor !== result.unselected.backgroundColor), "Dashboard no longer demonstrates distinct selected and unselected states.", failures);
  assert(Boolean(result.brand?.fontFamily && result.meta?.fontFamily && result.brand.fontFamily !== result.meta.fontFamily), "Dashboard no longer demonstrates distinct brand and UI typography.", failures);
  assert(Boolean(result.media?.filter && result.media.filter !== "none"), "Dashboard primary media no longer demonstrates the Skin V1 media treatment.", failures);
  assert(Boolean(result.status?.backgroundColor), "Dashboard no longer demonstrates a connected/status treatment.", failures);
  return result;
}

export async function runWebMcpSurfaceVisualAudit({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const chromium = await loadChromium(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, ...contextOptions(storageStatePath) });
  const page = await context.newPage();

  try {
    const response = await page.goto(new URL("/skin-v1", server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("main.pp-skin-v1-home[data-experience-surface='DASHBOARD']", { timeout: 15_000 });

    const dashboard = await inspectDashboard(page, failures);
    await installTestWebMcp(page, toolRoot);

    const discovered = await page.evaluate(async () => (await document.modelContext.getTools()).map((tool) => tool.name).sort());
    assert(WEBMCP_TOOL_NAMES.every((name) => discovered.includes(name)), `WebMCP discovery returned ${discovered.join(", ")}; expected the five bounded PlotPickle UAT tools.`, failures);

    const initial = await executeTool(page, "get_current_surface");
    assert(initial?.surface === "DASHBOARD", `WebMCP reported ${initial?.surface || "nothing"} instead of DASHBOARD.`, failures);

    const available = await executeTool(page, "list_available_surfaces");
    assert(Array.isArray(available?.dashboard) && available.dashboard.some((item) => item.id === "community" && item.connected), "WebMCP surface discovery did not expose connected Community.", failures);
    assert(Array.isArray(available?.dashboard) && available.dashboard.some((item) => item.id === "profile" && item.connected), "WebMCP surface discovery did not expose connected Profile.", failures);

    checkSurfaceContract(await executeTool(page, "inspect_surface_visual_contract"), dashboard.tokens, failures);

    await executeTool(page, "open_surface", { surface: "community" });
    await page.waitForSelector("section[aria-label='PlotPickle Community']", { timeout: 15_000 });
    checkSurfaceContract(await executeTool(page, "inspect_surface_visual_contract"), dashboard.tokens, failures);

    await executeTool(page, "open_surface", { surface: "dashboard" });
    await page.waitForSelector(DASHBOARD_CANONICAL_SELECTOR, { timeout: 10_000 });
    await executeTool(page, "open_surface", { surface: "profile" });
    await page.waitForSelector("section[aria-label='Profile menu']", { timeout: 10_000 });
    checkSurfaceContract(await executeTool(page, "inspect_surface_visual_contract"), dashboard.tokens, failures);

    await executeTool(page, "open_surface", { surface: "local-ai" });
    await page.waitForSelector("section[aria-label='Local AI setup']", { timeout: 15_000 });
    checkSurfaceContract(await executeTool(page, "inspect_surface_visual_contract"), dashboard.tokens, failures);

    await executeTool(page, "go_back");
    await page.waitForSelector("section[aria-label='Profile menu']", { timeout: 10_000 });
    await executeTool(page, "open_surface", { surface: "node" });
    await page.waitForSelector("section[aria-label='Node information']", { timeout: 15_000 });
    checkSurfaceContract(await executeTool(page, "inspect_surface_visual_contract"), dashboard.tokens, failures);

    await executeTool(page, "go_back");
    await page.waitForSelector("section[aria-label='Profile menu']", { timeout: 10_000 });
    await executeTool(page, "go_back");
    await page.waitForSelector(DASHBOARD_CANONICAL_SELECTOR, { timeout: 10_000 });
    const writeRow = page.locator("[data-dashboard-menu-item='write']");
    await writeRow.focus();
    await page.keyboard.press("W");
    await page.waitForTimeout(50);
    const writeSelected = await writeRow.getAttribute("aria-selected");
    assert(writeSelected === "true", "Physical W-key navigation did not select the Script Writer row; WebMCP must not mask keyboard regressions.", failures);
  } finally {
    await context.close();
    await browser.close();
  }

  if (failures.length) throw new Error(`WebMCP Surface Visual UAT failed:\n- ${failures.join("\n- ")}`);
  console.log(`WebMCP Surface Visual UAT passed. Dashboard is the sole screenshot reference: ${DASHBOARD_SCREENSHOT_PATH}`);
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const serverIndex = process.argv.indexOf("--server");
  const toolRootIndex = process.argv.indexOf("--tool-root");
  const storageStateIndex = process.argv.indexOf("--storage-state");
  runWebMcpSurfaceVisualAudit({
    serverUrl: serverIndex >= 0 ? process.argv[serverIndex + 1] : "http://127.0.0.1:4173",
    toolRoot: toolRootIndex >= 0 ? process.argv[toolRootIndex + 1] : "",
    storageStatePath: storageStateIndex >= 0 ? process.argv[storageStateIndex + 1] : "",
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
