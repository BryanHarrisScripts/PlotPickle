#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  SKIN_V1_RUNTIME_SELECTOR,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "./webmcp-canonical-surface-registry.mjs";
import {
  VISUAL_BASELINE_MANIFEST_PATH,
  WEBMCP_TOOL_NAMES,
} from "./webmcp-surface-visual-audit.mjs";
import { validateLocalServer, waitForUiServer } from "./ui-axe-audit.mjs";
import { createBrowserVerificationSession } from "./browser-verification-broker.mjs";

const DASHBOARD_SCORE_SELECTOR = "[data-skin-reference='dashboard-canonical'] [data-plotpickle-score='v1']";
const DASHBOARD_ART_SELECTOR = "[data-dashboard-art='skin-v1']";
const ORCHESTRATOR_SELECTOR = ".pp-skin-v1-orchestrator[data-skin-v1-orchestrator='runtime']";
const REPRESENTATIVE_FIXTURE = "afterglow";

async function loadManifest() {
  const manifest = JSON.parse(await readFile(path.resolve(VISUAL_BASELINE_MANIFEST_PATH), "utf8"));
  if (manifest?.skin !== "skin-v1" || !manifest?.surfaces || typeof manifest.surfaces !== "object") {
    throw new Error(`Invalid Skin V1 visual baseline manifest: ${VISUAL_BASELINE_MANIFEST_PATH}`);
  }
  for (const id of WEBMCP_STANDARD_SURFACE_TARGETS) {
    const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[id];
    const entry = manifest.surfaces[id];
    if (!entry) throw new Error(`WebMCP standard surface manifest is missing ${id}.`);
    if (entry.selector !== contract.rootSelector) throw new Error(`${id} manifest selector drifted from the canonical WebMCP surface registry.`);
    if (entry.candidate !== contract.candidate) throw new Error(`${id} candidate path drifted from the canonical WebMCP surface registry.`);
    if (entry.baseline !== contract.baseline) throw new Error(`${id} baseline path drifted from the canonical WebMCP surface registry.`);
  }
  return manifest;
}

function mcpPolyfillPath(toolRoot) {
  return path.join(path.resolve(toolRoot), "node_modules", "@mcp-b", "webmcp-polyfill", "dist", "index.iife.js");
}

