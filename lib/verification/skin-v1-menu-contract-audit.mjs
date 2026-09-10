import { createRequire } from "node:module";
import path from "node:path";

function loadChromium(toolRoot) {
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the pinned WebMCP verification install.");
  const toolRequire = createRequire(path.join(path.resolve(toolRoot), "package.json"));
  return toolRequire("@playwright/test").chromium;
}

function violation(surface, stableIdentity, property, actual, expected) {
  return {
    surface,
    semanticRole: "menu",
    stableIdentity,
    property,
    actual: String(actual ?? ""),
    expected: String(expected ?? ""),
    source: "skin-v1-menu-contract",
  };
}

function addFailure(failures, detail) {
  failures.push(`UI-CONFORMANCE ${JSON.stringify(detail)}`);
}

async function inspectMenu(page, menuName, failures) {
  const selector = `[data-skin-menu='${menuName}']`;
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 15_000 });
  const result = await page.locator(selector).first().evaluate((scope) => {
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const resolveBackground = (token) => {
      const probe = document.createElement("span");
      probe.style.position = "absolute";
      probe.style.background = `var(${token})`;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    };
    const rows = [...scope.querySelectorAll("[data-skin-menu-row]")].filter(visible).map((row) => {
      const indicator = row.querySelector("[data-skin-menu-indicator]");
      const rowStyle = getComputedStyle(row);
      const indicatorStyle = indicator ? getComputedStyle(indicator) : null;
      return {
        id: row.getAttribute("data-skin-menu-row") || "row",
        shortcut: row.getAttribute("data-skin-menu-shortcut") || "",
        connected: row.getAttribute("data-skin-menu-connected") === "true",
        selected: row.getAttribute("aria-selected") === "true",
        fontFamily: rowStyle.fontFamily,
        indicatorState: indicator?.getAttribute("data-skin-menu-indicator") || "missing",
        indicatorBackground: indicatorStyle?.backgroundColor || "missing",
      };
    });
    return {
      menuFont: getComputedStyle(scope).fontFamily,
      accentBright: resolveBackground("--pp-skin-accent-bright"),
      muted: resolveBackground("--pp-skin-ink-muted"),
      rows,
    };
  });

  if (!result.rows.length) {
    addFailure(failures, violation(menuName.toUpperCase(), `${menuName}-menu`, "menuRows", "0", ">= 1"));
    return;
  }

  for (const row of result.rows) {
    const identity = `${menuName}-${row.id}`;
    if (!row.shortcut || row.shortcut.length !== 1) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "shortcut", row.shortcut || "missing", "one visible keyboard shortcut"));
    }
    if (row.fontFamily !== result.menuFont) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "fontFamily", row.fontFamily, result.menuFont));
    }
    const expectedState = row.connected ? "connected" : "unwired";
    if (row.indicatorState !== expectedState) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "wiringIndicator", row.indicatorState, expectedState));
    }
    const expectedBackground = row.connected ? result.accentBright : result.muted;
    if (row.indicatorBackground !== expectedBackground) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "indicatorColor", row.indicatorBackground, expectedBackground));
    }
  }
}

async function inspectSolidChrome(page, surface, failures) {
  const chrome = await page.evaluate(() => {
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const probe = document.createElement("span");
    probe.style.position = "absolute";
    probe.style.background = "var(--pp-skin-accent-deep)";
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const selector = [
      ".pp-skin-v1-title",
      ".pp-skin-v1-bar",
      ".pp-skin-v1-bbs-banner",
      ".pp-skin-v1-dashboard-shell-title",
      ".pp-skin-v1-profile-banner",
      ".pp-skin-v1-status",
      ".pp-skin-v1-bbs-help",
    ].join(",");
    return {
      expected,
      elements: [...document.querySelectorAll(selector)].filter(visible).map((node, index) => {
        const style = getComputedStyle(node);
        return {
          id: node.id || [...node.classList].find((name) => name.startsWith("pp-skin-v1-")) || `chrome-${index}`,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
        };
      }),
    };
  });

  for (const item of chrome.elements) {
    if (item.backgroundImage !== "none") {
      addFailure(failures, violation(surface, item.id, "chromeBackgroundImage", item.backgroundImage, "none"));
    }
    if (item.backgroundColor !== chrome.expected) {
      addFailure(failures, violation(surface, item.id, "chromeBackgroundColor", item.backgroundColor, chrome.expected));
    }
  }
}

async function expectSelected(page, selector, surface, identity, failures) {
  const selected = await page.locator(selector).getAttribute("aria-selected");
  if (selected !== "true") {
    addFailure(failures, violation(surface, identity, "keyboardSelection", selected || "false", "true"));
  }
}

export async function runSkinV1MenuContractAudit({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const chromium = loadChromium(toolRoot);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  const failures = [];

  try {
    const response = await page.goto(new URL("/skin-v1", serverUrl || "http://127.0.0.1:4173").toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 menu audit failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("main.pp-skin-v1-home[data-experience-surface='DASHBOARD']", { timeout: 15_000 });

    await inspectMenu(page, "dashboard", failures);
    await inspectSolidChrome(page, "DASHBOARD", failures);

    const communityRow = page.locator("[data-dashboard-menu-item='community']");
    await communityRow.focus();
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "[data-dashboard-menu-item='library']", "DASHBOARD", "dashboard-library", failures);

    await page.keyboard.press("O");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });
    await inspectMenu(page, "settings", failures);
    await inspectSolidChrome(page, "SETTINGS", failures);

    const generalRow = page.locator("[data-settings-secondary-item='general']");
    await generalRow.focus();
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "[data-settings-secondary-item='appearance']", "SETTINGS", "settings-appearance", failures);
    await page.keyboard.press("D");
    await expectSelected(page, "[data-settings-secondary-item='data']", "SETTINGS", "settings-data", failures);

    await page.getByRole("button", { name: "Back to Dashboard" }).click();
    await page.locator("[data-skin-menu='dashboard']").waitFor({ state: "visible", timeout: 15_000 });
    await communityRow.focus();
    await page.keyboard.press("U");
    await page.locator("section[aria-label='Profile menu'][data-skin-menu='profile']").waitFor({ state: "visible", timeout: 15_000 });
    await inspectMenu(page, "profile", failures);
    await inspectSolidChrome(page, "PROFILE", failures);

    const profileRow = page.locator("[data-profile-menu-item='profile']");
    await profileRow.focus();
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "[data-profile-menu-item='local-ai']", "PROFILE", "profile-local-ai", failures);

    await profileRow.focus();
    await page.keyboard.press("N");
    await page.locator("section[aria-label='Node information']").waitFor({ state: "visible", timeout: 15_000 });
  } finally {
    await context.close();
    await browser.close();
  }

  if (failures.length) throw new Error(`Skin V1 menu contract UAT failed:\n- ${failures.join("\n- ")}`);
  return { menus: ["dashboard", "settings", "profile"], status: "pass" };
}
