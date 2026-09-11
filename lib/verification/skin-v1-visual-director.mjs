#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateLocalServer, waitForUiServer } from "./ui-axe-audit.mjs";

export const VISUAL_DIRECTOR_REPORT_PATH = ".artifacts/visual-readiness/visual-director-report.json";

const SURFACES = Object.freeze([
  "dashboard",
  "community",
  "settings",
  "cloud-story-mode",
  "agents",
  "profile",
  "local-ai",
  "node",
]);

const READINESS = Object.freeze({
  dashboard: "[data-skin-reference='dashboard-canonical']",
  community: "section[aria-label='PlotPickle Community'] .pp-skin-v1-community",
  settings: "section[aria-label='Settings menu'][data-settings-menu='keyboard-directory']",
  "cloud-story-mode": "section[aria-label='Cloud Story Mode setup'] [data-skin-v1-cloud-story-mode='true']",
  agents: "section[aria-label='PlotPickle Agents setup'] [data-skin-v1-plotpickle-agents='true']",
  profile: "section[aria-label='Profile menu'] .pp-skin-v1-bbs",
  "local-ai": "section[aria-label='Local Story Mode setup'] [data-skin-v1-local-ai='true'], section[aria-label='Local AI setup'] [data-skin-v1-local-ai='true']",
  node: "section[aria-label='Node information'] [data-skin-v1-node='true'][data-node-readiness='ready']",
});

const ROOT_SELECTORS = Object.freeze({
  dashboard: "section[aria-label='PlotPickle Dashboard']",
  community: "section[aria-label='PlotPickle Community']",
  settings: "section[aria-label='Settings menu']",
  "cloud-story-mode": "section[aria-label='Cloud Story Mode setup']",
  agents: "section[aria-label='PlotPickle Agents setup']",
  profile: "section[aria-label='Profile menu']",
  "local-ai": "section[aria-label='Local Story Mode setup'], section[aria-label='Local AI setup']",
  node: "section[aria-label='Node information']",
});

const COLOR_TOKENS = Object.freeze([
  "--pp-skin-canvas",
  "--pp-skin-surface-0",
  "--pp-skin-surface-1",
  "--pp-skin-surface-2",
  "--pp-skin-surface-3",
  "--pp-skin-surface-4",
  "--pp-skin-surface-highlight",
  "--pp-skin-ink",
  "--pp-skin-ink-soft",
  "--pp-skin-ink-muted",
  "--pp-skin-line",
  "--pp-skin-line-soft",
  "--pp-skin-line-strong",
  "--pp-skin-accent-deep",
  "--pp-skin-accent",
  "--pp-skin-accent-bright",
  "--pp-skin-focus",
  "--pp-skin-selected-bg",
  "--pp-skin-selected-ink",
  "--pp-skin-disabled",
  "--pp-skin-shadow-ink",
  "--pp-skin-warning-surface",
  "--pp-skin-warning-line",
  "--pp-skin-warning",
  "--pp-skin-warning-ink",
  "--pp-skin-danger-surface",
  "--pp-skin-danger-line",
  "--pp-skin-danger",
]);

const CONTRACT_TOKENS = Object.freeze([
  "--pp-skin-radius",
  "--pp-skin-border-thin",
  "--pp-skin-border-strong",
  "--pp-skin-control-height",
  "--pp-skin-space-1",
  "--pp-skin-font-ui",
  "--pp-skin-font-brand",
  "--pp-skin-font-title",
  "--pp-skin-font-brand-size",
]);

function numericPx(value) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isTransparent(value) {
  const normalized = normalize(value);
  return !normalized || normalized === "transparent" || normalized === "rgba(0, 0, 0, 0)";
}

function isFourPixelStep(value) {
  const px = numericPx(value);
  if (px === null || px === 0) return true;
  return Math.abs(px / 4 - Math.round(px / 4)) < 0.01;
}

