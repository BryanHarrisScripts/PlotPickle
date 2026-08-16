import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRenderedEvaluateText } from "../scripts/writer-visual-observer-v3.mjs";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");
const readJson = async (file) => JSON.parse(await read(file));
const implementation = "scripts/run-writer-in-residence-v4.mjs";
const recovery = "scripts/writer-in-residence-runtime-recovery.mjs";
const visualObserver = "scripts/writer-visual-observer-v3.mjs";

test("Writer-in-Residence is a disclosed synthetic writer with a complete active-product mission", async () => {
  const config = await readJson("config/writer-in-residence.json");
  assert.equal(config.persona.id, "avery-north");
  assert.match(config.persona.disclosure, /Synthetic writer persona/i);
  assert.match(config.storySeed.premise, /ferry operator/i);
  assert.deepEqual(config.reviewScreens.map((screen) => screen.id), ["learn", "plan", "wyrmwood", "settings"]);
  assert.ok(config.allowedRoutes.includes("/?workspace=settings"));
});

test("Avery keeps the required silly two-message Sage conversation", async () => {
  const [config, runner] = await Promise.all([readJson("config/writer-in-residence.json"), read(implementation)]);
  assert.equal(config.requiredSageConversation.length, 2);
  assert.match(config.requiredSageConversation[0], /union-mandated snack break/i);
  assert.match(config.requiredSageConversation[1], /ferry itself wants the sandwich/i);
  assert.match(runner, /performSillySageConversation/);
  assert.match(runner, /Ask the Guide/);
  assert.match(runner, /Phase 1 · silly Sage conversation/);
});

test("stable writer command installs local recovery before v4 and all runtime scripts parse", async () => {
  const entrypoint = await read("scripts/run-writer-in-residence.mjs");
  assert.ok(entrypoint.indexOf("writer-in-residence-runtime-recovery.mjs") < entrypoint.indexOf("run-writer-in-residence-v4.mjs"));
  for (const file of ["scripts/run-writer-in-residence.mjs", implementation, recovery, visualObserver]) {
    execFileSync(process.execPath, ["--check", fileURLToPath(new URL(`../${file}`, import.meta.url))], { stdio: "pipe" });
  }
});

