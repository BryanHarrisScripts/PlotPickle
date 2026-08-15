import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));
const implementation = "scripts/run-writer-in-residence-v3.mjs";
const visualObserver = "scripts/writer-visual-observer.mjs";

test("Writer-in-Residence is a disclosed synthetic writer with a complete active-product mission", async () => {
  const config = await readJson("config/writer-in-residence.json");
  assert.equal(config.persona.id, "avery-north");
  assert.match(config.persona.disclosure, /Synthetic writer persona/i);
  assert.match(config.storySeed.premise, /ferry operator/i);
  for (const label of ["LEARN", "PLAN", "Wyrmwood", "SETTINGS"]) assert.ok(config.journeyGoals.some((goal) => new RegExp(label, "i").test(goal)), `Missing ${label} journey goal`);
  assert.deepEqual(config.reviewScreens.map((screen) => screen.id), ["learn", "plan", "wyrmwood", "settings"]);
  assert.ok(config.allowedRoutes.includes("/?workspace=settings"));
});

test("Avery has a required silly two-message Sage conversation rather than only curriculum prompts", async () => {
  const [config, runner] = await Promise.all([readJson("config/writer-in-residence.json"), read(implementation)]);
  assert.equal(config.requiredSageConversation.length, 2);
  assert.match(config.requiredSageConversation[0], /union-mandated snack break/i);
  assert.match(config.requiredSageConversation[1], /ferry itself wants the sandwich/i);
  assert.match(runner, /performSillySageConversation/);
  assert.match(runner, /Ask the Guide/);
  assert.match(runner, /Sage completed the conversational reply/);
});

test("stable writer command delegates to the complete v3 journey and both runtime scripts parse", async () => {
  const entrypoint = await read("scripts/run-writer-in-residence.mjs");
  assert.match(entrypoint, /run-writer-in-residence-v3\.mjs/);
  for (const file of [implementation, visualObserver]) {
    execFileSync(process.execPath, ["--check", fileURLToPath(new URL(`../${file}`, import.meta.url))], { stdio: "pipe" });
  }
});

test("Avery uses only visible accessibility actions while the visual observer is a separate read-only rendered-layout layer", async () => {
  const [runner, observer] = await Promise.all([read(implementation), read(visualObserver)]);
  for (const name of ["browser_snapshot", "browser_click", "browser_type", "browser_navigate"]) assert.match(runner, new RegExp(name));
  assert.match(runner, /Avery never receives browser_evaluate/);
  assert.doesNotMatch(runner, /client\.call\("browser_evaluate"/);
  assert.match(observer, /client\.call\("browser_evaluate"/);
  assert.match(observer, /getBoundingClientRect/);
  assert.match(observer, /getComputedStyle/);
  assert.doesNotMatch(observer, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|document\.cookie/);
});

test("visual review checks current dark look, clipping, overlap, overflow and balance", async () => {
  const observer = await read(visualObserver);
  for (const token of ["lightSurfaces", "clippedControls", "overlaps", "horizontalOverflow", "gapImbalance"]) assert.match(observer, new RegExp(token));
  assert.match(observer, /matte-black \/ teal \/ orange/);
  assert.match(observer, /off-balance/);
  assert.match(observer, /old|older product/i);
});

test("Settings depth probe follows advanced controls down and visibly returns back up without changing configuration", async () => {
  const [runner, config] = await Promise.all([read(implementation), readJson("config/writer-in-residence.json")]);
  assert.ok(config.journeyGoals.some((goal) => /go.*back|back.*up|return/i.test(goal)));
  for (const label of ["Advanced Setup", "Advanced runtime details", "Advanced AI routing", "Cloud and legacy provider overrides", "Back to PlotPickle Settings"]) assert.match(runner, new RegExp(label, "i"));
  assert.match(runner, /settingsDepth\.returnedToSettings/);
  assert.match(runner, /never changes provider\/model\/toggle values/i);
  assert.match(runner, /safeSettingsAction/);
  assert.match(runner, /checkbox.*radio.*combobox/);
});

test("writer model chooses visible labels instead of fragile browser refs and can recover stale actions", async () => {
  const runner = await read(implementation);
  assert.match(runner, /CURRENT VISIBLE CONTROLS/);
  assert.match(runner, /VISIBLE ACCESSIBILITY SNAPSHOT/);
  assert.match(runner, /NEXT\|CLICK\|exact visible control name/);
  assert.match(runner, /PlotPickle resolves the current browser ref itself/);
  assert.match(runner, /mentionedControl/);
  assert.match(runner, /failedTargets/);
  assert.match(runner, /nextSafeRoute/);
  assert.match(runner, /safely moved to/);
  assert.match(runner, /consecutiveTurnErrors >= 3/);
});

test("writer feedback remains local-first and only explicit medium/high actionable findings reach GitHub/Modem", async () => {
  const [runner, config] = await Promise.all([read(implementation), readJson("config/writer-in-residence.json")]);
  assert.equal(config.minimumPromotedSeverity, "medium");
  assert.equal(config.maxPromotedFindings, 8);
  assert.match(runner, /item\.actionable && severityRank\[item\.severity\] >= minimumRank/);
  assert.match(runner, /rendered-visual-observer/);
  assert.match(runner, /settings-depth-probe/);
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
