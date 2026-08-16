import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sourceInteractionCounts, snapshotControlRefs } from "../scripts/exhaustive-ui-control-audit.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));

test("Pi accepts a hardware-friendly local coding model and startup tries to load it automatically", async () => {
  const [repair, ensure, policy, startup] = await Promise.all([
    read("scripts/run-uat-repair-agent.mjs"),
    read("scripts/ensure-local-repair-model.mjs"),
    read("scripts/developer-repair-model-policy.mjs"),
    read("build/uat-discovery-plugin.ts"),
  ]);

  for (const source of [repair, policy]) assert.match(source, /qwen2\.5-coder-7b/i);
  assert.match(ensure, /ollamaInstalledModels/);
  assert.match(ensure, /warmOllama/);
  assert.match(ensure, /downloadedLmStudioModels/);
  assert.match(ensure, /lms.*load|\["load", model/i);
  assert.match(repair, /PLOTPICKLE_REPAIR_MODEL/);
  assert.match(repair, /PLOTPICKLE_REPAIR_ENDPOINT/);
  assert.match(repair, /rankApprovedCodingModel/);
  assert.match(startup, /ensureDeveloperRepairModel/);
  assert.match(startup, /Developer repair model/);
  assert.match(startup, /PLOTPICKLE_REPAIR_AUTOLOAD/);
  assert.doesNotMatch(`${repair}\n${ensure}`, /api\.openai\.com|openrouter\.ai|api\.anthropic\.com/);
});

test("local repair readiness may bootstrap only the approved lightweight Pi model through local Ollama", async () => {
  const ensure = await read("scripts/ensure-local-repair-model.mjs");
  assert.match(ensure, /DEFAULT_OLLAMA_PI_MODEL = "qwen2\.5-coder:7b"/);
  assert.match(ensure, /PLOTPICKLE_REPAIR_AUTO_DOWNLOAD !== "0"/);
  assert.match(ensure, /http:\/\/127\.0\.0\.1:11434\/api\/pull/);
  assert.match(ensure, /approvedCodingModel\(model\)/);
  assert.match(ensure, /DOWNLOADING/);
  assert.match(ensure, /process\.exitCode = 2/);
  assert.doesNotMatch(ensure, /api\.openai\.com|openrouter\.ai|api\.anthropic\.com/);
});

test("exhaustive UAT covers entry plus every active slim-product screen and advanced Settings", async () => {
  const config = await readJson("config/exhaustive-ui-uat.json");
  assert.deepEqual(config.screens.map((screen) => screen.id), [
    "entry",
    "community",
    "learn",
    "plan",
    "wyrmwood",
    "settings",
    "advanced-ai-routing",
  ]);
  const settings = config.screens.find((screen) => screen.id === "settings");
  assert.equal(settings.testDuplicateInstances, true);
  assert.ok(settings.maxInteractions >= 150);
  assert.ok(settings.requireRoles.includes("button"));
  assert.ok(settings.requireRoles.includes("combobox"));
});

test("code-aware UAT reads source and inventories real interaction handlers", async () => {
  const counts = sourceInteractionCounts(`
    <button onClick={go}>Go</button>
    <select onChange={change}><option>A</option></select>
    <input onChange={type} />
    <form onSubmit={save}><textarea /></form>
    <details><summary>Advanced</summary></details>
    <a href="/next">Next</a>
  `);
  assert.equal(counts.buttons, 1);
  assert.equal(counts.selects, 1);
  assert.equal(counts.inputs, 1);
  assert.equal(counts.textareas, 1);
  assert.equal(counts.summaries, 1);
  assert.equal(counts.links, 1);
  assert.equal(counts.totalMarkupControls, 6);
  assert.equal(counts.onClick, 1);
  assert.equal(counts.onChange, 2);
  assert.equal(counts.onSubmit, 1);
});

test("exhaustive UAT can address duplicate visible controls without looping on the same ref", () => {
  const controls = snapshotControlRefs(`
    - button "Next" [ref=e1]
    - button "Next" [ref=e2]
    - combobox "Running local AI" [ref=e3]
    - checkbox "Use PlotPickle-managed llama.cpp" [ref=e4]
  `);
  assert.equal(controls[0].occurrence, 0);
  assert.equal(controls[1].occurrence, 1);
  assert.equal(controls[0].ref, "e1");
  assert.equal(controls[1].ref, "e2");
  assert.equal(controls[2].role, "combobox");
  assert.equal(controls[3].role, "checkbox");
});

test("exhaustive UI runner proves selectors, inputs, toggles, responses, restoration and no-loop completion", async () => {
  const [audit, runner, closedLoop] = await Promise.all([
    read("scripts/exhaustive-ui-control-audit.mjs"),
    read("scripts/run-exhaustive-ui-uat.mjs"),
    read("scripts/run-uat-closed-loop.mjs"),
  ]);

  for (const token of ["browser_select_option", "browser_type", "browser_click", "checkbox", "radio", "combobox", "spinbutton"]) assert.match(audit, new RegExp(token));
  assert.match(audit, /transactional/);
  assert.match(audit, /was restored/);
  assert.match(audit, /Each distinct rendered control is attempted at most once per screen/);
  assert.match(audit, /interaction ceiling/i);
  assert.match(audit, /produces no observable result/i);
  assert.match(audit, /longRunningActionPatterns/);
  assert.match(runner, /code-aware inspector \+ rendered UI\/UX/);
  assert.match(runner, /dead controls/i);
  assert.match(closedLoop, /run-exhaustive-ui-uat\.mjs/);
  assert.match(closedLoop, /exhaustiveUiUx/);
  assert.match(closedLoop, /exhaustiveCoverage/);
});

test("Settings safety boundary still allows every safe selector and pill to be tested", async () => {
  const [config, audit] = await Promise.all([
    readJson("config/exhaustive-ui-uat.json"),
    read("scripts/exhaustive-ui-control-audit.mjs"),
  ]);
  assert.ok(config.unsafeControlLabels.some((label) => /delete/i.test(label)));
  assert.ok(config.credentialPatterns.some((label) => /private key/i.test(label)));
  assert.match(audit, /Settings selectors, toggles and inputs are exercised transactionally/);
  assert.match(audit, /hardFailOnDeadSafeControl|dead/i);
  assert.doesNotMatch(audit, /localStorage|sessionStorage|document\.cookie/);
});

test("focused UAT owns the Pi autoload and exhaustive UI regression", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const owners = ["startup", "settings", "community", "foundations-learn", "plan", "wyrmwood"];
  for (const id of owners) {
    const area = registry.areas.find((item) => item.id === id);
    assert.ok(area, `missing ${id}`);
    assert.ok(area.tests.includes("tests/pi-local-model-exhaustive-uat.test.mjs"), `${id} does not own exhaustive UAT contract`);
  }
});