test("#657 cannot call two Sage probes a completed writer journey", async () => {
  const runner = await read(implementation);
  assert.match(runner, /minimumTurnsPerArea = Math\.max\(2/);
  assert.match(runner, /for \(const mission of config\.reviewScreens\)/);
  assert.match(runner, /areaCounts\[mission\.id\] >= minimumTurnsPerArea/);
  assert.match(runner, /journey\.complete && sageConversation\.completed === sageConversation\.requested/);
  assert.match(runner, /Writer-in-Residence \$\{state\}/);
  assert.match(runner, /INCOMPLETE/);
});

test("#660 retries the real local HTTP 400 no-text response across Fast and Quality", async () => {
  const source = await read(recovery);
  assert.match(source, /body\?\.provider !== "local"/);
  assert.match(source, /body\?\.agentId !== "creative-director"/);
  assert.match(source, /provider returned no text/);
  assert.match(source, /return !response\.ok &&/);
  assert.doesNotMatch(source, /response\.status >= 500/);
  assert.match(source, /roles = \[preferred, alternateRole\(preferred\), preferred, alternateRole\(preferred\)\]/);
  assert.match(source, /provider: "local", modelRole: role/);
  assert.match(source, /retryableFetchError/);
  assert.match(source, /Writer local recovery/);
  assert.doesNotMatch(source, /provider:\s*"openai"|provider:\s*"minimax"/i);
});

test("#657 gives every active area real successful writer turns instead of counting visual observer visits", async () => {
  const runner = await read(implementation);
  assert.match(runner, /Phase 2 · Avery four-area journey/);
  assert.match(runner, /writerVisitedScreens\.add\(mission\.id\)/);
  assert.match(runner, /areaCounts\[mission\.id\] \+= 1/);
  assert.match(runner, /areaCounts\[mission\.id\] >= minimumTurnsPerArea/);
  assert.doesNotMatch(runner, /visitedScreens\.add\(screen\.id\)/);
});

test("#660 normalizes only known visible Settings disclosure refs for deterministic down/up probes", async () => {
  const source = await read(recovery);
  for (const label of ["Advanced Setup", "Advanced runtime details", "Cloud and legacy provider overrides"]) assert.match(source, new RegExp(label, "i"));
  assert.match(source, /name !== "browser_snapshot"/);
  assert.match(source, /const ref = line\.match/);
  assert.match(source, /normalizeDisclosureLine\(line, label\)/);
  assert.match(source, /button \"\$\{label\}\" \[ref=\$\{ref\}\]/);
  assert.match(source, /No hidden DOM\/state is exposed/);
});

test("#657 screenshots are basename-safe and visual failures cannot abort the journey", async () => {
  const runner = await read(implementation);
  assert.match(runner, /async function safeScreenshot/);
  assert.match(runner, /filename: `\$\{name\}\.png`/);
  assert.doesNotMatch(runner, /filename: `writer-in-residence\//);
  assert.match(runner, /Phase 4 · rendered visual review/);
  assert.match(runner, /failures are nonfatal and recorded/);
});

test("#660 visual observer parses Playwright Result objects and JSON-encoded strings", () => {
  const direct = parseRenderedEvaluateText('### Result\n{"theme":"dark","horizontalOverflow":0}\n### Console');
  assert.equal(direct.theme, "dark");
  const encodedPayload = JSON.stringify(JSON.stringify({ theme: "dark", horizontalOverflow: 3 }));
  const encoded = parseRenderedEvaluateText(`### Result\n${encodedPayload}`);
  assert.equal(encoded.theme, "dark");
  assert.equal(encoded.horizontalOverflow, 3);
});

test("#662 and #663 visual overlap review ignores trivial geometry and reports meaningful hit-area evidence", async () => {
  const observer = await read(visualObserver);
  assert.match(observer, /pointerEvents !== 'none'/);
  assert.match(observer, /!node\.matches\(':disabled'\)/);
  assert.match(observer, /width <= 8 \|\| height <= 8/);
  assert.match(observer, /ratio < 0\.08/);
  assert.match(observer, /overlapRatio/);
  assert.match(observer, /smaller hit area/);
});

test("Avery uses visible accessibility actions while the visual observer remains a separate read-only rendered-layout layer", async () => {
  const [runner, observer] = await Promise.all([read(implementation), read(visualObserver)]);
  for (const name of ["browser_snapshot", "browser_click", "browser_type", "browser_navigate"]) assert.match(runner, new RegExp(name));
  assert.match(runner, /Avery never receives browser_evaluate/);
  assert.doesNotMatch(runner, /client\.call\("browser_evaluate"/);
  assert.match(observer, /client\.call\("browser_evaluate"/);
  assert.match(observer, /return JSON\.stringify\(payload\)/);
  assert.doesNotMatch(observer, /localStorage|sessionStorage|fetch\(|XMLHttpRequest|document\.cookie/);
});

test("Settings depth probe follows advanced controls down and back up without changing configuration", async () => {
  const runner = await read(implementation);
  for (const label of ["Advanced Setup", "Advanced runtime details", "Advanced AI routing", "Cloud and legacy provider overrides", "Back to PlotPickle Settings"]) assert.match(runner, new RegExp(label, "i"));
  assert.match(runner, /Phase 3 · Settings depth\/down-up/);
  assert.match(runner, /checkbox.*radio.*combobox/);
  assert.match(runner, /unsafeControl/);
});

test("#664 advanced AI routing belongs to the current dark PlotPickle surface family", async () => {
  const [page, settings, routing] = await Promise.all([
    read("app/ai-routing/page.tsx"),
    read("app/sage-settings-workspace.tsx"),
    read("app/ai-routing-panel.module.css"),
  ]);
  assert.match(page, /redirect\("\/\?workspace=settings#settings-routing"\)/);
  assert.match(settings, /id="settings-routing"/);
  assert.match(settings, /<AiRoutingPanel \/>/);
  assert.match(routing, /--routing-bg: #090a0b/);
  assert.match(routing, /--routing-teal: #35c9b8/);
  assert.match(routing, /--routing-gold: #c89446/);
  assert.doesNotMatch(routing, /#f4faf9/i);
});

test("visual review checks current dark look, clipping, overlap, overflow and balance", async () => {
  const observer = await read(visualObserver);
  for (const token of ["lightSurfaces", "clippedControls", "overlaps", "horizontalOverflow", "gapImbalance"]) assert.match(observer, new RegExp(token));
  assert.match(observer, /off-balance/);
  assert.match(observer, /extractPageState/);
});

test("writer feedback stays local-first and only explicit medium/high actionable findings reach GitHub/Modem", async () => {
  const [runner, config] = await Promise.all([read(implementation), readJson("config/writer-in-residence.json")]);
  assert.equal(config.minimumPromotedSeverity, "medium");
  assert.equal(config.maxPromotedFindings, 8);
  assert.match(runner, /item\.actionable && severityRank\[item\.severity\] >= minimumRank/);
  assert.match(runner, /rendered-visual-observer/);
  assert.match(runner, /writer-in-residence-report\.json/);
});

test("GitHub reporter labels synthetic feedback for Modem and never auto-repairs it", async () => {
  const reporter = await read("scripts/report-writer-in-residence.mjs");
  assert.match(reporter, /synthetic-writer/);
  assert.match(reporter, /product-feedback/);
  assert.match(reporter, /needs-triage/);
  assert.doesNotMatch(reporter, /--label", "uat:auto-repair"/);
  assert.doesNotMatch(reporter, /pr", "create"/);
});

test("focused Startup UAT owns the Writer-in-Residence contract", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup?.tests.includes("tests/issue-653-writer-in-residence.test.mjs"));
});
