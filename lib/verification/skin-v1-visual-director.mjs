#!/usr/bin/env node

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { validateLocalServer, waitForUiServer } from "./ui-axe-audit.mjs";

export const VISUAL_DIRECTOR_REPORT_PATH = ".artifacts/visual-readiness/visual-director-report.json";

const SURFACES = ["dashboard", "community", "settings", "cloud-story-mode", "agents", "profile", "local-ai", "node"];
const READINESS = {
  dashboard: "[data-skin-reference='dashboard-canonical']",
  community: "section[aria-label='PlotPickle Community'] .pp-skin-v1-community",
  settings: "section[aria-label='Settings menu'][data-settings-menu='keyboard-directory']",
  "cloud-story-mode": "section[aria-label='Cloud Story Mode setup'] [data-skin-v1-cloud-story-mode='true']",
  agents: "section[aria-label='PlotPickle Agents setup'] [data-skin-v1-plotpickle-agents='true']",
  profile: "section[aria-label='User Profile'].pp-skin-v1-profile-surface",
  "local-ai": "section[aria-label='Local Story Mode setup'] [data-skin-v1-local-ai='true'], section[aria-label='Local AI setup'] [data-skin-v1-local-ai='true']",
  node: "section[aria-label='Node information'] [data-skin-v1-node='true'][data-node-readiness='ready']",
};
const ROOTS = {
  dashboard: "section[aria-label='PlotPickle Dashboard']",
  community: "section[aria-label='PlotPickle Community']",
  settings: "section[aria-label='Settings menu']",
  "cloud-story-mode": "section[aria-label='Cloud Story Mode setup']",
  agents: "section[aria-label='PlotPickle Agents setup']",
  profile: "section[aria-label='User Profile'].pp-skin-v1-profile-surface",
  "local-ai": "section[aria-label='Local Story Mode setup'], section[aria-label='Local AI setup']",
  node: "section[aria-label='Node information']",
};
const COLOR_TOKENS = [
  "--pp-skin-canvas", "--pp-skin-surface-0", "--pp-skin-surface-1", "--pp-skin-surface-2", "--pp-skin-surface-3",
  "--pp-skin-surface-4", "--pp-skin-surface-highlight", "--pp-skin-ink", "--pp-skin-ink-soft", "--pp-skin-ink-muted",
  "--pp-skin-line", "--pp-skin-line-soft", "--pp-skin-line-strong", "--pp-skin-accent-deep", "--pp-skin-accent",
  "--pp-skin-accent-bright", "--pp-skin-focus", "--pp-skin-selected-bg", "--pp-skin-selected-ink", "--pp-skin-disabled",
  "--pp-skin-warning-surface", "--pp-skin-warning-line", "--pp-skin-warning", "--pp-skin-warning-ink",
  "--pp-skin-danger-surface", "--pp-skin-danger-line", "--pp-skin-danger",
];
const CONTRACT_TOKENS = ["--pp-skin-radius", "--pp-skin-border-strong", "--pp-skin-control-height", "--pp-skin-space-1"];

