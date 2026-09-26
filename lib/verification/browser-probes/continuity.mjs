import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import { WEBMCP_STANDARD_SURFACE_REGISTRY } from "../webmcp-canonical-surface-registry.mjs";
import { canonicalSurface } from "../skin-v1-surface-registry.mjs";
import { openWebMcpGovernedSurface } from "./webmcp-governed-surface.mjs";

const PROBE_STORAGE_KEY = "plotpickle.verification.webmcp-continuity";

async function settledOrchestratorIdentity(page) {
  const orchestrator = page.locator("[data-skin-v1-orchestrator='runtime']").first();
  await orchestrator.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => {
    const root = document.querySelector("[data-skin-v1-orchestrator='runtime']");
    return root instanceof HTMLElement
      && Boolean(root.dataset.skinV1ActiveSurface)
      && root.dataset.skinV1ActiveSurface !== "pending";
  }, { timeout: 20_000 });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const activeSurface = await orchestrator.getAttribute("data-skin-v1-active-surface");
  const visibleHeader = page.locator(".pp-skin-v1-orchestrator-header:visible").first();
  const label = (await visibleHeader.locator("span").first().textContent())?.trim() ?? "";
  return { activeSurface, label };
}

async function assertSettledOrchestratorIdentity({
  page,
  expectedSurface,
  expectedLabel,
  findings,
  trigger,
}) {
  const identity = await settledOrchestratorIdentity(page);
  if (identity.activeSurface !== expectedSurface) {
    findings.push({
      profile: "continuity",
      surfaceId: expectedSurface,
      severity: "blocker",
      probeId: "settled-orchestrator-surface-identity",
      trigger,
      expected: expectedSurface,
      observed: identity.activeSurface || "none",
    });
  }
  if (identity.label !== expectedLabel) {
    findings.push({
      profile: "continuity",
      surfaceId: expectedSurface,
      severity: "blocker",
      probeId: "settled-orchestrator-surface-label",
      trigger,
      expected: expectedLabel,
      observed: identity.label || "none",
    });
  }
  return identity;
}

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
    const dashboardStages = [
      { id: "outline", menuId: "plan", governed: "story-map" },
      { id: "storyboard", menuId: "storyboard", governed: "storyboard" },
      { id: "previs", menuId: "previs", governed: "previs" },
      { id: "timeline", menuId: "timeline", governed: "scene-timeline" },
      { id: "sound-foley", menuId: "sound-foley", governed: "sound-foley" },
      { id: "sound-narration", menuId: "sound-narration", governed: "sound-narration" },
      { id: "sound-music", menuId: "sound-music", governed: "sound-music" },
      { id: "production", menuId: "production", governed: "production" },
      { id: "screening", menuId: "screening", governed: "screening" },
    ];

    for (const stage of dashboardStages) {
      await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
      const control = page.locator(`[data-dashboard-menu-item='${stage.menuId}']`).first();
      await control.waitFor({ state: "visible", timeout: 20_000 });
      await control.click();
      await page.locator(`[data-dashboard-review-surface='${stage.id}']`).first()
        .waitFor({ state: "visible", timeout: 30_000 });
      const surface = canonicalSurface(stage.governed);
      if (!surface?.runtimeReadySelector) throw new Error(`Missing canonical ready selector for ${stage.governed}.`);
      await page.locator(surface.runtimeReadySelector).first().waitFor({ state: "visible", timeout: 30_000 });
      const identity = await assertSettledOrchestratorIdentity({
        page,
        expectedSurface: stage.governed,
        expectedLabel: surface.label,
        findings,
        trigger: "normal-dashboard-stage-open-after-orchestrator-settle",
      });
      if (stage.id === "previs") {
        const sharedMap = page.locator("[data-progressive-story-map='24x96']:visible").first();
        const sharedMapVisible = await sharedMap.count() > 0;
        if (!sharedMapVisible) {
          findings.push({
            profile: "continuity",
            surfaceId: "previs",
            severity: "blocker",
            probeId: "previs-shared-story-map-remains-visible",
            trigger: "normal-dashboard-stage-open-after-orchestrator-settle",
            expected: "visible",
            observed: "missing",
          });
        } else {
          const evidenceColors = await sharedMap.locator("[aria-label='24/96 evidence states'] [data-state]").evaluateAll((nodes) =>
            nodes.map((node) => ({
              state: node.getAttribute("data-state") || "",
              color: getComputedStyle(node).color,
            })),
          );
          const expectedStates = ["defined", "observed", "emerging", "missing", "locked"];
          const represented = new Map(evidenceColors.map((entry) => [entry.state, entry.color]));
          const distinctColors = new Set(expectedStates.map((state) => represented.get(state)).filter(Boolean));
          if (!expectedStates.every((state) => represented.has(state)) || distinctColors.size !== expectedStates.length) {
            findings.push({
              profile: "continuity",
              surfaceId: "previs",
              severity: "blocker",
              probeId: "previs-five-state-colour-grammar",
              trigger: "normal-dashboard-stage-open-after-orchestrator-settle",
              expected: "five distinct Defined/Observed/Emerging/Available/Blocked colours",
              observed: JSON.stringify(Object.fromEntries(represented)),
            });
          }
        }
      }
      journeys.push({
        stage: stage.id,
        status: identity.activeSurface === stage.governed ? "PASS" : "FAIL",
        trigger: "normal-dashboard-stage-open-after-orchestrator-settle",
      });
    }

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
      if (stage.governed && contract) {
        await assertSettledOrchestratorIdentity({
          page,
          expectedSurface: stage.governed,
          expectedLabel: contract.label,
          findings,
          trigger: "governed-surface-open-after-orchestrator-settle",
        });
      }
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
