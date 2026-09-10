#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
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
export const VISUAL_BASELINE_MANIFEST_PATH = "tests/visual-baselines/skin-v1/manifest.json";
export const WEBMCP_ALLOWED_TARGETS = Object.freeze([
  "dashboard",
  "community",
  "settings",
  "cloud-story-mode",
  "agents",
  "profile",
  "local-ai",
  "node",
]);
export const WEBMCP_FORBIDDEN_CAPABILITIES = Object.freeze([
  "ppf-write",
  "canon-mutation",
  "buzz-publication",
  "credential-read",
  "provider-invocation",
]);

async function loadVisualBaselineManifest() {
  const manifest = JSON.parse(await readFile(path.resolve(VISUAL_BASELINE_MANIFEST_PATH), "utf8"));
  if (manifest?.skin !== "skin-v1" || !manifest?.surfaces || typeof manifest.surfaces !== "object") {
    throw new Error(`Invalid Skin V1 visual baseline manifest: ${VISUAL_BASELINE_MANIFEST_PATH}`);
  }
  for (const target of WEBMCP_ALLOWED_TARGETS) {
    if (!manifest.surfaces[target]) throw new Error(`Visual baseline manifest is missing ${target}.`);
  }
  return manifest;
}

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
      if (visible(document.querySelector("section[aria-label='Cloud Story Mode setup']"))) return "CLOUD_STORY_MODE";
      if (visible(document.querySelector("section[aria-label='PlotPickle Agents setup']"))) return "AGENTS";
      if (visible(document.querySelector("section[aria-label='Settings menu']"))) return "SETTINGS";
      if (visible(document.querySelector("section[aria-label='Local Story Mode setup']"))) return "LOCAL_AI";
      if (visible(document.querySelector("section[aria-label='Local AI setup']"))) return "LOCAL_AI";
      if (visible(document.querySelector("section[aria-label='Node information']"))) return "NODE";
      if (visible(document.querySelector("section[aria-label='Profile menu']"))) return "PROFILE";
      if (visible(document.querySelector("section[aria-label='PlotPickle Community']"))) return "COMMUNITY";
      return document.querySelector("[data-experience-surface]")?.getAttribute("data-experience-surface") || "UNKNOWN";
    };

    const surfaceScope = (surface = currentSurface()) => {
      if (surface === "CLOUD_STORY_MODE") return document.querySelector("section[aria-label='Cloud Story Mode setup']");
      if (surface === "AGENTS") return document.querySelector("section[aria-label='PlotPickle Agents setup']");
      if (surface === "SETTINGS") return document.querySelector("section[aria-label='Settings menu']");
      if (surface === "LOCAL_AI") {
        return document.querySelector("section[aria-label='Local Story Mode setup']")
          || document.querySelector("section[aria-label='Local AI setup']");
      }
      if (surface === "NODE") return document.querySelector("section[aria-label='Node information']");
      if (surface === "PROFILE") return document.querySelector("section[aria-label='Profile menu']");
      if (surface === "COMMUNITY") return document.querySelector("section[aria-label='PlotPickle Community']");
      return document.querySelector("section[aria-label='PlotPickle Dashboard']");
    };

    const clickButtonByText = (text) => {
      const button = [...document.querySelectorAll("button")]
        .find((node) => visible(node) && node.textContent?.trim().includes(text));
      if (!button) throw new Error(`Visible button containing ${text} was not found.`);
      button.click();
    };

    const clickSelector = (selector, label) => {
      const node = document.querySelector(selector);
      if (!(node instanceof HTMLElement) || !visible(node)) throw new Error(`${label} was not visible.`);
      node.click();
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
        if (currentSurface() !== "DASHBOARD") returnToDashboard();
        clickSelector("[data-dashboard-menu-item='community']", "Community Dashboard row");
        return;
      }
      if (normalized === "settings") {
        if (currentSurface() !== "DASHBOARD") returnToDashboard();
        clickSelector("[data-dashboard-menu-item='settings']", "Settings Dashboard row");
        return;
      }
      if (normalized === "cloud-story-mode") {
        if (currentSurface() !== "SETTINGS") throw new Error("Cloud Story Mode can only be opened from the visible Settings menu.");
        clickSelector("[data-settings-secondary-item='cloud']", "Cloud Story Mode Settings row");
        return;
      }
      if (normalized === "agents") {
        if (currentSurface() !== "SETTINGS") throw new Error("PlotPickle Agents can only be opened from the visible Settings menu.");
        clickSelector("[data-settings-secondary-item='agents']", "PlotPickle Agents Settings row");
        return;
      }
      if (normalized === "profile") {
        if (currentSurface() !== "DASHBOARD") returnToDashboard();
        clickSelector("[data-dashboard-menu-item='profile']", "Profile Dashboard row");
        return;
      }
      if (currentSurface() !== "PROFILE") {
        throw new Error(`${normalized} can only be opened from the visible Profile menu.`);
      }
      clickButtonByText(normalized === "local-ai" ? "LOCAL STORY MODE" : "NODE");
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

    const stableIdentity = (node, index) => {
      const explicit = node.getAttribute("data-skin-id")
        || node.getAttribute("data-dashboard-menu-item")
        || node.getAttribute("data-settings-secondary-item")
        || node.id
        || node.getAttribute("aria-label")
        || node.getAttribute("name");
      if (explicit) return String(explicit).slice(0, 160);
      const classToken = [...node.classList].find((value) => value.startsWith("pp-")) || "";
      const role = node.getAttribute("role") || node.tagName.toLowerCase();
      return `${role}${classToken ? `.${classToken}` : ""}#${index}`;
    };

    const semanticRole = (node) => {
      const explicit = node.getAttribute("data-skin-role");
      if (explicit) return explicit;
      const controlKind = node.getAttribute("data-skin-control-kind");
      if (controlKind === "pill" || [...node.classList].some((value) => /pill/i.test(value))) return "pill";
      if (node.matches("button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='tab'], [role='menuitem'], [role='option']")) return "control";
      if (node.matches("h1, h2, h3, h4, h5, h6, [role='heading']")) return "heading";
      if (node.matches("[role='status'], [role='alert'], [aria-live], .pp-skin-v1-status")) return "status";
      if (node.matches(".pp-skin-v1-panel, .pp-skin-v1-bbs, [data-skin-role='panel']")) return "panel";
      if (node.matches("p, label, small")) return "body";
      return "surface";
    };

    const computedPresentation = (node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
        inputType: node instanceof HTMLInputElement ? node.type : "",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        borderRadius: style.borderRadius,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderTopColor: style.borderTopColor,
        backgroundColor: style.backgroundColor,
        color: style.color,
        outlineColor: style.outlineColor,
        minHeight: style.minHeight,
        height: `${box.height}px`,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
      };
    };

    const inventoryGovernedElements = (scope) => {
      if (!(scope instanceof HTMLElement)) return [];
      const selectors = [
        ".pp-skin-v1-panel",
        ".pp-skin-v1-bbs",
        "[data-skin-role]",
        "[data-skin-control-kind]",
        "button",
        "a[href]",
        "input:not([type='hidden'])",
        "select",
        "textarea",
        "[role='button']",
        "[role='tab']",
        "[role='menuitem']",
        "[role='option']",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "[role='heading']",
        "[role='status']",
        "[role='alert']",
        "[aria-live]",
        ".pp-skin-v1-status",
        "p",
        "label",
        "small",
      ].join(",");
      const nodes = [scope, ...scope.querySelectorAll(selectors)];
      const unique = [...new Set(nodes)].filter(visible);
      return unique.map((node, index) => ({
        semanticRole: semanticRole(node),
        stableIdentity: stableIdentity(node, index),
        computedPresentation: computedPresentation(node),
      }));
    };

    const inspect = () => {
      const html = getComputedStyle(document.documentElement);
      const home = document.querySelector("main.pp-skin-v1-home") || document.body;
      const surface = currentSurface();
      const scope = surfaceScope(surface);
      const control = scope?.querySelector("button:not(:disabled), a[href], input, select") || null;
      const homeStyle = getComputedStyle(home);
      const scopeStyle = scope ? getComputedStyle(scope) : null;
      const controlStyle = control ? getComputedStyle(control) : null;
      const tokenNames = [
        "--pp-skin-canvas", "--pp-skin-surface-0", "--pp-skin-surface-1", "--pp-skin-surface-2",
        "--pp-skin-ink", "--pp-skin-ink-soft", "--pp-skin-ink-muted", "--pp-skin-line-strong",
        "--pp-skin-accent-deep", "--pp-skin-accent", "--pp-skin-accent-bright", "--pp-skin-focus",
        "--pp-skin-selected-bg", "--pp-skin-selected-ink", "--pp-skin-disabled", "--pp-skin-radius",
        "--pp-skin-font-ui", "--pp-skin-font-brand", "--pp-skin-control-height", "--pp-skin-touch-target",
        "--pp-skin-border-thin", "--pp-skin-border-strong", "--pp-skin-shell-max",
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
        scope: scopeStyle ? {
          backgroundColor: scopeStyle.backgroundColor,
          color: scopeStyle.color,
          fontFamily: scopeStyle.fontFamily,
          borderRadius: scopeStyle.borderRadius,
        } : null,
        control: controlStyle ? {
          backgroundColor: controlStyle.backgroundColor,
          color: controlStyle.color,
          fontFamily: controlStyle.fontFamily,
          borderRadius: controlStyle.borderRadius,
          minHeight: controlStyle.minHeight,
        } : null,
        inventory: inventoryGovernedElements(scope),
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
          settings: [...document.querySelectorAll("[data-settings-secondary-item]")].map((node) => ({
            id: node.getAttribute("data-settings-secondary-item"),
            shortcut: node.getAttribute("data-settings-shortcut"),
            connected: node.getAttribute("data-settings-secondary-connected") === "true",
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
        description: "Read every governed rendered Skin V1 component for the current surface without mutating application state.",
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

function numericPx(value) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFamily(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function visualViolations(contract, baselineTokens = {}) {
  const surface = contract?.surface || "UNKNOWN";
  const inventory = Array.isArray(contract?.inventory) ? contract.inventory : [];
  const violations = [];
  const expectedRadius = baselineTokens["--pp-skin-radius"] || contract?.tokens?.["--pp-skin-radius"] || "0px";
  const expectedControlHeight = numericPx(baselineTokens["--pp-skin-control-height"] || contract?.tokens?.["--pp-skin-control-height"]);
  const expectedUiFamily = normalizeFamily(contract?.home?.fontFamily);

  const add = (item, property, actual, expected, source) => {
    violations.push({
      surface,
      semanticRole: item.semanticRole,
      stableIdentity: item.stableIdentity,
      property,
      actual: String(actual ?? ""),
      expected: String(expected ?? ""),
      source,
    });
  };

  for (const item of inventory) {
    const role = item.semanticRole;
    const presentation = item.computedPresentation || {};
    if (["surface", "panel", "control", "pill"].includes(role) && presentation.borderRadius !== expectedRadius) {
      add(item, "borderRadius", presentation.borderRadius, expectedRadius, "--pp-skin-radius");
    }

    if (["surface", "panel", "control", "pill", "body", "status"].includes(role)) {
      const actualFamily = normalizeFamily(presentation.fontFamily);
      if (expectedUiFamily && actualFamily !== expectedUiFamily) {
        add(item, "fontFamily", presentation.fontFamily, contract.home.fontFamily, "--pp-skin-font-ui");
      }
    }

    if (["control", "pill"].includes(role) && expectedControlHeight !== null) {
      const tag = presentation.tag;
      const inputType = String(presentation.inputType || "").toLowerCase();
      const sizedControl = ["button", "input", "select", "textarea"].includes(tag)
        && !["checkbox", "radio", "hidden"].includes(inputType);
      if (sizedControl) {
        const actualHeight = numericPx(presentation.height);
        if (actualHeight !== null && actualHeight + 0.5 < expectedControlHeight) {
          add(item, "height", presentation.height, `>= ${expectedControlHeight}px`, "--pp-skin-control-height");
        }
      }
    }
  }

  return violations;
}

function checkSurfaceContract(contract, baselineTokens, failures) {
  assert(contract?.tokens?.["--pp-skin-font-ui"] === baselineTokens["--pp-skin-font-ui"], `${contract?.surface || "Unknown"} changed the Skin V1 UI font token.`, failures);
  assert(contract?.tokens?.["--pp-skin-radius"] === baselineTokens["--pp-skin-radius"], `${contract?.surface || "Unknown"} changed the Skin V1 radius token.`, failures);
  assert(contract?.tokens?.["--pp-skin-accent"] === baselineTokens["--pp-skin-accent"], `${contract?.surface || "Unknown"} changed the Skin V1 accent token.`, failures);
  assert(contract?.tokens?.["--pp-skin-canvas"] === baselineTokens["--pp-skin-canvas"], `${contract?.surface || "Unknown"} changed the Skin V1 canvas token.`, failures);
  assert(Array.isArray(contract?.inventory) && contract.inventory.length > 0, `${contract?.surface || "Unknown"} returned no governed visual inventory.`, failures);

  const violations = visualViolations(contract, baselineTokens);
  for (const violation of violations) failures.push(`UI-CONFORMANCE ${JSON.stringify(violation)}`);
  return { inspected: contract?.inventory?.length || 0, violations };
}

async function inspectDashboard(page, failures) {
  await page.waitForSelector(DASHBOARD_CANONICAL_SELECTOR, { timeout: 15_000 });
  await page.waitForSelector("[data-skin-reference-state='selected']", { timeout: 10_000 });

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
        "--pp-skin-font-ui", "--pp-skin-font-brand", "--pp-skin-control-height", "--pp-skin-media-filter",
      ].map((name) => [name, html.getPropertyValue(name).trim()])),
    };
  });

  assert(result.imageReady, "Dashboard canonical design reference did not contain loaded primary media.", failures);
  assert(result.panel?.borderRadius === "0px", `Dashboard panel is not square (${result.panel?.borderRadius || "missing"}).`, failures);
  assert(Boolean(result.panel?.backgroundImage && result.panel.backgroundImage !== "none"), "Dashboard canonical panel lost its stepped Skin V1 shading.", failures);
  assert(Boolean(result.selected && result.unselected && result.selected.backgroundColor !== result.unselected.backgroundColor), "Dashboard no longer demonstrates distinct selected and unselected states.", failures);
  assert(Boolean(result.brand?.fontFamily && result.meta?.fontFamily && result.brand.fontFamily !== result.meta.fontFamily), "Dashboard no longer demonstrates distinct brand and UI typography.", failures);
  assert(result.media?.filter === "none", `Dashboard primary media should preserve source colour under Skin V1 (${result.media?.filter || "missing"}).`, failures);
  assert(Boolean(result.status?.backgroundColor), "Dashboard no longer demonstrates a connected/status treatment.", failures);
  return result;
}

async function comparePngPixels(page, baseline, candidate, comparison) {
  const comparePage = await page.context().newPage();
  try {
    return await comparePage.evaluate(async ({ baselineData, candidateData, channelDelta }) => {
      const loadImage = (src) => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("PNG could not be decoded"));
        image.src = src;
      });
      const [expected, actual] = await Promise.all([loadImage(baselineData), loadImage(candidateData)]);
      if (expected.width !== actual.width || expected.height !== actual.height) {
        return { sameDimensions: false, changedPixelRatio: 1, width: actual.width, height: actual.height, baselineWidth: expected.width, baselineHeight: expected.height };
      }
      const canvas = document.createElement("canvas");
      canvas.width = actual.width;
      canvas.height = actual.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(expected, 0, 0);
      const expectedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(actual, 0, 0);
      const actualPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let index = 0; index < actualPixels.length; index += 4) {
        if (
          Math.abs(expectedPixels[index] - actualPixels[index]) > channelDelta
          || Math.abs(expectedPixels[index + 1] - actualPixels[index + 1]) > channelDelta
          || Math.abs(expectedPixels[index + 2] - actualPixels[index + 2]) > channelDelta
          || Math.abs(expectedPixels[index + 3] - actualPixels[index + 3]) > channelDelta
        ) changed += 1;
      }
      return { sameDimensions: true, changedPixelRatio: changed / (canvas.width * canvas.height), width: actual.width, height: actual.height };
    }, {
      baselineData: `data:image/png;base64,${baseline.toString("base64")}`,
      candidateData: `data:image/png;base64,${candidate.toString("base64")}`,
      channelDelta: Number(comparison.channelDelta),
    });
  } finally {
    await comparePage.close();
  }
}

