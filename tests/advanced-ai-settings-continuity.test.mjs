import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Advanced AI stays inside the three-column Settings workspace", async () => {
  const [settings, route] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/ai-routing/page.tsx"),
  ]);

  assert.match(settings, /import AiRoutingPanel from "\.\/ai-routing-panel"/);
  assert.match(settings, /id="settings-routing"/);
  assert.match(settings, /<AiRoutingPanel \/>/);
  assert.match(settings, /href="#settings-routing"/);
  assert.match(route, /redirect\("\/\?workspace=settings&section=ai-routing"\)/);
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