async function installCatalogueWebMcp(page, toolRoot) {
  await page.addScriptTag({ path: mcpPolyfillPath(toolRoot) });
  await page.evaluate(async ({ names, registry, targets }) => {
    const context = document.modelContext;
    if (!context?.registerTool || !context?.getTools) throw new Error("WebMCP document.modelContext was not installed for the standard surface catalogue.");

    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const contracts = targets.map((id) => registry[id]);
    const dashboard = registry.dashboard;
    const routeMatchesLocation = (contract) => {
      if (!contract.route) return false;
      const expected = new URL(contract.route, location.origin);
      if (expected.pathname !== location.pathname) return false;
      return [...expected.searchParams.entries()].every(([key, value]) => new URL(location.href).searchParams.get(key) === value);
    };
    const contractForRenderedSurface = () => {
      const routed = contracts.find((contract) => routeMatchesLocation(contract) && visible(document.querySelector(contract.readySelector)));
      if (routed) return routed;
      const visibleContracts = contracts
        .filter((contract) => contract.id !== "dashboard" && visible(document.querySelector(contract.readySelector)))
        .map((contract) => ({ contract, root: document.querySelector(contract.rootSelector) }))
        .filter((entry) => entry.root instanceof HTMLElement);
      const storyboardOwner = visibleContracts.find(({ contract }) => contract.id === "storyboard");
      if (storyboardOwner) return storyboardOwner.contract;
      const depth = (contract) => contract.navigationPath?.length ?? 0;
      visibleContracts.sort((left, right) => depth(right.contract) - depth(left.contract));
      const mostSpecific = visibleContracts.find(({ root }) =>
        !visibleContracts.some(({ root: otherRoot }) => root !== otherRoot && root.contains(otherRoot)));
      return mostSpecific?.contract || (visible(document.querySelector(dashboard.readySelector)) ? dashboard : null);
    };
    const currentSurface = () => contractForRenderedSurface()?.surface || "UNKNOWN";
    const currentScope = () => {
      const contract = contractForRenderedSurface();
      return contract ? document.querySelector(contract.rootSelector) : null;
    };
    const settle = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const waitVisible = async (selector, label, timeout = 10_000) => {
      const startedAt = performance.now();
      while (performance.now() - startedAt < timeout) {
        const node = document.querySelector(selector);
        if (node instanceof HTMLElement && visible(node)) return node;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      throw new Error(`${label} was not visible within ${timeout}ms.`);
    };
    const clickVisible = async (selector, label) => {
      const node = await waitVisible(selector, label);
      node.click();
      await settle();
    };
    const returnToDashboard = async () => {
      for (let depth = 0; depth < 6; depth += 1) {
        if (visible(document.querySelector(dashboard.readySelector))) return true;
        const back = [...document.querySelectorAll("button.pp-skin-v1-return")].find(visible);
        if (!(back instanceof HTMLElement)) return false;
        back.click();
        await settle();
      }
      return visible(document.querySelector(dashboard.readySelector));
    };
    const openTarget = async (surface) => {
      const normalized = String(surface || "").toLowerCase();
      const contract = registry[normalized];
      if (!contract || !targets.includes(normalized)) throw new Error(`Unsupported WebMCP standard surface target: ${normalized || "empty"}`);
      if (!(await returnToDashboard())) throw new Error(`Could not return to Dashboard before opening ${contract.label}.`);
      for (const step of contract.navigation) await clickVisible(step.selector, step.label);
      return contract;
    };
    const inspect = () => {
      const contract = contractForRenderedSurface();
      const scope = currentScope();
      if (!contract || !(scope instanceof HTMLElement)) return { surface: "UNKNOWN", ready: false };
      const rootStyle = getComputedStyle(scope);
      const html = getComputedStyle(document.documentElement);
      return {
        id: contract.id,
        surface: contract.surface,
        ready: visible(scope),
        root: {
          fontFamily: rootStyle.fontFamily,
          backgroundColor: rootStyle.backgroundColor,
          color: rootStyle.color,
          borderRadius: rootStyle.borderRadius,
        },
        tokens: {
          "--pp-skin-font-ui": html.getPropertyValue("--pp-skin-font-ui").trim(),
          "--pp-skin-radius": html.getPropertyValue("--pp-skin-radius").trim(),
          "--pp-skin-accent": html.getPropertyValue("--pp-skin-accent").trim(),
          "--pp-skin-canvas": html.getPropertyValue("--pp-skin-canvas").trim(),
        },
      };
    };

    const registrations = [
      {
        name: names[0],
        description: "Return the currently rendered PlotPickle standard surface.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => ({ surface: currentSurface() }),
      },
      {
        name: names[1],
        description: "List every standard Human-approved WebMCP capture surface.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => ({ surfaces: targets.map((id) => ({ id, label: registry[id].label, surface: registry[id].surface })) }),
      },
      {
        name: names[2],
        description: "Navigate through visible PlotPickle controls to one standard capture surface.",
        inputSchema: { type: "object", properties: { surface: { type: "string", enum: targets } }, required: ["surface"], additionalProperties: false },
        execute: async ({ surface } = {}) => {
          const contract = await openTarget(surface);
          return { requested: contract.id, surface: contract.surface };
        },
      },
      {
        name: names[3],
        description: "Use the visible PlotPickle return control to move back one surface.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          const back = [...document.querySelectorAll("button.pp-skin-v1-return")].find(visible);
          if (!(back instanceof HTMLElement)) return { moved: false, surface: currentSurface() };
          back.click();
          await settle();
          return { moved: true, surface: currentSurface() };
        },
      },
      {
        name: names[4],
        description: "Read the current standard surface visual boundary without mutating PlotPickle data.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => inspect(),
      },
    ];
    for (const registration of registrations) await context.registerTool(registration);
  }, { names: WEBMCP_TOOL_NAMES, registry: WEBMCP_STANDARD_SURFACE_REGISTRY, targets: WEBMCP_STANDARD_SURFACE_TARGETS });
}

async function executeTool(page, name, input = {}) {
  return page.evaluate(async ({ name, input }) => {
    const context = document.modelContext;
    const tools = await context.getTools();
    const tool = tools.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`WebMCP catalogue tool ${name} was not discoverable.`);
    const result = await context.executeTool(tool, JSON.stringify(input));
    if (typeof result !== "string") return result;
    try { return JSON.parse(result); } catch { return { text: result }; }
  }, { name, input });
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

