import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));
const implementation = "scripts/run-writer-in-residence-v2.mjs";

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

test("stable writer command delegates to the resilient journey implementation", async () => {
  const entrypoint = await read("scripts/run-writer-in-residence.mjs");
  assert.match(entrypoint, /run-writer-in-residence-v2\.mjs/);
  execFileSync(process.execPath, ["--check", new URL(`../${implementation}`, import.meta.url).pathname], { stdio: "pipe" });
});

test("exploratory writer uses visible Playwright accessibility actions and never calls hidden browser state", async () => {
  const runner = await read(implementation);
  assert.match(runner, /browser_snapshot/);
  assert.match(runner, /browser_click/);
  assert.match(runner, /browser_type/);
  assert.match(runner, /browser_navigate/);
  assert.match(runner, /isolated browser profile/i);
  assert.match(runner, /browser_evaluate is available to MCP but deliberately never used/);
  assert.doesNotMatch(runner, /client\.call\("browser_evaluate"/);
  assert.doesNotMatch(runner, /document\.querySelector|document\.querySelectorAll|window\.localStorage/);
});

test("writer model receives bounded visible context and chooses labels instead of fragile browser refs", async () => {
  const runner = await read(implementation);
  assert.match(runner, /CURRENT VISIBLE CONTROLS/);
  assert.match(runner, /VISIBLE ACCESSIBILITY SNAPSHOT/);
  assert.match(runner, /maximum = 5_000/);
  assert.match(runner, /NEXT\|CLICK\|exact visible control name/);
  assert.match(runner, /PlotPickle resolves the current browser ref itself/);
  assert.match(runner, /agentId:\s*"creative-director"/);
  assert.doesNotMatch(runner, /git\s+commit|git\s+push|gh\("issue"|gh\("pr"/);
});

test("failed or non-protocol writer actions recover without repeating stale controls", async () => {
  const runner = await read(implementation);
  assert.match(runner, /mentionedControl/);
  assert.match(runner, /failedTargets/);
  assert.match(runner, /nextSafeRoute/);
  assert.match(runner, /safely moved to/);
  assert.match(runner, /Local model ignored the compact NEXT protocol/);
  assert.match(runner, /consecutiveTurnErrors >= 3/);
  assert.match(runner, /Writer-in-Residence COMPLETE/);
});

test("writer feedback is local-first and only explicit medium/high actionable observations are promoted", async () => {
  const [runner, config] = await Promise.all([
    read(implementation),
    readJson("config/writer-in-residence.json"),
  ]);
  assert.equal(config.minimumPromotedSeverity, "medium");
  assert.equal(config.maxPromotedFindings, 5);
  assert.match(runner, /OBS\|confusion\|medium\|true/);
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
