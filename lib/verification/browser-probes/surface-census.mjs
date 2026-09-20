import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import {
  WEBMCP_DASHBOARD_DESTINATION_COVERAGE,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../webmcp-canonical-surface-registry.mjs";
import { SKIN_V1_SURFACES } from "../skin-v1-surface-registry.mjs";
import { openWebMcpGovernedSurface } from "./webmcp-governed-surface.mjs";

const REPRESENTATIVE_FIXTURE = "afterglow";
const DASHBOARD_SELECTOR = "[data-skin-reference='dashboard-canonical']";
const DASHBOARD_ROW_SELECTOR = "[data-dashboard-menu-item]";
const SAFE_LIVE_EXTRA_IDS = new Set(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function percent(numerator, denominator) {
  if (!denominator) return 100;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

function canonicalNavigation(surface) {
  return Array.isArray(surface.navigationPath)
    ? surface.navigationPath.map((segment) => ({
      order: segment.order,
      slug: segment.slug,
      label: segment.label,
    }))
    : [];
}

function routeUrl(serverUrl, surface) {
  const route = surface.runtimeRoute || surface.route;
  if (!route) return null;
  const url = new URL(route, serverUrl);
  if (surface.capturePolicy !== "public-exception") {
    url.searchParams.set("representative", REPRESENTATIVE_FIXTURE);
  }
  return url;
}

async function pageSnapshot(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      if (!(node instanceof HTMLElement) || node.getClientRects().length === 0) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden";
    };
    const headings = [...document.querySelectorAll("h1, h2, [role='heading']")]
      .filter(visible)
      .map((node) => (node.textContent || "").replace(/\s+/gu, " ").trim())
      .filter(Boolean);
    const skinSignals = (document.body?.innerText || "")
      .split(/\r?\n/u)
      .map((line) => line.replace(/\s+/gu, " ").trim())
      .filter((line) => /\b(?:matrix|skin\s*v?\s*1)\b/iu.test(line))
      .slice(0, 20);
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      documentTitle: document.title || "",
      visibleHeading: headings[0] || "",
      skinDataset: document.documentElement.dataset.plotpickleSkin || "",
      skinThemeDataset: document.documentElement.dataset.plotpickleSkinTheme || "",
      shellLabelSignals: [...new Set(skinSignals)],
    };
  });
}

async function dashboardRows(page) {
  await page.locator(DASHBOARD_SELECTOR).first().waitFor({ state: "visible", timeout: 20_000 });
  return page.locator(DASHBOARD_ROW_SELECTOR).evaluateAll((nodes) => nodes
    .filter((node) => {
      if (!(node instanceof HTMLElement) || node.getClientRects().length === 0) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden";
    })
    .map((node) => ({
      id: node.getAttribute("data-dashboard-menu-item") || "",
      shortcut: node.getAttribute("data-skin-menu-shortcut") || node.getAttribute("aria-keyshortcuts") || "",
      connected: node.getAttribute("data-skin-menu-connected") === "true",
      disabled: node instanceof HTMLButtonElement ? node.disabled : node.getAttribute("aria-disabled") === "true",
      label: (node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/gu, " ").trim(),
    }))
    .filter((entry) => entry.id));
}

function capturedRootIds() {
  return new Set(Object.keys(WEBMCP_DASHBOARD_DESTINATION_COVERAGE.captured));
}

export function classifyLiveDashboardDestination(id) {
  const normalized = String(id || "");
  if (capturedRootIds().has(normalized)) return "governed";
  if (WEBMCP_DASHBOARD_DESTINATION_COVERAGE.censusOnly.includes(normalized)) return "census-only";
  if (WEBMCP_DASHBOARD_DESTINATION_COVERAGE.nonVisualActions.includes(normalized)) return "non-visual-action";
  if (WEBMCP_DASHBOARD_DESTINATION_COVERAGE.currentlyUnwired.includes(normalized)) return "currently-unwired";
  return "unclassified";
}