function median(values) {
  const ordered = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function itemColors(item) {
  const presentation = item.presentation || {};
  return [
    ["color", presentation.color],
    ["backgroundColor", presentation.backgroundColor],
    ["borderTopColor", presentation.borderTopColor],
  ];
}

function maxBorderWidth(item) {
  const presentation = item.presentation || {};
  return Math.max(0, ...[
    presentation.borderTopWidth,
    presentation.borderRightWidth,
    presentation.borderBottomWidth,
    presentation.borderLeftWidth,
  ].map((value) => numericPx(value) || 0));
}

function makeFinding(surface, severity, category, item, property, actual, expected, guidance) {
  return {
    surface,
    severity,
    category,
    identity: item?.identity || surface,
    property,
    actual: String(actual ?? ""),
    expected: String(expected ?? ""),
    guidance,
  };
}

export function analyzeVisualContinuity(reference, candidate) {
  if (!reference || reference.surface !== "DASHBOARD") throw new Error("Visual Director requires DASHBOARD as its canonical reference profile.");
  if (!candidate?.surface) throw new Error("Visual Director requires a candidate surface profile.");
  if (candidate.surface === "DASHBOARD") return [];

  const findings = [];
  const referenceItems = Array.isArray(reference.items) ? reference.items : [];
  const candidateItems = Array.isArray(candidate.items) ? candidate.items : [];
  const referenceFamilies = new Set([
    normalize(reference.root?.fontFamily),
    ...referenceItems.map((item) => normalize(item.presentation?.fontFamily)),
  ].filter(Boolean));
  const referencePalette = new Set([
    ...Object.values(reference.resolvedColors || {}).map(normalize),
    ...referenceItems.flatMap((item) => itemColors(item).map(([, value]) => normalize(value))),
  ].filter((value) => value && !isTransparent(value)));
  const expectedRadius = reference.tokens?.["--pp-skin-radius"] || "0px";
  const expectedStrongBorder = numericPx(reference.tokens?.["--pp-skin-border-strong"]) ?? 2;

  const foreignFonts = candidateItems.filter((item) => {
    const family = normalize(item.presentation?.fontFamily);
    return family && !referenceFamilies.has(family);
  });
  for (const item of foreignFonts.slice(0, 5)) {
    findings.push(makeFinding(
      candidate.surface,
      "blocker",
      "typography",
      item,
      "fontFamily",
      item.presentation?.fontFamily,
      "Dashboard typography vocabulary",
      "Use the same Skin V1 UI or brand typography demonstrated by Dashboard; do not introduce a local surface font.",
    ));
  }

  const radiusBreaks = candidateItems.filter((item) =>
    ["surface", "panel", "control", "pill"].includes(item.role)
      && item.presentation?.borderRadius
      && item.presentation.borderRadius !== expectedRadius);
  for (const item of radiusBreaks.slice(0, 5)) {
    findings.push(makeFinding(
      candidate.surface,
      "blocker",
      "geometry",
      item,
      "borderRadius",
      item.presentation?.borderRadius,
      expectedRadius,
      "Return this component to Dashboard/Skin V1 square geometry.",
    ));
  }

  const heavyBorders = candidateItems.filter((item) =>
    ["surface", "panel", "control"].includes(item.role) && maxBorderWidth(item) > expectedStrongBorder + 0.5);
  for (const item of heavyBorders.slice(0, 5)) {
    findings.push(makeFinding(
      candidate.surface,
      "blocker",
      "border-treatment",
      item,
      "borderWidth",
      `${maxBorderWidth(item)}px`,
      `<= ${expectedStrongBorder}px Dashboard strong border`,
      "Use the Dashboard thin/strong border vocabulary instead of creating a heavier local frame.",
    ));
  }

  const offPalette = [];
  for (const item of candidateItems) {
    for (const [property, value] of itemColors(item)) {
      const normalized = normalize(value);
      if (normalized && !isTransparent(normalized) && !referencePalette.has(normalized)) {
        offPalette.push({ item, property, value });
      }
    }
  }
  if (offPalette.length) {
    const first = offPalette[0];
    findings.push(makeFinding(
      candidate.surface,
      "advisory",
      "palette",
      first.item,
      first.property,
      first.value,
      "Dashboard/Skin V1 palette token",
      `${offPalette.length} rendered colour use${offPalette.length === 1 ? " is" : "s are"} outside Dashboard's canonical palette. Replace local colours with Skin V1 tokens unless the state is intentionally exceptional.`,
    ));
  }

  const offGrid = [];
  for (const item of candidateItems) {
    for (const property of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
      const value = item.presentation?.[property];
      if (value && !isFourPixelStep(value)) offGrid.push({ item, property, value });
    }
  }
  if (offGrid.length) {
    const first = offGrid[0];
    findings.push(makeFinding(
      candidate.surface,
      "advisory",
      "spacing-rhythm",
      first.item,
      first.property,
      first.value,
      "4px Dashboard/Skin V1 spacing grid",
      `${offGrid.length} padding value${offGrid.length === 1 ? " is" : "s are"} off the canonical four-pixel rhythm. Move them onto Skin V1 spacing tokens to restore cross-screen cadence.`,
    ));
  }

  const referencePanels = referenceItems.filter((item) => item.role === "panel");
  const candidatePanels = candidateItems.filter((item) => item.role === "panel");
  const referenceUsesSteppedFill = referencePanels.some((item) => item.presentation?.backgroundImage && item.presentation.backgroundImage !== "none");
  const flatPanels = candidatePanels.filter((item) => !item.presentation?.backgroundImage || item.presentation.backgroundImage === "none");
  if (referenceUsesSteppedFill && flatPanels.length) {
    findings.push(makeFinding(
      candidate.surface,
      "advisory",
      "panel-treatment",
      flatPanels[0],
      "backgroundImage",
      flatPanels[0].presentation?.backgroundImage || "none",
      "Dashboard stepped Skin V1 panel fill",
      `${flatPanels.length} panel${flatPanels.length === 1 ? " is" : "s are"} visually flatter than Dashboard. Reuse the canonical stepped panel/header fills where the component is meant to be a standard Skin V1 panel.`,
    ));
  }

  const referenceHeadings = referenceItems.filter((item) => item.role === "heading");
  const candidateHeadings = candidateItems.filter((item) => item.role === "heading");
  const referenceHeadingSizes = referenceHeadings.map((item) => numericPx(item.presentation?.fontSize)).filter(Number.isFinite);
  const candidateHeadingSizes = candidateHeadings.map((item) => numericPx(item.presentation?.fontSize)).filter(Number.isFinite);
  const referenceMax = Math.max(0, ...referenceHeadingSizes);
  const candidateMax = Math.max(0, ...candidateHeadingSizes);
  if (referenceMax > 0 && candidateMax > referenceMax * 1.25) {
    const item = candidateHeadings.find((entry) => numericPx(entry.presentation?.fontSize) === candidateMax);
    findings.push(makeFinding(
      candidate.surface,
      "advisory",
      "hierarchy",
      item,
      "fontSize",
      `${candidateMax}px`,
      `<= ${Math.round(referenceMax * 1.25)}px relative to Dashboard hierarchy`,
      "Reduce this heading so the submenu does not visually outrank Dashboard's canonical hierarchy.",
    ));
  }
  if (referenceMax > 0 && candidateMax > 0) {
    const referenceDominant = referenceHeadingSizes.filter((size) => size >= referenceMax * 0.9).length;
    const candidateDominant = candidateHeadingSizes.filter((size) => size >= candidateMax * 0.9).length;
    if (candidateDominant > Math.max(1, referenceDominant + 1)) {
      findings.push(makeFinding(
        candidate.surface,
        "advisory",
        "hierarchy",
        candidateHeadings[0],
        "dominantHeadingCount",
        candidateDominant,
        `approximately ${referenceDominant || 1} dominant Dashboard heading`,
        "Too many headings are competing at the top visual level. Keep one dominant page title and demote secondary headings.",
      ));
    }
  }

  const referenceWidth = numericPx(reference.root?.width);
  const candidateWidth = numericPx(candidate.root?.width);
  if (referenceWidth && candidateWidth && candidateWidth < referenceWidth * 0.7) {
    findings.push(makeFinding(
      candidate.surface,
      "advisory",
      "layout-measure",
      { identity: candidate.surface },
      "width",
      `${candidateWidth}px`,
      `closer to Dashboard's ${referenceWidth}px canonical measure`,
      "This surface is materially narrower than Dashboard. Verify that the narrower measure is intentional; otherwise reuse the canonical shell/menu width so adjacent screens feel related.",
    ));
  }

  const referenceControlMedian = median(referenceItems
    .filter((item) => item.role === "control")
    .map((item) => numericPx(item.presentation?.height)));
  const candidateControlMedian = median(candidateItems
    .filter((item) => item.role === "control")
    .map((item) => numericPx(item.presentation?.height)));
  if (referenceControlMedian && candidateControlMedian && candidateControlMedian > referenceControlMedian * 1.6) {
    findings.push(makeFinding(
      candidate.surface,
      "advisory",
      "control-density",
      { identity: candidate.surface },
      "medianControlHeight",
      `${candidateControlMedian}px`,
      `near Dashboard's ${referenceControlMedian}px control rhythm`,
      "Controls are substantially taller than Dashboard's typical rhythm. Reduce padding/row height unless the larger target is required by the interaction.",
    ));
  }

  return findings;
}

async function loadChromium(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned CI-only verification install.");
  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  return toolRequire("@playwright/test").chromium;
}

function contextOptions(storageStatePath) {
  return storageStatePath ? { storageState: storageStatePath } : {};
}

async function clickVisible(page, selector, label) {
  const locator = page.locator(selector).filter({ visible: true }).first();
  if (!(await locator.count())) throw new Error(`${label} was not visible.`);
  await locator.click();
}

async function clickButtonContaining(page, text) {
  const button = page.locator("button:visible").filter({ hasText: text }).first();
  if (!(await button.count())) throw new Error(`Visible button containing ${text} was not found.`);
  await button.click();
}

async function goBack(page) {
  await clickVisible(page, "button.pp-skin-v1-return:visible", "Skin V1 return control");
}

async function goDashboard(page) {
  const dashboardButton = page.locator("button.pp-skin-v1-return:visible").filter({ hasText: "Dashboard" }).first();
  if (await dashboardButton.count()) await dashboardButton.click();
  await page.locator(READINESS.dashboard).first().waitFor({ state: "visible", timeout: 15_000 });
}

async function collectProfile(page, surface) {
  await page.locator(READINESS[surface]).first().waitFor({ state: "visible", timeout: 30_000 });
  return page.evaluate(({ surfaceName, rootSelector, colorTokens, contractTokens }) => {
    const root = document.querySelector(rootSelector);
    if (!(root instanceof HTMLElement)) throw new Error(`Visual Director could not resolve ${surfaceName} root.`);
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const semanticRole = (node) => {
      const explicit = node.getAttribute("data-skin-role");
      if (explicit) return explicit;
      if (node.matches("h1, h2, h3, h4, h5, h6, [role='heading'], .pp-skin-v1-title, .pp-skin-v1-bar, .pp-skin-v1-bbs-banner")) return "heading";
      if (node.matches(".pp-skin-v1-panel, .pp-skin-v1-bbs")) return "panel";
      if (node.matches("button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='tab'], [role='menuitem'], [role='option']")) return "control";
      if (node.matches("[role='status'], [role='alert'], [aria-live], .pp-skin-v1-status")) return "status";
      if (node.matches("p, label, small")) return "body";
      return "surface";
    };
    const identity = (node, index) => node.getAttribute("data-skin-id")
      || node.getAttribute("data-dashboard-menu-item")
      || node.getAttribute("data-settings-secondary-item")
      || node.id
      || node.getAttribute("aria-label")
      || node.getAttribute("name")
      || `${node.tagName.toLowerCase()}#${index}`;
    const presentation = (node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        borderRadius: style.borderRadius,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderTopColor: style.borderTopColor,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        width: `${box.width}px`,
        height: `${box.height}px`,
      };
    };
    const selector = [
      ".pp-skin-v1-panel",
      ".pp-skin-v1-bbs",
      "[data-skin-role]",
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
      ".pp-skin-v1-title",
      ".pp-skin-v1-bar",
      ".pp-skin-v1-bbs-banner",
      "[role='status']",
      "[role='alert']",
      "[aria-live]",
      ".pp-skin-v1-status",
      "p",
      "label",
      "small",
    ].join(",");
    const nodes = [...new Set([root, ...root.querySelectorAll(selector)])].filter(visible);
    const html = getComputedStyle(document.documentElement);
    const resolvedColors = {};
    for (const token of colorTokens) {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      probe.style.display = "none";
      document.body.appendChild(probe);
      resolvedColors[token] = getComputedStyle(probe).color;
      probe.remove();
    }
    return {
      surface: surfaceName.toUpperCase().replaceAll("-", "_"),
      root: presentation(root),
      tokens: Object.fromEntries([...colorTokens, ...contractTokens].map((name) => [name, html.getPropertyValue(name).trim()])),
      resolvedColors,
      items: nodes.map((node, index) => ({ role: semanticRole(node), identity: identity(node, index), presentation: presentation(node) })),
    };
  }, { surfaceName: surface, rootSelector: ROOT_SELECTORS[surface], colorTokens: COLOR_TOKENS, contractTokens: CONTRACT_TOKENS });
}

