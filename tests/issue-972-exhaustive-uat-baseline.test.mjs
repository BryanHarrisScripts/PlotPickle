import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { controlKey, refFor } from "../scripts/exhaustive-ui-control-audit.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await source(path));

test("issue #972 scopes Advanced AI routing without duplicating the entire Settings screen", async () => {
  const config = await json("config/exhaustive-ui-uat.json");
  const advanced = config.screens.find((screen) => screen.id === "advanced-ai-routing");
  assert.ok(advanced);
  assert.equal(advanced.route, "/?workspace=settings#settings-routing");
  assert.equal(advanced.scopeSelector, "#settings-routing");
  assert.ok(advanced.sourceFiles.includes("app/sage-settings-workspace.tsx"));
  assert.ok(advanced.sourceFiles.includes("app/ai-routing-panel.tsx"));
  assert.ok(advanced.sourceFiles.includes("app/ai-routing/page.tsx"));
});

test("issue #972 derives deterministic accessible labels instead of broad fuzzy guesses", async () => {
  const audit = await source("scripts/exhaustive-ui-control-audit.mjs");
  for (const contract of [
    "aria-hidden",
    "aria-labelledby",
    "input, select, textarea, button",
    "labelText",
    "textFor",
    "scopeSelector",
    "[aria-live]",
  ]) assert.ok(audit.includes(contract), `missing accessibility contract: ${contract}`);

  const snapshot = [
    '- button "Dashboard Start" [ref=e1]',
    '- button "Dashboard Settings" [ref=e2]',
  ].join("\n");
  assert.equal(refFor({ role: "button", label: "DashboardStart", occurrence: 0 }, snapshot), null);
});

test("issue #972 treats a state-changing label at one DOM identity as the same physical control", () => {
  const before = controlKey({ role: "button", label: "Mark Lesson complete", identity: "section:0/button:1", type: "button", name: "" }, false);
  const after = controlKey({ role: "button", label: "Mark Lesson incomplete", identity: "section:0/button:1", type: "button", name: "" }, false);
  assert.equal(before, after);
});

test("issue #972 keeps navigation destinations out of the originating screen queue and fails closed on 0/0 discovery", async () => {
  const audit = await source("scripts/exhaustive-ui-control-audit.mjs");
  assert.match(audit, /const discovered = navigated \? \[\]/);
  assert.match(audit, /Navigation destinations are verified by their own screen contract/);
  assert.match(audit, /renderDiscoveryMissing/);
  assert.match(audit, /source inventory contains .*interactive control/i);
  assert.match(audit, /bounded render readiness/i);
});

test("issue #972 Settings refresh and developer actions expose visible completion evidence", async () => {
  const [routing, sage, traces, dsh, runtime] = await Promise.all([
    source("app/ai-routing-panel.tsx"),
    source("app/sage-fast-model-setup.tsx"),
    source("app/agent-observability-panel.tsx"),
    source("app/deepseek-harness-panel.tsx"),
    source("app/local-runtime-panel.tsx"),
  ]);

  assert.match(routing, /AI routing configuration refreshed/);
  assert.match(routing, /role="status" aria-live="polite"/);
  assert.match(sage, /Local AI status refreshed/);
  assert.match(traces, /Agent activity refreshed/);
  assert.match(dsh, /DeepSeek Harness launch request completed/);
  assert.match(dsh, /DeepSeek Harness status refreshed/);
  assert.match(runtime, /Hardware and model inventory refreshed/);
  assert.match(runtime, /Missing-runtime and model plan is ready below/);
});
