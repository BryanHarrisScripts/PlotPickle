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
    await openWebMcpGovernedSurface(page, serverUrl, "story-map");
    const stages = [
      { id: "outline", selector: WEBMCP_STANDARD_SURFACE_REGISTRY["story-map"].readySelector },
      { id: "storyboard", selector: WEBMCP_STANDARD_SURFACE_REGISTRY.storyboard.readySelector },
      { id: "previs", selector: WEBMCP_STANDARD_SURFACE_REGISTRY.previs.readySelector },
      { id: "timeline", selector: WEBMCP_STANDARD_SURFACE_REGISTRY["scene-timeline"].readySelector },
      { id: "production", selector: "[data-skin-v1-preproduction-review='production']" },
    ];

    for (let index = 0; index < stages.length; index += 1) {
      const stage = stages[index];
      await page.locator(stage.selector).first().waitFor({ state: "visible", timeout: 30_000 });
      const active = page.locator(`[data-preproduction-stage='${stage.id}'][aria-current='step']`).first();
      await active.waitFor({ state: "visible", timeout: 20_000 });
      journeys.push({ stage: stage.id, status: "PASS", trigger: index === 0 ? "dashboard-navigation" : "real-browser-click" });
      if (index + 1 < stages.length) {
        const next = stages[index + 1];
        await page.locator(`[data-preproduction-stage='${next.id}']`).first().click();
      }
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
