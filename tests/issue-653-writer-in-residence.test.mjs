import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("Writer-in-Residence is a disclosed synthetic writer with a real creative mission", async () => {
  const config = await readJson("config/writer-in-residence.json");
  assert.equal(config.persona.id, "avery-north");
  assert.match(config.persona.disclosure, /Synthetic writer persona/i);
  assert.match(config.storySeed.premise, /ferry operator/i);
  assert.ok(config.journeyGoals.some((goal) => /LEARN/i.test(goal)));
  assert.ok(config.journeyGoals.some((goal) => /Sage/i.test(goal)));
  assert.ok(config.journeyGoals.some((goal) => /PLAN/i.test(goal)));
  assert.ok(config.journeyGoals.some((goal) => /Wyrmwood/i.test(goal)));
});

test("exploratory writer uses visible Playwright accessibility actions and never calls hidden browser state", async () => {
  const runner = await read("scripts/run-writer-in-residence.mjs");
  assert.match(runner, /browser_snapshot/);
  assert.match(runner, /browser_click/);
  assert.match(runner, /browser_type/);
  assert.match(runner, /browser_navigate/);
  assert.match(runner, /isolated browser profile/i);
  assert.match(runner, /browser_evaluate is available to MCP but deliberately never used/);
  assert.doesNotMatch(runner, /client\.call\("browser_evaluate"/);
  assert.doesNotMatch(runner, /document\.querySelector|document\.querySelectorAll|window\.localStorage/);
});

test("writer model receives only bounded visible snapshot context and cannot edit code or GitHub", async () => {
  const runner = await read("scripts/run-writer-in-residence.mjs");
  assert.match(runner, /VISIBLE ACCESSIBILITY SNAPSHOT/);
  assert.match(runner, /maximum = 5_500/);
  assert.match(runner, /Do not request browser_evaluate, source code, DOM inspection, localStorage, filesystem inspection, test files, logs, GitHub, or developer tools/);
  assert.match(runner, /agentId:\s*"creative-director"/);
  assert.doesNotMatch(runner, /git\s+commit|git\s+push|gh\("issue"|gh\("pr"/);
});

test("writer decision format is repaired locally and malformed output cannot become product feedback", async () => {
  const runner = await read("scripts/run-writer-in-residence.mjs");
  assert.match(runner, /FORMAT REPAIR ONLY/);
  assert.match(runner, /normalizeDecision\(repaired\.text\)/);
  assert.match(runner, /recovery: "format-repair"/);
  assert.match(runner, /recovery: "visible-ui-fallback"/);
  assert.match(runner, /response\.recovery === "visible-ui-fallback"\s*\? \[\]/);
  assert.match(runner, /runnerFindings/);
  assert.match(runner, /finishedReason = "local-model-unavailable"/);
});

test("writer feedback is kept locally first and only medium/high actionable findings are promoted", async () => {
  const [runner, config] = await Promise.all([
    read("scripts/run-writer-in-residence.mjs"),
    readJson("config/writer-in-residence.json"),
  ]);
  assert.equal(config.minimumPromotedSeverity, "medium");
  assert.equal(config.maxPromotedFindings, 5);
  assert.match(runner, /item\.actionable && severityRank\[item\.severity\] >= minimumRank/);
  assert.match(runner, /writer-in-residence-report\.json/);
  assert.match(runner, /writer-in-residence-report\.md/);
});

test("GitHub reporter labels synthetic feedback for Modem and does not auto-repair unverified observations", async () => {
  const reporter = await read("scripts/report-writer-in-residence.mjs");
  assert.match(reporter, /synthetic-writer/);
  assert.match(reporter, /product-feedback/);
  assert.match(reporter, /needs-triage/);
  assert.match(reporter, /not a real customer report/i);
  assert.match(reporter, /before adding `uat:auto-repair`/);
  assert.doesNotMatch(reporter, /--label", "uat:auto-repair"/);
  assert.doesNotMatch(reporter, /pr", "create"/);
});

test("focused Startup UAT owns the Writer-in-Residence contract", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup?.tests.includes("tests/issue-653-writer-in-residence.test.mjs"));
});
