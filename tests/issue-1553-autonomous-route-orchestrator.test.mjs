import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateAutonomousRouteOperation } from "../lib/verification/autonomous-route-operations.mjs";
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

test("#1553 inspect routes may be entered, but operate routes require a bounded operation receipt", () => {
  const inspectRoute = registry.autonomousStoryRoutes.find((entry) => entry.id === "learn");
  const inspectBody = `${inspectRoute.requiredTerms.join(" ")} `.repeat(40);
  const inspectEvidence = {
    reached: true,
    resolvedRoute: "/?workspace=learn",
    url: "http://127.0.0.1:4173/?workspace=learn",
    bodyText: inspectBody,
    bodyLength: inspectBody.length,
    consoleErrors: false,
    timingMs: 42,
  };
  const entered = assessAutonomousRoute(inspectRoute, inspectEvidence);
  assert.equal(entered.disposition, "entered");

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
  const missingOperation = assessAutonomousRoute(route, evidence);
  const operated = assessAutonomousRoute(route, evidence, {
    attempted: true,
    succeeded: true,
    actionId: "audit-story-decision-queue",
    operatorId: "plotpickle-autonomous-route-controller",
    outcome: "completed-no-change",
  });
  const missingOperator = assessAutonomousRoute(route, evidence, { attempted: true, succeeded: true, actionId: "audit-story-decision-queue" });
  const failed = assessAutonomousRoute(route, { ...evidence, consoleErrors: true }, {
    attempted: true,
    succeeded: true,
    actionId: "audit-story-decision-queue",
    operatorId: "plotpickle-autonomous-route-controller",
  });
  const workbench = registry.autonomousStoryRoutes.find((entry) => entry.id === "story-workbench");
  const workbenchEvidence = { ...evidence, bodyText: "Story Workbench revision ".repeat(20), resolvedRoute: "/story-workbench?decisionId=one", url: "http://127.0.0.1:4173/story-workbench?decisionId=one" };
  const skipped = assessAutonomousRoute(workbench, workbenchEvidence, { skippedPrerequisite: "answered-story-decision" });
  const undeclaredSkip = assessAutonomousRoute(workbench, workbenchEvidence, { skippedPrerequisite: "paid-cloud-provider" });
  assert.equal(missingOperation.disposition, "failed-defect");
  assert.match(missingOperation.reason, /declared autonomous operation did not execute/);
  assert.equal(operated.disposition, "operated");
  assert.equal(missingOperator.disposition, "failed-defect");
  assert.equal(failed.disposition, "failed-defect");
  assert.equal(skipped.disposition, "skipped-prerequisite");
  assert.equal(skipped.entered, true);
  assert.equal(undeclaredSkip.disposition, "failed-defect");
  assert.equal(assessAutonomousRoute(route, { ...evidence, url: "http://127.0.0.1:4173/?workspace=learn" }).disposition, "failed-defect");
  assert.deepEqual(summarizeAutonomousRouteResults([entered, operated, missingOperation, skipped]).counts, {
    entered: 1,
    operated: 1,
    "skipped-prerequisite": 1,
    "failed-defect": 1,
  });
});

test("#1553 route operation policy accepts a proven no-change queue and rejects unoperated Decisions", () => {
  const route = registry.autonomousStoryRoutes.find((entry) => entry.id === "story-decisions");
  const evidence = { reached: true, bodyText: "Story Decisions Decision", resolvedRoute: "/story-decisions" };
  const context = { expectedProjectId: "project-afterglow" };
  const clear = evaluateAutonomousRouteOperation(route, evidence, {
    decisionQueueReachable: true,
    decisionCount: 0,
    actionableDecisionCount: 0,
  }, context);
  assert.equal(clear.succeeded, true);
  assert.equal(clear.outcome, "completed-no-change");
  assert.equal(clear.operatorId, "plotpickle-autonomous-route-controller");

  const pending = evaluateAutonomousRouteOperation(route, evidence, {
    decisionQueueReachable: true,
    decisionCount: 2,
    actionableDecisionCount: 1,
  }, context);
  assert.equal(pending.succeeded, false);
  assert.match(pending.error, /delegated Decision\/Workbench operator/);
});

test("#1553 visual operate routes require canonical project identity and reject stale production state", () => {
  const route = registry.autonomousStoryRoutes.find((entry) => entry.id === "storyboard");
  const evidence = { reached: true, bodyText: "Storyboard Block", resolvedRoute: "/storyboard" };
  const context = { expectedProjectId: "project-afterglow" };
  assert.equal(evaluateAutonomousRouteOperation(route, evidence, {}, context).succeeded, false);
  assert.equal(evaluateAutonomousRouteOperation(route, evidence, {
    projectId: "project-afterglow",
    staleProductionTargets: 1,
  }, context).succeeded, false);
  const clear = evaluateAutonomousRouteOperation(route, evidence, {
    projectId: "project-afterglow",
    staleProductionTargets: 0,
    readinessItems: 96,
  }, context);
  assert.equal(clear.succeeded, true);
  assert.equal(clear.outcome, "completed-no-change");
});

test("#1553 route runner reuses Playwright readiness helpers without private-state mutation", async () => {
  const runner = await read("scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs");
  assert.match(runner, /creative-uat|mcp-runtime\.mjs/);
  assert.match(runner, /render-readiness\.mjs/);
  assert.match(runner, /waitForRenderedArea/);
  assert.match(runner, /captureAutonomousRouteOperationProbe/);
  assert.match(runner, /evaluateAutonomousRouteOperation/);
  assert.match(runner, /afterglow-working-copy-bootstrap\.json/);
  assert.match(runner, /evidencePolicy/);
  assert.match(runner, /issue-1553-autonomous-convergence-restart\.test\.mjs/);
  assert.match(runner, /--user-data-dir/);
  assert.match(runner, /fresh-playwright-mcp-process-shared-browser-profile/);
  assert.match(runner, /applicationProcessRestarted: false/);
  assert.match(runner, /requiresApplicationLifecycleProof: true/);
  assert.doesNotMatch(runner, /localStorage|indexedDB|saveFoundationProject|applyStoryCommand|sqlite|database/i);
  assert.doesNotMatch(runner, /writeFile\([^\n]+snapshot|browser_take_screenshot/);
});