#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  SKIN_V1_RUNTIME_SELECTOR,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "./webmcp-canonical-surface-registry.mjs";
import { validateLocalServer, waitForUiServer } from "./ui-axe-audit.mjs";
import { createBrowserVerificationSession } from "./browser-verification-broker.mjs";
import { loadSkinV1SurfaceContracts } from "./skin-v1-surface-contracts.mjs";
import {
  RENDERED_GEOMETRY_ARTIFACT_ROOT,
  analyzeRenderedSurfaceContract,
  collectRenderedSurfaceProfile,
  writeRenderedGeometryEvidence,
} from "./skin-v1-rendered-surface-profile.mjs";

export const VISUAL_DIRECTOR_REPORT_PATH = ".artifacts/visual-readiness/visual-director-report.json";

const SURFACES = WEBMCP_STANDARD_SURFACE_TARGETS;
const COLOR_TOKENS = [
  "--pp-skin-canvas", "--pp-skin-surface-0", "--pp-skin-surface-1", "--pp-skin-surface-2", "--pp-skin-surface-3",
  "--pp-skin-surface-4", "--pp-skin-surface-highlight", "--pp-skin-ink", "--pp-skin-ink-soft", "--pp-skin-ink-muted",
  "--pp-skin-line", "--pp-skin-line-soft", "--pp-skin-line-strong", "--pp-skin-accent-deep", "--pp-skin-accent",
  "--pp-skin-accent-bright", "--pp-skin-focus", "--pp-skin-selected-bg", "--pp-skin-selected-ink", "--pp-skin-disabled",
  "--pp-skin-warning-surface", "--pp-skin-warning-line", "--pp-skin-warning", "--pp-skin-warning-ink",
  "--pp-skin-danger-surface", "--pp-skin-danger-line", "--pp-skin-danger",
];
const CONTRACT_TOKENS = ["--pp-skin-radius", "--pp-skin-border-strong", "--pp-skin-control-height", "--pp-skin-space-1"];

// Compatibility evidence retained for #1920: profile: "section[aria-label='User Profile'].pp-skin-v1-profile-surface"

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

function percentile(values, ratio = 0.9) {
  const ordered = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!ordered.length) return null;
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * ratio) - 1));
  return ordered[index];
}

export function derivePeerCorpus(profiles = []) {
  const governed = profiles.filter((profile) => profile?.surface);
  const gapValues = governed.map((profile) => Number(profile.layout?.largestVerticalGap)).filter(Number.isFinite);
  const heightValues = governed.map((profile) => px(profile.root?.height)).filter(Number.isFinite);
  const shellValues = governed.map((profile) => Number(profile.layout?.shellLandmarks)).filter(Number.isFinite);
  return {
    surfaces: governed.length,
    largestVerticalGapMedian: median(gapValues),
    largestVerticalGapP90: percentile(gapValues, 0.9),
    rootHeightMedian: median(heightValues),
    rootHeightP90: percentile(heightValues, 0.9),
    shellLandmarksP90: percentile(shellValues, 0.9),
  };
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

export function analyzeVisualContinuity(reference, candidate, peerProfiles = []) {
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
  const peerCorpus = derivePeerCorpus(peerProfiles.filter((profile) => profile?.surface !== candidate.surface));

  for (const media of (candidate.media?.broken || []).slice(0, 5)) {
    output.push(finding(
      candidate.surface,
      "blocker",
      "broken-media",
      { identity: media.identity || "media" },
      "mediaLoad",
      media.detail || "broken",
      "rendered media must load successfully",
      "Repair or remove this broken rendered media reference before the surface reaches Human UAT; visible broken assets are not a conforming PlotPickle surface.",
    ));
  }

  const largestGap = Number(candidate.layout?.largestVerticalGap);
  const peerGap = Math.max(
    240,
    Number(peerCorpus.largestVerticalGapP90 || 0) * 1.75,
    Number(peerCorpus.largestVerticalGapMedian || 0) * 2.5,
  );
  if (Number.isFinite(largestGap) && largestGap > peerGap) {
    output.push(finding(
      candidate.surface,
      "advisory",
      "structural-dead-space",
      null,
      "largestVerticalGap",
      `${Math.round(largestGap)}px`,
      `<= ${Math.round(peerGap)}px based on governed peer-surface structure`,
      "This surface contains an unusually large unused vertical region compared with the governed PlotPickle surface family. Collapse unintended empty containers or bring the primary workspace into the active viewport.",
    ));
  }

  const candidateRootHeight = px(candidate.root?.height);
  const peerRootHeightP90 = Number(peerCorpus.rootHeightP90 || 0);
  const viewportHeight = Number(candidate.layout?.viewportHeight || 0);
  const heightLimit = Math.max(peerRootHeightP90 * 1.8, viewportHeight * 2.75);
  if (candidateRootHeight && heightLimit > 0 && candidateRootHeight > heightLimit) {
    output.push(finding(
      candidate.surface,
      "advisory",
      "structural-height",
      null,
      "rootHeight",
      `${Math.round(candidateRootHeight)}px`,
      `<= ${Math.round(heightLimit)}px unless the workspace intentionally requires a long document flow`,
      "The rendered root is materially taller than the governed surface corpus. Check for stacked legacy/current regions, oversized empty containers or duplicated workspace sections.",
    ));
  }

  const shellLandmarks = Number(candidate.layout?.shellLandmarks || 0);
  const shellLimit = Math.max(6, Number(peerCorpus.shellLandmarksP90 || 0) + 3);
  if (shellLandmarks > shellLimit) {
    output.push(finding(
      candidate.surface,
      "advisory",
      "shell-density",
      null,
      "shellLandmarks",
      shellLandmarks,
      `<= ${shellLimit} visible shell/navigation landmarks relative to governed peers`,
      "This surface exposes unusually many shell/navigation landmarks. Check for a legacy shell, duplicated navigation or multiple application frames being rendered together.",
    ));
  }

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


async function visibleClick(page, selector, label) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 15_000 }).catch(() => { throw new Error(`${label} was not visible.`); });
  await locator.click();
  await page.waitForTimeout(50);
}

