import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2189 Start UAT is authenticated, profile-private and explicit opt-in", async () => {
  const [route, panel] = await Promise.all([
    read("app/api/auth/uat-guide/route.ts"),
    read("app/skin-v1/uat-guide-panel.tsx"),
  ]);

  assert.match(route, /boundary\.authorizeRequest\(requestBoundary\(request\), mutation \? \{ mutation: true \} : undefined\)/u);
  assert.match(route, /domain: "settings", objectId: PREFERENCE_OBJECT_ID/u);
  assert.match(route, /UAT_GUIDE_OPT_IN_REQUIRED/u);
  assert.match(route, /createHash\("sha256"\)\.update\(profileId\)/u);
  assert.match(route, /LOOPBACK = new Set\(\["127\.0\.0\.1", "localhost", "::1"\]\)/u);
  assert.doesNotMatch(route, /displayName|GitHub identity|BUZZ identity|USERNAME|USERPROFILE/u);

  assert.match(panel, /mode === "dashboard" && !payload\?\.enabled/u);
  assert.match(panel, /action: "set-enabled"/u);
  assert.match(panel, /X-PlotPickle-CSRF/u);
  assert.match(panel, /Profile-private opt-in/u);
});

test("#2189 UAT Guide reuses synthetic WebMCP authority and Afterglow deterministic acceptance", async () => {
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

test("#2189 Guide reports safe operational facts rather than model reasoning", async () => {
  const [guide, panel] = await Promise.all([
    read("scripts/run-uat-guide.mjs"),
    read("app/skin-v1/uat-guide-panel.tsx"),
  ]);

  assert.match(guide, /reports observable test operations only/u);
  assert.match(guide, /safeText\(value\)/u);
  assert.match(guide, /\[redacted-token\]/u);
  assert.match(guide, /\[redacted-api-key\]/u);
  assert.match(panel, /Synthetic Human isolation/u);
  assert.match(panel, /deterministic verification owns PASS\/FAIL/u);
  assert.match(panel, /Verification Inbox/u);
  assert.doesNotMatch(panel, /chain-of-thought|prompt text|model response/u);
});

test("#2189 Windows mirror uses the same Guide runner without granting shell authority to browser input", async () => {
  const [route, windowScript] = await Promise.all([
    read("app/api/auth/uat-guide/route.ts"),
    read("scripts/start-uat-guide-window.ps1"),
  ]);

  assert.match(route, /spawn\("powershell\.exe"/u);
  assert.match(route, /"-File", windowScript/u);
  assert.match(route, /shell: false/u);
  assert.match(windowScript, /Start-Process -FilePath \$Node -ArgumentList \$arguments/u);
  assert.match(windowScript, /"--stay-open"/u);
  assert.doesNotMatch(windowScript, /Invoke-Expression|cmd \/c|Start-Process .*https?:/u);
});

test("#2189 Dashboard and General Settings expose one shared UAT Guide component", async () => {
  const [dashboard, settings, css] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/skin-v1/uat-guide-panel.module.css"),
  ]);

  assert.match(dashboard, /<UatGuidePanel mode="dashboard" \/>/u);
  assert.match(settings, /<UatGuidePanel mode="settings" \/>/u);
  assert.match(css, /var\(--pp-skin-font-ui\)/u);
  assert.match(css, /var\(--pp-skin-radius\)/u);
  assert.doesNotMatch(css, /border-radius:\s*[1-9]\d*px/u);
});

test("#2189 UAT Guide files remain under existing verification and Skin ownership", async () => {
  const ownership = await readJson("config/verification/ownership-map.json");
  const webmcp = ownership.rules.find((rule) => rule.id === "webmcp-live-verifier");
  const entry = ownership.rules.find((rule) => rule.id === "uat-guide-authenticated-entry");
  const skin = ownership.rules.find((rule) => rule.id === "experience-skin-v1");

  assert.ok(webmcp?.include.includes("scripts/run-uat-guide.mjs"));
  assert.ok(webmcp?.include.includes("scripts/start-uat-guide-window.ps1"));
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
