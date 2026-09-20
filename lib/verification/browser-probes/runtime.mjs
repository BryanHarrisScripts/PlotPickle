import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import { WEBMCP_STANDARD_SURFACE_TARGETS } from "../webmcp-canonical-surface-registry.mjs";
import { openWebMcpGovernedSurface } from "./webmcp-governed-surface.mjs";

async function inspectRuntimeInvariants(page, contract) {
  return page.locator(contract.rootSelector).first().evaluate((root) => {
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const accessibleName = (node) => {
      const aria = node.getAttribute("aria-label");
      if (aria?.trim()) return aria.trim();
      const labelledBy = node.getAttribute("aria-labelledby");
      if (labelledBy) {
        const text = labelledBy.split(/\s+/u)
          .map((id) => document.getElementById(id)?.textContent?.trim() || "")
          .filter(Boolean)
          .join(" ");
        if (text) return text;
      }
      if (node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement) {
        if (node.id) {
          const label = document.querySelector(`label[for="${CSS.escape(node.id)}"]`);
          if (label?.textContent?.trim()) return label.textContent.trim();
        }
        const parent = node.closest("label");
        if (parent?.textContent?.trim()) return parent.textContent.trim();
        if (node.getAttribute("placeholder")?.trim()) return node.getAttribute("placeholder").trim();
      }
      if (node.getAttribute("title")?.trim()) return node.getAttribute("title").trim();
      return (node.textContent || "").trim();
    };

    const ids = new Map();
    for (const node of root.querySelectorAll("[id]")) {
      if (!visible(node)) continue;
      const id = node.id;
      if (!id) continue;
      ids.set(id, (ids.get(id) || 0) + 1);
    }
    const duplicateIds = [...ids.entries()].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));

    const controls = [...root.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [tabindex]")]
      .filter((node) => visible(node) && node.getAttribute("aria-hidden") !== "true");
    const inaccessibleControls = controls
      .filter((node) => !accessibleName(node))
      .slice(0, 20)
      .map((node) => ({ tag: node.tagName.toLowerCase(), id: node.id || "", role: node.getAttribute("role") || "" }));

    const rootRect = root.getBoundingClientRect();
    const clippedControls = controls
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < rootRect.left - 1 || rect.right > rootRect.right + 1;
      })
      .slice(0, 20)
      .map((node) => ({ tag: node.tagName.toLowerCase(), id: node.id || "" }));

    const active = document.activeElement;
    const hiddenFocused = active instanceof HTMLElement && root.contains(active) && !visible(active)
      ? { tag: active.tagName.toLowerCase(), id: active.id || "", role: active.getAttribute("role") || "" }
      : null;

    const unresolvedLoading = [...root.querySelectorAll("[aria-busy='true'], [data-loading='true'], [data-status='loading']")]
      .filter(visible)
      .slice(0, 20)
      .map((node) => ({ tag: node.tagName.toLowerCase(), id: node.id || "", role: node.getAttribute("role") || "" }));

    return {
      duplicateIds,
      inaccessibleControls,
      clippedControls,
      hiddenFocused,
      unresolvedLoading,
      horizontalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
      controlCount: controls.length,
    };
  });
}

export async function runWebMcpRuntimeProfile({
  serverUrl,
  toolRoot,
  storageStatePath,
  runId,
  artifactRoot,
} = {}) {
  const session = await createBrowserVerificationSession({
    toolRoot,
    runId: `${runId}-runtime`,
    allowedOrigins: [new URL(serverUrl).origin],
    failOnBlockers: false,
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
      const invariant = await inspectRuntimeInvariants(page, contract);
      surfaces.push({ surfaceId, label: contract.label, ...invariant });

      if (invariant.duplicateIds.length) findings.push({
        profile: "runtime",
        surfaceId,
        severity: "blocker",
        probeId: "duplicate-visible-ids",
        trigger: "bounded-dom-evaluation",
        expected: "No duplicate visible IDs inside the governed active surface",
        observed: invariant.duplicateIds,
      });
      if (invariant.hiddenFocused) findings.push({
        profile: "runtime",
        surfaceId,
        severity: "blocker",
        probeId: "hidden-focus-target",
        trigger: "bounded-dom-evaluation",
        expected: "Focused element remains visible",
        observed: invariant.hiddenFocused,
      });
      if (invariant.horizontalOverflowPx > 1) findings.push({
        profile: "runtime",
        surfaceId,
        severity: "advisory",
        probeId: "horizontal-overflow",
        trigger: "bounded-dom-evaluation",
        expected: "<= 1px horizontal overflow",
        observed: { pixels: invariant.horizontalOverflowPx },
      });
      if (invariant.clippedControls.length) findings.push({
        profile: "runtime",
        surfaceId,
        severity: "advisory",
        probeId: "clipped-controls",
        trigger: "bounded-dom-evaluation",
        expected: "Required interactive controls remain horizontally inside the governed root",
        observed: invariant.clippedControls,
      });
      if (invariant.inaccessibleControls.length) findings.push({
        profile: "runtime",
        surfaceId,
        severity: "advisory",
        probeId: "accessible-control-name",
        trigger: "bounded-dom-evaluation",
        expected: "Visible controls expose a usable accessible name",
        observed: invariant.inaccessibleControls,
      });
      if (invariant.unresolvedLoading.length) findings.push({
        profile: "runtime",
        surfaceId,
        severity: "advisory",
        probeId: "unresolved-loading-state",
        trigger: "bounded-dom-evaluation",
        expected: "No active loading marker remains after governed ready state",
        observed: invariant.unresolvedLoading,
      });

      await session.checkpoint(page, {
        surfaceId,
        actionId: "runtime-invariant-sweep",
        checkpoint: "runtime-surface-ready",
      });
    }

    const diagnostics = session.observer.summary();
    for (const diagnostic of diagnostics.findings.filter((finding) => finding.severity === "blocker" && !finding.allowlistMatch)) {
      findings.push({
        profile: "runtime",
        surfaceId: diagnostic.surfaceId,
        severity: "blocker",
        probeId: "browser-health",
        trigger: "browser-verification-broker",
        expected: "No unexplained browser-health blocker",
        observed: { category: diagnostic.category, summary: diagnostic.summary },
      });
    }

    const report = {
      schemaVersion: 1,
      profile: "runtime",
      runId,
      status: findings.some((finding) => finding.severity === "blocker") ? "FAIL" : "PASS",
      surfaces,
      findings,
      brokerDiagnostics: {
        runId: diagnostics.runId,
        totals: diagnostics.totals,
      },
      totals: {
        surfaces: surfaces.length,
        blockers: findings.filter((finding) => finding.severity === "blocker").length,
        advisories: findings.filter((finding) => finding.severity === "advisory").length,
      },
    };
    const target = path.join(artifactRoot, "profile-5-runtime", "report.json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return { ...report, report: target };
  } finally {
    await context.close();
    await session.close();
  }
}
