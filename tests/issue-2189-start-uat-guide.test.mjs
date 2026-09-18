import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2189 UAT entry remains authenticated and loopback-only without an opt-in preference", async () => {
  const [route, panel] = await Promise.all([
    read("app/api/auth/uat-guide/route.ts"),
    read("app/skin-v1/uat-guide-panel.tsx"),
  ]);

  assert.match(route, /boundary\.authorizeRequest\(requestBoundary\(request\), mutation \? \{ mutation: true \} : undefined\)/u);
  assert.match(route, /createHash\("sha256"\)\.update\(profileId\)/u);
  assert.match(route, /LOOPBACK = new Set\(\["127\.0\.0\.1", "localhost", "::1"\]\)/u);
  assert.doesNotMatch(route, /PREFERENCE_OBJECT_ID|UAT_GUIDE_OPT_IN_REQUIRED|set-enabled/u);
  assert.doesNotMatch(route, /displayName|GitHub identity|BUZZ identity|USERNAME|USERPROFILE/u);

  assert.match(panel, /data-uat-semantic-review="built-in"/u);
  assert.match(panel, /START UAT REVIEW/u);
  assert.match(panel, /X-PlotPickle-CSRF/u);
  assert.doesNotMatch(panel, /Show Start UAT Guide|setEnabled|payload\?\.enabled/u);
});

test("#2189 UAT Semantic Review reuses synthetic WebMCP authority and Afterglow deterministic acceptance", async () => {
  const [guide, webmcp, catalogue] = await Promise.all([
    read("scripts/run-uat-guide.mjs"),
    read("scripts/run-webmcp-startup-uat.mjs"),
    read("lib/verification/webmcp-standard-surface-catalogue.mjs"),
  ]);

  assert.match(guide, /prepareVerificationSyntheticHome\(syntheticHome\)/u);
  assert.match(guide, /cleanupVerificationSyntheticHome\(syntheticHome\)/u);
  assert.match(guide, /runWebMcpStartupUat\(\{/u);
  assert.match(guide, /allowBaselinePrompt: false/u);
  assert.match(guide, /tests\/issue-2174-afterglow-story-to-screen-acceptance\.test\.mjs/u);
  assert.match(guide, /tests\/issue-2189-canonical-routing-fence\.test\.mjs/u);
  assert.match(guide, /providerSpendAllowed: false/u);
  assert.match(guide, /privateStoryRead: false/u);
  assert.match(guide, /hiddenReasoningRecorded: false/u);

  assert.match(webmcp, /export async function runWebMcpStartupUat/u);
  assert.match(webmcp, /onSurface: async \(surface\) => onEvent\?\.\(/u);
  assert.match(catalogue, /onSurface = null/u);
  assert.match(catalogue, /await onSurface\?\.\(\{ id: contract\.id, label: contract\.label/u);
});

test("#2189 Semantic Review reports safe operational facts rather than model reasoning", async () => {
  const [guide, panel] = await Promise.all([
    read("scripts/run-uat-guide.mjs"),
    read("app/skin-v1/uat-guide-panel.tsx"),
  ]);

  assert.match(guide, /reports observable test operations only/u);
  assert.match(guide, /safeText\(value\)/u);
  assert.match(guide, /\[redacted-token\]/u);
  assert.match(guide, /\[redacted-api-key\]/u);
  assert.match(panel, /synthetic verification isolation/u);
  assert.match(panel, /deterministic verification owns PASS\/FAIL/u);
  assert.doesNotMatch(panel, />Verification Inbox<|href=\{payload\?\.verificationInbox|\/verification-inbox/u);
  assert.doesNotMatch(panel, /chain-of-thought|prompt text|model response/u);
});

test("#2189 normal Human UAT stays in-page rather than launching a second Windows console", async () => {
  const [route, panel, legacyWindowScript] = await Promise.all([
    read("app/api/auth/uat-guide/route.ts"),
    read("app/skin-v1/uat-guide-panel.tsx"),
    read("scripts/start-uat-guide-window.ps1"),
  ]);

  assert.doesNotMatch(route, /powershell\.exe|windowScript|mirrorWindows/u);
  assert.doesNotMatch(panel, /Mirror status|mirrorWindows|canMirrorWindows/u);
  assert.match(panel, /In-page command window/u);
  assert.doesNotMatch(legacyWindowScript, /Invoke-Expression|cmd \/c|Start-Process .*https?:/u);
});

test("#2189 General Settings is the single shared UAT Semantic Review entry", async () => {
  const [dashboard, settings, css] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/skin-v1/uat-guide-panel.module.css"),
  ]);

  assert.doesNotMatch(dashboard, /UatGuidePanel/u);
  assert.match(settings, /<UatGuidePanel \/>/u);
  assert.match(css, /\.consoleBody/u);
  assert.match(css, /var\(--pp-skin-font-ui\)/u);
  assert.match(css, /var\(--pp-skin-radius\)/u);
  assert.doesNotMatch(css, /border-radius:\s*[1-9]\d*px/u);
});

test("#2189 UAT files remain under existing verification and Skin ownership", async () => {
  const ownership = await readJson("config/verification/ownership-map.json");
  const webmcp = ownership.rules.find((rule) => rule.id === "webmcp-live-verifier");
  const entry = ownership.rules.find((rule) => rule.id === "uat-guide-authenticated-entry");
  const skin = ownership.rules.find((rule) => rule.id === "experience-skin-v1");

  assert.ok(webmcp?.include.includes("scripts/run-uat-guide.mjs"));
  assert.deepEqual(entry?.include, ["app/api/auth/uat-guide/route.ts"]);
  assert.equal(entry?.ownerLayer, "verification");
  assert.ok(skin?.include.includes("app/skin-v1/**"));
});

test("#2189 default UAT run cannot auto-approve visual baselines", async () => {
  const [guide, webmcp] = await Promise.all([
    read("scripts/run-uat-guide.mjs"),
    read("scripts/run-webmcp-startup-uat.mjs"),
  ]);
  assert.match(guide, /allowBaselinePrompt: false/u);
  assert.match(webmcp, /allowBaselinePrompt\s*\?\s*await promptVisualBaselineChanges/u);
  assert.match(webmcp, /no visual baseline was auto-approved/u);
});
