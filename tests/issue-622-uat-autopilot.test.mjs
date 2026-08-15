import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessFocusedUat,
  assessRenderedArea,
  contractTestsFromRegistry,
  validateUatRegistry,
} from "../lib/uat-autopilot.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function cleanEvidence(area) {
  return {
    reached: true,
    url: `http://127.0.0.1:4173${area.route}`,
    bodyText: `${area.requiredTerms.join(" ")} ${"ready ".repeat(Math.ceil(area.minimumTextLength / 6) + 1)}`,
    bodyLength: area.minimumTextLength + 50,
    screenshotCaptured: true,
    consoleErrors: false,
  };
}

test("the UAT registry is deliberately limited to startup, settings, foundations/LEARN, PLAN, and Wyrmwood", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  assert.deepEqual(registry.areas.map((area) => area.id), ["startup", "settings", "foundations-learn", "plan", "wyrmwood"]);
  assert.equal(registry.areas.find((area) => area.id === "startup")?.route, undefined);
  assert.equal(registry.areas.find((area) => area.id === "settings")?.route, "/?workspace=settings");
  assert.equal(registry.areas.find((area) => area.id === "foundations-learn")?.route, "/?workspace=learn");
  assert.equal(registry.areas.find((area) => area.id === "plan")?.route, "/?workspace=plan&section=foundations");
  assert.equal(registry.areas.find((area) => area.id === "wyrmwood")?.route, "/?workspace=wyrmwood");
});

test("each current area owns focused contract tests and the registry is the extension point", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  assert.deepEqual(validateUatRegistry(registry), []);
  for (const area of registry.areas) assert.ok(area.tests.length > 0, `${area.id} has no focused tests`);
  const contracts = contractTestsFromRegistry(registry);
  assert.ok(contracts.includes("tests/foundation-architecture.test.mjs"));
  assert.ok(contracts.includes("tests/wyrmwood-phase-1.test.mjs"));
  assert.equal(new Set(contracts).size, contracts.length, "registry contract tests must be deduplicated");
});

test("clean evidence across the focused registry passes", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const rendered = registry.areas.filter((area) => area.route).map((area) => ({ id: area.id, ...cleanEvidence(area) }));
  const result = assessFocusedUat({
    registry,
    contractExitCode: 0,
    rendered,
    startup: {
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
    },
  });
  assert.equal(result.overall, "PASS");
  assert.deepEqual(result.blockers, []);
});

test("missing content, screenshot evidence, console cleanliness, or PLAN JSON blocks focused UAT", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const rendered = registry.areas.filter((area) => area.route).map((area) => ({ id: area.id, ...cleanEvidence(area) }));
  rendered.find((entry) => entry.id === "foundations-learn").bodyText = "Learn only";
  rendered.find((entry) => entry.id === "foundations-learn").bodyLength = 10;
  rendered.find((entry) => entry.id === "settings").screenshotCaptured = false;
  rendered.find((entry) => entry.id === "wyrmwood").consoleErrors = true;
  const result = assessFocusedUat({
    registry,
    contractExitCode: 0,
    rendered,
    startup: {
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
      plannerPassed: false,
      plannerMessage: "Foundations Planner did not return both requested structured PLAN fields.",
    },
  });
  assert.equal(result.overall, "FAIL");
  assert.ok(result.blockers.length >= 4);
});

test("unavailable optional local models are warnings, not false failures", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const rendered = registry.areas.filter((area) => area.route).map((area) => ({ id: area.id, ...cleanEvidence(area) }));
  const result = assessFocusedUat({
    registry,
    contractExitCode: 0,
    rendered,
    startup: {
      statusOk: true,
      mastraReady: true,
      embedded: true,
      sageRegistered: true,
      foundationsRegistered: true,
      fastAvailable: false,
      qualityAvailable: false,
      sageAttempted: false,
      sagePassed: false,
      plannerAttempted: false,
      plannerPassed: false,
    },
  });
  assert.equal(result.overall, "WARN");
  assert.ok(result.warnings.length >= 2);
});

test("a rendered area fails independently when a new regression appears", async () => {
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
  assert.match(source, /const fieldIds = \["output-1", "output-2"\]/);
  assert.match(source, /foundationFieldIds: fieldIds/);
  assert.match(source, /FOCUSED UAT PLAN STRUCTURED RETRY/);
  assert.match(source, /plannerChat\(\[fieldId\]/);
  assert.match(source, /per-field recovery/);
  assert.doesNotMatch(source, /run-local-browser-uat\.mjs|run-creative-writer-uat\.mjs|ui-continuity-agent\.mjs|visual-baseline/i);
  assert.doesNotMatch(source, /api\.openai\.com|anthropic\.com/i);
});
