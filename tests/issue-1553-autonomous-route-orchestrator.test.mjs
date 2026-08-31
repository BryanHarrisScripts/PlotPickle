import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessAutonomousRoute,
  autonomousContractTestsFromRegistry,
  autonomousStoryRoutes,
  materializeAutonomousRoute,
  skippedAutonomousRoute,
  summarizeAutonomousRouteResults,
  validateAutonomousStoryRoutes,
} from "../lib/verification/autonomous-story-routes.mjs";
import { validateUatRegistry } from "../lib/verification/uat-autopilot.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));

test("#1553 registers the complete ordered autonomous creative route journey", () => {
  assert.deepEqual(validateAutonomousStoryRoutes(registry), []);
  assert.deepEqual(validateUatRegistry(registry), []);
  const routes = autonomousStoryRoutes(registry);
  assert.deepEqual(routes.map((route) => route.id), [
    "library", "learn", "plan", "build", "story-decisions", "story-workbench", "visual-readiness",
    "storyboard", "production-shots", "previs-animatic", "write", "edit", "refine", "reports",
  ]);
  assert.deepEqual(routes.map((route) => route.order), [...routes.map((_, index) => (index + 1) * 10)]);
  assert.ok(autonomousContractTestsFromRegistry(registry).every((path) => path.startsWith("tests/") && path.endsWith(".test.mjs")));
});

test("#1553 materializes dynamic Workbench routes only from explicit run inputs", () => {
  const workbench = registry.autonomousStoryRoutes.find((route) => route.id === "story-workbench");
  assert.deepEqual(materializeAutonomousRoute(workbench), { route: null, missingInputs: ["decisionId"] });
  assert.deepEqual(materializeAutonomousRoute(workbench, { decisionId: "decision/one" }), {
    route: "/story-workbench?decisionId=decision%2Fone",
    missingInputs: [],
  });
  const skipped = skippedAutonomousRoute(workbench, ["decisionId"]);
  assert.equal(skipped.disposition, "skipped-prerequisite");
  assert.match(skipped.reason, /answered-story-decision/);
});

test("#1553 distinguishes entered, operated, legitimate prerequisite skips and defects", () => {
  const route = registry.autonomousStoryRoutes.find((entry) => entry.id === "story-decisions");
  const evidence = {
    reached: true,
    resolvedRoute: "/story-decisions",
    url: "http://127.0.0.1:4173/story-decisions",
    bodyText: `${"Story Decisions Decision ".repeat(20)}`,
    bodyLength: 500,
    consoleErrors: false,
    timingMs: 42,
  };
  const entered = assessAutonomousRoute(route, evidence);
  const operated = assessAutonomousRoute(route, evidence, { attempted: true, succeeded: true, actionId: "respond-decision" });
  const failed = assessAutonomousRoute(route, { ...evidence, consoleErrors: true });
  const workbench = registry.autonomousStoryRoutes.find((entry) => entry.id === "story-workbench");
  const workbenchEvidence = { ...evidence, bodyText: "Story Workbench revision ".repeat(20), resolvedRoute: "/story-workbench?decisionId=one", url: "http://127.0.0.1:4173/story-workbench?decisionId=one" };
  const skipped = assessAutonomousRoute(workbench, workbenchEvidence, { skippedPrerequisite: "answered-story-decision" });
  const undeclaredSkip = assessAutonomousRoute(workbench, workbenchEvidence, { skippedPrerequisite: "paid-cloud-provider" });
  assert.equal(entered.disposition, "entered");
  assert.equal(operated.disposition, "operated");
  assert.equal(failed.disposition, "failed-defect");
  assert.equal(skipped.disposition, "skipped-prerequisite");
  assert.equal(skipped.entered, true);
  assert.equal(undeclaredSkip.disposition, "failed-defect");
  assert.equal(assessAutonomousRoute(route, { ...evidence, url: "http://127.0.0.1:4173/?workspace=learn" }).disposition, "failed-defect");
  assert.deepEqual(summarizeAutonomousRouteResults([entered, operated, failed, skipped]).counts, {
    entered: 1,
    operated: 1,
    "skipped-prerequisite": 1,
    "failed-defect": 1,
  });
});

test("#1553 route runner reuses Playwright readiness helpers without private-state mutation", async () => {
  const runner = await read("scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs");
  assert.match(runner, /creative-uat|mcp-runtime\.mjs/);
  assert.match(runner, /render-readiness\.mjs/);
  assert.match(runner, /waitForRenderedArea/);
  assert.match(runner, /evidencePolicy/);
  assert.match(runner, /issue-1553-autonomous-convergence-restart\.test\.mjs/);
  assert.match(runner, /--user-data-dir/);
  assert.match(runner, /fresh-playwright-mcp-process-shared-browser-profile/);
  assert.match(runner, /applicationProcessRestarted: false/);
  assert.match(runner, /requiresApplicationLifecycleProof: true/);
  assert.doesNotMatch(runner, /localStorage|indexedDB|saveFoundationProject|applyStoryCommand|sqlite|database/i);
  assert.doesNotMatch(runner, /writeFile\([^\n]+snapshot|browser_take_screenshot/);
});
