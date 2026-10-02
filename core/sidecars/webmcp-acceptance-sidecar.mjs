import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../../lib/verification/browser-verification-broker.mjs";

export const WEBMCP_ACCEPTANCE_JOURNEYS = Object.freeze({
  "mind-map-world-map-shared-header": Object.freeze({
    id: "mind-map-world-map-shared-header",
    issue: 2667,
    description: "Dashboard → Mind Map → Dashboard → World Map → Dashboard with shared-header and project-continuity proof.",
    postMergeCritical: true,
  }),
});

const ACTIVE_PROJECT_KEY_PREFIX = "plotpickle.project-library.session-project";

function clean(value, maximum = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function normalizeWebMcpAcceptanceRequest(request = {}) {
  const requestId = clean(request.requestId, 240);
  const target = clean(request.target, 240);
  const mode = request.mode === "post-merge" ? "post-merge" : "exact-head";
  if (!requestId) throw new Error("Browser acceptance requestId is required.");
  if (request.operation !== "rendered-acceptance") throw new Error("Browser acceptance sidecar only accepts rendered-acceptance requests.");
  if (!WEBMCP_ACCEPTANCE_JOURNEYS[target]) throw new Error(`Unknown browser acceptance journey: ${target || "missing"}`);
  return Object.freeze({
    requestId,
    operation: "rendered-acceptance",
    target,
    mode,
    commitSha: clean(request.commitSha, 160),
  });
}

export function evaluateAcceptanceAssertions(request, assertions, evidenceRefs = []) {
  const normalized = normalizeWebMcpAcceptanceRequest(request);
  const records = Array.isArray(assertions) ? assertions.map((entry) => Object.freeze({
    id: clean(entry?.id, 240) || "unnamed-assertion",
    status: entry?.status === "PASS" ? "PASS" : "FAIL",
    expected: clean(entry?.expected, 1000),
    observed: clean(entry?.observed, 2000),
  })) : [];
  const blockers = records.filter((entry) => entry.status === "FAIL");
  return Object.freeze({
    schemaVersion: 1,
    requestId: normalized.requestId,
    journeyId: normalized.target,
    mode: normalized.mode,
    commitSha: normalized.commitSha,
    state: blockers.length ? "failed" : "ready",
    status: blockers.length ? "FAIL" : "PASS",
    rendered: true,
    deterministic: true,
    isolatedBrowserContext: true,
    assertions: Object.freeze(records),
    blockerCount: blockers.length,
    evidenceRefs: Object.freeze([...new Set((Array.isArray(evidenceRefs) ? evidenceRefs : []).map((value) => clean(value, 1000)).filter(Boolean))]),
  });
}

function assertion(id, pass, expected, observed) {
  return {
    id,
    status: pass ? "PASS" : "FAIL",
    expected: String(expected ?? ""),
    observed: String(observed ?? ""),
  };
}

async function settledSurfaceIdentity(page) {
  const root = page.locator("[data-skin-v1-orchestrator='runtime']").first();
  await root.waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForFunction(() => {
    const node = document.querySelector("[data-skin-v1-orchestrator='runtime']");
    return node instanceof HTMLElement
      && Boolean(node.dataset.skinV1ActiveSurface)
      && node.dataset.skinV1ActiveSurface !== "pending";
  }, { timeout: 20_000 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return clean(await root.getAttribute("data-skin-v1-active-surface"), 240);
}

async function sessionActiveProjectId(page) {
  return page.evaluate((prefix) => {
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const value = sessionStorage.getItem(key)?.trim();
      if (value) return value;
    }
    return null;
  }, ACTIVE_PROJECT_KEY_PREFIX);
}

async function topicLabels(page, ariaLabel) {
  return page.locator(`nav[aria-label="${ariaLabel}"] button`).allTextContents()
    .then((values) => values.map((value) => value.trim()).filter(Boolean));
}

async function firstControlBox(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  return box ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } : null;
}

function aligned(left, right, tolerance = 24) {
  return Boolean(left && right && Math.abs(left.x - right.x) <= tolerance);
}

async function returnToDashboard(page) {
  const back = page.getByRole("button", { name: "Back to Dashboard", exact: true }).first();
  await back.waitFor({ state: "visible", timeout: 20_000 });
  await back.click();
  await page.locator("[data-dashboard-menu-item='discovery']").first().waitFor({ state: "visible", timeout: 20_000 });
  return settledSurfaceIdentity(page);
}

async function runMindMapWorldMapJourney({ page, serverUrl, session }) {
  const assertions = [];
  const evidenceRefs = [];

  await page.goto(serverUrl, { waitUntil: "domcontentloaded" });
  await page.locator("[data-dashboard-menu-item='discovery']").first().waitFor({ state: "visible", timeout: 30_000 });
  const initialProject = await sessionActiveProjectId(page);
  assertions.push(assertion("active-project-present-before-journey", Boolean(initialProject), "known active project id", initialProject || "none"));

  await page.locator("[data-dashboard-menu-item='discovery']").first().click();
  const mind = page.locator("[data-mind-map-surface='true']").first();
  await mind.waitFor({ state: "visible", timeout: 30_000 });
  const mindIdentity = await settledSurfaceIdentity(page);
  const mindProject = clean(await mind.getAttribute("data-discovery-project"), 240);
  const mindTopics = await topicLabels(page, "MindMap Learn topics");
  const mindActCount = await page.locator("[data-mind-map-act-choice]").count();
  const mindActBox = await firstControlBox(page, "[data-mind-map-act-choice]");
  const mindTopicBox = await firstControlBox(page, "nav[aria-label='MindMap Learn topics'] button");
  assertions.push(
    assertion("mind-map-settled-identity", mindIdentity === "discovery", "discovery", mindIdentity),
    assertion("mind-map-project-continuity", Boolean(initialProject) && mindProject === initialProject, initialProject || "known active project", mindProject || "none"),
    assertion("mind-map-four-act-controls", mindActCount === 4, "4", mindActCount),
    assertion("mind-map-topic-rail-alignment", aligned(mindActBox, mindTopicBox), "first Act/topic controls left-aligned within 24px", JSON.stringify({ act: mindActBox, topic: mindTopicBox })),
  );
  await page.locator("[data-mind-map-act-choice]").first().focus();
  await page.keyboard.press("2");
  await page.waitForFunction(() => document.querySelector("[data-mind-map-surface='true']")?.getAttribute("data-mind-map-act") === "2");
  assertions.push(assertion("mind-map-key-2-selects-act-2", await mind.getAttribute("data-mind-map-act") === "2", "2", await mind.getAttribute("data-mind-map-act")));
  await session.checkpoint(page, { surfaceId: "discovery", actionId: "dsdd-rendered-acceptance", checkpoint: "mind-map-settled" });

  const dashboardAfterMind = await returnToDashboard(page);
  assertions.push(assertion("mind-map-back-to-dashboard", dashboardAfterMind === "dashboard", "dashboard", dashboardAfterMind));

  await page.locator("[data-dashboard-menu-item='story-bible']").first().click();
  const world = page.locator("[data-world-map-surface='review']").first();
  await world.waitFor({ state: "visible", timeout: 30_000 });
  const worldIdentity = await settledSurfaceIdentity(page);
  const worldProject = clean(await world.getAttribute("data-story-bible-project-id"), 240);
  const worldTopics = await topicLabels(page, "World Map Learn topics");
  const worldActCount = await page.locator("[data-world-map-act-choice]").count();
  const worldActBox = await firstControlBox(page, "[data-world-map-act-choice]");
  const worldTopicBox = await firstControlBox(page, "nav[aria-label='World Map Learn topics'] button");
  assertions.push(
    assertion("world-map-settled-identity", worldIdentity === "story-bible", "story-bible", worldIdentity),
    assertion("world-map-project-continuity", Boolean(initialProject) && worldProject === initialProject, initialProject || "known active project", worldProject || "none"),
    assertion("world-map-four-act-controls", worldActCount === 4, "4", worldActCount),
    assertion("world-map-topic-rail-alignment", aligned(worldActBox, worldTopicBox), "first Act/topic controls left-aligned within 24px", JSON.stringify({ act: worldActBox, topic: worldTopicBox })),
    assertion("shared-topic-spine-same-order", mindTopics.length === 12 && JSON.stringify(mindTopics) === JSON.stringify(worldTopics), JSON.stringify(mindTopics), JSON.stringify(worldTopics)),
  );
  await page.locator("[data-world-map-act-choice]").first().focus();
  await page.keyboard.press("2");
  await page.waitForFunction(() => document.querySelector("[data-world-map-surface='review']")?.getAttribute("data-world-map-act") === "2");
  assertions.push(assertion("world-map-key-2-selects-act-2", await world.getAttribute("data-world-map-act") === "2", "2", await world.getAttribute("data-world-map-act")));
  await session.checkpoint(page, { surfaceId: "story-bible", actionId: "dsdd-rendered-acceptance", checkpoint: "world-map-settled" });

  const dashboardAfterWorld = await returnToDashboard(page);
  const finalProject = await sessionActiveProjectId(page);
  assertions.push(
    assertion("world-map-back-to-dashboard", dashboardAfterWorld === "dashboard", "dashboard", dashboardAfterWorld),
    assertion("journey-active-project-stable", Boolean(initialProject) && finalProject === initialProject, initialProject || "known active project", finalProject || "none"),
  );

  return { assertions, evidenceRefs };
}

export async function runWebMcpAcceptanceJourney({
  request,
  serverUrl,
  toolRoot,
  storageStatePath,
  artifactRoot = ".artifacts/webmcp-acceptance",
} = {}) {
  const normalized = normalizeWebMcpAcceptanceRequest(request);
  if (!serverUrl || !toolRoot || !storageStatePath) {
    throw new Error("Browser acceptance requires serverUrl, toolRoot and isolated synthetic storageStatePath.");
  }
  const origin = new URL(serverUrl).origin;
  const session = await createBrowserVerificationSession({
    toolRoot,
    runId: normalized.requestId.replace(/[^a-z0-9_.-]+/giu, "-").slice(0, 100),
    allowedOrigins: [origin],
    failOnBlockers: true,
  });
  const context = await session.browser.newContext({
    viewport: { width: 1440, height: 1000 },
    storageState: storageStatePath,
  });
  const page = await context.newPage();

  let result;
  try {
    if (normalized.target === "mind-map-world-map-shared-header") {
      const journey = await runMindMapWorldMapJourney({ page, serverUrl, session });
      const diagnostics = await session.finalize();
      const diagnosticBlockers = Number(diagnostics?.summary?.blockers ?? diagnostics?.blockers ?? 0);
      const assertions = [...journey.assertions, assertion(
        "browser-runtime-diagnostics",
        diagnosticBlockers === 0,
        "0 blocking browser diagnostics",
        String(diagnosticBlockers),
      )];
      result = evaluateAcceptanceAssertions(normalized, assertions, [
        ...journey.evidenceRefs,
        ...(diagnostics?.evidencePath ? [diagnostics.evidencePath] : []),
      ]);
    } else {
      throw new Error(`No executor is registered for browser acceptance journey ${normalized.target}.`);
    }
  } catch (error) {
    result = evaluateAcceptanceAssertions(normalized, [{
      id: "journey-execution",
      status: "FAIL",
      expected: "rendered journey completes",
      observed: error instanceof Error ? error.message : String(error),
    }]);
  } finally {
    await context.close().catch(() => undefined);
    await session.close().catch(() => undefined);
  }

  const folder = path.resolve(artifactRoot, normalized.target);
  await mkdir(folder, { recursive: true });
  const reportPath = path.join(folder, `${normalized.mode}.json`);
  await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return Object.freeze({ ...result, reportPath });
}