function px(value) {
  const result = Number.parseFloat(String(value || ""));
  return Number.isFinite(result) ? result : null;
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function transparent(value) {
  const text = normalize(value);
  return !text || text === "transparent" || text === "rgba(0, 0, 0, 0)";
}

function fourPixelStep(value) {
  const valuePx = px(value);
  return valuePx === null || valuePx === 0 || Math.abs(valuePx / 4 - Math.round(valuePx / 4)) < 0.01;
}

function median(values) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function finding(surface, severity, category, item, property, actual, expected, guidance) {
  return { surface, severity, category, identity: item?.identity || surface, property, actual: String(actual ?? ""), expected: String(expected ?? ""), guidance };
}

function itemColors(item) {
  const p = item.presentation || {};
  return [["color", p.color], ["backgroundColor", p.backgroundColor], ["borderTopColor", p.borderTopColor]];
}

function maxBorder(item) {
  const p = item.presentation || {};
  return Math.max(0, ...[p.borderTopWidth, p.borderRightWidth, p.borderBottomWidth, p.borderLeftWidth].map((value) => px(value) || 0));
}

export function analyzeVisualContinuity(reference, candidate) {
  if (reference?.surface !== "DASHBOARD") throw new Error("Visual Director requires DASHBOARD as its canonical reference profile.");
  if (!candidate?.surface) throw new Error("Visual Director requires a candidate surface profile.");
  if (candidate.surface === "DASHBOARD") return [];

  const output = [];
  const referenceItems = reference.items || [];
  const candidateItems = candidate.items || [];
  const allowedFamilies = new Set([normalize(reference.root?.fontFamily), ...referenceItems.map((item) => normalize(item.presentation?.fontFamily))].filter(Boolean));
  const allowedPalette = new Set([
    ...Object.values(reference.resolvedColors || {}).map(normalize),
    ...referenceItems.flatMap((item) => itemColors(item).map(([, value]) => normalize(value))),
  ].filter((value) => value && !transparent(value)));
  const expectedRadius = reference.tokens?.["--pp-skin-radius"] || "0px";
  const strongBorder = px(reference.tokens?.["--pp-skin-border-strong"]) ?? 2;

  for (const item of candidateItems.filter((entry) => {
    const family = normalize(entry.presentation?.fontFamily);
    return family && !allowedFamilies.has(family);
  }).slice(0, 5)) {
    output.push(finding(candidate.surface, "blocker", "typography", item, "fontFamily", item.presentation?.fontFamily, "Dashboard typography vocabulary", "Use the same Skin V1 UI or brand typography demonstrated by Dashboard; do not introduce a local surface font."));
  }

  for (const item of candidateItems.filter((entry) => ["surface", "panel", "control"].includes(entry.role) && entry.presentation?.borderRadius && entry.presentation.borderRadius !== expectedRadius).slice(0, 5)) {
    output.push(finding(candidate.surface, "blocker", "geometry", item, "borderRadius", item.presentation?.borderRadius, expectedRadius, "Return this component to Dashboard/Skin V1 square geometry."));
  }

  for (const item of candidateItems.filter((entry) => ["surface", "panel", "control"].includes(entry.role) && maxBorder(entry) > strongBorder + 0.5).slice(0, 5)) {
    output.push(finding(candidate.surface, "blocker", "border-treatment", item, "borderWidth", `${maxBorder(item)}px`, `<= ${strongBorder}px Dashboard strong border`, "Use the Dashboard thin/strong border vocabulary instead of creating a heavier local frame."));
  }

  const offPalette = [];
  for (const item of candidateItems) {
    for (const [property, value] of itemColors(item)) {
      const normalized = normalize(value);
      if (normalized && !transparent(normalized) && !allowedPalette.has(normalized)) offPalette.push({ item, property, value });
    }
  }
  if (offPalette.length) {
    const first = offPalette[0];
    output.push(finding(candidate.surface, "advisory", "palette", first.item, first.property, first.value, "Dashboard/Skin V1 palette token", `${offPalette.length} rendered colour use${offPalette.length === 1 ? " is" : "s are"} outside Dashboard's canonical palette. Replace local colours with Skin V1 tokens unless the state is intentionally exceptional.`));
  }

  const offGrid = [];
  for (const item of candidateItems) {
    for (const property of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
      const value = item.presentation?.[property];
      if (value && !fourPixelStep(value)) offGrid.push({ item, property, value });
    }
  }
  if (offGrid.length) {
    const first = offGrid[0];
    output.push(finding(candidate.surface, "advisory", "spacing-rhythm", first.item, first.property, first.value, "4px Dashboard/Skin V1 spacing grid", `${offGrid.length} padding value${offGrid.length === 1 ? " is" : "s are"} off the canonical four-pixel rhythm. Move them onto Skin V1 spacing tokens to restore cross-screen cadence.`));
  }

  const referencePanels = referenceItems.filter((item) => item.role === "panel");
  const flatPanels = candidateItems.filter((item) => item.role === "panel" && (!item.presentation?.backgroundImage || item.presentation.backgroundImage === "none"));
  if (referencePanels.some((item) => item.presentation?.backgroundImage && item.presentation.backgroundImage !== "none") && flatPanels.length) {
    output.push(finding(candidate.surface, "advisory", "panel-treatment", flatPanels[0], "backgroundImage", flatPanels[0].presentation?.backgroundImage || "none", "Dashboard stepped Skin V1 panel fill", `${flatPanels.length} panel${flatPanels.length === 1 ? " is" : "s are"} visually flatter than Dashboard. Reuse the canonical stepped panel/header fills where the component is meant to be a standard Skin V1 panel.`));
  }

  const refHeadings = referenceItems.filter((item) => item.role === "heading");
  const candidateHeadings = candidateItems.filter((item) => item.role === "heading");
  const refSizes = refHeadings.map((item) => px(item.presentation?.fontSize)).filter(Number.isFinite);
  const candidateSizes = candidateHeadings.map((item) => px(item.presentation?.fontSize)).filter(Number.isFinite);
  const refMax = Math.max(0, ...refSizes);
  const candidateMax = Math.max(0, ...candidateSizes);
  if (refMax && candidateMax > refMax * 1.25) {
    const item = candidateHeadings.find((entry) => px(entry.presentation?.fontSize) === candidateMax);
    output.push(finding(candidate.surface, "advisory", "hierarchy", item, "fontSize", `${candidateMax}px`, `<= ${Math.round(refMax * 1.25)}px relative to Dashboard hierarchy`, "Reduce this heading so the submenu does not visually outrank Dashboard's canonical hierarchy."));
  }
  if (refMax && candidateMax) {
    const refDominant = refSizes.filter((size) => size >= refMax * 0.9).length;
    const candidateDominant = candidateSizes.filter((size) => size >= candidateMax * 0.9).length;
    if (candidateDominant > Math.max(1, refDominant + 1)) {
      output.push(finding(candidate.surface, "advisory", "hierarchy", candidateHeadings[0], "dominantHeadingCount", candidateDominant, `approximately ${refDominant || 1} dominant Dashboard heading`, "Too many headings are competing at the top visual level. Keep one dominant page title and demote secondary headings."));
    }
  }

  const refWidth = px(reference.root?.width);
  const candidateWidth = px(candidate.root?.width);
  if (refWidth && candidateWidth && candidateWidth < refWidth * 0.7) {
    output.push(finding(candidate.surface, "advisory", "layout-measure", null, "width", `${candidateWidth}px`, `closer to Dashboard's ${refWidth}px canonical measure`, "This surface is materially narrower than Dashboard. Verify that the narrower measure is intentional; otherwise reuse the canonical shell/menu width so adjacent screens feel related."));
  }

  const refControlMedian = median(referenceItems.filter((item) => item.role === "control").map((item) => px(item.presentation?.height)));
  const candidateControlMedian = median(candidateItems.filter((item) => item.role === "control").map((item) => px(item.presentation?.height)));
  if (refControlMedian && candidateControlMedian && candidateControlMedian > refControlMedian * 1.6) {
    output.push(finding(candidate.surface, "advisory", "control-density", null, "medianControlHeight", `${candidateControlMedian}px`, `near Dashboard's ${refControlMedian}px control rhythm`, "Controls are substantially taller than Dashboard's typical rhythm. Reduce padding/row height unless the larger target is required by the interaction."));
  }
  return output;
}

async function chromiumFor(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned CI-only verification install.");
  return createRequire(path.join(path.resolve(toolRoot), "package.json"))("@playwright/test").chromium;
}

async function visibleClick(page, selector, label) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 15_000 }).catch(() => { throw new Error(`${label} was not visible.`); });
  await locator.click();
}

