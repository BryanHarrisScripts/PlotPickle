import path from "node:path";
import { createBrowserVerificationSession } from "./browser-verification-broker.mjs";


function violation(surface, stableIdentity, property, actual, expected, semanticRole = "menu", source = "skin-v1-menu-contract") {
  return {
    surface,
    semanticRole,
    stableIdentity,
    property,
    actual: String(actual ?? ""),
    expected: String(expected ?? ""),
    source,
  };
}

function addFailure(failures, detail) {
  failures.push(`UI-CONFORMANCE ${JSON.stringify(detail)}`);
}


async function clickSurfaceReturn(page, legacyLabel) {
  const orchestrated = page.locator("button.pp-skin-v1-orchestrator-return:visible").first();
  if (await orchestrated.count()) {
    await orchestrated.click();
    return;
  }
  await page.getByRole("button", { name: legacyLabel }).click();
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
        surfaceState: row.getAttribute("data-dashboard-surface-state") || "",
        locked: row.getAttribute("data-dashboard-locked") === "true",
        fontFamily: rowStyle.fontFamily,
        backgroundColor: rowStyle.backgroundColor,
        borderColor: rowStyle.borderTopColor,
        indicatorState: indicator?.getAttribute("data-skin-menu-indicator") || "missing",
        indicatorBackground: indicatorStyle?.backgroundColor || "missing",
      };
    });
    return {
      indicatorsHidden: scope.getAttribute("data-skin-menu-indicators") === "hidden",
      menuFont: getComputedStyle(scope).fontFamily,
      accentDeep: resolveBackground("--pp-skin-accent-deep"),
      accentBright: resolveBackground("--pp-skin-accent-bright"),
      warning: resolveBackground("--pp-skin-warning"),
      muted: resolveBackground("--pp-skin-ink-muted"),
      rows,
    };
  });

  if (!result.rows.length) {
    addFailure(failures, violation(menuName.toUpperCase(), `${menuName}-menu`, "menuRows", "0", ">= 1"));
    return;
  }

  const selectedRows = result.rows.filter((row) => row.selected);
  if (selectedRows.length !== 1) {
    addFailure(failures, violation(menuName.toUpperCase(), `${menuName}-menu`, "selectedRows", selectedRows.length, "1"));
  }

  for (const row of result.rows) {
    const identity = `${menuName}-${row.id}`;
    if (!row.shortcut || row.shortcut.length !== 1) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "shortcut", row.shortcut || "missing", "one visible keyboard shortcut"));
    }
    if (row.fontFamily !== result.menuFont) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "fontFamily", row.fontFamily, result.menuFont));
    }
    if (!result.indicatorsHidden) {
      const expectedState = row.connected ? "connected" : "unwired";
      if (row.indicatorState !== expectedState) {
        addFailure(failures, violation(menuName.toUpperCase(), identity, "wiringIndicator", row.indicatorState, expectedState));
      }
      const isDashboardReviewItem = menuName === "dashboard"
        && ["previs", "timeline", "production"].includes(row.id);
      const expectedBackground = isDashboardReviewItem
        ? result.warning
        : row.connected
          ? result.accentBright
          : result.muted;
      if (row.indicatorBackground !== expectedBackground) {
        addFailure(failures, violation(menuName.toUpperCase(), identity, "indicatorColor", row.indicatorBackground, expectedBackground));
      }
      if (menuName === "dashboard") {
        const expectedSurfaceState = isDashboardReviewItem ? "in-review" : row.connected ? "locked" : "unavailable";
        if (row.surfaceState !== expectedSurfaceState) {
          addFailure(failures, violation("DASHBOARD", identity, "surfaceState", row.surfaceState || "missing", expectedSurfaceState));
        }
        const expectedLocked = row.connected && !isDashboardReviewItem;
        if (row.locked !== expectedLocked) {
          addFailure(failures, violation("DASHBOARD", identity, "locked", row.locked, expectedLocked));
        }
      }
    }
    if (row.selected && row.backgroundColor !== result.accentDeep) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "selectedBackground", row.backgroundColor, result.accentDeep));
    }
    if (row.selected && row.borderColor !== result.accentBright) {
      addFailure(failures, violation(menuName.toUpperCase(), identity, "selectedBorder", row.borderColor, result.accentBright));
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
      ".pp-skin-v1-dashboard-shell-title",
      ".pp-skin-v1-status",
      ".pp-skin-v1-bbs-help",
      "[data-skin-chrome='solid']",
    ].join(",");
    return {
      expected,
      elements: [...document.querySelectorAll(selector)].filter(visible).map((node, index) => {
        const style = getComputedStyle(node);
        return {
          id: node.id || node.getAttribute("data-skin-chrome") || [...node.classList].find((name) => name.startsWith("pp-skin-v1-")) || `chrome-${index}`,
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

async function inspectSystemErrorLeaks(page, surface, scopeSelector, failures) {
  const findings = await page.locator(scopeSelector).first().evaluate((scope) => {
    const visible = (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    };
    const runtimePattern = /\b(?:EEXIST|ENOENT|EACCES|EPERM|TypeError|ReferenceError|Unhandled)\b|[A-Za-z]:\\(?:Users|Program Files|AppData)\\|\/(?:home|Users|tmp)\//u;
    return [...scope.querySelectorAll("[role='status'], [role='alert']")]
      .filter(visible)
      .map((node, index) => ({
        id: node.id || node.getAttribute("aria-label") || `system-status-${index}`,
        leaked: runtimePattern.test(node.textContent || ""),
      }))
      .filter((item) => item.leaked)
      .map(({ id }) => ({ id }));
  });

  for (const finding of findings) {
    addFailure(failures, violation(
      surface,
      finding.id,
      "runtimeErrorLeak",
      "detected",
      "none",
      "status",
      "skin-v1-system-content-contract",
    ));
  }
}

async function expectSelected(page, selector, surface, identity, failures) {
  const selected = await page.locator(selector).getAttribute("aria-selected");
  if (selected !== "true") {
    addFailure(failures, violation(surface, identity, "keyboardSelection", selected || "false", "true"));
  }
}

export async function runSkinV1MenuContractAudit({ serverUrl, toolRoot, storageStatePath = "" } = {}) {
  const server = new URL(serverUrl || "http://127.0.0.1:4173");
  const browserSession = await createBrowserVerificationSession({
    toolRoot,
    runId: "skin-v1-menu-contract-audit",
    allowedOrigins: [server.origin],
    failOnBlockers: true,
  });
  const browser = browserSession.browser;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  const page = await context.newPage();
  const failures = [];
  const skinUrl = new URL("/skin-v1", server).toString();

  try {
    const response = await page.goto(skinUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!response || response.status() >= 400) throw new Error(`Skin V1 menu audit failed to render: HTTP ${response?.status() ?? "no response"}`);
    await page.waitForSelector("main.pp-skin-v1-home[data-experience-surface='DASHBOARD']", { timeout: 15_000 });

    await inspectMenu(page, "dashboard", failures);
    await inspectSolidChrome(page, "DASHBOARD", failures);
    await browserSession.checkpoint(page, { surfaceId: "dashboard", route: skinUrl, actionId: "menu-contract", checkpoint: "governed-surface-ready" });

    const communityRow = page.locator("[data-dashboard-menu-item='community']");
    await communityRow.focus();
    await page.keyboard.press("C");
    await page.locator("section[aria-label='PlotPickle Community']").waitFor({ state: "visible", timeout: 20_000 });
    await inspectSystemErrorLeaks(page, "COMMUNITY", "section[aria-label='PlotPickle Community']", failures);

    await page.goto(skinUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector("main.pp-skin-v1-home[data-experience-surface='DASHBOARD']", { timeout: 15_000 });
    const resetCommunityRow = page.locator("[data-dashboard-menu-item='community']");
    await resetCommunityRow.focus();
    await page.keyboard.press("ArrowUp");
    await expectSelected(page, "[data-dashboard-menu-item='learn']", "DASHBOARD", "dashboard-learn", failures);
    await resetCommunityRow.focus();
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "[data-dashboard-menu-item='library']", "DASHBOARD", "dashboard-library", failures);
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "[data-dashboard-menu-item='discovery']", "DASHBOARD", "dashboard-discovery", failures);

    await page.keyboard.press("L");
    await page.locator("main[data-library-workspace='v2']").waitFor({ state: "visible", timeout: 20_000 });
    await page.locator("section[data-library-destination='load']").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("[data-library-nav='new']").click();
    await page.locator("section[data-library-destination='new']").waitFor({ state: "visible", timeout: 15_000 });
    await clickSurfaceReturn(page, "Back to Dashboard");
    await page.locator("[data-skin-menu='dashboard']").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("[data-dashboard-menu-item='library']").focus();

    await page.keyboard.press("M");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });
    await inspectMenu(page, "settings", failures);
    await inspectSolidChrome(page, "SETTINGS", failures);
    await browserSession.checkpoint(page, { surfaceId: "settings", route: page.url(), actionId: "menu-contract", checkpoint: "governed-surface-ready" });

    const settingsRows = await page.locator("[data-settings-secondary-item]").evaluateAll((rows) => rows.map((row) => ({
      id: row.getAttribute("data-settings-secondary-item"),
      shortcut: row.getAttribute("data-settings-shortcut"),
    })));
    const settingsIds = settingsRows.map((row) => row.id).join(",");
    const expectedSettingsIds = "general,local,cloud,hybrid,node-info,agents,ai-routing,buzz-settings";
    if (settingsIds !== expectedSettingsIds) {
      addFailure(failures, violation("SETTINGS", "settings-directory", "destinations", settingsIds, expectedSettingsIds));
    }
    const settingsShortcuts = settingsRows.map((row) => row.shortcut).join(",");
    if (settingsShortcuts !== "G,L,C,H,I,A,R,B") {
      addFailure(failures, violation("SETTINGS", "settings-directory", "shortcuts", settingsShortcuts, "G,L,C,H,I,A,R,B"));
    }

    const generalRow = page.locator("[data-settings-secondary-item='general']");
    await generalRow.focus();
    await page.keyboard.press("ArrowDown");
    await expectSelected(page, "[data-settings-secondary-item='local']", "SETTINGS", "settings-local", failures);

    await generalRow.focus();
    await page.keyboard.press("G");
    await page.locator("section[aria-label='General settings']").waitFor({ state: "visible", timeout: 15_000 });
    await inspectSolidChrome(page, "GENERAL", failures);
    await clickSurfaceReturn(page, "Back to Settings");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });

    await page.locator("[data-settings-secondary-item='local']").focus();
    await page.keyboard.press("L");
    await page.locator("section[aria-label='Local Story Mode setup']").waitFor({ state: "visible", timeout: 20_000 });
    await inspectSolidChrome(page, "LOCAL_STORY_MODE", failures);
    await clickSurfaceReturn(page, "Back to Settings");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });

    await page.locator("[data-settings-secondary-item='cloud']").focus();
    await page.keyboard.press("C");
    await page.locator("section[aria-label='Cloud Story Mode setup']").waitFor({ state: "visible", timeout: 20_000 });
    await inspectSolidChrome(page, "CLOUD_STORY_MODE", failures);
    await clickSurfaceReturn(page, "Back to Settings");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });

    await page.locator("[data-settings-secondary-item='hybrid']").focus();
    await page.keyboard.press("H");
    await page.locator("section[aria-label='Hybrid Story Mode']").waitFor({ state: "visible", timeout: 20_000 });
    await inspectSolidChrome(page, "HYBRID_STORY_MODE", failures);
    await clickSurfaceReturn(page, "Back to Settings");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });

    await page.locator("[data-settings-secondary-item='node-info']").focus();
    await page.keyboard.press("I");
    await page.locator("section[aria-label='Node information']").waitFor({ state: "visible", timeout: 20_000 });
    await inspectSolidChrome(page, "NODE", failures);
    await clickSurfaceReturn(page, "Back to Settings");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });

    await page.locator("[data-settings-secondary-item='agents']").focus();
    await page.keyboard.press("A");
    await page.locator("section[aria-label='PlotPickle Agents setup']").waitFor({ state: "visible", timeout: 30_000 });
    await inspectSolidChrome(page, "AGENTS", failures);
    await clickSurfaceReturn(page, "Back to Settings");
    await page.locator("section[aria-label='Settings menu'][data-skin-menu='settings']").waitFor({ state: "visible", timeout: 15_000 });

    await clickSurfaceReturn(page, "Back to Dashboard");
    await page.locator("[data-skin-menu='dashboard']").waitFor({ state: "visible", timeout: 15_000 });

    const directProfileRow = page.locator("[data-dashboard-menu-item='community']");
    await directProfileRow.focus();
    await page.keyboard.press("I");
    await page.locator("section[aria-label='User Profile']").waitFor({ state: "visible", timeout: 20_000 });
    await clickSurfaceReturn(page, "Back to Dashboard");
    await page.locator("[data-skin-menu='dashboard']").waitFor({ state: "visible", timeout: 15_000 });

    const writerCraftSourceRow = page.locator("[data-dashboard-menu-item='community']");
    await writerCraftSourceRow.focus();
    await page.keyboard.press("1");
    const allCurriculum = page.locator("section[aria-label='LEARN Explore All Curriculum'][data-learn-explore-access='unrestricted'][data-learn-explore-view='directory']");
    await allCurriculum.waitFor({ state: "visible", timeout: 20_000 });
    await inspectSolidChrome(page, "LEARN_EXPLORE", failures);
    await page.locator("input[aria-label='Search all curriculum'][data-learn-explore-search='true']").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("select[aria-label='Filter Explore by topic'][data-learn-explore-topic-filter='true']").waitFor({ state: "visible", timeout: 15_000 });
    await page.locator("select[aria-label='Filter Explore by Craft Module'][data-learn-explore-course-filter='true']").waitFor({ state: "visible", timeout: 15_000 });
    const exploreLessonCount = await page.locator("[data-learn-explore-lesson]").count();
    if (exploreLessonCount !== 96) {
      addFailure(failures, violation("LEARN_EXPLORE", "all-curriculum-results", "visibleLessonCount", exploreLessonCount, 96));
    }
    const learnJourneyCount = await page.locator("section[aria-label='LEARN menu'][data-skin-menu='learn-journey']").count();
    if (learnJourneyCount !== 0) {
      addFailure(failures, violation("LEARN_EXPLORE", "retired-journey-entry", "visibleJourneyCount", learnJourneyCount, 0));
    }
    const legacyWriterCraftMenuCount = await page.locator("[data-skin-menu='writer-craft']").count();
    if (legacyWriterCraftMenuCount !== 0) {
      addFailure(failures, violation("LEARN_EXPLORE", "legacy-writer-craft-menu", "visibleLegacyMenuCount", legacyWriterCraftMenuCount, 0));
    }
    await clickSurfaceReturn(page, "Back to Dashboard");
    await page.locator("[data-skin-menu='dashboard']").waitFor({ state: "visible", timeout: 20_000 });
    await inspectMenu(page, "dashboard", failures);
  } finally {
    await context.close();
    await browserSession.close();
  }

  if (failures.length) throw new Error(`Skin V1 menu contract UAT failed:\n- ${failures.join("\n- ")}`);
  return { menus: ["dashboard", "settings"], status: "pass" };
}