async function goDashboard(page, server) {
  const dashboard = WEBMCP_STANDARD_SURFACE_REGISTRY.dashboard;
  if (await page.locator(dashboard.readySelector).first().isVisible().catch(() => false)) return;

  const response = await page.goto(new URL("/skin-v1", server).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  if (!response || response.status() >= 400) {
    throw new Error(`Visual Director could not restore the Dashboard route: HTTP ${response?.status() ?? "no response"}.`);
  }
  await page.locator(dashboard.readySelector).first().waitFor({ state: "visible", timeout: 15_000 });
}

async function collectProfile(page, surface, geometryEvidence) {
  const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
  if (!contract) throw new Error(`Visual Director does not know the ${surface} surface.`);
  await page.locator(contract.readySelector).first().waitFor({ state: "visible", timeout: contract.timeout ?? 30_000 });
  const profile = await collectRenderedSurfaceProfile(page, {
    surfaceName: contract.surface,
    rootSelector: contract.rootSelector,
    colorTokens: COLOR_TOKENS,
    contractTokens: CONTRACT_TOKENS,
  });
  geometryEvidence[surface] = await writeRenderedGeometryEvidence({
    page,
    profile,
    surfaceId: surface,
  });
  return profile;
}

async function navigateAndCollect(page, surface, server, geometryEvidence) {
  if (surface === "dashboard") return collectProfile(page, surface, geometryEvidence);
  const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surface];
  if (contract.route) {
    const response = await page.goto(new URL(contract.route, server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`${contract.label} route failed with HTTP ${response?.status() ?? "no response"}.`);
    await page.locator(SKIN_V1_RUNTIME_SELECTOR).waitFor({ state: "attached", timeout: contract.timeout ?? 30_000 });
    return collectProfile(page, surface, geometryEvidence);
  }
  await goDashboard(page, server);
  for (const step of contract.navigation) await visibleClick(page, step.selector, step.label);
  return collectProfile(page, surface, geometryEvidence);
}

export async function runSkinV1VisualDirector({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const browserSession = await createBrowserVerificationSession({
    toolRoot,
    runId: "skin-v1-visual-director",
    allowedOrigins: [server.origin],
    failOnBlockers: true,
  });
  const browser = browserSession.browser;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, ...(storageStatePath ? { storageState: storageStatePath } : {}) });
  const page = await context.newPage();
  const surfaces = {};
  const profiles = {};
  const geometryEvidence = {};
  const { contracts } = await loadSkinV1SurfaceContracts();
  const surfaceContracts = new Map(contracts.map((contract) => [contract.webmcpId || contract.surfaceId, contract]));
  try {
    const response = await page.goto(new URL("/skin-v1", server).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 failed to render: HTTP ${response?.status() ?? "no response"}`);
    profiles.dashboard = await navigateAndCollect(page, "dashboard", server, geometryEvidence);
    await browserSession.checkpoint(page, { surfaceId: "dashboard", route: page.url(), actionId: "visual-director-profile", checkpoint: "governed-surface-ready" });
    for (const surface of SURFACES.slice(1)) {
      profiles[surface] = await navigateAndCollect(page, surface, server, geometryEvidence);
      await browserSession.checkpoint(page, { surfaceId: surface, route: page.url(), actionId: "visual-director-profile", checkpoint: "governed-surface-ready" });
    }
    const dashboard = profiles.dashboard;
    const peerProfiles = Object.values(profiles);
    for (const surface of SURFACES.slice(1)) {
      const surfaceContract = surfaceContracts.get(surface);
      if (!surfaceContract) throw new Error(`Visual Director could not resolve the Surface Contract for ${surface}.`);
      const findings = [
        ...analyzeVisualContinuity(dashboard, profiles[surface], peerProfiles),
        ...analyzeRenderedSurfaceContract(surfaceContract, profiles[surface]),
      ];
      surfaces[surface] = {
        blockers: findings.filter((item) => item.severity === "blocker").length,
        advisories: findings.filter((item) => item.severity === "advisory").length,
        findings,
      };
    }
  } finally {
    await context.close();
    await browserSession.close();
  }

  const report = {
    version: 3,
    skin: "skin-v1",
    canonicalReference: "dashboard",
    geometryEvidenceRoot: path.resolve(RENDERED_GEOMETRY_ARTIFACT_ROOT),
    geometryEvidence,
    peerCorpus: derivePeerCorpus(Object.values(profiles || {})),
    rule: "Dashboard remains the locked canonical visual authority. Governed peer surfaces provide supplemental structural norms; a target's own historical screenshot is regression evidence only.",
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
