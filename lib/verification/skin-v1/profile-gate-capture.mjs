#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createBrowserVerificationSession } from "../browser-verification-broker.mjs";
import { validateLocalServer, waitForUiServer } from "../ui-axe-audit.mjs";
import {
  authenticateVerificationSyntheticProfile,
  createVerificationSyntheticProfile,
} from "../../../scripts/full-verification-auth.mjs";

export const PROFILE_GATE_CAPTURE_ROOT = ".artifacts/visual-readiness";
export const PROFILE_GATE_CAPTURE_REPORT = ".artifacts/webmcp-startup/profile-gate-captures.json";
export const PROFILE_GATE_CAPTURE_PATHS = Object.freeze({
  initializing: path.posix.join(PROFILE_GATE_CAPTURE_ROOT, "startup-initializing-candidate.png"),
  locked: path.posix.join(PROFILE_GATE_CAPTURE_ROOT, "profile-locked-candidate.png"),
});

function expectedSelector(state) {
  if (state === "initializing") return "main[data-profile-gate-state='initializing']";
  if (state === "locked") return "main[data-profile-gate-state='locked']";
  throw new Error(`Unknown profile-gate capture state: ${state}`);
}

async function shellGeometry(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-profile-gate-state]");
    const card = root?.querySelector("section");
    const brand = card?.querySelector("header");
    const stateRegion = card?.querySelector("[class*='gateState']");
    const rect = (node) => {
      if (!(node instanceof HTMLElement)) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      root: rect(root),
      card: rect(card),
      brand: rect(brand),
      stateRegion: rect(stateRegion),
      title: card?.querySelector("h1")?.textContent?.trim() || "",
      passwordFieldCount: card?.querySelectorAll("input[type='password']").length || 0,
      filledPasswordFieldCount: Array.from(card?.querySelectorAll("input[type='password']") || [])
        .filter((input) => input instanceof HTMLInputElement && input.value.length > 0).length,
    };
  });
}

export async function captureWebMcpProfileGateState({
  state,
  serverUrl,
  toolRoot,
} = {}) {
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  await waitForUiServer(server);
  const relativeTarget = PROFILE_GATE_CAPTURE_PATHS[state];
  if (!relativeTarget) throw new Error("Profile-gate capture target is missing.");
  const target = path.resolve(relativeTarget);
  await mkdir(path.dirname(target), { recursive: true });

  const session = await createBrowserVerificationSession({
    toolRoot,
    allowedOrigins: [server.origin],
    runId: `profile-gate-${state}`,
  });
  let context;
  try {
    context = await session.browser.newContext({ viewport: { width: 1440, height: 1000 } });
    if (state === "initializing") {
      await context.addInitScript(() => {
        window.__PLOTPICKLE_WEBMCP_PROFILE_GATE_CAPTURE__ = "initializing";
      });
    }
    const page = await context.newPage();
    await page.goto(server.origin, { waitUntil: "domcontentloaded" });
    await page.locator(expectedSelector(state)).waitFor({ state: "visible", timeout: 20_000 });

    const geometry = await shellGeometry(page);
    if (geometry.title !== "PlotPickle Profile Gate") {
      throw new Error(`Profile-gate ${state} capture did not render the canonical shared title.`);
    }
    if (geometry.filledPasswordFieldCount !== 0) {
      throw new Error("Profile-gate capture refused to persist a filled password/passphrase field.");
    }
    if (state === "initializing" && geometry.passwordFieldCount !== 0) {
      throw new Error("Initialization capture unexpectedly rendered a credential field.");
    }
    if (state === "locked" && geometry.passwordFieldCount !== 1) {
      throw new Error("Locked profile capture did not expose exactly one empty passphrase field.");
    }

    await page.screenshot({ path: target, fullPage: true });
    await session.checkpoint(page, {
      surface: `PROFILE_GATE_${state.toUpperCase()}`,
      stage: "profile-gate-capture",
      screenshot: target,
    });
    return Object.freeze({ state, screenshot: target, geometry });
  } finally {
    await context?.close().catch(() => undefined);
    await session.close();
  }
}

export function assertProfileGateContinuity(initializing, locked) {
  const a = initializing?.geometry?.card;
  const b = locked?.geometry?.card;
  if (!a || !b) throw new Error("Profile-gate continuity requires both rendered card geometries.");
  const widthDelta = Math.abs(a.width - b.width);
  const xDelta = Math.abs(a.x - b.x);
  if (widthDelta > 1 || xDelta > 1) {
    throw new Error(`Profile-gate shell moved between initialization and locked state (width Δ ${widthDelta}px, x Δ ${xDelta}px).`);
  }
  return true;
}

export async function writeProfileGateCaptureReport({ initializing, locked } = {}) {
  assertProfileGateContinuity(initializing, locked);
  const target = path.resolve(PROFILE_GATE_CAPTURE_REPORT);
  await mkdir(path.dirname(target), { recursive: true });
  const report = {
    schemaVersion: 1,
    authority: "webmcp-profile-gate-observer",
    credentialAutomation: false,
    states: {
      initializing,
      locked,
    },
  };
  await writeFile(target, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return target;
}

export async function prepareWebMcpProfileGateSession({ baseUrl, home, toolRoot } = {}) {
  const initializing = await captureWebMcpProfileGateState({
    state: "initializing",
    serverUrl: baseUrl,
    toolRoot,
  });
  const prepared = await createVerificationSyntheticProfile({ baseUrl, home });
  const locked = await captureWebMcpProfileGateState({
    state: "locked",
    serverUrl: baseUrl,
    toolRoot,
  });
  await writeProfileGateCaptureReport({ initializing, locked });
  const auth = await authenticateVerificationSyntheticProfile({
    baseUrl,
    home,
    profileId: prepared.profileId,
    password: prepared.password,
  });
  console.log(`[PASS] Startup/profile gate captured safely: ${PROFILE_GATE_CAPTURE_PATHS.initializing}, ${PROFILE_GATE_CAPTURE_PATHS.locked}`);
  return auth;
}