async function capture(page, manifest, surface, failures) {
  const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
  const entry = manifest.surfaces[surface];
  const locator = page.locator(contract.rootSelector).first();
  await locator.waitFor({ state: "visible", timeout: contract.timeout });
  const orchestratorSurfaceId = contract.aliasSurfaceId || surface;
  const orchestrated = page.locator(`${ORCHESTRATOR_SELECTOR} [data-skin-v1-orchestrated="true"][data-skin-v1-orchestrator-active="true"][data-skin-v1-surface-id="${orchestratorSurfaceId}"]`).first();
  try {
    await orchestrated.waitFor({ state: "visible", timeout: contract.timeout });
  } catch {
    failures.push(`${contract.label} rendered without the canonical Skin V1 Surface Orchestrator contract.`);
    return;
  }
  if (surface === "dashboard") {
    const score = page.locator(DASHBOARD_SCORE_SELECTOR).first();
    try {
      await score.waitFor({ state: "visible", timeout: contract.timeout });
      await page.locator(DASHBOARD_ART_SELECTOR).first().waitFor({ state: "visible", timeout: contract.timeout });
      await page.waitForFunction(
        (selector) => {
          const image = document.querySelector(selector);
          return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
        },
        DASHBOARD_ART_SELECTOR,
        { timeout: contract.timeout },
      );
    } catch {
      failures.push("Dashboard is missing its visible Score panel or fully loaded canonical artwork; canonical visual evidence is incomplete.");
      return;
    }
  }
  const candidatePath = path.resolve(contract.candidate);
  await mkdir(path.dirname(candidatePath), { recursive: true });
  const frame = page.locator(ORCHESTRATOR_SELECTOR).first();
  await frame.screenshot({ path: candidatePath, animations: "disabled" });
  if (entry.status !== "locked") return;
  const comparisonCandidate = await locator.screenshot({ animations: "disabled" });
  let baseline;
  try {
    baseline = await readFile(path.resolve(contract.baseline));
  } catch (error) {
    if (error?.code === "ENOENT") {
      failures.push(`${contract.label} is locked but its repository baseline is missing: ${contract.baseline}`);
      return;
    }
    throw error;
  }
  const result = await comparePngPixels(page, baseline, comparisonCandidate, manifest.comparison);
  if (!result.sameDimensions) {
    failures.push(`${contract.label} changed screenshot dimensions from ${result.baselineWidth}x${result.baselineHeight} to ${result.width}x${result.height}.`);
  } else if (result.changedPixelRatio > Number(manifest.comparison.maxChangedPixelRatio)) {
    failures.push(`${contract.label} changed ${(result.changedPixelRatio * 100).toFixed(2)}% of pixels; locked tolerance is ${(Number(manifest.comparison.maxChangedPixelRatio) * 100).toFixed(2)}%.`);
  }
}

