import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2189 built-in UAT still automatically selects Local Story Mode", async () => {
  const panel = await read("app/skin-v1/uat-guide-panel.tsx");

  assert.match(panel, /async function ensureLocalStoryMode\(\)/u);
  assert.match(panel, /body: JSON\.stringify\(\{ mode: "local" \}\)/u);
  assert.match(panel, /async function start\(\)[\s\S]*await ensureLocalStoryMode\(\)/u);
  assert.match(panel, /START UAT REVIEW/u);
  assert.doesNotMatch(panel, /Show Start UAT Guide|setEnabled|mode="settings"|mode="dashboard"/u);
});

test("#2189 expired UAT profile sessions recover through the normal profile boundary", async () => {
  const panel = await read("app/skin-v1/uat-guide-panel.tsx");

  assert.match(panel, /PROFILE_UNLOCK_REQUIRED/u);
  assert.match(panel, /session is invalid or expired\|unlock a human profile\|human profile is locked/i);
  assert.doesNotMatch(panel, /window\.location\.reload|window\.setTimeout\(\(\) => window\.location\.reload/u);
  assert.match(panel, /Unlock the profile using PlotPickle's normal profile control/u);
});

test("#2189 UAT runner independently forces Local Story Mode before any acceptance checks", async () => {
  const runner = await read("scripts/run-uat-guide.mjs");

  assert.match(runner, /async function forceLocalStoryMode\(\)/u);
  assert.match(runner, /new URL\("\/api\/story-mode\/policy", server\.origin\)/u);
  assert.match(runner, /body: JSON\.stringify\(\{ mode: "local" \}\)/u);

  const forceIndex = runner.indexOf("await forceLocalStoryMode()");
  const syntheticIndex = runner.indexOf("await prepareVerificationSyntheticHome(syntheticHome)");
  assert.ok(forceIndex >= 0 && syntheticIndex > forceIndex, "Local Story Mode must be forced before the synthetic acceptance session starts.");
  assert.match(runner, /Cloud providers are not eligible for the default acceptance run/u);
});

test("#2189 Story Mode readiness requires complete capability coverage", async () => {
  const host = await read("app/skin-v1/story-mode-host.tsx");

  assert.match(host, /\[status\.text, status\.image, status\.video\]\.every/u);
  assert.match(host, /route\.locality === locality && route\.ready === true/u);
  assert.match(host, /const cloudReady = localityReady\(routingStatus, "cloud"\)/u);
  assert.match(host, /const hybridReady = hybridSelectionReady\(routingStatus\)/u);
  assert.match(host, /selected\.every\(Boolean\) && selected\.includes\("local"\) && selected\.includes\("cloud"\)/u);
});

test("#2189 Hybrid Story Mode is a two-column Local Cloud resource matrix over the existing router", async () => {
  const [host, hybrid] = await Promise.all([
    read("app/skin-v1/story-mode-host.tsx"),
    read("app/skin-v1/hybrid-story-mode-panel.tsx"),
  ]);

  assert.match(host, /<HybridStoryModePanel onChanged=\{\(\) => void refresh\(\)\} \/>/u);
  assert.match(hybrid, /data-hybrid-story-mode="capability-matrix"/u);
  assert.match(hybrid, />LOCAL RESOURCES</u);
  assert.match(hybrid, />CLOUD RESOURCES</u);
  for (const capability of ["text", "image", "video"]) {
    assert.match(hybrid, new RegExp(`id: "${capability}"`, "u"));
  }
  assert.match(hybrid, /option\.locality === locality/u);
  assert.match(hybrid, /fetch\("\/api\/ai-routing\/select"/u);
  assert.match(hybrid, /capability,\s*route,/u);
  assert.doesNotMatch(hybrid, /new provider registry|multiplexer|ollama-hybrid/iu);
});

test("#2189 Hybrid Cloud selections retain charge and video data-sharing consent", async () => {
  const hybrid = await read("app/skin-v1/hybrid-story-mode-panel.tsx");

  assert.match(hybrid, /cloud provider requests may incur charges/u);
  assert.match(hybrid, /cloud video prompts and selected reference media may leave this computer/u);
  assert.match(hybrid, /paidAcknowledged: locality === "cloud"/u);
  assert.match(hybrid, /dataSharingAcknowledged: capability === "video" && locality === "cloud"/u);
});

test("#2189 General Settings remains the single UAT entry without duplicating Story Mode authority", async () => {
  const [general, dashboard] = await Promise.all([
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.doesNotMatch(general, /aria-label="Story Mode"/u);
  assert.doesNotMatch(general, /persistStoryMode/u);
  assert.match(general, /<UatGuidePanel \/>/u);
  assert.doesNotMatch(dashboard, /UatGuidePanel/u);
});

test("#2189 WebMCP waits for the new Hybrid capability matrix", async () => {
  const registry = await read("lib/verification/webmcp-surface-capture-registry.mjs");
  assert.match(registry, /"hybrid-story-mode": Object\.freeze\(\{[\s\S]*?readySelector: "section\[aria-label='Hybrid Story Mode'\]\[data-story-mode-view='hybrid'\] \[data-hybrid-story-mode='capability-matrix'\]"/u);
  assert.doesNotMatch(registry, /data-story-mode-hybrid='policy-only'/u);
});
