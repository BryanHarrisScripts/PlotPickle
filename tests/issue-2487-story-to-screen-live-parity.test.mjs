import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2487 keeps canonical production id while Human-facing identity is Rough Cut", async () => {
  const [registry, menu, host] = await Promise.all([
    readJson("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  const production = registry.surfaces.find((surface) => surface.id === "production");
  assert.equal(production?.id, "production");
  assert.equal(production?.label, "Rough Cut");
  assert.equal(production?.navigationPath?.[0]?.label, "Rough Cut");
  assert.equal(production?.runtimeSelector, "[data-skin-v1-preproduction-review='production']");

  assert.match(menu, /id: "production"[\s\S]*label: "Rough Cut"/u);
  assert.match(host, /data-dashboard-review-surface="production"/u);
  assert.match(host, /<h1>ROUGH CUT<\/h1>/u);
});

test("#2487/#2612 live browser continuity opens only currently active downstream Dashboard destinations", async () => {
  const probe = await read("lib/verification/browser-probes/continuity.mjs");

  for (const stage of [
    '{ id: "timeline", menuId: "timeline", governed: "scene-timeline" }',
    '{ id: "production", menuId: "production", governed: "production" }',
  ]) assert.ok(probe.includes(stage), "missing active #2487 live stage " + stage);
  for (const deferred of ["sound-foley", "sound-narration", "sound-music", "screening"]) {
    assert.doesNotMatch(probe, new RegExp(`menuId: "${deferred}"`, "u"));
  }

  assert.match(probe, /openWebMcpGovernedSurface\(page, serverUrl, "dashboard"\)/u);
  assert.match(probe, /\[data-dashboard-menu-item='\$\{stage\.menuId\}'\]/u);
  assert.match(probe, /\[data-dashboard-review-surface='\$\{stage\.id\}'\]/u);
  assert.match(probe, /surface\.runtimeReadySelector/u);
  assert.match(probe, /expectedSurface: stage\.governed/u);
  assert.match(probe, /expectedLabel: surface\.label/u);
  assert.match(probe, /normal-dashboard-stage-open-after-orchestrator-settle/u);
});

test("#2487 every live stage returns to Dashboard cleanly", async () => {
  const probe = await read("lib/verification/browser-probes/continuity.mjs");

  assert.match(probe, /getByRole\("button", \{ name: "Back to Dashboard", exact: true \}\)/u);
  assert.match(probe, /await backToDashboard\.click\(\)/u);
  assert.match(probe, /canonicalSurface\("dashboard"\)/u);
  assert.match(probe, /expectedSurface: "dashboard"/u);
  assert.match(probe, /expectedLabel: dashboardSurface\.label/u);
  assert.match(probe, /normal-dashboard-stage-return-after-orchestrator-settle/u);
  assert.match(probe, /stage: `\$\{stage\.id\}:dashboard-return`/u);
});

test("#2487 proof is a rendered WebMCP browser path, not a source-only checklist", async () => {
  const [runner, probe] = await Promise.all([
    read("lib/verification/webmcp-qa/runner.mjs"),
    read("lib/verification/browser-probes/continuity.mjs"),
  ]);

  assert.match(runner, /runWebMcpContinuityProfile/u);
  assert.match(runner, /browser-probes\/continuity\.mjs/u);
  assert.match(probe, /createBrowserVerificationSession/u);
  assert.match(probe, /session\.browser\.newContext/u);
  assert.match(probe, /control\.click\(\)/u);
  assert.match(probe, /waitFor\(\{ state: "visible"/u);
});
