import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReleaseScriptInventory } from "../scripts/runtime-weight/release-script-inventory.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1656 removes only proven release/measurement scripts and retains operational self-support", async () => {
  const classification = JSON.parse(await read("config/release-script-classification.json"));
  assert.equal(classification.issue, 1656);
  assert.match(classification.classificationRule, /not developer-only merely because engineers use it/i);

  const excluded = new Set(classification.baseUserReleaseExclusions.map((entry) => entry.path));
  for (const safeReleaseOnly of [
    "scripts/runtime-weight",
    "scripts/package-platform.mjs",
    "scripts/package-smoke.mjs",
    "scripts/windows-installer",
  ]) assert.ok(excluded.has(safeReleaseOnly), `${safeReleaseOnly} must remain a bounded release-only exclusion`);

  const retained = new Set(classification.retainedRuntimeAnchors.map((entry) => entry.path));
  for (const operational of [
    "scripts/agent-skills.mjs",
    "scripts/developer-diagnostics",
    "scripts/pi",
    "scripts/autonomous-qa",
    "scripts/creative-uat",
    "scripts/run-ben-code-quality.mjs",
    "scripts/run-pi-code-quality-review.mjs",
  ]) {
    assert.ok(retained.has(operational), `${operational} must remain available to bounded self-support`);
    assert.ok(!excluded.has(operational), `${operational} must not be classified as release-only`);
  }

  assert.equal(classification.authorityBoundary.learningMayImproveUnderstanding, true);
  assert.equal(classification.authorityBoundary.durableAdmissionRequiresHarnessApproval, true);
  assert.equal(classification.authorityBoundary.sourceMutationMayNotBeSelfGranted, true);
  assert.equal(classification.authorityBoundary.skillInstallationMayNotBeSelfGranted, true);
  assert.equal(classification.authorityBoundary.skillActivationMayNotBeSelfGranted, true);
  assert.equal(classification.authorityBoundary.operationalAuthorityMayNotBeSelfGranted, true);

  const packager = await read("scripts/package-platform.mjs");
  assert.match(packager, /release-script-classification\.json/);
  assert.match(packager, /\.\.\.classifiedScriptExclusions/);

  const learner = await read("build/autonomous-guest/maintainer/architecture-learner.mjs");
  for (const boundedFlag of [
    "durableAdmissionAllowed: false",
    "sourceMutationAllowed: false",
    "skillInstallationAllowed: false",
    "skillActivationAllowed: false",
    "operationalAuthorityGranted: false",
  ]) assert.ok(learner.includes(boundedFlag), `Architecture learner lost harness boundary: ${boundedFlag}`);

  const inventory = buildReleaseScriptInventory();
  assert.ok(inventory.totals.excludedFiles > 0);
  assert.ok(inventory.totals.excludedBytes > 0);
  assert.ok(inventory.retained.every((entry) => entry.exists));
});
