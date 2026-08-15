import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assessFocusedUat,
  assessRenderedArea,
  contractTestsFromRegistry,
  validateUatRegistry,
} from "../lib/uat-autopilot.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const healthyStartup = {
  statusOk: true,
  mastraReady: true,
  embedded: true,
  sageRegistered: true,
  foundationsRegistered: true,
  fastAvailable: true,
  qualityAvailable: true,
  sageAttempted: true,
  sagePassed: true,
  plannerAttempted: true,
  plannerPassed: true,
};

function renderedEvidence(registry) {
  return registry.areas.filter((area) => area.route).map((area) => ({
    id: area.id,
    reached: true,
    url: `http://127.0.0.1:4173${area.route}`,
    bodyText: `${area.requiredTerms.join(" ")} ${"useful content ".repeat(150)}`,
    bodyLength: Math.max(area.minimumTextLength + 100, 2200),
    screenshotCaptured: true,
    consoleErrors: false,
  }));
}

test("the UAT registry is deliberately limited to startup, settings, foundations/LEARN, PLAN, and Wyrmwood", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  assert.deepEqual(registry.areas.map((area) => area.id), [
    "startup",
    "settings",
    "foundations-learn",
    "plan",
    "wyrmwood",
  ]);
  assert.deepEqual(validateUatRegistry(registry), []);
  assert.equal(registry.areas.find((area) => area.id === "settings").route, "/?workspace=settings");
  assert.equal(registry.areas.find((area) => area.id === "foundations-learn").route, "/?workspace=learn");
  assert.equal(registry.areas.find((area) => area.id === "plan").route, "/?workspace=plan&section=foundations");
  assert.equal(registry.areas.find((area) => area.id === "wyrmwood").route, "/?workspace=wyrmwood");
});

test("each current area owns focused contract tests and the registry is the extension point", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const tests = contractTestsFromRegistry(registry);
  assert.ok(tests.includes("tests/issue-590-windows-startup-defaults.test.mjs"));
  assert.ok(tests.includes("tests/learn-sage-settings-entry.test.mjs"));
  assert.ok(tests.includes("tests/foundation-architecture.test.mjs"));
  assert.ok(tests.includes("tests/issue-595-foundations-plan-starter.test.mjs"));
  assert.ok(tests.includes("tests/wyrmwood-phase-3.test.mjs"));
  assert.ok(tests.length >= 15);
  assert.equal(new Set(tests).size, tests.length);
});

test("clean evidence across the focused registry passes", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const result = assessFocusedUat({
    registry,
    contractExitCode: 0,
    rendered: renderedEvidence(registry),
    startup: healthyStartup,
  });
  assert.equal(result.overall, "PASS");
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.metrics.areasRegistered, 5);
  assert.equal(result.metrics.renderedAreas, 4);
});

test("missing content, screenshot evidence, console cleanliness, or PLAN JSON blocks focused UAT", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const rendered = renderedEvidence(registry);
  const plan = rendered.find((entry) => entry.id === "plan");
  plan.bodyText = "Plan only";
  plan.bodyLength = 20;
  plan.screenshotCaptured = false;
  plan.consoleErrors = true;
  const result = assessFocusedUat({
    registry,
    contractExitCode: 0,
    rendered,
    startup: {
      ...healthyStartup,
      plannerPassed: false,
      plannerMessage: "Foundations Planner did not return both requested structured PLAN fields.",
    },
  });
  assert.equal(result.overall, "FAIL");
  assert.ok(result.blockers.some((message) => /PLAN and Foundations handoff rendered too little/i.test(message)));
  assert.ok(result.blockers.some((message) => /missing expected rendered text: Foundations/i.test(message)));
  assert.ok(result.blockers.some((message) => /missing screenshot evidence/i.test(message)));
  assert.ok(result.blockers.some((message) => /browser console error/i.test(message)));
  assert.ok(result.blockers.some((message) => /both requested structured PLAN fields/i.test(message)));
});

test("unavailable optional local models are warnings, not false failures", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const result = assessFocusedUat({
    registry,
    contractExitCode: 0,
    rendered: renderedEvidence(registry),
    startup: {
      ...healthyStartup,
      fastAvailable: false,
      qualityAvailable: false,
      sageAttempted: false,
      plannerAttempted: false,
    },
  });
  assert.equal(result.overall, "WARN");
  assert.ok(result.warnings.some((message) => /Fast local model is unavailable/i.test(message)));
  assert.ok(result.warnings.some((message) => /Quality local model is unavailable/i.test(message)));
});

test("a rendered area fails independently when a new regression appears", () => {
  const area = {
    id: "future-area",
    label: "Future area",
    route: "/?workspace=future",
    requiredTerms: ["Future", "Ready"],
    minimumTextLength: 300,
    tests: ["tests/future.test.mjs"],
  };
  const result = assessRenderedArea(area, {
    reached: true,
    url: "http://127.0.0.1:4173/?workspace=future",
    bodyText: "Future",
    bodyLength: 40,
    screenshotCaptured: false,
    consoleErrors: true,
  });
  assert.ok(result.blockers.length >= 4);
});

test("the runner reads the registry and does not pull the whole application into this UAT pass", async () => {
  const source = await read("scripts/run-uat-autopilot.mjs");
  assert.match(source, /uat-autopilot-registry\.json/);
  assert.match(source, /--contracts-only/);
  assert.match(source, /McpClient/);
  assert.match(source, /browser_navigate/);
  assert.match(source, /api\/writing-assistant\/status/);
  assert.match(source, /agentId: "curriculum-guide"/);
  assert.match(source, /agentId: "foundations-planner"/);
  assert.match(source, /foundationFieldIds: \["output-1", "output-2"\]/);
  assert.doesNotMatch(source, /run-local-browser-uat\.mjs|run-creative-writer-uat\.mjs|ui-continuity-agent\.mjs|visual-baseline/i);
  assert.doesNotMatch(source, /api\.openai\.com|anthropic\.com/i);
});
