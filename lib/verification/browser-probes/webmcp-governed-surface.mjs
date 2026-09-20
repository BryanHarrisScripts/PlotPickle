import {
  SKIN_V1_RUNTIME_SELECTOR,
  WEBMCP_STANDARD_SURFACE_REGISTRY,
} from "../webmcp-canonical-surface-registry.mjs";

const REPRESENTATIVE_FIXTURE = "afterglow";

function governedUrl(serverUrl, pathname = "/skin-v1") {
  const url = new URL(pathname, serverUrl);
  url.searchParams.set("representative", REPRESENTATIVE_FIXTURE);
  return url;
}

export async function openWebMcpGovernedSurface(page, serverUrl, surfaceId) {
  const contract = WEBMCP_STANDARD_SURFACE_REGISTRY[surfaceId];
  if (!contract) throw new Error(`Unknown governed WebMCP surface: ${surfaceId}.`);

  if (contract.route) {
    const response = await page.goto(governedUrl(serverUrl, contract.route).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) {
      throw new Error(`${contract.label} route failed with HTTP ${response?.status() ?? "no response"}.`);
    }
  } else {
    const response = await page.goto(governedUrl(serverUrl).href, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) {
      throw new Error(`Dashboard reset failed before opening ${contract.label}.`);
    }
    await page.locator(WEBMCP_STANDARD_SURFACE_REGISTRY.dashboard.readySelector).first()
      .waitFor({ state: "visible", timeout: 20_000 });
    for (const step of contract.navigation || []) {
      const target = page.locator(step.selector).first();
      await target.waitFor({ state: "visible", timeout: contract.timeout || 20_000 });
      await target.click();
    }
  }

  await page.locator(SKIN_V1_RUNTIME_SELECTOR).waitFor({ state: "attached", timeout: contract.timeout || 20_000 });
  const root = page.locator(contract.readySelector).first();
  await root.waitFor({ state: "visible", timeout: contract.timeout || 20_000 });
  return contract;
}

export async function governedSurfaceSnapshot(page, contract) {
  return page.locator(contract.rootSelector).first().evaluate((root) => {
    const controls = [...root.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")].filter(
      (node) => node instanceof HTMLElement
        && node.getClientRects().length > 0
        && getComputedStyle(node).display !== "none"
        && getComputedStyle(node).visibility !== "hidden",
    );
    return {
      id: root.id || "",
      ariaLabel: root.getAttribute("aria-label") || "",
      controls: controls.length,
      disabledControls: controls.filter((node) => node instanceof HTMLButtonElement || node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement ? node.disabled : false).length,
      requiredControls: controls.filter((node) => node.hasAttribute("required") || node.getAttribute("aria-required") === "true").length,
    };
  });
}