async function goDashboard(page) {
  for (let depth = 0; depth < 4; depth += 1) {
    if (await page.locator(READINESS.dashboard).first().isVisible().catch(() => false)) return;
    const direct = page.locator("button.pp-skin-v1-return:visible").filter({ hasText: "Dashboard" }).first();
    if (await direct.count()) {
      await direct.click();
    } else {
      const back = page.locator("button.pp-skin-v1-return:visible").first();
      if (!(await back.count())) break;
      await back.click();
    }
    await page.waitForTimeout(50);
  }
  await page.locator(READINESS.dashboard).first().waitFor({ state: "visible", timeout: 15_000 });
}

async function collectProfile(page, surface) {
  await page.locator(READINESS[surface]).first().waitFor({ state: "visible", timeout: 30_000 });
  return page.evaluate(({ surface, rootSelector, colorTokens, contractTokens }) => {
    const root = document.querySelector(rootSelector);
    if (!(root instanceof HTMLElement)) throw new Error(`Visual Director could not resolve ${surface} root.`);
    const visible = (node) => node instanceof HTMLElement && getComputedStyle(node).display !== "none" && getComputedStyle(node).visibility !== "hidden" && node.getClientRects().length > 0;
    const role = (node) => {
      if (node.matches("h1,h2,h3,h4,h5,h6,[role='heading'],.pp-skin-v1-title,.pp-skin-v1-bar,.pp-skin-v1-bbs-banner")) return "heading";
      if (node.matches(".pp-skin-v1-panel,.pp-skin-v1-bbs,[data-skin-role='panel']")) return "panel";
      if (node.matches("button,a[href],input:not([type='hidden']),select,textarea,[role='button'],[role='tab'],[role='menuitem'],[role='option']")) return "control";
      if (node.matches("[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status")) return "status";
      if (node.matches("p,label,small")) return "body";
      return node.getAttribute("data-skin-role") || "surface";
    };
    const identity = (node, index) => node.getAttribute("data-skin-id") || node.getAttribute("data-dashboard-menu-item") || node.getAttribute("data-settings-secondary-item") || node.id || node.getAttribute("aria-label") || node.getAttribute("name") || `${node.tagName.toLowerCase()}#${index}`;
    const presentation = (node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        fontFamily: style.fontFamily, fontSize: style.fontSize, color: style.color, backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage, borderRadius: style.borderRadius, borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth, borderBottomWidth: style.borderBottomWidth, borderLeftWidth: style.borderLeftWidth,
        borderTopColor: style.borderTopColor, paddingTop: style.paddingTop, paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom, paddingLeft: style.paddingLeft, width: `${box.width}px`, height: `${box.height}px`,
      };
    };
    const selector = ".pp-skin-v1-panel,.pp-skin-v1-bbs,[data-skin-role],button,a[href],input:not([type='hidden']),select,textarea,[role='button'],[role='tab'],[role='menuitem'],[role='option'],h1,h2,h3,h4,h5,h6,[role='heading'],.pp-skin-v1-title,.pp-skin-v1-bar,.pp-skin-v1-bbs-banner,[role='status'],[role='alert'],[aria-live],.pp-skin-v1-status,p,label,small";
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
      surface: surface.toUpperCase().replaceAll("-", "_"), root: presentation(root), resolvedColors,
      tokens: Object.fromEntries([...colorTokens, ...contractTokens].map((name) => [name, html.getPropertyValue(name).trim()])),
      items: nodes.map((node, index) => ({ role: role(node), identity: identity(node, index), presentation: presentation(node) })),
    };
  }, { surface, rootSelector: ROOTS[surface], colorTokens: COLOR_TOKENS, contractTokens: CONTRACT_TOKENS });
}

