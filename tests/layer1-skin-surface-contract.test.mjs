import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Layer 1 canonical Skin contract keeps one continuous secure Profile Gate", async () => {
  const [boundary, css, router, voice] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("app/profile-access/profile-access-boundary.module.css"),
    read("app/profile-access/profile-access-router.tsx"),
    read("lib/voice-input.ts"),
  ]);

  assert.match(boundary, /function ProfileGateShell/u);
  assert.match(boundary, /data-profile-gate-state=\{state\}/u);
  assert.match(boundary, /<h1>PlotPickle Profile Gate<\/h1>/u);
  assert.match(boundary, /state="initializing"[\s\S]*INITIALIZING LOCAL NODE/u);
  assert.match(boundary, /state="locked"/u);
  assert.match(boundary, /activeProfiles\.length === 1[\s\S]*screen: "login"/u);
  assert.match(boundary, /forceChooser: action === "switch-profile"/u);
  assert.match(boundary, /__PLOTPICKLE_WEBMCP_PROFILE_GATE_CAPTURE__/u);
  assert.match(boundary, /if \(webMcpProfileGateCaptureRequested\(\)\) return;/u);
  assert.match(css, /\.gateState[\s\S]*min-height:/u);
  assert.match(css, /html\[data-plotpickle-skin="skin-v1"\][\s\S]*\.gateState/u);
  assert.ok(router.includes('if (isSkinV1Path(pathname) || isPublicWebPath(pathname)) return <>{children}</>;'));
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