async function compareLockedBaseline(page, surface, entry, candidate, comparison, failures) {
  if (entry.status !== "locked") return;
  let baseline;
  try {
    baseline = await readFile(path.resolve(entry.baseline));
  } catch (error) {
    if (error?.code === "ENOENT") {
      failures.push(`${entry.label || surface} is locked but its repository baseline is missing: ${entry.baseline}`);
      return;
    }
    throw error;
  }

  let result;
  try {
    result = await comparePngPixels(page, baseline, candidate, comparison);
  } catch (error) {
    failures.push(`${entry.label || surface} locked baseline could not be compared: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!result.sameDimensions) {
    failures.push(`${entry.label || surface} changed screenshot dimensions from ${result.baselineWidth}x${result.baselineHeight} to ${result.width}x${result.height}.`);
    return;
  }
  if (result.changedPixelRatio > Number(comparison.maxChangedPixelRatio)) {
    failures.push(`${entry.label || surface} changed ${(result.changedPixelRatio * 100).toFixed(2)}% of pixels; locked tolerance is ${(Number(comparison.maxChangedPixelRatio) * 100).toFixed(2)}%.`);
  }
}

async function captureSurfaceCandidate(page, manifest, surface, failures) {
  const entry = manifest.surfaces[surface];
  if (!entry) {
    failures.push(`No visual baseline manifest entry exists for ${surface}.`);
    return;
  }
  const locator = page.locator(entry.selector).first();
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  const candidatePath = path.resolve(entry.candidate);
  await mkdir(path.dirname(candidatePath), { recursive: true });
  const candidate = await locator.screenshot({ path: candidatePath, animations: "disabled" });
  await compareLockedBaseline(page, surface, entry, candidate, manifest.comparison, failures);
}

export async function runWebMcpSurfaceVisualAudit({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const manifest = await loadVisualBaselineManifest();
  const chromium = await loadChromium(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const conformance = [];
  const context = await browser.newContext({ viewport: manifest.viewport, ...contextOptions(storageStatePath) });
  const page = await context.newPage();

  let dashboard;
  const inspectCurrent = async (surface) => {
    const contract = await executeTool(page, "inspect_surface_visual_contract");
    const result = checkSurfaceContract(contract, dashboard.tokens, failures);
    conformance.push({ surface, inspected: result.inspected, violations: result.violations.length });
  };

  try {
    const response = await page.goto(new URL("/skin-v1", server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("main.pp-skin-v1-home[data-experience-surface='DASHBOARD']", { timeout: 15_000 });

    dashboard = await inspectDashboard(page, failures);
    await captureSurfaceCandidate(page, manifest, "dashboard", failures);
    await installTestWebMcp(page, toolRoot);

    const discovered = await page.evaluate(async () => (await document.modelContext.getTools()).map((tool) => tool.name).sort());
    assert(WEBMCP_TOOL_NAMES.every((name) => discovered.includes(name)), `WebMCP discovery returned ${discovered.join(", ")}; expected the five bounded PlotPickle UAT tools.`, failures);

    const initial = await executeTool(page, "get_current_surface");
    assert(initial?.surface === "DASHBOARD", `WebMCP reported ${initial?.surface || "nothing"} instead of DASHBOARD.`, failures);

    const available = await executeTool(page, "list_available_surfaces");
    assert(Array.isArray(available?.dashboard) && available.dashboard.some((item) => item.id === "community" && item.connected), "WebMCP surface discovery did not expose connected Community.", failures);
    assert(Array.isArray(available?.dashboard) && available.dashboard.some((item) => item.id === "settings" && item.connected), "WebMCP surface discovery did not expose connected Settings.", failures);
    assert(Array.isArray(available?.dashboard) && available.dashboard.some((item) => item.id === "profile" && item.connected), "WebMCP surface discovery did not expose connected Profile.", failures);

    await inspectCurrent("dashboard");

    await executeTool(page, "open_surface", { surface: "community" });
    await page.waitForSelector("section[aria-label='PlotPickle Community']", { timeout: 15_000 });
    await inspectCurrent("community");
    await captureSurfaceCandidate(page, manifest, "community", failures);

    await executeTool(page, "open_surface", { surface: "dashboard" });
    await page.waitForSelector(DASHBOARD_CANONICAL_SELECTOR, { timeout: 10_000 });
    await executeTool(page, "open_surface", { surface: "settings" });
    await page.waitForSelector("section[aria-label='Settings menu']", { timeout: 10_000 });
    const settingsAvailable = await executeTool(page, "list_available_surfaces");
    assert(Array.isArray(settingsAvailable?.settings) && settingsAvailable.settings.some((item) => item.id === "cloud" && item.connected), "WebMCP Settings discovery did not expose connected Cloud Story Mode.", failures);
    assert(Array.isArray(settingsAvailable?.settings) && settingsAvailable.settings.some((item) => item.id === "agents" && item.connected), "WebMCP Settings discovery did not expose connected PlotPickle Agents.", failures);
    await inspectCurrent("settings");
    await captureSurfaceCandidate(page, manifest, "settings", failures);

    await executeTool(page, "open_surface", { surface: "cloud-story-mode" });
    await page.waitForSelector("section[aria-label='Cloud Story Mode setup']", { timeout: 15_000 });
    await inspectCurrent("cloud-story-mode");
    await captureSurfaceCandidate(page, manifest, "cloud-story-mode", failures);

    await executeTool(page, "go_back");
    await page.waitForSelector("section[aria-label='Settings menu']", { timeout: 10_000 });
    await executeTool(page, "open_surface", { surface: "agents" });
    await page.waitForSelector("section[aria-label='PlotPickle Agents setup']", { timeout: 15_000 });
    await inspectCurrent("agents");
    await captureSurfaceCandidate(page, manifest, "agents", failures);

    await executeTool(page, "go_back");
    await page.waitForSelector("section[aria-label='Settings menu']", { timeout: 10_000 });
    await executeTool(page, "go_back");
    await page.waitForSelector(DASHBOARD_CANONICAL_SELECTOR, { timeout: 10_000 });
    await executeTool(page, "open_surface", { surface: "profile" });
    await page.waitForSelector("section[aria-label='Profile menu']", { timeout: 10_000 });
    await inspectCurrent("profile");
    await captureSurfaceCandidate(page, manifest, "profile", failures);

    await executeTool(page, "open_surface", { surface: "local-ai" });
    await page.waitForSelector("section[aria-label='Local Story Mode setup'], section[aria-label='Local AI setup']", { timeout: 15_000 });
    await inspectCurrent("local-ai");
    await captureSurfaceCandidate(page, manifest, "local-ai", failures);

    await executeTool(page, "go_back");
    await page.waitForSelector("section[aria-label='Profile menu']", { timeout: 10_000 });
    await executeTool(page, "open_surface", { surface: "node" });
    await page.waitForSelector("section[aria-label='Node information']", { timeout: 15_000 });
    await inspectCurrent("node");
    await captureSurfaceCandidate(page, manifest, "node", failures);

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
  const locked = Object.values(manifest.surfaces).filter((entry) => entry.status === "locked").length;
  const inspected = conformance.reduce((sum, entry) => sum + entry.inspected, 0);
  console.log(`WebMCP Surface Visual UAT passed. Dashboard is the canonical Skin V1 design reference. Captured ${WEBMCP_ALLOWED_TARGETS.length} surface candidates; ${locked} locked baselines enforced.`);
  console.log(`UI conformance passed: ${inspected} governed rendered elements inspected across ${conformance.length} surfaces; 0 violations.`);
  console.log(`Dashboard candidate: ${DASHBOARD_SCREENSHOT_PATH}`);
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
