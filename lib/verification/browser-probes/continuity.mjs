import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import { WEBMCP_STANDARD_SURFACE_REGISTRY } from "../webmcp-canonical-surface-registry.mjs";
import { openWebMcpGovernedSurface } from "./webmcp-governed-surface.mjs";

const PROBE_STORAGE_KEY = "plotpickle.verification.webmcp-continuity";

export async function runWebMcpContinuityProfile({
  serverUrl,
  toolRoot,
  storageStatePath,
  runId,
  artifactRoot,
} = {}) {
  const origin = new URL(serverUrl).origin;
  const session = await createBrowserVerificationSession({
    toolRoot,
    runId: `${runId}-continuity`,
    allowedOrigins: [origin],
    failOnBlockers: true,
  });
  const context = await session.browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  let isolatedContext;
  const findings = [];
  const journeys = [];

  try {
    const stages = [
      { id: "outline", governed: "story-map" },
      { id: "storyboard", governed: "storyboard" },
      { id: "previs", governed: "previs" },
      { id: "timeline", governed: "scene-timeline" },
      { id: "production", governed: null },
    ];

    for (const stage of stages) {
      if (stage.governed) await openWebMcpGovernedSurface(page, serverUrl, stage.governed);
      else {
        await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
        await page.locator("[data-dashboard-menu-item='production']").click();
        await page.locator("[data-skin-v1-preproduction-review='production']").waitFor({ state: "visible", timeout: 30_000 });
      }
      const contract = stage.governed ? WEBMCP_STANDARD_SURFACE_REGISTRY[stage.governed] : null;
      const header = page.locator(".pp-skin-v1-home-link:visible").first();
      await header.waitFor({ state: "visible", timeout: 20_000 });
      await header.click();
      await page.locator(WEBMCP_STANDARD_SURFACE_REGISTRY.dashboard.readySelector).first().waitFor({ state: "visible", timeout: 20_000 });
      journeys.push({ stage: stage.id, status: "PASS", trigger: contract?.route ? "governed-route-and-header-return" : "dashboard-click-and-header-return" });
    }

    const tabA = page;
    const tabB = await context.newPage();
    await openWebMcpGovernedSurface(tabB, serverUrl, "dashboard");
    const marker = `${runId}:shared`;
    await tabA.evaluate(([key, value]) => localStorage.setItem(key, value), [PROBE_STORAGE_KEY, marker]);
    await tabB.reload({ waitUntil: "domcontentloaded" });
    const sharedValue = await tabB.evaluate((key) => localStorage.getItem(key), PROBE_STORAGE_KEY);
    if (sharedValue !== marker) {
      findings.push({
        profile: "continuity",
        surfaceId: "dashboard",
        severity: "blocker",
        probeId: "same-context-storage-propagation",
        trigger: "multi-page-browser-context",
        expected: marker,
        observed: sharedValue,
      });
    }

    isolatedContext = await session.browser.newContext({
      viewport: { width: 1440, height: 1000 },
      ...(storageStatePath ? { storageState: storageStatePath } : {}),
    });
    const isolatedPage = await isolatedContext.newPage();
    await openWebMcpGovernedSurface(isolatedPage, serverUrl, "dashboard");
    const isolatedValue = await isolatedPage.evaluate((key) => localStorage.getItem(key), PROBE_STORAGE_KEY);
    if (isolatedValue !== null) {
      findings.push({
        profile: "continuity",
        surfaceId: "dashboard",
        severity: "blocker",
        probeId: "isolated-context-storage-boundary",
        trigger: "independent-browser-context",
        expected: null,
        observed: isolatedValue,
      });
    }

    await tabA.evaluate((key) => localStorage.removeItem(key), PROBE_STORAGE_KEY);
    await tabB.close();
    await isolatedPage.close();

    const report = {
      schemaVersion: 1,
      profile: "continuity",
      runId,
      status: findings.some((finding) => finding.severity === "blocker") ? "FAIL" : "PASS",
      journeys,
      propagation: {
        sameContext: sharedValue === marker ? "PASS" : "FAIL",
        isolatedContext: isolatedValue === null ? "PASS" : "FAIL",
      },
      findings,
      totals: {
        journeys: journeys.length,
        blockers: findings.filter((finding) => finding.severity === "blocker").length,
        advisories: findings.filter((finding) => finding.severity === "advisory").length,
      },
    };
    const target = path.join(artifactRoot, "profile-4-continuity", "report.json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return { ...report, report: target };
  } finally {
    await isolatedContext?.close().catch(() => undefined);
    await context.close();
    await session.close();
  }
}
