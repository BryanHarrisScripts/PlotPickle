import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import {
  WEBMCP_STANDARD_SURFACE_REGISTRY,
  WEBMCP_STANDARD_SURFACE_TARGETS,
} from "../webmcp-canonical-surface-registry.mjs";
import {
  governedSurfaceSnapshot,
  openWebMcpGovernedSurface,
} from "./webmcp-governed-surface.mjs";

async function activeElementSnapshot(page) {
  return page.evaluate(() => {
    const node = document.activeElement;
    if (!(node instanceof HTMLElement)) return null;
    return {
      tag: node.tagName.toLowerCase(),
      id: node.id || "",
      role: node.getAttribute("role") || "",
      ariaLabel: node.getAttribute("aria-label") || "",
      text: (node.textContent || "").trim().slice(0, 80),
    };
  });
}

export async function runWebMcpInteractionProfile({
  serverUrl,
  toolRoot,
  storageStatePath,
  runId,
  artifactRoot,
} = {}) {
  const session = await createBrowserVerificationSession({
    toolRoot,
    runId: `${runId}-interaction`,
    allowedOrigins: [new URL(serverUrl).origin],
    failOnBlockers: true,
  });
  const context = await session.browser.newContext({
    viewport: { width: 1440, height: 1000 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  const surfaces = [];
  const findings = [];

  try {
    for (const surfaceId of WEBMCP_STANDARD_SURFACE_TARGETS) {
      const contract = await openWebMcpGovernedSurface(page, serverUrl, surfaceId);
      const snapshot = await governedSurfaceSnapshot(page, contract);
      let keyboardFocus = null;
      if (snapshot.controls > 0) {
        await page.evaluate(() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && active !== document.body) active.blur();
        });
        await page.keyboard.press("Tab");
        keyboardFocus = await activeElementSnapshot(page);
        if (!keyboardFocus || keyboardFocus.tag === "body") {
          findings.push({
            profile: "interaction",
            surfaceId,
            severity: "advisory",
            probeId: "keyboard-focus-entry",
            trigger: "real-browser-keyboard",
            expected: "Tab reaches a usable focus target",
            observed: keyboardFocus || { tag: "none" },
          });
        }
        await page.keyboard.press("Shift+Tab");
      }
      surfaces.push({
        surfaceId,
        label: contract.label,
        trigger: "real-browser-keyboard",
        controls: snapshot.controls,
        disabledControls: snapshot.disabledControls,
        requiredControls: snapshot.requiredControls,
        keyboardFocus,
        status: "PASS",
      });
      await session.checkpoint(page, {
        surfaceId,
        actionId: "interaction-state-sweep",
        checkpoint: "interaction-surface-ready",
      });
    }

    const dashboard = WEBMCP_STANDARD_SURFACE_REGISTRY.dashboard;
    const settings = WEBMCP_STANDARD_SURFACE_REGISTRY.settings;
    await openWebMcpGovernedSurface(page, serverUrl, "dashboard");
    const settingsControl = page.locator(settings.navigation[0].selector).first();
    await settingsControl.focus();
    await page.keyboard.press("Enter");
    await page.locator(settings.readySelector).first().waitFor({ state: "visible", timeout: settings.timeout });
    await page.keyboard.press("Escape");
    await page.locator(dashboard.readySelector).first().waitFor({ state: "visible", timeout: dashboard.timeout });
    surfaces.push({
      surfaceId: "dashboard-settings-keyboard-roundtrip",
      label: "Dashboard → Manage → Dashboard",
      trigger: "real-browser-keyboard",
      keys: ["Enter", "Escape"],
      status: "PASS",
    });

    const report = {
      schemaVersion: 1,
      profile: "interaction",
      runId,
      status: findings.some((finding) => finding.severity === "blocker") ? "FAIL" : "PASS",
      browserInteraction: "playwright-keyboard-and-focus",
      syntheticEventDispatch: false,
      surfaces,
      findings,
      totals: {
        surfaces: WEBMCP_STANDARD_SURFACE_TARGETS.length,
        blockers: findings.filter((finding) => finding.severity === "blocker").length,
        advisories: findings.filter((finding) => finding.severity === "advisory").length,
      },
    };
    const target = path.join(artifactRoot, "profile-2-interaction", "report.json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return { ...report, report: target };
  } finally {
    await context.close();
    await session.close();
  }
}