async function navigateAndCollect(page, surface) {
  if (surface === "dashboard") return collectProfile(page, surface);
  if (surface === "community" || surface === "settings" || surface === "profile") {
    await goDashboard(page);
    await clickVisible(page, `[data-dashboard-menu-item='${surface}']`, `${surface} Dashboard row`);
    return collectProfile(page, surface);
  }
  if (surface === "cloud-story-mode" || surface === "agents") {
    await goDashboard(page);
    await clickVisible(page, "[data-dashboard-menu-item='settings']", "Settings Dashboard row");
    await page.locator(READINESS.settings).first().waitFor({ state: "visible", timeout: 15_000 });
    await clickVisible(page, `[data-settings-secondary-item='${surface === "cloud-story-mode" ? "cloud" : "agents"}']`, `${surface} Settings row`);
    return collectProfile(page, surface);
  }
  if (surface === "local-ai" || surface === "node") {
    await goDashboard(page);
    await clickVisible(page, "[data-dashboard-menu-item='profile']", "Profile Dashboard row");
    await page.locator(READINESS.profile).first().waitFor({ state: "visible", timeout: 15_000 });
    await clickButtonContaining(page, surface === "local-ai" ? "LOCAL STORY MODE" : "NODE");
    return collectProfile(page, surface);
  }
  throw new Error(`Unsupported Visual Director surface: ${surface}`);
}