export function buildSurfaceCensusSummary(records, dashboard = []) {
  const safelyReachable = records.filter((record) => record.reachable === true);
  const applicableReachable = safelyReachable.filter((record) => record.capturePolicy !== "public-exception");
  const governedReachable = applicableReachable.filter((record) => record.webmcpGoverned);
  const missingFromWebMcp = applicableReachable.filter((record) => !record.webmcpGoverned);
  const governedButUnreachable = records.filter((record) => record.webmcpGoverned && record.reachable === false);
  const legacyUnclassifiedReachable = safelyReachable.filter((record) =>
    record.source === "live-dashboard" && !record.canonicalRegistry,
  );
  const navigationFailures = records.filter((record) => record.status === "navigation-failure");
  const skippedUnsafe = records.filter((record) => record.reachable === null);
  const unclassified = records.filter((record) => record.classification === "unclassified");
  const publicExceptions = safelyReachable.filter((record) => record.capturePolicy === "public-exception");
  const visibleUnwired = dashboard.filter((entry) => entry.classification === "currently-unwired");
  const visibleNonVisual = dashboard.filter((entry) => entry.classification === "non-visual-action");

  return {
    discoveredUserVisibleSurfaces: records.length,
    canonicalRegistrySurfaces: records.filter((record) => record.canonicalRegistry).length,
    webmcpGovernedSurfaces: WEBMCP_STANDARD_SURFACE_TARGETS.length,
    safelyReachableSurfaces: safelyReachable.length,
    governedReachableSurfaces: governedReachable.length,
    missingFromWebMcp: missingFromWebMcp.map((record) => record.id),
    governedButUnreachable: governedButUnreachable.map((record) => record.id),
    legacyUnclassifiedReachable: legacyUnclassifiedReachable.map((record) => record.id),
    navigationFailures: navigationFailures.map((record) => record.id),
    skippedUnsafe: skippedUnsafe.map((record) => record.id),
    publicExceptions: publicExceptions.map((record) => record.id),
    visibleUnwiredDashboardDestinations: visibleUnwired.map((entry) => entry.id),
    visibleNonVisualDashboardActions: visibleNonVisual.map((entry) => entry.id),
    reconciliationCoveragePct: percent(records.length - unclassified.length, records.length),
    governanceCoveragePct: percent(governedReachable.length, applicableReachable.length),
    coverageComplete: unclassified.length === 0,
  };
}

