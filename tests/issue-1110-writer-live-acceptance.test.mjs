import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { writerExplorationAcceptance } from "../scripts/writer-e2e-acceptance-policy.mjs";
import { writerObserverFunctionSources } from "../scripts/writer-journey-final-state.mjs";
import { normalizeWriterSnapshot } from "../scripts/writer-snapshot-normalizer.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1110 normalizes live LEARN topic accessible names without touching completion controls", () => {
  const raw = [
    '  - button "Foundations 0 of 11 complete" [expanded] [ref=e10]',
    '    - button "Mark Premise and Story Promise complete" [ref=e11]',
    '    - button "Mark Character Want complete" [ref=e12]',
    '  - button "World · 0 of 5 complete" [collapsed] [ref=e20]',
    '    - button "Mark Setting as Pressure complete" [ref=e21]',
  ].join("\n");
  const normalized = normalizeWriterSnapshot(raw);
  assert.match(normalized, /button "Foundations" \[expanded\] \[ref=e10\]/);
  assert.match(normalized, /button "World" \[collapsed\] \[ref=e20\]/);
  assert.match(normalized, /button "Mark Premise and Story Promise complete" \[ref=e11\]/);
  assert.match(normalized, /button "Mark Setting as Pressure complete" \[ref=e21\]/);
});

test("#1110 normalizer preserves unrelated visible controls", () => {
  const raw = [
    '  - button "Marquee locked until Foundations" [ref=e1]',
    '  - textbox "Ask in your own words" [ref=e2]',
    '  - button "Ask the Guide" [ref=e3]',
  ].join("\n");
  assert.equal(normalizeWriterSnapshot(raw), raw);
});

test("#1110 every read-only observer page function compiles before browser_evaluate", () => {
  const sources = writerObserverFunctionSources();
  assert.deepEqual(Object.keys(sources).sort(), [
    "inspectBuildPage",
    "inspectDashboardPage",
    "inspectLearnPage",
    "inspectPlanPage",
    "inspectWorldPlanPage",
    "readProjectPage",
  ].sort());
  for (const [name, source] of Object.entries(sources)) {
    assert.doesNotThrow(() => Function(`return (${source});`)(), `${name} must be valid standalone JavaScript`);
  }
});

test("#1110 observer functions remain read-only", () => {
  const joined = Object.values(writerObserverFunctionSources()).join("\n");
  assert.match(joined, /localStorage\.getItem/);
  assert.doesNotMatch(joined, /localStorage\.(?:setItem|removeItem|clear)/);
  assert.doesNotMatch(joined, /sessionStorage\.(?:setItem|removeItem|clear)/);
});

test("#1110 story-frontier acceptance requires screen coverage and Sage but not exploratory Settings depth", () => {
  const report = {
    finishedReason: "incomplete-journey",
    journeyCoverage: { complete: true },
    settingsDepth: {
      advancedSetup: false,
      advancedRuntime: false,
      advancedRouting: true,
      returnedToSettings: true,
    },
    exploratoryExitCode: 1,
  };
  const result = writerExplorationAcceptance(report, { requested: 2, completed: 2, passed: true });
  assert.equal(result.passed, true);
  assert.equal(result.settingsDepthComplete, false);
  assert.equal(result.exploratoryExitCode, 1);
});

test("#1110 missing Sage conversation blocks final story-frontier acceptance", () => {
  const report = { finishedReason: "incomplete-journey", journeyCoverage: { complete: true }, settingsDepth: {} };
  const result = writerExplorationAcceptance(report, { requested: 2, completed: 0, passed: false });
  assert.equal(result.passed, false);
  assert.equal(result.sageComplete, false);
});

test("#1110 fatal v4 runner failure still blocks acceptance", () => {
  const report = { finishedReason: "runner-error", journeyCoverage: { complete: true }, settingsDepth: {} };
  const result = writerExplorationAcceptance(report, { requested: 2, completed: 2, passed: true });
  assert.equal(result.passed, false);
  assert.equal(result.runnerFatal, true);
});

test("#1110 completion driver stays UI-only while Sage retry stays UI-only", async () => {
  const [completion, sage, wrapper, recovery] = await Promise.all([
    read("scripts/writer-journey-completion.mjs"),
    read("scripts/writer-sage-acceptance.mjs"),
    read("scripts/run-writer-in-residence-e2e.mjs"),
    read("scripts/writer-in-residence-runtime-recovery.mjs"),
  ]);
  assert.doesNotMatch(completion, /browser_evaluate|localStorage\.(?:getItem|setItem|removeItem)/);
  assert.doesNotMatch(sage, /browser_evaluate|localStorage|sessionStorage/);
  assert.match(wrapper, /runSageAcceptance/);
  assert.match(wrapper, /writerExplorationAcceptance/);
  assert.match(wrapper, /auditError/);
  assert.match(recovery, /normalizeWriterSnapshot/);
});
