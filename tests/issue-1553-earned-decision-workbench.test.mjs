import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createStoryDecisionFromCouncilResult } from "../core/story-workflow/story-decisions/core.mjs";
import { createAfterglowAutonomousCouncilResult } from "../scripts/creative-uat/autonomous/afterglow-autonomous-council.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1553 deterministic Afterglow Council earns a real revision-bound Decision", () => {
  const input = createAfterglowAutonomousCouncilResult({
    projectId: "afterglow-working-copy",
    revision: "9",
    recordedAt: "2026-09-01T08:00:00.000Z",
  });
  assert.equal(input.councilResult.requiresHuman, true);
  assert.equal(input.councilResult.decisionClass, "unresolved-conflict");
  assert.equal(input.councilResult.baseRevision, "9");
  assert.ok(input.councilResult.positions.length >= 3);
  assert.ok(input.councilResult.positions.every((position) => position.provenance.transport === "local-runtime"));
  const decision = createStoryDecisionFromCouncilResult(input);
  assert.ok(decision);
  assert.equal(decision.projectId, "afterglow-working-copy");
  assert.equal(decision.baseRevision, "9");
  assert.equal(decision.integrity.writesCanon, false);
  assert.equal(decision.integrity.requiresWorkbenchValidation, true);
  assert.match(decision.targetRefs[0], /^ppf:foundations:/);
});

test("#1553 route controller uses the bounded operator, Guest gateway and real Workbench apply surface", async () => {
  const [runner, gateway, workbench] = await Promise.all([
    read("scripts/creative-uat/autonomous/run-autonomous-story-routes.mjs"),
    read("build/story-decisions/gateway.ts"),
    read("app/story-workbench/page.tsx"),
  ]);
  assert.match(runner, /operateAutonomousStoryDecision/);
  assert.match(runner, /createAfterglowAutonomousCouncilResult/);
  assert.match(runner, /action: "ingest-council"/);
  assert.match(runner, /action: "respond-autonomous"/);
  assert.match(runner, /Apply change/);
  assert.match(runner, /routeInputs\.decisionId = decision\.decisionId/);
  assert.doesNotMatch(runner, /localStorage|indexedDB|saveFoundationProject|applyStoryCommand/);

  assert.match(gateway, /action === "respond-autonomous"/);
  assert.match(gateway, /scope\.kind !== "autonomous-guest"/);
  assert.match(gateway, /respondAutonomousStoryDecisionThroughGateway/);
  assert.match(gateway, /plotpickle-deterministic-decision-policy-v1/);

  assert.match(workbench, /data-story-workbench-package-id/);
  assert.match(workbench, /data-story-workbench-applied/);
  assert.match(workbench, /saveFoundationProjectAtRevision/);
  assert.match(workbench, /applyStoryWorkbenchReview/);
});
