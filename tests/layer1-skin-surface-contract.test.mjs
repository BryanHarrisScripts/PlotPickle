import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  loadSkinV1SurfaceContractSources,
  resolveSkinV1BlastRadius,
  resolveSkinV1GovernedCompositions,
} from "../lib/verification/skin-v1/surface-contracts.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Layer 1 canonical Skin contract keeps one continuous secure Skin V1 LOGON shell", async () => {
  const [client, css, router, voice] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1.css"),
    read("app/profile-access/profile-access-router.tsx"),
    read("lib/voice-input.ts"),
  ]);

  assert.match(client, /function webMcpProfileGateCaptureRequested/u);
  assert.match(client, /__PLOTPICKLE_WEBMCP_PROFILE_GATE_CAPTURE__/u);
  assert.match(client, /if \(webMcpProfileGateCaptureRequested\(\)\) return;/u);
  assert.match(client, /view\.state === "loading" \? "initializing" : view\.state/u);
  assert.match(client, /data-skin-v1-logon-state=\{logonState\}/u);
  assert.match(client, /PLOTPICKLE[\s\S]*LOGON[\s\S]*MATRIX/u);
  assert.match(client, /view\.profiles\.length === 1[\s\S]*data-skin-v1-known-profile="true"/u);
  assert.match(client, /view\.profiles\.length > 1[\s\S]*<select/u);
  assert.match(client, /autoFocus=\{view\.profiles\.length === 1\}/u);
  assert.match(css, /\.pp-skin-v1-logon > \.pp-skin-v1-panel > :is\(p, form, \.pp-skin-v1-message\)[\s\S]*min-height: 260px/u);
  assert.ok(router.includes('if (publicWebRoot || isSkinV1Path(pathname) || isPublicWebPath(pathname)) return <>{children}</>;'));
  assert.match(voice, /password\|passphrase\|secret/u);
});

test("Layer 1 canonical Skin contract captures startup states without browser credential entry", async () => {
  const [capture, runner, auth] = await Promise.all([
    read("lib/verification/skin-v1/profile-gate-capture.mjs"),
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("scripts/full-verification-auth.mjs"),
  ]);

  assert.match(capture, /startup-initializing-candidate\.png/u);
  assert.match(capture, /profile-locked-candidate\.png/u);
  assert.match(capture, /filledPasswordFieldCount/u);
  assert.match(capture, /state === "locked"[\s\S]*passwordFieldCount !== 1/u);
  assert.doesNotMatch(capture, /page\.fill\(|keyboard\.type\(|locator\([^\n]*password[^\n]*\)\.fill/u);
  assert.match(capture, /credentialAutomation: false/u);
  assert.match(capture, /assertProfileGateContinuity/u);
  assert.match(capture, /data-skin-v1-logon-state/u);
  assert.match(capture, /new URL\("\/skin-v1", server\.origin\)/u);
  assert.match(capture, /shellGeometry\(rootLocator\)/u);
  assert.match(capture, /canonicalHeader/u);
  assert.match(capture, /initializingHeader !== lockedHeader/u);
  assert.match(capture, /headerDeltas/u);

  assert.match(runner, /prepareWebMcpProfileGateSession/u);
  const initializing = capture.indexOf('state: "initializing"');
  const createProfile = capture.indexOf("const prepared = await createVerificationSyntheticProfile");
  const locked = capture.indexOf('state: "locked"', initializing + 1);
  const authenticate = capture.indexOf("const auth = await authenticateVerificationSyntheticProfile");
  assert.ok(initializing >= 0 && createProfile > initializing && locked > createProfile && authenticate > locked);
  assert.match(capture, /writeProfileGateCaptureReport/u);
  assert.match(capture, /Startup\/profile gate captured safely/u);

  assert.match(auth, /export async function createVerificationSyntheticProfile/u);
  assert.match(auth, /export async function authenticateVerificationSyntheticProfile/u);
  assert.match(auth, /action: "create-first-profile"/u);
  assert.match(auth, /action: "login"/u);
});

test("Layer 1 ordinary selection stays consolidated to three current-product owners", async () => {
  const catalog = JSON.parse(await read("config/verification/test-catalog.json"));
  const ordinary = catalog.entries
    .filter((entry) => entry.ownerLayer === "experience-skins" && entry.modes.some((mode) => mode === "baseline" || mode === "impact"))
    .map((entry) => entry.id)
    .sort();
  assert.deepEqual(ordinary, [
    "experience.navigation-continuity",
    "experience.skin-surface-contract",
    "experience.webmcp-live-observer",
  ]);
  const historical = catalog.entries.filter((entry) => entry.ownerLayer === "experience-skins" && entry.modes.length === 1 && entry.modes[0] === "manual");
  assert.equal(historical.length, 12);
});


test("Layer 1 #2364 governed primitives inherit through families and resolve deterministic blast radius", async () => {
  const sources = await loadSkinV1SurfaceContractSources();
  const compositions = resolveSkinV1GovernedCompositions(sources);
  const byId = new Map(compositions.map((composition) => [composition.surfaceId, composition]));

  for (const id of ["dashboard", "writers-craft", "discovery", "storyboard", "settings"]) {
    assert.ok(byId.has(id), `Missing governed primitive composition for ${id}`);
  }

  assert.ok(byId.get("dashboard").effectivePrimitives.includes("application-header"));
  assert.ok(!byId.get("dashboard").effectivePrimitives.includes("return-control"));
  assert.ok(byId.get("writers-craft").effectivePrimitives.includes("horizontal-menu"));
  assert.ok(byId.get("settings").effectivePrimitives.includes("horizontal-menu"));
  assert.ok(byId.get("storyboard").effectivePrimitives.includes("content-frame"));
  assert.ok(byId.get("discovery").effectivePrimitives.includes("application-shell"));

  assert.equal(sources.registry.surfaces.some((surface) => surface.id === "dsdd-live-uat"), false);
  assert.equal(sources.grammar.overlayProfiles["dsdd-live-uat"].isPageSurface, false);
  assert.deepEqual(
    sources.grammar.overlayProfiles["dsdd-live-uat"].primitives,
    ["overlay-shell", "input-console", "status-bar", "action-control"],
  );

  const horizontalMenu = resolveSkinV1BlastRadius(sources, { type: "primitive", id: "horizontal-menu" });
  assert.deepEqual(horizontalMenu.affectedSurfaces, ["settings", "writers-craft"]);
  assert.deepEqual(horizontalMenu.affectedFamilies, ["settings", "writers-craft"]);
  assert.deepEqual(horizontalMenu.affectedOverlays, []);

  const inputConsole = resolveSkinV1BlastRadius(sources, { type: "primitive", id: "input-console" });
  assert.deepEqual(inputConsole.affectedSurfaces, []);
  assert.deepEqual(inputConsole.affectedOverlays, ["dsdd-live-uat"]);

  const storyFamily = resolveSkinV1BlastRadius(sources, { type: "family", id: "story" });
  assert.deepEqual(storyFamily.affectedSurfaces, ["discovery"]);

  const storyboard = resolveSkinV1BlastRadius(sources, { type: "surface", id: "storyboard" });
  assert.deepEqual(storyboard.affectedSurfaces, ["scene-timeline", "storyboard", "visual-story"]);
  assert.deepEqual(storyboard.affectedFamilies, ["storyboard"]);
});