async function probeStandardSurface(page, serverUrl, surface) {
  try {
    await openWebMcpGovernedSurface(page, serverUrl, surface.id);
    return {
      reachable: true,
      status: "governed-reachable",
      snapshot: await pageSnapshot(page),
      failure: "",
    };
  } catch (error) {
    return {
      reachable: false,
      status: "navigation-failure",
      snapshot: null,
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeCanonicalNonstandardSurface(page, serverUrl, surface) {
  const url = routeUrl(serverUrl, surface);
  try {
    if (url) {
      const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
      if (!response || response.status() >= 400) {
        throw new Error(`HTTP ${response?.status() ?? "no response"} for ${url.pathname}${url.search}`);
      }
      if (surface.runtimeReadySelector) {
        await page.locator(surface.runtimeReadySelector).first()
          .waitFor({ state: "visible", timeout: 20_000 });
      } else if (surface.runtimeSelector) {
        await page.locator(surface.runtimeSelector).first()
          .waitFor({ state: "visible", timeout: 20_000 });
      } else {
        await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
      }
      return {
        reachable: true,
        status: surface.capturePolicy === "public-exception" ? "public-exception-reachable" : "census-only-reachable",
        snapshot: await pageSnapshot(page),
        failure: "",
      };
    }

    if (surface.runtimeReadySelector || surface.runtimeSelector) {
      await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
      const destination = page.locator(`[data-dashboard-menu-item='${surface.id}']`).first();
      if (await destination.count()) {
        await destination.waitFor({ state: "visible", timeout: 10_000 });
        if (await destination.isDisabled()) {
          return { reachable: false, status: "declared-unreachable", snapshot: await pageSnapshot(page), failure: "Dashboard destination is disabled." };
        }
        await destination.click();
        await page.locator(surface.runtimeReadySelector || surface.runtimeSelector).first()
          .waitFor({ state: "visible", timeout: 20_000 });
        return {
          reachable: true,
          status: "census-only-reachable",
          snapshot: await pageSnapshot(page),
          failure: "",
        };
      }
      return {
        reachable: null,
        status: "declared-state-only",
        snapshot: null,
        failure: "No direct safe route or Dashboard destination is declared for this state surface.",
      };
    }

    return {
      reachable: null,
      status: "declared-state-only",
      snapshot: null,
      failure: "Canonical state surface has no direct safe route or runtime selector.",
    };
  } catch (error) {
    return {
      reachable: false,
      status: "navigation-failure",
      snapshot: await pageSnapshot(page).catch(() => null),
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeLiveExtra(page, serverUrl, entry) {
  if (!SAFE_LIVE_EXTRA_IDS.has(entry.id) || entry.disabled || !entry.connected) {
    return {
      reachable: null,
      status: entry.disabled || !entry.connected ? "visible-unavailable" : "skipped-unsafe",
      snapshot: null,
      failure: "Live destination is not in the safe census-only activation allowlist.",
    };
  }
  try {
    await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
    const destination = page.locator(`[data-dashboard-menu-item='${entry.id}']`).first();
    await destination.waitFor({ state: "visible", timeout: 10_000 });
    await destination.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
    return {
      reachable: true,
      status: "live-unregistered-reachable",
      snapshot: await pageSnapshot(page),
      failure: "",
    };
  } catch (error) {
    return {
      reachable: false,
      status: "navigation-failure",
      snapshot: await pageSnapshot(page).catch(() => null),
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

function markdownSummary(report) {
  const lines = [
    "# Surface Census",
    "",
    `Run: ${report.runId}`,
    `Status: ${report.status}`,
    "",
    `Discovered user-visible surfaces: ${report.summary.discoveredUserVisibleSurfaces}`,
    `Canonical registry surfaces: ${report.summary.canonicalRegistrySurfaces}`,
    `WebMCP governed surfaces: ${report.summary.webmcpGovernedSurfaces}`,
    `Safely reachable surfaces: ${report.summary.safelyReachableSurfaces}`,
    `Missing from WebMCP: ${report.summary.missingFromWebMcp.length}`,
    `Governed but unreachable: ${report.summary.governedButUnreachable.length}`,
    `Legacy/unclassified reachable: ${report.summary.legacyUnclassifiedReachable.length}`,
    `Navigation failures: ${report.summary.navigationFailures.length}`,
    `Skipped/state-only: ${report.summary.skippedUnsafe.length}`,
    `Reconciliation coverage: ${report.summary.reconciliationCoveragePct}%`,
    `Governance coverage: ${report.summary.governanceCoveragePct}%`,
    "",
  ];
  for (const [label, values] of [
    ["Missing from WebMCP", report.summary.missingFromWebMcp],
    ["Governed but unreachable", report.summary.governedButUnreachable],
    ["Legacy/unclassified reachable", report.summary.legacyUnclassifiedReachable],
    ["Navigation failures", report.summary.navigationFailures],
    ["Skipped/state-only", report.summary.skippedUnsafe],
    ["Visible unwired Dashboard destinations", report.summary.visibleUnwiredDashboardDestinations],
  ]) {
    lines.push(`## ${label}`);
    lines.push(values.length ? values.map((value) => `- ${value}`).join("\n") : "- none");
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function runWebMcpSurfaceCensusProfile({
  serverUrl,
  toolRoot,
  storageStatePath,
  runId,
  artifactRoot,
} = {}) {
  const session = await createBrowserVerificationSession({
    toolRoot,
    runId: `${runId}-surface-census`,
    allowedOrigins: [new URL(serverUrl).origin],
    failOnBlockers: false,
  });
  const context = await session.browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  const records = [];
  let dashboard = [];

  try {
    await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
    dashboard = (await dashboardRows(page)).map((entry) => ({
      ...entry,
      classification: classifyLiveDashboardDestination(entry.id),
    }));
    const dashboardShell = await pageSnapshot(page);
    const canonicalIds = new Set(SKIN_V1_SURFACES.map((surface) => surface.id));

    for (const surface of SKIN_V1_SURFACES) {
      const webmcpGoverned = WEBMCP_STANDARD_SURFACE_TARGETS.includes(surface.id);
      const probe = webmcpGoverned
        ? await probeStandardSurface(page, serverUrl, surface)
        : await probeCanonicalNonstandardSurface(page, serverUrl, surface);
      records.push({
        id: surface.id,
        label: surface.label,
        source: "canonical-registry",
        canonicalRegistry: true,
        capturePolicy: surface.capturePolicy,
        governance: surface.governance || "",
        surfaceClass: surface.surfaceClass || "",
        family: surface.family || "",
        parent: surface.parent || "",
        route: surface.runtimeRoute || surface.route || "",
        runtimeSelector: surface.runtimeSelector || "",
        navigationPath: canonicalNavigation(surface),
        webmcpGoverned,
        classification: webmcpGoverned
          ? "governed"
          : surface.capturePolicy === "public-exception"
            ? "public-exception"
            : "census-only",
        ...probe,
      });
    }

    for (const entry of dashboard) {
      if (canonicalIds.has(entry.id)) continue;
      const classification = entry.classification;
      if (classification === "governed" || classification === "currently-unwired" || classification === "non-visual-action") continue;
      const probe = await probeLiveExtra(page, serverUrl, entry);
      records.push({
        id: entry.id,
        label: entry.label,
        source: "live-dashboard",
        canonicalRegistry: false,
        capturePolicy: classification === "census-only" ? "census-only" : "unregistered",
        governance: "unregistered",
        surfaceClass: "unknown",
        family: "",
        parent: "dashboard",
        route: probe.snapshot?.url || "",
        runtimeSelector: "",
        navigationPath: [{ order: null, slug: entry.id, label: entry.label }],
        webmcpGoverned: false,
        classification: classification === "census-only" ? "legacy-unclassified" : "unclassified",
        ...probe,
      });
    }

    const summary = buildSurfaceCensusSummary(records, dashboard);
    const findings = [
      ...summary.missingFromWebMcp.map((surfaceId) => ({
        profile: "surface-census",
        severity: "diagnostic",
        category: "missing-from-webmcp",
        surfaceId,
      })),
      ...summary.legacyUnclassifiedReachable.map((surfaceId) => ({
        profile: "surface-census",
        severity: "diagnostic",
        category: "legacy-unclassified-reachable",
        surfaceId,
      })),
      ...summary.navigationFailures.map((surfaceId) => ({
        profile: "surface-census",
        severity: "diagnostic",
        category: "navigation-failure",
        surfaceId,
      })),
    ];
    const blockerCount = summary.governedButUnreachable.length;
    const report = {
      schemaVersion: 1,
      profile: "surface-census",
      runId,
      status: blockerCount ? "FAIL" : "PASS",
      authority: {
        canonicalRegistry: "config/skin-v1-surface-registry.json",
        webmcpGovernance: "lib/verification/webmcp-canonical-surface-registry.mjs",
        liveDiscovery: "Dashboard rendered navigation",
      },
      safety: {
        destructiveActions: false,
        paidGenerationActions: false,
        externalProviderCalls: false,
        safeLiveExtraAllowlist: [...SAFE_LIVE_EXTRA_IDS],
      },
      dashboardShell,
      dashboard,
      records,
      findings,
      summary,
      totals: {
        surfaces: records.length,
        blockers: blockerCount,
        advisories: 0,
        diagnostics: findings.length,
      },
    };

    const folder = path.join(artifactRoot, "profile-6-surface-census");
    const reportPath = path.join(folder, "report.json");
    const markdownPath = path.join(folder, "surface-census.md");
    await mkdir(folder, { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(markdownPath, markdownSummary(report), "utf8");

    return { ...report, report: reportPath, markdown: markdownPath };
  } finally {
    await context.close();
    await session.close();
  }
}
