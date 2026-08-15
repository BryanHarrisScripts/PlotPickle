import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EXPECTED_BROWSER_SCREENS,
  MIN_SNAPSHOT_LENGTH,
  assessAutopilotEvidence,
  parseAcceptanceReport,
  parseContinuityReport,
  safeSlug,
} from "../lib/uat-autopilot.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function browserReport({ status = "PASS", navigation = "visible workspace control", screenshot = "captured", consoleError = false } = {}) {
  const rows = EXPECTED_BROWSER_SCREENS.map((screen) => `| ${screen} | ${status} | ${navigation} | ${safeSlug(screen)} / http://127.0.0.1:4173/ | ${screenshot} |`).join("\n");
  return `# PlotPickle Local Human Acceptance Test\n\nOverall: ${status === "FAIL" ? "FAIL" : status}\n\n| Screen | Result | Navigation | Active workspace / URL | Screenshot |\n| --- | --- | --- | --- | --- |\n${rows}${consoleError ? "\n\n- WARN Dashboard: Browser console reported an error.\n  Console: Error: test failure" : ""}\n`;
}

function snapshotLengths() {
  return Object.fromEntries(EXPECTED_BROWSER_SCREENS.map((screen, index) => [
    `${String(index + 1).padStart(2, "0")}-${safeSlug(screen)}.md`,
    MIN_SNAPSHOT_LENGTH + 100,
  ]));
}

const continuityPass = `# PlotPickle UI Continuity Agent report\n\n## Summary\n\nScreens inspected: 15\nScreens with no findings: 15\nFindings: 0 (0 errors, 0 warnings)\n`;

const healthyAgents = {
  statusOk: true,
  mastraReady: true,
  sageRegistered: true,
  foundationsRegistered: true,
  fastAvailable: true,
  qualityAvailable: true,
  sageAttempted: true,
  sagePassed: true,
  plannerAttempted: true,
  plannerPassed: true,
};

test("UAT autopilot parses the existing deterministic browser and UI continuity reports", () => {
  const browser = parseAcceptanceReport(browserReport());
  assert.equal(browser.overall, "PASS");
  assert.equal(browser.rows.length, EXPECTED_BROWSER_SCREENS.length);
  assert.equal(browser.consoleErrors, false);

  const continuity = parseContinuityReport(continuityPass);
  assert.deepEqual(continuity, { screens: 15, findings: 0, errors: 0, warnings: 0, runtimeError: "" });
});

test("a clean full evidence set passes without human rediscovery of deterministic defects", () => {
  const result = assessAutopilotEvidence({
    browser: parseAcceptanceReport(browserReport()),
    continuity: parseContinuityReport(continuityPass),
    snapshotLengths: snapshotLengths(),
    learn: { ok: true, status: 200, bodyLength: 12_000 },
    agents: healthyAgents,
  });

  assert.equal(result.overall, "PASS");
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.warnings, []);
});

test("console errors, missing screenshots, thin content, visual errors and malformed planner JSON are merge blockers", () => {
  const thinSnapshots = snapshotLengths();
  thinSnapshots["03-storyboard.md"] = 10;
  const continuity = parseContinuityReport(`Screens inspected: 15\nFindings: 2 (1 errors, 1 warnings)\n`);
  const result = assessAutopilotEvidence({
    browser: parseAcceptanceReport(browserReport({ screenshot: "missing", consoleError: true })),
    continuity,
    snapshotLengths: thinSnapshots,
    learn: { ok: true, status: 200, bodyLength: 12_000 },
    agents: { ...healthyAgents, plannerPassed: false, plannerMessage: "Structured JSON is missing output-2." },
  });

  assert.equal(result.overall, "FAIL");
  assert.ok(result.blockers.some((item) => /console errors/i.test(item)));
  assert.ok(result.blockers.some((item) => /missing screenshot evidence/i.test(item)));
  assert.ok(result.blockers.some((item) => /Storyboard accessibility evidence/i.test(item)));
  assert.ok(result.blockers.some((item) => /visual\/UX regression/i.test(item)));
  assert.ok(result.blockers.some((item) => /Structured JSON is missing output-2/i.test(item)));
});

test("recovery navigation and unavailable optional local models remain visible warnings", () => {
  const result = assessAutopilotEvidence({
    browser: parseAcceptanceReport(browserReport({ status: "WARN", navigation: "direct recovery navigation" })),
    continuity: parseContinuityReport(continuityPass),
    snapshotLengths: snapshotLengths(),
    learn: { ok: true, status: 200, bodyLength: 12_000 },
    agents: {
      statusOk: true,
      mastraReady: true,
      sageRegistered: true,
      foundationsRegistered: true,
      fastAvailable: false,
      qualityAvailable: false,
      sageAttempted: false,
      plannerAttempted: false,
    },
  });

  assert.equal(result.overall, "WARN");
  assert.ok(result.warnings.some((item) => /recovery navigation/i.test(item)));
  assert.ok(result.warnings.some((item) => /Fast local model is unavailable/i.test(item)));
  assert.ok(result.warnings.some((item) => /Quality local model is unavailable/i.test(item)));
});

test("the runner composes existing PlotPickle UAT instead of creating a second browser architecture", async () => {
  const source = await read("scripts/run-uat-autopilot.mjs");
  assert.match(source, /run-local-browser-uat\.mjs/);
  assert.match(source, /ui-continuity-agent\.mjs/);
  assert.match(source, /--scope", "full"/);
  assert.match(source, /autopilot-report\.json/);
  assert.match(source, /workspace=learn/);
  assert.match(source, /agentId: "curriculum-guide"/);
  assert.match(source, /agentId: "foundations-planner"/);
  assert.match(source, /foundationFieldIds: \["output-1", "output-2"\]/);
  assert.doesNotMatch(source, /api\.openai\.com|anthropic\.com|paid/i);
});