export async function runWebMcpStandardSurfaceCatalogue({ serverUrl, toolRoot, storageStatePath = "", onSurface = null } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const manifest = await loadManifest();
  const browserSession = await createBrowserVerificationSession({
    toolRoot,
    runId: "webmcp-standard-surface-catalogue",
    allowedOrigins: [server.origin],
    failOnBlockers: true,
  });
  const browser = browserSession.browser;
  const context = await browser.newContext({ viewport: manifest.viewport, ...(storageStatePath ? { storageState: storageStatePath } : {}) });
  const page = await context.newPage();
  const failures = [];
  try {
    const initialUrl = new URL("/skin-v1", server);
    initialUrl.searchParams.set("representative", REPRESENTATIVE_FIXTURE);
    const response = await page.goto(initialUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 failed to render for the standard surface catalogue: HTTP ${response?.status() ?? "no response"}`);
    await page.locator(WEBMCP_STANDARD_SURFACE_REGISTRY.dashboard.readySelector).first().waitFor({ state: "visible", timeout: 15_000 });
    await page.locator('html[data-plotpickle-representative-fixture="afterglow"]').waitFor({ state: "attached", timeout: 20_000 });
    await page.locator(`${ORCHESTRATOR_SELECTOR} [data-skin-v1-surface-id="dashboard"][data-skin-v1-orchestrator-active="true"]`).first().waitFor({ state: "visible", timeout: 20_000 });
    await installCatalogueWebMcp(page, toolRoot);

    const discovered = await page.evaluate(async () => (await document.modelContext.getTools()).map((tool) => tool.name));
    if (!WEBMCP_TOOL_NAMES.every((name) => discovered.includes(name))) failures.push("Expanded WebMCP catalogue did not expose the five bounded UAT tools.");

    const listed = await executeTool(page, WEBMCP_TOOL_NAMES[1]);
    const listedIds = Array.isArray(listed?.surfaces) ? listed.surfaces.map((item) => item.id) : [];
    if (listedIds.join(",") !== WEBMCP_STANDARD_SURFACE_TARGETS.join(",")) failures.push(`WebMCP standard registry discovery returned ${listedIds.join(",") || "nothing"}.`);

    for (const surface of WEBMCP_STANDARD_SURFACE_TARGETS) {
      const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
      await onSurface?.({ id: contract.id, label: contract.label, surface: contract.surface, route: contract.route || "/skin-v1" });
      if (contract.route) {
        const routeUrl = new URL(contract.route, server);
        routeUrl.searchParams.set("representative", REPRESENTATIVE_FIXTURE);
        const response = await page.goto(routeUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
        if (!response || response.status() >= 400) {
          failures.push(`${contract.label} route failed with HTTP ${response?.status() ?? "no response"}.`);
          continue;
        }
        try {
          await page.locator(SKIN_V1_RUNTIME_SELECTOR).waitFor({ state: "attached", timeout: contract.timeout });
          await page.locator(contract.readySelector).first().waitFor({ state: "visible", timeout: contract.timeout });
        } catch {
          failures.push(`${contract.label} could not reach its registered ready state at ${contract.route}.`);
          continue;
        }
        await installCatalogueWebMcp(page, toolRoot);
      } else {
        if (new URL(page.url()).pathname !== "/skin-v1") {
          const dashboardUrl = new URL("/skin-v1", server);
          dashboardUrl.searchParams.set("representative", REPRESENTATIVE_FIXTURE);
          const dashboardResponse = await page.goto(dashboardUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
          if (!dashboardResponse || dashboardResponse.status() >= 400) {
            failures.push(`${contract.label} could not restore the Dashboard route before visible-control navigation.`);
            continue;
          }
          await page.locator(WEBMCP_STANDARD_SURFACE_REGISTRY.dashboard.readySelector).first().waitFor({ state: "visible", timeout: 15_000 });
          await installCatalogueWebMcp(page, toolRoot);
        }
        await executeTool(page, WEBMCP_TOOL_NAMES[2], { surface });
      }
      try {
        await page.locator(contract.readySelector).first().waitFor({ state: "visible", timeout: contract.timeout });
        const orchestratorSurfaceId = contract.aliasSurfaceId || surface;
        await page.locator(`${ORCHESTRATOR_SELECTOR} [data-skin-v1-surface-id="${orchestratorSurfaceId}"][data-skin-v1-orchestrator-active="true"]`).first().waitFor({ state: "visible", timeout: contract.timeout });
      } catch {
        failures.push(`${contract.label} could not reach its registered ready state.`);
        continue;
      }
      const current = await executeTool(page, WEBMCP_TOOL_NAMES[0]);
      if (current?.surface !== contract.surface) failures.push(`${contract.label} opened as ${current?.surface || "UNKNOWN"}; expected ${contract.surface}.`);
      const visual = await executeTool(page, WEBMCP_TOOL_NAMES[4]);
      if (!visual?.ready || visual?.surface !== contract.surface) failures.push(`${contract.label} did not expose its registered visual boundary.`);
      await capture(page, manifest, surface, failures);
      await browserSession.checkpoint(page, {
        surfaceId: contract.id,
        route: contract.route ? new URL(contract.route, server).toString() : new URL("/skin-v1", server).toString(),
        actionId: "capture-standard-surface",
        checkpoint: "governed-surface-ready",
      });
    }
  } finally {
    await context.close();
    await browserSession.close();
  }

  if (failures.length) throw new Error(`WebMCP standard surface catalogue failed:\n- ${failures.join("\n- ")}`);
  const locked = WEBMCP_STANDARD_SURFACE_TARGETS.filter((surface) => manifest.surfaces[surface]?.status === "locked").length;
  console.log(`WebMCP standard surface catalogue captured ${WEBMCP_STANDARD_SURFACE_TARGETS.length} surfaces; ${locked} locked baselines enforced.`);
  return { surfaces: WEBMCP_STANDARD_SURFACE_TARGETS.length, locked };
}
