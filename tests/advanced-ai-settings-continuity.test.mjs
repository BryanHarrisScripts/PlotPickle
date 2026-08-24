import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Advanced AI stays inside the three-column Settings workspace through shared Local and Cloud Compute", async () => {
  const [settings, compute, routingPanel, route] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
    read("app/ai-routing-panel.tsx"),
    read("app/ai-routing/page.tsx"),
  ]);

  assert.match(settings, /import AiComputeWorkspace from "\.\/settings\/compute\/ai-compute-workspace"/);
  assert.match(settings, /id="settings-local-compute"/);
  assert.match(settings, /id="settings-cloud-compute"/);
  assert.match(settings, /<AiComputeWorkspace mode="local" \/>/);
  assert.match(settings, /<AiComputeWorkspace mode="cloud" \/>/);
  assert.match(settings, /"settings-routing": "local-compute"/);
  assert.match(settings, /"settings-comfyui": "local-compute"/);
  assert.match(compute, /<AiRoutingPanel/);
  assert.match(compute, /<MediaRoutingPanel/);
  assert.match(compute, />Advanced Options<\/button>/);
  assert.match(routingPanel, /if \(onManage\)/);
  assert.match(routingPanel, /localSection\.scrollIntoView/);
  assert.match(routingPanel, /window\.history\.replaceState/);
  assert.match(route, /redirect\("\/\?workspace=settings#settings-routing"\)/);
  assert.doesNotMatch(route, /LocalRuntimePanel|<main|AiRoutingPanel/);
});

test("AI routing is presented as one choice per capability instead of independent switches", async () => {
  const routing = await read("app/ai-routing-panel.tsx");

  assert.match(routing, /type="radio"/);
  assert.match(routing, /name={`ai-route-\${capability}`}/);
  assert.match(routing, /onChange=\{\(\) => void select\(capability, route\)\}/);
  assert.doesNotMatch(routing, /toggleRoute\(/);
  assert.doesNotMatch(routing, /Turn off|Turn on/);
});

test("unverified exhaustive observations stay local and exhaustive GitHub reporting is capped", async () => {
  const [policy, reporter] = await Promise.all([
    read("scripts/exhaustive-ui-finding-policy.mjs"),
    read("scripts/report-uat-findings.mjs"),
  ]);

  assert.match(policy, /can be activated but produces no observable result/i);
  assert.match(reporter, /exhaustiveOnly \? findings\.slice\(0, 3\) : findings/);
  assert.match(reporter, /complete finding set remains in the local report/i);
});