async function navigateAndCollect(page, surface) {
  if (surface === "dashboard") return collectProfile(page, surface);
  await goDashboard(page);
  if (["community", "settings", "profile"].includes(surface)) {
    await visibleClick(page, `[data-dashboard-menu-item='${surface}']`, `${surface} Dashboard row`);
  } else if (["cloud-story-mode", "agents"].includes(surface)) {
    await visibleClick(page, "[data-dashboard-menu-item='settings']", "Settings Dashboard row");
    await page.locator(READINESS.settings).first().waitFor({ state: "visible", timeout: 15_000 });
    await visibleClick(page, `[data-settings-secondary-item='${surface === "cloud-story-mode" ? "cloud" : "agents"}']`, `${surface} Settings row`);
  } else if (["local-ai", "node"].includes(surface)) {
    await visibleClick(page, "[data-dashboard-menu-item='settings']", "Settings Dashboard row");
    await page.locator(READINESS.settings).first().waitFor({ state: "visible", timeout: 15_000 });
    await visibleClick(page, `[data-settings-secondary-item='${surface === "local-ai" ? "local-story-mode" : "node-info"}']`, `${surface} Settings row`);
  }
  return collectProfile(page, surface);
}

export async function runSkinV1VisualDirector({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const chromium = await chromiumFor(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, ...(storageStatePath ? { storageState: storageStatePath } : {}) });
  const page = await context.newPage();
  const surfaces = {};
  try {
    const response = await page.goto(new URL("/skin-v1", server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 failed to render: HTTP ${response?.status() ?? "no response"}`);
    const dashboard = await navigateAndCollect(page, "dashboard");
    for (const surface of SURFACES.slice(1)) {
      const findings = analyzeVisualContinuity(dashboard, await navigateAndCollect(page, surface));
      surfaces[surface] = { blockers: findings.filter((item) => item.severity === "blocker").length, advisories: findings.filter((item) => item.severity === "advisory").length, findings };
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
  await mkdir(path.dirname(path.resolve(VISUAL_DIRECTOR_REPORT_PATH)), { recursive: true });
  await writeFile(path.resolve(VISUAL_DIRECTOR_REPORT_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Visual Director compared ${report.totals.surfaces} surfaces against Dashboard: ${report.totals.blockers} blocker(s), ${report.totals.advisories} advisory finding(s).`);
  for (const [surface, entry] of Object.entries(surfaces)) {
    for (const item of entry.findings) console.log(`VISUAL-DIRECTOR ${item.severity.toUpperCase()} ${surface} ${item.category}: ${item.guidance} [${item.identity}; ${item.property}: ${item.actual} -> ${item.expected}]`);
  }
  console.log(`Visual Director report: ${VISUAL_DIRECTOR_REPORT_PATH}`);
  if (report.totals.blockers) throw new Error(`Visual Director gate failed with ${report.totals.blockers} blocking Dashboard-continuity finding(s).`);
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
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