export async function runSkinV1VisualDirector({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const chromium = await loadChromium(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, ...contextOptions(storageStatePath) });
  const page = await context.newPage();
  const profiles = {};
  const surfaces = {};
  try {
    const response = await page.goto(new URL("/skin-v1", server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 failed to render: HTTP ${response?.status() ?? "no response"}`);
    profiles.dashboard = await navigateAndCollect(page, "dashboard");
    for (const surface of SURFACES.slice(1)) {
      const profile = await navigateAndCollect(page, surface);
      profiles[surface] = profile;
      const findings = analyzeVisualContinuity(profiles.dashboard, profile);
      surfaces[surface] = {
        blockers: findings.filter((finding) => finding.severity === "blocker").length,
        advisories: findings.filter((finding) => finding.severity === "advisory").length,
        findings,
      };
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const report = {
    version: 1,
    skin: "skin-v1",
    canonicalReference: "dashboard",
    rule: "A target surface is judged against Dashboard's rendered visual language; its own historical screenshot is regression evidence only.",
    totals: {
      surfaces: SURFACES.length - 1,
      blockers: Object.values(surfaces).reduce((sum, entry) => sum + entry.blockers, 0),
      advisories: Object.values(surfaces).reduce((sum, entry) => sum + entry.advisories, 0),
    },
    surfaces,
  };
  const reportPath = path.resolve(VISUAL_DIRECTOR_REPORT_PATH);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Visual Director compared ${report.totals.surfaces} surfaces against Dashboard: ${report.totals.blockers} blocker(s), ${report.totals.advisories} advisory finding(s).`);
  for (const [surface, entry] of Object.entries(surfaces)) {
    for (const finding of entry.findings) {
      console.log(`VISUAL-DIRECTOR ${finding.severity.toUpperCase()} ${surface} ${finding.category}: ${finding.guidance} [${finding.identity}; ${finding.property}: ${finding.actual} -> ${finding.expected}]`);
    }
  }
  console.log(`Visual Director report: ${VISUAL_DIRECTOR_REPORT_PATH}`);
  if (report.totals.blockers > 0) throw new Error(`Visual Director gate failed with ${report.totals.blockers} blocking Dashboard-continuity finding(s).`);
  return report;
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const serverIndex = process.argv.indexOf("--server");
  const toolRootIndex = process.argv.indexOf("--tool-root");
  const storageStateIndex = process.argv.indexOf("--storage-state");
  runSkinV1VisualDirector({
    serverUrl: serverIndex >= 0 ? process.argv[serverIndex + 1] : "http://127.0.0.1:4173",
    toolRoot: toolRootIndex >= 0 ? process.argv[toolRootIndex + 1] : "",
    storageStatePath: storageStateIndex >= 0 ? process.argv[storageStateIndex + 1] : "",
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
